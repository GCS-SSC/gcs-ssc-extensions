import type {
  GcsExtensionAgreementClaimLineItemCreateInput,
  GcsExtensionMoneyInput
} from '../src/server'
import { moneyFromMinorUnits } from '../src/money'

const authoritativeMoney: GcsExtensionMoneyInput = moneyFromMinorUnits('99999999999999999999999999999999999999', 'CAD')

const authoritativeClaimLine: GcsExtensionAgreementClaimLineItemCreateInput = {
  budgetLineItemId: null,
  submittedCostCategory: null,
  submittedCostSubsection: null,
  submittedLineItem: null,
  description: 'Canonical amount',
  amount: authoritativeMoney,
  currency: 'cad'
}

// @ts-expect-error -- money inputs require currency-bearing minor-unit objects.
const invalidMoney: GcsExtensionMoneyInput = true
// @ts-expect-error -- human decimal text must pass through currency-aware conversion.
const decimalMoney: GcsExtensionMoneyInput = '1234.56'
// @ts-expect-error -- numeric compatibility is deliberately absent.
const numericMoney: GcsExtensionMoneyInput = 1234.56
// @ts-expect-error -- minor-unit text alone does not carry its denomination.
const bareMinorUnits: GcsExtensionMoneyInput = '123456'

void authoritativeClaimLine
void invalidMoney
void decimalMoney
void numericMoney
void bareMinorUnits
