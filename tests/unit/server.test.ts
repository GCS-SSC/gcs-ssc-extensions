import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import { createEvent } from 'h3'
import {
  DummyDriver,
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler
} from 'kysely'
import { describe, expect, it, vi } from 'vitest'
import {
  createGcsExtensionRouteContext,
  getGcsExtensionRequestHeader,
  readGcsExtensionRequestBody,
  resolveExtensionAgreementByNumber,
  setEncryptedExtensionSecret,
  type ExtensionSecretDatabase,
  type GcsExtensionRouteEvent
} from '../../src/server'

interface SecretTestDatabase extends ExtensionSecretDatabase {
  test_audit: {
    id: string
  }
}

const createSecretTestDb = (): Kysely<SecretTestDatabase> => new Kysely<SecretTestDatabase>({
  dialect: {
    createAdapter: () => new PostgresAdapter(),
    createDriver: () => new DummyDriver(),
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
  it('reads request bodies and headers from raw H3 events and route contexts', async () => {
    const rawEvent = createTestRouteEvent({ source: 'raw-event' }, 'raw-header')
    const contextEvent = createTestRouteEvent({ source: 'route-context' }, 'context-header')
    const routeContext = createGcsExtensionRouteContext(contextEvent)

    await expect(readGcsExtensionRequestBody(rawEvent)).resolves.toEqual({ source: 'raw-event' })
    expect(getGcsExtensionRequestHeader(rawEvent, 'x-extension-test')).toBe('raw-header')
    await expect(readGcsExtensionRequestBody(routeContext)).resolves.toEqual({ source: 'route-context' })
    expect(getGcsExtensionRequestHeader(routeContext, 'x-extension-test')).toBe('context-header')
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
})
