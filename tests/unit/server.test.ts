import { describe, expect, it, vi } from 'vitest'
import { resolveExtensionAgreementByNumber } from '../../src/server'

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

describe('extension SDK server helpers', () => {
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
