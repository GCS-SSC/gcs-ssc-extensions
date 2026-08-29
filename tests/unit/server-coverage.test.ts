import { describe, expect, it, vi } from 'vitest'

import {
  createGcsExtensionUserError,
  defineGcsExtensionMigration,
  defineGcsExtensionNitroPlugin,
  defineGcsExtensionRouteHandler,
  defineGcsLifecycleEntityAdapter,
  deleteEncryptedExtensionSecret,
  deleteExtensionKvEntry,
  getEncryptedExtensionSecret,
  getExtensionKvEntry,
  getGcsExtensionHookDatabase,
  GCS_EXTENSION_AGREEMENT_PAYMENT_MUTATION_GUARD_HOOK,
  GCS_EXTENSION_CREATE_OPERATION_HOOK,
  isGcsExtensionUserError,
  registerGcsExtensionAgreementDeleteGuard,
  registerGcsExtensionAgreementLifecycleLock,
  registerGcsExtensionAgreementPaymentMutationGuard,
  registerGcsExtensionAgreementStreamChangeGuard,
  registerGcsExtensionConfigurationGuard,
  registerGcsExtensionCreateOperationHandler,
  registerGcsExtensionDisableGuard,
  registerGcsExtensionStatusReferenceGuard,
  resolveExtensionStreamContext,
  setExtensionKvEntry
} from '../../src/server'

const queryChain = (result: unknown) => {
  const query: Record<string, ReturnType<typeof vi.fn>> = {}
  for (const method of ['select', 'where', 'set', 'values', 'returningAll', 'innerJoin']) {
    query[method] = vi.fn(() => query)
  }
  query.executeTakeFirst = vi.fn(async () => result)
  query.execute = vi.fn(async () => result)
  return query
}

const captureHook = () => {
  let name = ''
  let handler: ((payload: any) => Promise<void>) | undefined
  const registrar = {
    hooks: {
      hook: vi.fn((hookName: string, hookHandler: typeof handler) => {
        name = hookName
        handler = hookHandler
      })
    }
  }
  return { registrar, read: () => ({ name, handler }) }
}

describe('extension SDK server branch contracts', () => {
  it('preserves identity helpers, hook database precedence, and Nitro registration', () => {
    const migration = { up: vi.fn() }
    const adapter = { lock: vi.fn() }
    const plugin = vi.fn()
    expect(defineGcsExtensionMigration(migration as never)).toBe(migration)
    expect(defineGcsLifecycleEntityAdapter(adapter as never)).toBe(adapter)
    expect(getGcsExtensionHookDatabase({ db: 'direct', event: { context: { $db: 'event' } } })).toBe('direct')
    expect(getGcsExtensionHookDatabase({ event: { context: { $db: 'event' } } })).toBe('event')
    expect(getGcsExtensionHookDatabase({})).toBeUndefined()
    expect(defineGcsExtensionNitroPlugin(plugin)).toBe(plugin)

    const defineNitroPlugin = vi.fn((value: typeof plugin) => value)
    ;(globalThis as { defineNitroPlugin?: unknown }).defineNitroPlugin = defineNitroPlugin
    expect(defineGcsExtensionNitroPlugin(plugin)).toBe(plugin)
    expect(defineNitroPlugin).toHaveBeenCalledWith(plugin)
    delete (globalThis as { defineNitroPlugin?: unknown }).defineNitroPlugin
  })

  it('normalizes local and cross-realm user errors', () => {
    const error = createGcsExtensionUserError({
      code: 'SAMPLE_INVALID',
      message: { en: 'Invalid', fr: 'Invalide' },
      statusCode: 409,
      details: [{ path: 'field', message: 'Required' }]
    })
    expect(error).toMatchObject({ message: 'Invalid', code: 'SAMPLE_INVALID', statusCode: 409 })
    expect(isGcsExtensionUserError(error)).toBe(true)
    expect(isGcsExtensionUserError({ name: 'GcsExtensionUserError', code: 'REMOTE', message: 'Remote' })).toBe(true)
    expect(isGcsExtensionUserError({ name: 'GcsExtensionUserError', code: 1, message: 'Remote' })).toBe(false)
    expect(isGcsExtensionUserError(null)).toBe(false)
    expect(createGcsExtensionUserError({ code: 'DEFAULT', message: 'Message' }).statusCode).toBe(400)
  })

  it('runs create-operation hooks only for enabled matching contexts and records results', async () => {
    const captured = captureHook()
    const implementation = vi.fn(async () => ({ created: true }))
    registerGcsExtensionCreateOperationHandler('sample', 'agreement:create', implementation, captured.registrar as never)
    const hook = captured.read().handler!
    const base = {
      operation: 'other', enabledExtensionKeys: new Set(['sample']), contexts: {}, results: []
    }
    await hook(base)
    await hook({ ...base, operation: 'agreement:create', enabledExtensionKeys: new Set() })
    await hook({ ...base, operation: 'agreement:create' })
    expect(implementation).not.toHaveBeenCalled()

    const payload = {
      ...base,
      operation: 'agreement:create',
      contexts: { sample: { event: {}, db: {}, data: { id: '1' } } }
    }
    await hook(payload)
    expect(captured.read().name).toBe(GCS_EXTENSION_CREATE_OPERATION_HOOK)
    expect(payload.results).toEqual([{ extensionKey: 'sample', result: { created: true } }])
  })

  it('injects extension identity into payment mutation guards', async () => {
    const captured = captureHook()
    const implementation = vi.fn()
    registerGcsExtensionAgreementPaymentMutationGuard('sample', implementation, captured.registrar as never)
    const payload = { event: {}, db: {}, agreementId: '1', agencyId: '2', streamId: '3' }
    await captured.read().handler!(payload)
    expect(captured.read().name).toBe(GCS_EXTENSION_AGREEMENT_PAYMENT_MUTATION_GUARD_HOOK)
    expect(implementation).toHaveBeenCalledWith({ ...payload, extensionKey: 'sample' })
  })

  it('fails every lifecycle registration outside a Nitro plugin', () => {
    const handler = vi.fn()
    expect(() => registerGcsExtensionCreateOperationHandler('sample', 'agreement:create', handler)).toThrow('Nitro plugin')
    expect(() => registerGcsExtensionDisableGuard('sample', handler)).toThrow('Nitro plugin')
    expect(() => registerGcsExtensionAgreementLifecycleLock('sample', handler)).toThrow('Nitro plugin')
    expect(() => registerGcsExtensionAgreementStreamChangeGuard('sample', handler)).toThrow('Nitro plugin')
    expect(() => registerGcsExtensionAgreementPaymentMutationGuard('sample', handler)).toThrow('Nitro plugin')
    expect(() => registerGcsExtensionAgreementDeleteGuard('sample', handler)).toThrow('Nitro plugin')
    expect(() => registerGcsExtensionStatusReferenceGuard('sample', handler)).toThrow('Nitro plugin')
    expect(() => registerGcsExtensionConfigurationGuard('sample', handler)).toThrow('Nitro plugin')
  })

  it('wraps route handlers with the host-created extension context', async () => {
    const handler = vi.fn(async context => ({ db: context.db, config: context.config }))
    const event = { context: { $db: 'database', gcsExtension: { config: { enabled: true } } } }
    await expect(defineGcsExtensionRouteHandler(handler)(event as never)).resolves.toEqual({
      db: 'database', config: { enabled: true }
    })
  })

  it('resolves a complete active stream context', async () => {
    const query = queryChain({ agency_id: 2, profile_id: 3 })
    const db = { selectFrom: vi.fn(() => query) }
    await expect(resolveExtensionStreamContext(db as never, '4')).resolves.toEqual({
      agencyId: '2', profileId: '3', streamId: '4',
      scope: {
        type: 'entity', agencyId: '2',
        path: [
          { type: 'transfer_payment', id: '3' },
          { type: 'transfer_payment_stream', id: '4' }
        ]
      }
    })
  })

  it('creates, updates, reads, and soft-deletes extension KV entries', async () => {
    const missing = queryChain(null)
    const inserted = queryChain({ id: '1', value: { enabled: true } })
    const insertDb = {
      selectFrom: vi.fn(() => missing),
      insertInto: vi.fn(() => inserted)
    }
    await expect(setExtensionKvEntry(insertDb as never, 'sample', 'agency', '2', 'config', { enabled: true }))
      .resolves.toEqual({ id: '1', value: { enabled: true } })

    const existing = queryChain({ id: '1' })
    const updated = queryChain({ id: '1', value: false })
    const updateDb = {
      selectFrom: vi.fn(() => existing),
      updateTable: vi.fn(() => updated)
    }
    await expect(setExtensionKvEntry(updateDb as never, 'sample', 'agency', '2', 'config', false))
      .resolves.toEqual({ id: '1', value: false })

    const read = queryChain({ value: ['one'] })
    await expect(getExtensionKvEntry({ selectFrom: vi.fn(() => read) } as never, 'sample', 'agency', '2', 'config'))
      .resolves.toEqual(['one'])
    const absent = queryChain(null)
    await expect(getExtensionKvEntry({ selectFrom: vi.fn(() => absent) } as never, 'sample', 'agency', '2', 'config'))
      .resolves.toBeNull()

    const deleted = queryChain(undefined)
    await deleteExtensionKvEntry({ updateTable: vi.fn(() => deleted) } as never, 'sample', 'agency', '2', 'config')
    expect(deleted.set).toHaveBeenCalledWith({ _deleted: true })
  })

  it('handles absent, unsupported, and deleted encrypted secret rows', async () => {
    const absent = queryChain(null)
    await expect(getEncryptedExtensionSecret({ selectFrom: vi.fn(() => absent) } as never, {
      rootKey: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
      extensionKey: 'sample', ownerType: 'agency', ownerId: '2', secretKey: 'credential'
    })).resolves.toBeNull()

    const unsupported = queryChain({
      ciphertext: '', iv: '', auth_tag: '', algorithm: 'old', key_version: 0
    })
    await expect(getEncryptedExtensionSecret({ selectFrom: vi.fn(() => unsupported) } as never, {
      rootKey: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
      extensionKey: 'sample', ownerType: 'agency', ownerId: '2', secretKey: 'credential'
    })).rejects.toThrow('Unsupported extension secret')

    const deleted = queryChain(undefined)
    await deleteEncryptedExtensionSecret(
      { updateTable: vi.fn(() => deleted) } as never,
      'sample', 'agency', '2', 'credential'
    )
    expect(deleted.set).toHaveBeenCalledWith(expect.objectContaining({ _deleted: true }))
  })
})
