import type { GcsPaymentAmountCalculatorResult } from '../src/ui'

const exactResult: GcsPaymentAmountCalculatorResult = {
  ceilingAmount: '99999999999999999.99',
  suggestedAmount: '1234.56',
  currency: 'CAD',
  details: [{ label: 'baseAmount', value: '1234.56' }],
  loading: false,
  error: null
}

const invalidResult: GcsPaymentAmountCalculatorResult = {
  // @ts-expect-error -- calculator money outputs must be canonical decimal text, not numbers.
  ceilingAmount: 1234.56
}

void exactResult
void invalidResult
