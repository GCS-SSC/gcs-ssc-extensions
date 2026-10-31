import { z } from 'zod'
import {
  add, allocate, calculator, compare, dinero, down, halfAwayFromZero, halfEven,
  subtract, toSnapshot, up, type DineroCurrency
} from 'dinero.js/bigint'
import * as currencies from 'dinero.js/bigint/currencies'

declare const minorUnitsBrand: unique symbol
declare const currencyCodeBrand: unique symbol
declare const decimalTextBrand: unique symbol
export type MinorUnits = string & { readonly [minorUnitsBrand]: 'MinorUnits' }
export type CurrencyCode = string & { readonly [currencyCodeBrand]: 'CurrencyCode' }
export type SupportedCurrencyCode = Lowercase<keyof typeof currencies | 'ANG' | 'BYR' | 'CUC' | 'HRK'>
/** Dimensionless exact decimal, used for percentages and allocation ratios. */
export type DecimalText = string & { readonly [decimalTextBrand]: 'DecimalText' }
/** Settled money. Amount is an integer number of the currency's actual minor units. */
export type Money = Readonly<{ amount: MinorUnits; currency: CurrencyCode }>
/** UI-only invalid human draft. Never accepted as persisted or transported money. */
export type MoneyDraft = Readonly<{ draft: string }>
export type MoneyInput = Money | MoneyDraft | null | undefined
export type MoneyRounding = 'down' | 'up' | 'halfAwayFromZero' | 'halfEven' | 'towardsZero'
export interface MoneyRoundingOptions { rounding?: MoneyRounding; scale?: number }
export interface MoneyAllocationOptions { method?: 'dinero' | 'largestRemainder' | 'ordered' }

const ZERO = BigInt(0)
const ONE = BigInt(1)
const TEN = BigInt(10)
const registry = new Map<string, DineroCurrency<bigint>>()
for (const currency of Object.values(currencies)) registry.set(currency.code, Object.freeze({ ...currency }))
// Historical units remain distinct denominations; replacements are never implicit conversions.
for (const [code, exponent] of [['ANG', 2], ['BYR', 0], ['CUC', 2], ['HRK', 2]] as const) {
  registry.set(code, Object.freeze({ code, base: TEN, exponent: BigInt(exponent) }))
}
/** XDR has no defined settlement subdivision and is deliberately absent. */
export const isSupportedCurrencyCode = (value: unknown): value is SupportedCurrencyCode => typeof value === 'string'
  && value === value.toLowerCase() && registry.has(value.toUpperCase())
export const supportedCurrencyCodes: readonly SupportedCurrencyCode[] = Object.freeze([...registry.keys()].map(key => {
  const code = key.toLowerCase()
  if (!isSupportedCurrencyCode(code)) throw new TypeError('Currency registry contains an invalid code.')
  return code
}).sort())
export const getCurrency = (code: string): DineroCurrency<bigint> => {
  if (typeof code !== 'string') throw new TypeError('Currency must be a supported currency code.')
  const currency = registry.get(code.toUpperCase())
  if (!currency) throw new RangeError(code.toUpperCase() === 'XDR'
    ? 'XDR has no defined settlement minor unit.' : `Unsupported monetary currency: ${code}`)
  return currency
}
export const getCurrencyMinorUnitFactor = (code: string): bigint => {
  const currency = getCurrency(code)
  const base = Array.isArray(currency.base)
    ? currency.base.reduce((product, value) => calculator.multiply(product, value), ONE)
    : currency.base
  return calculator.power(base, currency.exponent)
}

export const parseMinorUnits = (value: string): MinorUnits => {
  if (typeof value !== 'string' || value.trim() !== value || !/^(?:0|-?[1-9]\d*)$/.test(value)) {
    throw new TypeError('Money amount must be canonical signed integer text in minor units.')
  }
  return value as MinorUnits
}
export const parseDecimalText = (value: string): DecimalText => {
  if (typeof value !== 'string' || value.trim() !== value || !/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)) {
    throw new TypeError('Decimal value must be plain exact decimal text.')
  }
  const [whole = '0', rawFraction = ''] = value.split('.')
  const fraction = rawFraction.replace(/0+$/, '')
  const integer = whole === '-0' && !fraction ? '0' : whole
  return `${integer}${fraction ? `.${fraction}` : ''}` as DecimalText
}
export const moneyFromMinorUnits = (amount: bigint | string, currency: string): Money => Object.freeze({
  amount: parseMinorUnits(typeof amount === 'bigint' ? String(amount) : amount),
  currency: getCurrency(currency).code as CurrencyCode
})
export const moneyToMinorUnits = (value: Money): bigint => BigInt(parseMinorUnits(value.amount))
export const zeroMoney = (currency: string): Money => moneyFromMinorUnits(ZERO, currency)
export const isPersistableMoney = (value: unknown): value is Money => isCanonicalMoney(value)
  && value.amount.replace(/^-/, '').length <= 38

export const parseMoney = (value: unknown): Money => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)
    || !('amount' in value) || !('currency' in value)
    || typeof value.amount !== 'string' || typeof value.currency !== 'string'
    || Object.keys(value).length !== 2 || Object.keys(value).some(key => key !== 'amount' && key !== 'currency')) {
    throw new TypeError('Money must be an object containing integer amount text and currency.')
  }
  const parsed = moneyFromMinorUnits(value.amount, value.currency)
  if (parsed.currency !== value.currency) throw new TypeError('Money currency must be its canonical uppercase code.')
  return parsed
}
export const isCanonicalMoney = (value: unknown): value is Money => {
  try { parseMoney(value); return true } catch { return false }
}
export const MoneySchema = z.unknown().transform((value, context) => {
  try { return parseMoney(value) } catch {
    context.addIssue({ code: 'custom', message: 'Invalid currency-bearing minor-unit money.' })
    return z.NEVER
  }
})

interface Fraction { numerator: bigint; denominator: bigint }
const decimalFraction = (value: DecimalText): Fraction => {
  const canonical = parseDecimalText(value)
  const [whole = '0', fraction = ''] = canonical.split('.')
  return { numerator: BigInt(`${whole}${fraction}`), denominator: calculator.power(TEN, BigInt(fraction.length)) }
}
/** Parses human/external major-unit decimal text; it never rounds fractional minor units. */
export const parseCurrencyMoney = (value: string, currency: string): Money => {
  const fraction = decimalFraction(parseDecimalText(value))
  const numerator = calculator.multiply(fraction.numerator, getCurrencyMinorUnitFactor(currency))
  if (calculator.modulo(numerator, fraction.denominator) !== ZERO) throw new RangeError('Amount contains a fractional currency minor unit.')
  return moneyFromMinorUnits(calculator.integerDivide(numerator, fraction.denominator), currency)
}

/** Decimal digits needed to render the actual subdivision, including MGA fifths. */
export const getCurrencyFractionDigits = (currency: string): number => {
  let factor = getCurrencyMinorUnitFactor(currency)
  let twos = 0
  let fives = 0
  while (calculator.modulo(factor, BigInt(2)) === ZERO) { factor = calculator.integerDivide(factor, BigInt(2)); twos++ }
  while (calculator.modulo(factor, BigInt(5)) === ZERO) { factor = calculator.integerDivide(factor, BigInt(5)); fives++ }
  if (factor !== ONE) throw new RangeError('Currency subdivision has no finite decimal representation.')
  return Math.max(twos, fives)
}
export const majorMoneyText = (value: Money): string => {
  const digits = getCurrencyFractionDigits(value.currency)
  const decimalFactor = calculator.power(TEN, BigInt(digits))
  const amount = calculator.integerDivide(calculator.multiply(moneyToMinorUnits(value), decimalFactor), getCurrencyMinorUnitFactor(value.currency))
  const negative = amount < ZERO
  const absolute = negative ? calculator.subtract(ZERO, amount) : amount
  const text = String(absolute).padStart(digits + 1, '0')
  return parseDecimalText(`${negative ? '-' : ''}${digits === 0 ? text : `${text.slice(0, -digits)}.${text.slice(-digits)}`}`)
}
const dineroMoney = (value: Money) => dinero({ amount: moneyToMinorUnits(value), currency: getCurrency(value.currency) })
const assertSameCurrency = (left: Money, right: Money): void => {
  if (left.currency !== right.currency) throw new TypeError('Money currencies must match.')
}
export const addMoney = (left: Money, right: Money): Money => {
  assertSameCurrency(left, right)
  return moneyFromMinorUnits(toSnapshot(add(dineroMoney(left), dineroMoney(right))).amount, left.currency)
}
export const subtractMoney = (left: Money, right: Money): Money => {
  assertSameCurrency(left, right)
  return moneyFromMinorUnits(toSnapshot(subtract(dineroMoney(left), dineroMoney(right))).amount, left.currency)
}
export const compareMoney = (left: Money, right: Money): -1 | 0 | 1 => {
  assertSameCurrency(left, right)
  return compare(dineroMoney(left), dineroMoney(right))
}
export const sumMoney = (values: Iterable<Money>, currency: string): Money => {
  let total = zeroMoney(currency)
  for (const value of values) total = addMoney(total, value)
  return total
}
export const minMoney = (values: Iterable<Money>, currency: string): Money => {
  let result: Money | undefined
  for (const value of values) {
    assertSameCurrency(zeroMoney(currency), value)
    if (!result || compareMoney(value, result) < 0) result = value
  }
  if (!result) throw new RangeError('Cannot find the minimum of empty money values.')
  return result
}
export const maxMoney = (values: Iterable<Money>, currency: string): Money => {
  let result: Money | undefined
  for (const value of values) {
    assertSameCurrency(zeroMoney(currency), value)
    if (!result || compareMoney(value, result) > 0) result = value
  }
  if (!result) throw new RangeError('Cannot find the maximum of empty money values.')
  return result
}
export const negateMoney = (value: Money): Money => subtractMoney(zeroMoney(value.currency), value)
export const absMoney = (value: Money): Money => compareMoney(value, zeroMoney(value.currency)) < 0 ? negateMoney(value) : value

const roundedInteger = (numerator: bigint, denominator: bigint, rounding: MoneyRounding): bigint => {
  if (denominator === ZERO) throw new RangeError('Cannot divide money by zero.')
  if (denominator < ZERO) return roundedInteger(calculator.subtract(ZERO, numerator), calculator.subtract(ZERO, denominator), rounding)
  switch (rounding) {
    case 'down': return down(numerator, denominator, calculator)
    case 'up': return up(numerator, denominator, calculator)
    case 'halfAwayFromZero': return halfAwayFromZero(numerator, denominator, calculator)
    case 'halfEven': return halfEven(numerator, denominator, calculator)
    case 'towardsZero': return calculator.integerDivide(numerator, denominator)
  }
}
const roundingFactor = (currency: string, scale: number | undefined): bigint => {
  const digits = getCurrencyFractionDigits(currency)
  if (scale === undefined || scale === digits) return getCurrencyMinorUnitFactor(currency)
  if (!Number.isInteger(scale) || scale < 0 || scale > digits) throw new RangeError('Rounding scale must not exceed the currency subdivision.')
  const factor = calculator.power(TEN, BigInt(scale))
  if (calculator.modulo(getCurrencyMinorUnitFactor(currency), factor) !== ZERO) throw new RangeError('Rounding scale must align with currency minor units.')
  return factor
}
/** Fraction is in minor units. Extra precision never escapes as settled Money. */
const settleFraction = (fraction: Fraction, currency: string, options: MoneyRoundingOptions): Money => {
  const minorFactor = getCurrencyMinorUnitFactor(currency)
  const targetFactor = roundingFactor(currency, options.scale)
  const steps = roundedInteger(calculator.multiply(fraction.numerator, targetFactor),
    calculator.multiply(fraction.denominator, minorFactor), options.rounding ?? 'halfAwayFromZero')
  return moneyFromMinorUnits(calculator.integerDivide(calculator.multiply(steps, minorFactor), targetFactor), currency)
}
export const multiplyMoney = (value: Money, factor: DecimalText, options: MoneyRoundingOptions = {}): Money => {
  const ratio = decimalFraction(factor)
  return settleFraction({ numerator: calculator.multiply(moneyToMinorUnits(value), ratio.numerator), denominator: ratio.denominator }, value.currency, options)
}
export const divideMoney = (value: Money, divisor: DecimalText, options: MoneyRoundingOptions = {}): Money => {
  const ratio = decimalFraction(divisor)
  return settleFraction({ numerator: calculator.multiply(moneyToMinorUnits(value), ratio.denominator), denominator: ratio.numerator }, value.currency, options)
}
export const percentageMoney = (value: Money, percentage: DecimalText, options: MoneyRoundingOptions = {}): Money => {
  const ratio = decimalFraction(percentage)
  return settleFraction({ numerator: calculator.multiply(moneyToMinorUnits(value), ratio.numerator),
    denominator: calculator.multiply(ratio.denominator, BigInt(100)) }, value.currency, options)
}
export const roundMoney = (value: Money, options: MoneyRoundingOptions = {}): Money =>
  settleFraction({ numerator: moneyToMinorUnits(value), denominator: ONE }, value.currency, options)
export const compareScaledMoney = (left: Money, leftFactor: DecimalText, right: Money, rightFactor: DecimalText): -1 | 0 | 1 => {
  assertSameCurrency(left, right)
  const a = decimalFraction(leftFactor)
  const b = decimalFraction(rightFactor)
  return calculator.compare(calculator.multiply(calculator.multiply(moneyToMinorUnits(left), a.numerator), b.denominator),
    calculator.multiply(calculator.multiply(moneyToMinorUnits(right), b.numerator), a.denominator))
}

const integerRatios = (ratios: readonly DecimalText[]): bigint[] => {
  const fractions = ratios.map(decimalFraction)
  const denominator = fractions.reduce((largest, fraction) => fraction.denominator > largest ? fraction.denominator : largest, ONE)
  return fractions.map(fraction => {
    if (fraction.numerator < ZERO) throw new RangeError('Allocation ratios must be nonnegative.')
    return calculator.multiply(fraction.numerator, calculator.integerDivide(denominator, fraction.denominator))
  })
}
const settleQuotas = (value: Money, numerators: readonly bigint[], denominator: bigint, target: bigint,
  method: 'largestRemainder' | 'ordered' = 'largestRemainder'): Money[] => {
  const shares = numerators.map((numerator, index) => ({ index,
    units: calculator.integerDivide(numerator, denominator), remainder: calculator.modulo(numerator, denominator) }))
  let remaining = calculator.subtract(target, shares.reduce((total, share) => calculator.add(total, share.units), ZERO))
  const ranked = shares.filter(share => numerators[share.index] !== ZERO)
    .sort((a, b) => method === 'ordered' ? a.index - b.index : calculator.compare(b.remainder, a.remainder) || a.index - b.index)
  for (const share of ranked) {
    if (remaining <= ZERO) break
    share.units = calculator.increment(share.units)
    remaining = calculator.decrement(remaining)
  }
  const negative = moneyToMinorUnits(value) < ZERO
  return shares.map(share => moneyFromMinorUnits(negative ? calculator.subtract(ZERO, share.units) : share.units, value.currency))
}
export const allocateMoney = (value: Money, ratios: readonly DecimalText[], options: MoneyAllocationOptions = {}): Money[] => {
  const weights = integerRatios(ratios)
  if (options.method !== 'largestRemainder' && options.method !== 'ordered') return allocate(dineroMoney(value), weights)
    .map(part => moneyFromMinorUnits(toSnapshot(part).amount, value.currency))
  const denominator = weights.reduce((total, weight) => calculator.add(total, weight), ZERO)
  if (denominator === ZERO) throw new RangeError('Allocation ratios must include a positive value.')
  const amount = moneyToMinorUnits(absMoney(value))
  return settleQuotas(value, weights.map(weight => calculator.multiply(amount, weight)), denominator, amount, options.method)
}
/** Percentage quotas round their combined target once, then distribute by exact remainder. */
export const allocateMoneyByPercentages = (value: Money, percentages: readonly DecimalText[]): Money[] => {
  const fractions = percentages.map(decimalFraction)
  const common = fractions.reduce((largest, fraction) => fraction.denominator > largest ? fraction.denominator : largest, ONE)
  const denominator = calculator.multiply(common, BigInt(100))
  const amount = moneyToMinorUnits(absMoney(value))
  const numerators = fractions.map(fraction => {
    if (fraction.numerator < ZERO) throw new RangeError('Allocation percentages must be nonnegative.')
    return calculator.multiply(calculator.multiply(amount, fraction.numerator), calculator.integerDivide(common, fraction.denominator))
  })
  const total = numerators.reduce((sum, numerator) => calculator.add(sum, numerator), ZERO)
  return settleQuotas(value, numerators, denominator, halfAwayFromZero(total, denominator, calculator))
}

/** Formats exact decimal text without assigning it a currency or settlement precision. */
export const formatDecimalText = (value: DecimalText, locale: string): string => {
  const canonical = parseDecimalText(value)
  const [integer = '0', fraction = ''] = canonical.split('.')
  const formatter = new Intl.NumberFormat(locale, { minimumFractionDigits: fraction ? 1 : 0, maximumFractionDigits: fraction ? 1 : 0 })
  const units = integer === '-0' ? -0 : BigInt(integer)
  return formatter.formatToParts(units).map(part => part.type === 'fraction' ? fraction : part.value).join('')
}
export const formatMoneyText = (value: Money, locale: string): string => {
  const digits = getCurrencyFractionDigits(value.currency)
  const [integer = '0', rawFraction = ''] = majorMoneyText(value).split('.')
  const fraction = rawFraction.padEnd(digits, '0')
  const formatter = new Intl.NumberFormat(locale, { style: 'currency', currency: value.currency,
    minimumFractionDigits: digits, maximumFractionDigits: digits })
  return formatter.formatToParts(integer === '-0' ? -0 : BigInt(integer))
    .map(part => part.type === 'fraction' ? fraction : part.value).join('')
}

/** Dimensionless ratios may use the same exact calculator without being branded as money. */
export { calculator as moneyCalculator }
