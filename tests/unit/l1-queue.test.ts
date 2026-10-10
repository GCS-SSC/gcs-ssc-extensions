import { describe, expect, it, vi } from 'vitest'
import { registerGcsExtensionL1QueueHandler, type GcsL1QueueRegistration } from '../../src/server'

describe('L1 handler registration', () => {
  it('registers stable extension-owned identities when the host collects handlers', () => {
    const hook = vi.fn()
    const run = vi.fn(async () => {})
    registerGcsExtensionL1QueueHandler({ extensionKey: 'example', id: 'import', intervalMs: 60_000, run }, { hooks: { hook } })
    expect(hook.mock.calls[0]?.[0]).toBe('gcs-extension:l1-queue-register')
    const registration: GcsL1QueueRegistration = { register: vi.fn() }
    hook.mock.calls[0]?.[1](registration)
    expect(registration.register).toHaveBeenCalledWith({ extensionKey: 'example', id: 'example:import', intervalMs: 60_000, run })
  })

  it.each([
    { extensionKey: 'host:other', id: 'work', intervalMs: 5000 },
    { extensionKey: 'example', id: 'work:other', intervalMs: 5000 },
    { extensionKey: 'example', id: 'work', intervalMs: 0 },
    { extensionKey: 'example', id: 'work', intervalMs: 2_147_483_648 }
  ])('rejects invalid registration %#', input => {
    expect(() => registerGcsExtensionL1QueueHandler({ ...input, run: vi.fn() }, { hooks: { hook: vi.fn() } })).toThrow()
  })
})
