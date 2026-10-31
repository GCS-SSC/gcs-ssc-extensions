import type { GcsPaymentAmountCalculatorResult } from '../src/ui'
import { moneyFromMinorUnits } from '../src/money'

const exactResult: GcsPaymentAmountCalculatorResult = {
  ceilingAmount: moneyFromMinorUnits('99999999999999999999999999999999999999', 'CAD'),
  suggestedAmount: moneyFromMinorUnits('123456', 'CAD'),
  currency: 'CAD',
  details: [{ label: 'baseAmount', value: moneyFromMinorUnits('123456', 'CAD') }],
  explanation: [{
    label: 'Calculated payment',
    rows: [{ label: 'Forecast', value: 'CAD $2,000.00' }, { label: 'Payments already made', value: 'CAD $500.00', operator: '−' }],
    total: { label: 'Calculated payment', value: 'CAD $1,500.00' }
  }],
  loading: false,
  error: null
}

const invalidResult: GcsPaymentAmountCalculatorResult = {
  // @ts-expect-error -- calculator money outputs require currency-bearing minor-unit objects.
  ceilingAmount: 1234.56
}

void exactResult
void invalidResult
