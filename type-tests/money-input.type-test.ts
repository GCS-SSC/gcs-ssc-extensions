import type {
  GcsExtensionAgreementClaimLineItemCreateInput,
  GcsExtensionMoneyInput
} from '../src/server'

const authoritativeMoney: GcsExtensionMoneyInput = '99999999999999999.99'
const compatibilityMoney: GcsExtensionMoneyInput = 1234.56

const authoritativeClaimLine: GcsExtensionAgreementClaimLineItemCreateInput = {
  budgetLineItemId: null,
  submittedCostCategory: null,
  submittedCostSubsection: null,
  submittedLineItem: null,
  description: 'Canonical amount',
  amount: authoritativeMoney,
  currency: 'cad'
}

const compatibilityClaimLine: GcsExtensionAgreementClaimLineItemCreateInput = {
  ...authoritativeClaimLine,
  amount: compatibilityMoney
}

// @ts-expect-error -- money inputs accept decimal text or backwards-compatible finite numbers, not arbitrary values.
const invalidMoney: GcsExtensionMoneyInput = true

void authoritativeClaimLine
void compatibilityClaimLine
void invalidMoney
