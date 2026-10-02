import { describe, expect, it, vi } from 'vitest'
import { GCS_EXTENSION_CORRECTION_OUTCOME_HOOK, registerGcsExtensionCorrectionOutcomeHandler,
  type GcsExtensionCorrectionOutcomeContext } from '../../src/server'

describe('configured Correction outcome staging SDK', () => {
  it('requires Nitro registration and dispatches only the extension-qualified context', async () => {
    const stage = vi.fn(async (_context: GcsExtensionCorrectionOutcomeContext) => undefined)
    expect(() => registerGcsExtensionCorrectionOutcomeHandler('approved', stage)).toThrow('Nitro plugin')
    let name = ''
    let hook: ((payload: GcsExtensionCorrectionOutcomeContext) => Promise<void> | void) | undefined
    registerGcsExtensionCorrectionOutcomeHandler('approved', stage, { hooks: { hook: ((key: string, handler: typeof hook) => {
      name = key; hook = handler
    }) as never } })
    const db = {}
    const payload = { extensionKey: 'other', db, config: { channel: 'configured' }, agencyId: '1', streamId: '10', agreementId: '100',
      correctionId: '40', reference: 'FIN-COR-1', outcome: 'posted', runtimeId: '50', decisionCommonUserId: '2',
      recordedAt: '2026-10-01T00:00:00.000Z', notifications: [{ notificationId: '80', commonUserId: '1' }] } as GcsExtensionCorrectionOutcomeContext
    await hook!(payload)
    expect(stage).not.toHaveBeenCalled()
    await hook!({ ...payload, extensionKey: 'approved' })
    expect(name).toBe(GCS_EXTENSION_CORRECTION_OUTCOME_HOOK)
    expect(stage).toHaveBeenCalledWith({ ...payload, extensionKey: 'approved' })
    expect(stage.mock.calls[0]![0].db).toBe(db)
  })

  it('uses the host Nitro app when supplied globally and propagates staging errors', async () => {
    let hook: ((payload: GcsExtensionCorrectionOutcomeContext) => Promise<void> | void) | undefined
    vi.stubGlobal('useNitroApp', () => ({ hooks: { hook: (_key: string, handler: typeof hook) => { hook = handler } } }))
    try {
      registerGcsExtensionCorrectionOutcomeHandler('approved', async () => { throw new Error('Outbox unavailable') })
      await expect(hook!({ extensionKey: 'approved' } as never)).rejects.toThrow('Outbox unavailable')
    } finally { vi.unstubAllGlobals() }
  })
})
