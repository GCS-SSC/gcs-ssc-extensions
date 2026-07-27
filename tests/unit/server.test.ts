import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import { createEvent } from 'h3'
import {
  DummyDriver,
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
  type Transaction
} from 'kysely'
import { describe, expect, it, vi } from 'vitest'
import {
  createGcsExtensionRouteContext,
  GCS_EXTENSION_AGREEMENT_DELETE_GUARD_HOOK,
  GCS_EXTENSION_AGREEMENT_LIFECYCLE_LOCK_HOOK,
  GCS_EXTENSION_AGREEMENT_STREAM_CHANGE_GUARD_HOOK,
  GCS_EXTENSION_DISABLE_GUARD_HOOK,
  getGcsExtensionRequestHeader,
  lockGcsExtensionLifecycleScope,
  readGcsExtensionRequestBody,
  registerGcsExtensionAgreementDeleteGuard,
  registerGcsExtensionAgreementLifecycleLock,
  registerGcsExtensionAgreementStreamChangeGuard,
  registerGcsExtensionDisableGuard,
  resolveExtensionAgreementByNumber,
  resolveExtensionStreamContext,
  setEncryptedExtensionSecret,
  type ExtensionSecretDatabase,
  type GcsExtensionRouteEvent
} from '../../src/server'

interface SecretTestDatabase extends ExtensionSecretDatabase {
  test_audit: {
    id: string
  }
}

const createSecretTestDb = (
  driver: DummyDriver = new DummyDriver()
): Kysely<SecretTestDatabase> => new Kysely<SecretTestDatabase>({
  dialect: {
    createAdapter: () => new PostgresAdapter(),
    createDriver: () => driver,
    createIntrospector: db => new PostgresIntrospector(db),
    createQueryCompiler: () => new PostgresQueryCompiler()
  }
})

const createAgreementLookupDb = (agreement: unknown) => {
  const query = {
    select: vi.fn(() => query),
    where: vi.fn(() => query),
    executeTakeFirst: vi.fn(async () => agreement)
  }
  const db = {
    selectFrom: vi.fn(() => query)
  }

  return { db, query }
}

const createTestRouteEvent = (
  body: Record<string, unknown>,
  headerValue: string
): GcsExtensionRouteEvent => {
  const request = new IncomingMessage(new Socket())
  request.method = 'POST'
  request.headers = {
    'content-type': 'application/json',
    'x-extension-test': headerValue
  }

  return Object.assign(
    createEvent(request, new ServerResponse(request)),
    {
      context: {
        $db: {}
      },
      _requestBody: JSON.stringify(body)
    }
  )
}

describe('extension SDK server helpers', () => {
  it('requires an active owning agency when resolving an extension stream', async () => {
    const query = {
      innerJoin: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn(async () => undefined)
    }
    const db = { selectFrom: vi.fn(() => query) }

    await expect(resolveExtensionStreamContext(db as any, 'stream-1')).resolves.toBeNull()
    expect(query.innerJoin).toHaveBeenCalledWith(
      'Agency_Profile',
      'Agency_Profile.id',
      'Transfer_Payment_Profile.egcs_tp_agency'
    )
    expect(query.where).toHaveBeenCalledWith('Agency_Profile._deleted', '=', false)
  })
  it('locks agency scope before stream scope with stable extension-specific keys', async () => {
    const driver = new DummyDriver()
    const db = createSecretTestDb(driver)
    const executeQuery = vi.fn(async () => ({ rows: [] }))
    vi.spyOn(driver, 'acquireConnection').mockResolvedValue({
      executeQuery,
      streamQuery: vi.fn()
    } as never)

    try {
      await db.transaction().execute(async trx => {
        await lockGcsExtensionLifecycleScope(
          trx as unknown as Transaction<unknown>,
          'gcs-test',
          'agency-1',
          'stream-1'
        )
      })

      expect(executeQuery).toHaveBeenCalledTimes(2)
      expect(executeQuery.mock.calls.map(([query]) => query.parameters)).toEqual([
        ['gcs-extension-lifecycle:gcs-test:agency:agency-1'],
        ['gcs-extension-lifecycle:gcs-test:stream:stream-1']
      ])
    } finally {
      await db.destroy()
    }
  })

  it('reads request bodies and headers from raw H3 events and route contexts', async () => {
    const rawEvent = createTestRouteEvent({ source: 'raw-event' }, 'raw-header')
    const contextEvent = createTestRouteEvent({ source: 'route-context' }, 'context-header')
    const routeContext = createGcsExtensionRouteContext(contextEvent)

    await expect(readGcsExtensionRequestBody(rawEvent)).resolves.toEqual({ source: 'raw-event' })
    expect(getGcsExtensionRequestHeader(rawEvent, 'x-extension-test')).toBe('raw-header')
    await expect(readGcsExtensionRequestBody(routeContext)).resolves.toEqual({ source: 'route-context' })
    expect(getGcsExtensionRequestHeader(routeContext, 'x-extension-test')).toBe('context-header')
  })

  it('exposes the host-owned ordered write authorization phases', () => {
    const event = createTestRouteEvent({}, 'header')
    const writeAuthorization = {
      lockAuthState: vi.fn(async () => undefined),
      authorizeCurrentScope: vi.fn(async () => undefined),
      authorizeCurrentEntity: vi.fn(async () => undefined),
      lockAndAuthorizeAgreement: vi.fn(async () => true)
    }
    const agreementAccess = {
      listVisibleOptions: vi.fn(async () => [])
    }
    event.context.gcsExtension = {
      config: {},
      writeAuthorization,
      agreementAccess
    }

    expect(createGcsExtensionRouteContext(event).writeAuthorization).toBe(writeAuthorization)
    expect(createGcsExtensionRouteContext(event).agreementAccess).toBe(agreementAccess)
  })

  it('rejects structural SDK event mocks at the H3 request-helper boundary', async () => {
    const event: GcsExtensionRouteEvent = {
      context: {
        $db: {}
      }
    }

    await expect(readGcsExtensionRequestBody(event)).rejects.toThrow('require a host H3 event')
    expect(() => getGcsExtensionRequestHeader(event, 'x-extension-test')).toThrow('require a host H3 event')
  })

  it.each([
    'not-base64',
    'AAAA=AAA'
  ])('rejects malformed base64 secret root keys before database access: %s', async (rootKey) => {
    const db = createSecretTestDb()
    const selectFrom = vi.spyOn(db, 'selectFrom')

    try {
      await expect(setEncryptedExtensionSecret(db, {
        rootKey,
        extensionKey: 'gcs-test',
        ownerType: 'agency',
        ownerId: 'agency-1',
        secretKey: 'credential-1',
        value: {
          token: 'private'
        }
      })).rejects.toThrow('base64')
      expect(selectFrom).not.toHaveBeenCalled()
    } finally {
      await db.destroy()
    }
  })

  it('resolves agreements from the agreement profile table', async () => {
    const { db, query } = createAgreementLookupDb({
      id: 42,
      egcs_fc_fundingagreement: 'AGR-2026-001',
      egcs_fc_transferpaymentstream: 7
    })

    await expect(resolveExtensionAgreementByNumber(db as never, 'AGR-2026-001', '7')).resolves.toEqual({
      id: '42',
      agreementNumber: 'AGR-2026-001',
      streamId: '7'
    })

    expect(db.selectFrom).toHaveBeenCalledWith('Funding_Case_Agreement_Profile')
    expect(query.where).toHaveBeenCalledWith('egcs_fc_fundingagreement', '=', 'AGR-2026-001')
    expect(query.where).toHaveBeenCalledWith('_deleted', '=', false)
    expect(query.where).toHaveBeenCalledWith('egcs_fc_transferpaymentstream', '=', '7')
  })

  it('returns null when no agreement number is resolved', async () => {
    const { db } = createAgreementLookupDb({
      id: 42,
      egcs_fc_fundingagreement: null,
      egcs_fc_transferpaymentstream: 7
    })

    await expect(resolveExtensionAgreementByNumber(db as never, 'AGR-2026-001')).resolves.toBeNull()
  })

  it('dispatches disable guards only for their registered extension key', async () => {
    let registeredName = ''
    let registeredHook: ((payload: {
      extensionKey: string
      scope: 'agency'
      event: unknown
      db: Transaction<unknown>
      agencyId: string
    }) => Promise<void>) | undefined
    const guard = vi.fn()
    registerGcsExtensionDisableGuard('gcs-test', guard, {
      hooks: {
        hook: (name: string, handler: typeof registeredHook) => {
          registeredName = name
          registeredHook = handler
        }
      }
    } as never)
    const payload = {
      extensionKey: 'other-extension',
      scope: 'agency' as const,
      event: {},
      db: {} as Transaction<unknown>,
      agencyId: 'agency-1'
    }

    await registeredHook?.(payload)
    expect(guard).not.toHaveBeenCalled()
    await registeredHook?.({
      ...payload,
      extensionKey: 'gcs-test'
    })

    expect(registeredName).toBe(GCS_EXTENSION_DISABLE_GUARD_HOOK)
    expect(guard).toHaveBeenCalledOnce()
  })

  it('injects the registered extension key into agreement stream change guards', async () => {
    let registeredName = ''
    let registeredHook: ((payload: {
      event: unknown
      db: Transaction<unknown>
      agreementId: string
      agencyId: string
      currentStreamId: string
      nextStreamId: string
    }) => Promise<void>) | undefined
    const guard = vi.fn()
    registerGcsExtensionAgreementStreamChangeGuard('gcs-test', guard, {
      hooks: {
        hook: (name: string, handler: typeof registeredHook) => {
          registeredName = name
          registeredHook = handler
        }
      }
    } as never)
    const payload = {
      event: {},
      db: {} as Transaction<unknown>,
      agreementId: 'agreement-1',
      agencyId: 'agency-1',
      currentStreamId: 'stream-1',
      nextStreamId: 'stream-2'
    }

    await registeredHook?.(payload)

    expect(registeredName).toBe(GCS_EXTENSION_AGREEMENT_STREAM_CHANGE_GUARD_HOOK)
    expect(guard).toHaveBeenCalledWith({
      ...payload,
      extensionKey: 'gcs-test'
    })
  })

  it('injects the registered extension key into pre-row agreement lifecycle locks', async () => {
    let registeredName = ''
    let registeredHook: ((payload: {
      event: unknown
      db: Transaction<unknown>
      agreementId: string
      agencyId: string
      currentStreamId: string
      targetStreamIds: string[]
    }) => Promise<void>) | undefined
    const handler = vi.fn()
    registerGcsExtensionAgreementLifecycleLock('gcs-test', handler, {
      hooks: {
        hook: (name: string, hook: typeof registeredHook) => {
          registeredName = name
          registeredHook = hook
        }
      }
    } as never)
    const payload = {
      event: {},
      db: {} as Transaction<unknown>,
      agreementId: 'agreement-1',
      agencyId: 'agency-1',
      currentStreamId: 'stream-1',
      targetStreamIds: ['stream-1', 'stream-2']
    }

    await registeredHook?.(payload)

    expect(registeredName).toBe(GCS_EXTENSION_AGREEMENT_LIFECYCLE_LOCK_HOOK)
    expect(handler).toHaveBeenCalledWith({
      ...payload,
      extensionKey: 'gcs-test'
    })
  })

  it('injects the registered extension key into locked agreement deletion guards', async () => {
    let registeredName = ''
    let registeredHook: ((payload: {
      event: unknown
      db: Transaction<unknown>
      agreementId: string
      agencyId: string
      streamId: string
    }) => Promise<void>) | undefined
    const guard = vi.fn()
    registerGcsExtensionAgreementDeleteGuard('gcs-test', guard, {
      hooks: {
        hook: (name: string, hook: typeof registeredHook) => {
          registeredName = name
          registeredHook = hook
        }
      }
    } as never)
    const payload = {
      event: {},
      db: {} as Transaction<unknown>,
      agreementId: 'agreement-1',
      agencyId: 'agency-1',
      streamId: 'stream-1'
    }

    await registeredHook?.(payload)

    expect(registeredName).toBe(GCS_EXTENSION_AGREEMENT_DELETE_GUARD_HOOK)
    expect(guard).toHaveBeenCalledWith({
      ...payload,
      extensionKey: 'gcs-test'
    })
  })
})
