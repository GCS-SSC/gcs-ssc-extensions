import { describe, expect, it, vi } from 'vitest'
import {
  installGcsQueueRegistrar,
  registerGcsExtensionQueueHandler,
  type GcsQueueContext,
  type GcsQueueHandler
} from '../../src/server'

describe('background handler registration', () => {
  it('immediately registers a copied handler with its owner, level and original callback', async () => {
    const app = { hooks: { hook: vi.fn() } }
    const handlers: GcsQueueHandler[] = []
    installGcsQueueRegistrar(app, { register: handler => { handlers.push(handler) } })
    const run = vi.fn(async (_context: GcsQueueContext) => {})
    const handler = { extensionKey: 'example', id: 'import', queueLevel: 2, run }
    registerGcsExtensionQueueHandler(handler, app)

    expect(app.hooks.hook).not.toHaveBeenCalled()
    expect(handlers).toEqual([{ extensionKey: 'example', id: 'example:import', queueLevel: 2, run }])
    expect(handlers[0]?.run).toBe(run)
    expect(handler.id).toBe('import')
    expect(run).not.toHaveBeenCalled()

    handler.extensionKey = 'changed'
    handler.id = 'changed'
    handler.queueLevel = 1
    handler.run = vi.fn(async () => {})
    expect(handlers).toEqual([{ extensionKey: 'example', id: 'example:import', queueLevel: 2, run }])

    const context: GcsQueueContext = {
      db: Symbol('host database'),
      createWriteAuthorization: vi.fn(),
      runForAgency: async (_agencyId, operation) => operation()
    }
    await handlers[0]?.run(context)
    expect(run).toHaveBeenCalledExactlyOnceWith(context)
  })

  it.each([0, 1, 2, 3, 4, Number.MAX_SAFE_INTEGER])('leaves support for nonnegative level %s to the host catalog', queueLevel => {
    const app = { hooks: { hook: vi.fn() } }
    const register = vi.fn()
    installGcsQueueRegistrar(app, { register })
    const run = vi.fn(async () => {})
    registerGcsExtensionQueueHandler({ extensionKey: 'example', id: 'work', queueLevel, run }, app)
    expect(register).toHaveBeenCalledExactlyOnceWith({
      extensionKey: 'example', id: 'example:work', queueLevel, run
    })
  })

  it('propagates host validation failures synchronously and preserves their identity', () => {
    const app = { hooks: { hook: vi.fn() } }
    const failure = new Error('Unsupported host queue level: 4')
    installGcsQueueRegistrar(app, { register: () => { throw failure } })
    expect(() => registerGcsExtensionQueueHandler({
      extensionKey: 'example', id: 'work', queueLevel: 4, run: vi.fn()
    }, app)).toThrow(failure)
  })

  it('requires the host bridge before registration', () => {
    expect(() => registerGcsExtensionQueueHandler({
      extensionKey: 'example', id: 'work', queueLevel: 1, run: vi.fn()
    }, { hooks: { hook: vi.fn() } })).toThrow('The host queue registrar is not initialized for this app.')
  })

  it('keeps registrations independent across app instances', () => {
    const first = { hooks: { hook: vi.fn() } }
    const second = { hooks: { hook: vi.fn() } }
    const firstRegister = vi.fn()
    const secondRegister = vi.fn()
    installGcsQueueRegistrar(first, { register: firstRegister })
    installGcsQueueRegistrar(second, { register: secondRegister })
    const run = vi.fn(async () => {})
    registerGcsExtensionQueueHandler({ extensionKey: 'example', id: 'first', queueLevel: 1, run }, first)
    registerGcsExtensionQueueHandler({ extensionKey: 'example', id: 'second', queueLevel: 2, run }, second)
    expect(firstRegister).toHaveBeenCalledExactlyOnceWith({ extensionKey: 'example', id: 'example:first', queueLevel: 1, run })
    expect(secondRegister).toHaveBeenCalledExactlyOnceWith({ extensionKey: 'example', id: 'example:second', queueLevel: 2, run })
  })

  it('does not inherit another app\'s registrar through its prototype', () => {
    const parent = { hooks: { hook: vi.fn() } }
    const register = vi.fn()
    installGcsQueueRegistrar(parent, { register })
    const app = Object.create(parent)
    expect(() => registerGcsExtensionQueueHandler({
      extensionKey: 'example', id: 'work', queueLevel: 1, run: vi.fn()
    }, app)).toThrow('The host queue registrar is not initialized for this app.')
    expect(register).not.toHaveBeenCalled()
  })

  it('allows reinstalling the same registrar and rejects replacing it', () => {
    const app = { hooks: { hook: vi.fn() } }
    const register = vi.fn()
    const registrar = { register }
    installGcsQueueRegistrar(app, registrar)
    installGcsQueueRegistrar(app, registrar)
    expect(() => installGcsQueueRegistrar(app, { register: vi.fn() }))
      .toThrow('A queue registrar is already installed for this app.')
    const run = vi.fn(async () => {})
    registerGcsExtensionQueueHandler({ extensionKey: 'example', id: 'work', queueLevel: 1, run }, app)
    expect(register).toHaveBeenCalledExactlyOnceWith({ extensionKey: 'example', id: 'example:work', queueLevel: 1, run })
  })

  it('retains the app bridge across module reloads', async () => {
    const app = { hooks: { hook: vi.fn() } }
    const register = vi.fn()
    const registrar = { register }
    installGcsQueueRegistrar(app, registrar)
    vi.resetModules()
    const reloaded = await import('../../src/server')
    reloaded.installGcsQueueRegistrar(app, registrar)
    const run = vi.fn(async () => {})
    reloaded.registerGcsExtensionQueueHandler({ extensionKey: 'example', id: 'work', queueLevel: 2, run }, app)
    expect(register).toHaveBeenCalledExactlyOnceWith({ extensionKey: 'example', id: 'example:work', queueLevel: 2, run })
  })

  it.each([null, undefined, {}, { register: null }, { register: 'register' }])(
    'rejects malformed host bridges before installation %#', registrar => {
      const app = {}
      expect(() => Reflect.apply(installGcsQueueRegistrar, undefined, [app, registrar])).toThrow()
      expect(Object.getOwnPropertySymbols(app)).toEqual([])
    }
  )

  it.each([undefined, null, {}, { register: null }, { register: 'register' }])(
    'rejects a malformed runtime bridge when registering %#', registrar => {
      const app = { hooks: { hook: vi.fn() } }
      Object.defineProperty(app, Symbol.for('gcs-ssc:queue-registrar'), { value: registrar })
      expect(() => registerGcsExtensionQueueHandler({
        extensionKey: 'example', id: 'work', queueLevel: 1, run: vi.fn()
      }, app)).toThrow('The host queue registrar is not initialized for this app.')
    }
  )

  it('rejects a registrar whose callable operation was removed after installation', () => {
    const app = { hooks: { hook: vi.fn() } }
    const registrar: { register: unknown } = { register: vi.fn() }
    Reflect.apply(installGcsQueueRegistrar, undefined, [app, registrar])
    registrar.register = null
    expect(() => registerGcsExtensionQueueHandler({
      extensionKey: 'example', id: 'work', queueLevel: 1, run: vi.fn()
    }, app)).toThrow('The host queue registrar is not initialized for this app.')
  })

  it.each([
    { extensionKey: 'host:other', id: 'work' },
    { extensionKey: 'example', id: 'work:other' },
    { extensionKey: 'Example', id: 'work' },
    { extensionKey: 'example', id: '' },
    { extensionKey: undefined, id: 'work' },
    { extensionKey: 'example', id: 123 }
  ])('rejects malformed identities before calling the host %#', input => {
    const app = { hooks: { hook: vi.fn() } }
    const register = vi.fn()
    installGcsQueueRegistrar(app, { register })
    expect(() => Reflect.apply(registerGcsExtensionQueueHandler, undefined, [
      { ...input, queueLevel: 1, run: vi.fn() }, app
    ])).toThrow('identities must be lowercase kebab-case')
    expect(register).not.toHaveBeenCalled()
  })

  it.each([-1, -2, 1.5, Number.MAX_SAFE_INTEGER + 1, NaN, Infinity, '1', null, undefined])(
    'rejects invalid queue level %s before calling the host', queueLevel => {
      const app = { hooks: { hook: vi.fn() } }
      const register = vi.fn()
      installGcsQueueRegistrar(app, { register })
      expect(() => Reflect.apply(registerGcsExtensionQueueHandler, undefined, [
        { extensionKey: 'example', id: 'work', queueLevel, run: vi.fn() }, app
      ])).toThrow('Queue levels must be nonnegative safe integers')
      expect(register).not.toHaveBeenCalled()
    }
  )

  it.each([undefined, null, 'run', {}])('rejects a non-callable run operation %s', run => {
    const app = { hooks: { hook: vi.fn() } }
    const register = vi.fn()
    installGcsQueueRegistrar(app, { register })
    expect(() => Reflect.apply(registerGcsExtensionQueueHandler, undefined, [
      { extensionKey: 'example', id: 'work', queueLevel: 1, run }, app
    ])).toThrow('Queue handlers require a callable run operation')
    expect(register).not.toHaveBeenCalled()
  })

  it.each([
    { intervalMs: 5000 },
    { queueLevel: 1, intervalMs: 5000 },
    { queueLevel: 1, intervalMs: undefined }
  ])('rejects legacy intervals, including mixed registrations %#', scheduling => {
    const app = { hooks: { hook: vi.fn() } }
    const register = vi.fn()
    installGcsQueueRegistrar(app, { register })
    expect(() => Reflect.apply(registerGcsExtensionQueueHandler, undefined, [
      { extensionKey: 'example', id: 'work', run: vi.fn(), ...scheduling }, app
    ])).toThrow('Queue handlers use queueLevel; intervalMs is not supported')
    expect(register).not.toHaveBeenCalled()
  })

  it.each([null, undefined, [], 'handler'])('rejects a malformed registration %s', handler => {
    const app = { hooks: { hook: vi.fn() } }
    const register = vi.fn()
    installGcsQueueRegistrar(app, { register })
    expect(() => Reflect.apply(registerGcsExtensionQueueHandler, undefined, [handler, app])).toThrow()
    expect(register).not.toHaveBeenCalled()
  })
})
