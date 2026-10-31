import { describe, expect, it } from 'vitest'
import {
  MoneySchema, absMoney, addMoney, allocateMoney, allocateMoneyByPercentages,
  compareMoney, compareScaledMoney, divideMoney, formatDecimalText, formatMoneyText,
  getCurrency, getCurrencyFractionDigits, getCurrencyMinorUnitFactor, isCanonicalMoney,
  isPersistableMoney, isSupportedCurrencyCode, majorMoneyText, maxMoney, minMoney, moneyFromMinorUnits,
  moneyToMinorUnits, multiplyMoney, negateMoney, parseCurrencyMoney, parseDecimalText,
  parseMinorUnits, parseMoney, percentageMoney, roundMoney, subtractMoney,
  sumMoney, supportedCurrencyCodes, zeroMoney
} from '../../src/money'

const usd = (text: string) => parseCurrencyMoney(text, 'USD')
const decimal = parseDecimalText

describe('currency-bearing minor-unit money', () => {
  it('round-trips JSON integer text and rejects ambiguous legacy inputs', () => {
    const value = usd('123.45')
    expect(value).toEqual({ amount: '12345', currency: 'USD' })
    expect(Object.isFrozen(value)).toBe(true)
    expect(parseMoney(JSON.parse(JSON.stringify(value)))).toEqual(value)
    expect(MoneySchema.parse(value)).toEqual(value)
    for (const invalid of ['123.45', 12345, null, [], {}, { amount: 12345, currency: 'USD' },
      { amount: '1.2', currency: 'USD' }, { amount: '01', currency: 'USD' },
      { amount: '-0', currency: 'USD' }, { amount: '1', currency: 'usd' },
      { amount: '1', currency: 'USD', scale: 2 }, { amount: '1', currency: 'XXX' }, { draft: '1.' }]) {
      expect(() => parseMoney(invalid)).toThrow()
      expect(isCanonicalMoney(invalid)).toBe(false)
      expect(isPersistableMoney(invalid)).toBe(false)
      expect(MoneySchema.safeParse(invalid).success).toBe(false)
    }
    expect(isCanonicalMoney(value)).toBe(true)
    expect(parseMinorUnits('-12')).toBe('-12')
    expect(() => parseMinorUnits(' 1')).toThrow()
    expect(() => parseMinorUnits('1\n')).toThrow()
    expect(moneyFromMinorUnits('1', 'cad').currency).toBe('CAD')
    expect(moneyToMinorUnits(moneyFromMinorUnits(BigInt(-1), 'USD'))).toBe(BigInt(-1))
  })

  it('uses actual 0, 2, 3, 4 and nondecimal currency subdivisions', () => {
    for (const [currency, major, minor, digits] of [
      ['JPY', '123', '123', 0], ['USD', '1.23', '123', 2], ['KWD', '1.234', '1234', 3],
      ['BHD', '0.001', '1', 3], ['CLF', '1.2345', '12345', 4], ['MGA', '1.2', '6', 1]
    ] as const) {
      const value = parseCurrencyMoney(major, currency)
      expect(value.amount).toBe(minor)
      expect(majorMoneyText(value)).toBe(major)
      expect(getCurrencyFractionDigits(currency)).toBe(digits)
      expect(parseCurrencyMoney(majorMoneyText(value), currency)).toEqual(value)
    }
    expect(getCurrencyMinorUnitFactor('MGA')).toBe(BigInt(5))
    expect(() => parseCurrencyMoney('1.1', 'JPY')).toThrow('fractional')
    expect(() => parseCurrencyMoney('1.234', 'USD')).toThrow('fractional')
    expect(() => parseCurrencyMoney('1.2345', 'KWD')).toThrow('fractional')
    expect(() => parseCurrencyMoney('0.1', 'MGA')).toThrow('fractional')
    expect(majorMoneyText(parseCurrencyMoney('-0.00', 'USD'))).toBe('0')
    expect(parseCurrencyMoney('1.2300', 'USD')).toEqual(usd('1.23'))
  })

  it('retains distinct historical units and rejects invented precision for XDR', () => {
    for (const [code, factor] of [['ANG', 100], ['BYR', 1], ['CUC', 100], ['HRK', 100]] as const) {
      expect(getCurrency(code).code).toBe(code)
      expect(getCurrencyMinorUnitFactor(code)).toBe(BigInt(factor))
      expect(supportedCurrencyCodes).toContain(code.toLowerCase())
    }
    expect(supportedCurrencyCodes).not.toContain('xdr')
    expect(isSupportedCurrencyCode('usd')).toBe(true)
    expect(isSupportedCurrencyCode('USD')).toBe(false)
    expect(isSupportedCurrencyCode('xdr')).toBe(false)
    expect(isSupportedCurrencyCode(null)).toBe(false)
    expect(Object.isFrozen(getCurrency('USD'))).toBe(true)
    expect(Object.isFrozen(supportedCurrencyCodes)).toBe(true)
    for (const code of supportedCurrencyCodes) {
      const unit = moneyFromMinorUnits('1', code)
      expect(parseCurrencyMoney(majorMoneyText(unit), code)).toEqual(unit)
    }
    expect(() => getCurrency('XDR')).toThrow('no defined settlement')
    expect(() => getCurrency('XYZ')).toThrow('Unsupported')
    expect(() => getCurrency(null as never)).toThrow('Currency must')
  })

  it('keeps the 38-digit persistence boundary separate from unbounded totals', () => {
    const max = moneyFromMinorUnits('9'.repeat(38), 'JPY')
    expect(isPersistableMoney(max)).toBe(true)
    expect(isPersistableMoney(negateMoney(max))).toBe(true)
    const beyond = addMoney(max, moneyFromMinorUnits('1', 'JPY'))
    expect(beyond.amount).toBe(`1${'0'.repeat(38)}`)
    expect(isPersistableMoney(beyond)).toBe(false)
    expect(parseMoney(beyond)).toEqual(beyond)
  })

  it('parses dimensionless decimals without accepting numbers, exponents or decoration', () => {
    expect(decimal('12.3400')).toBe('12.34')
    expect(decimal('-0.000')).toBe('0')
    expect(decimal('-0.0100')).toBe('-0.01')
    for (const value of ['', '01', '1.', '.1', ' 1', '1\n', '+1', '1e2', 'Infinity', 'NaN', '1,000']) {
      expect(() => decimal(value)).toThrow()
    }
    expect(() => decimal(1 as never)).toThrow()
  })

  it('adds, subtracts and compares adjacent large minor units with currency checking', () => {
    const large = moneyFromMinorUnits('99999999999999999999', 'USD')
    const next = addMoney(large, usd('0.01'))
    expect(next.amount).toBe('100000000000000000000')
    expect(subtractMoney(next, large)).toEqual(usd('0.01'))
    expect(compareMoney(large, next)).toBe(-1)
    expect(compareMoney(next, large)).toBe(1)
    expect(compareMoney(next, next)).toBe(0)
    expect(sumMoney([usd('0.1'), usd('0.2')], 'USD')).toEqual(usd('0.3'))
    expect(sumMoney([], 'JPY')).toEqual(zeroMoney('JPY'))
    const kwd = parseCurrencyMoney('1', 'KWD')
    for (const operation of [addMoney, subtractMoney, compareMoney]) expect(() => operation(usd('1'), kwd)).toThrow('currencies must match')
    expect(() => sumMoney([kwd], 'USD')).toThrow('currencies must match')
  })

  it('selects extrema, negates and takes absolute values without discarding currency', () => {
    const values = [usd('2'), usd('-1'), usd('3')]
    expect(minMoney(values, 'USD')).toEqual(usd('-1'))
    expect(maxMoney(values, 'USD')).toEqual(usd('3'))
    expect(negateMoney(usd('-1'))).toEqual(usd('1'))
    expect(absMoney(usd('-1'))).toEqual(usd('1'))
    expect(absMoney(usd('1'))).toEqual(usd('1'))
    expect(() => minMoney([], 'USD')).toThrow('empty')
    expect(() => maxMoney([], 'USD')).toThrow('empty')
    expect(() => minMoney(values, 'JPY')).toThrow('currencies must match')
    expect(() => maxMoney(values, 'JPY')).toThrow('currencies must match')
  })

  it('settles rational calculations once using explicit Dinero rounding', () => {
    expect(multiplyMoney(usd('0.01'), decimal('0.5'))).toEqual(usd('0.01'))
    expect(multiplyMoney(usd('0.01'), decimal('0.5'), { rounding: 'halfEven' })).toEqual(usd('0'))
    expect(multiplyMoney(usd('0.01'), decimal('0.5'), { rounding: 'towardsZero' })).toEqual(usd('0'))
    expect(multiplyMoney(usd('-0.01'), decimal('0.5'), { rounding: 'down' })).toEqual(usd('-0.01'))
    expect(multiplyMoney(usd('-0.01'), decimal('0.5'), { rounding: 'up' })).toEqual(usd('0'))
    expect(divideMoney(usd('1'), decimal('-2'))).toEqual(usd('-0.5'))
    expect(divideMoney(usd('1'), decimal('3'))).toEqual(usd('0.33'))
    expect(() => divideMoney(usd('1'), decimal('0'))).toThrow('zero')
    expect(percentageMoney(usd('100.05'), decimal('10'))).toEqual(usd('10.01'))
    expect(percentageMoney(usd('100.05'), decimal('10'), { scale: 0, rounding: 'down' })).toEqual(usd('10'))
    expect(roundMoney(usd('1.25'), { scale: 1 })).toEqual(usd('1.3'))
    expect(roundMoney(usd('1.25'), { scale: 2 })).toEqual(usd('1.25'))
    for (const scale of [-1, 3, 0.5]) expect(() => roundMoney(usd('1'), { scale })).toThrow('scale')
  })

  it('treats MGA as fifths instead of decimal tenths during percentage calculations', () => {
    const value = parseCurrencyMoney('0.2', 'MGA')
    expect(percentageMoney(value, decimal('50'))).toEqual(value)
    expect(percentageMoney(value, decimal('50'), { rounding: 'down' })).toEqual(zeroMoney('MGA'))
    expect(percentageMoney(parseCurrencyMoney('12.2', 'MGA'), decimal('10'), { scale: 0, rounding: 'down' }))
      .toEqual(parseCurrencyMoney('1', 'MGA'))
    expect(multiplyMoney(parseCurrencyMoney('1', 'MGA'), decimal('0.5'))).toEqual(parseCurrencyMoney('0.6', 'MGA'))
    expect(multiplyMoney(parseCurrencyMoney('1', 'MGA'), decimal('0.5'), { rounding: 'halfEven' })).toEqual(parseCurrencyMoney('0.4', 'MGA'))
  })

  it('compares scaled capacities before any minor-unit settlement', () => {
    expect(compareScaledMoney(usd('0.01'), decimal('0.49'), usd('0.01'), decimal('0.5'))).toBe(-1)
    expect(compareScaledMoney(usd('10'), decimal('1.25'), usd('12.5'), decimal('1'))).toBe(0)
    expect(compareScaledMoney(usd('1'), decimal('2'), usd('1'), decimal('1.9'))).toBe(1)
    expect(() => compareScaledMoney(usd('1'), decimal('1'), parseCurrencyMoney('1', 'JPY'), decimal('1'))).toThrow('currencies must match')
  })

  it('allocates actual minor units, retaining explicit residual ordering', () => {
    const ratios = ['1', '3', '3'].map(decimal)
    expect(allocateMoney(usd('0.05'), ratios).map(value => value.amount)).toEqual(['0', '3', '2'])
    expect(allocateMoney(usd('0.05'), ratios, { method: 'largestRemainder' }).map(value => value.amount)).toEqual(['1', '2', '2'])
    expect(allocateMoney(usd('0.02'), ['1', '2', '3'].map(decimal)).map(value => value.amount)).toEqual(['0', '0', '2'])
    expect(allocateMoney(usd('0.02'), ['1', '2', '3'].map(decimal), { method: 'largestRemainder' }).map(value => value.amount)).toEqual(['0', '1', '1'])
    expect(allocateMoney(usd('0.02'), ['1', '2'].map(decimal), { method: 'ordered' }).map(value => value.amount)).toEqual(['1', '1'])
    expect(allocateMoney(usd('0.02'), ['0', '1', '2'].map(decimal), { method: 'ordered' }).map(value => value.amount)).toEqual(['0', '1', '1'])
    expect(allocateMoney(usd('-0.02'), ['1', '2'].map(decimal), { method: 'ordered' }).map(value => value.amount)).toEqual(['-1', '-1'])
    expect(allocateMoney(usd('-0.02'), ['1', '2', '3'].map(decimal), { method: 'largestRemainder' }).map(value => value.amount)).toEqual(['0', '-1', '-1'])
    expect(allocateMoney(parseCurrencyMoney('1', 'MGA'), ['1', '1'].map(decimal)).map(majorMoneyText)).toEqual(['0.6', '0.4'])
    expect(allocateMoney(usd('1'), ['0.1', '0.2'].map(decimal)).map(majorMoneyText)).toEqual(['0.33', '0.67'])
    for (const ratios of [[], ['0'], ['-1', '2']]) {
      expect(() => allocateMoney(usd('1'), ratios.map(decimal))).toThrow()
      expect(() => allocateMoney(usd('1'), ratios.map(decimal), { method: 'largestRemainder' })).toThrow()
    }
  })

  it('allocates percentage quotas with one combined-target rounding', () => {
    const value = usd('0.05')
    expect(allocateMoneyByPercentages(value, ['10', '30', '30'].map(decimal)).map(part => part.amount)).toEqual(['1', '2', '1'])
    expect(allocateMoneyByPercentages(value, ['0', '0'].map(decimal)).map(part => part.amount)).toEqual(['0', '0'])
    expect(allocateMoneyByPercentages(usd('-0.05'), ['10', '30', '30'].map(decimal)).map(part => part.amount)).toEqual(['-1', '-2', '-1'])
    expect(allocateMoneyByPercentages(value, ['12.5', '12.50'].map(decimal)).map(part => part.amount)).toEqual(['1', '0'])
    expect(allocateMoneyByPercentages(value, [])).toEqual([])
    expect(() => allocateMoneyByPercentages(value, [decimal('-1')])).toThrow('nonnegative')
  })

  it('formats owning currencies at their actual precision with exact large values', () => {
    expect(formatMoneyText(usd('1.2'), 'en-CA')).toContain('1.20')
    expect(formatMoneyText(parseCurrencyMoney('123', 'JPY'), 'en-CA')).not.toContain('.00')
    expect(formatMoneyText(parseCurrencyMoney('1.234', 'KWD'), 'en-CA')).toContain('1.234')
    expect(formatMoneyText(parseCurrencyMoney('1.2345', 'CLF'), 'en-CA')).toContain('1.2345')
    expect(formatMoneyText(parseCurrencyMoney('0.2', 'MGA'), 'en-CA')).toContain('0.2')
    expect(formatMoneyText(usd('-0.01'), 'fr-CA')).toContain('-0,01')
    expect(formatMoneyText(moneyFromMinorUnits('99999999999999999999', 'USD'), 'en-CA')).toContain('999,999,999,999,999,999.99')
    expect(formatMoneyText(usd('0'), 'en-CA')).toContain('0.00')
    expect(formatDecimalText(decimal('12345678901234567890.1234'), 'en-CA')).toBe('12,345,678,901,234,567,890.1234')
    expect(formatDecimalText(decimal('-0.1234'), 'fr-CA')).toBe('-0,1234')
    expect(formatDecimalText(decimal('2'), 'en-CA')).toBe('2')
  })
})
