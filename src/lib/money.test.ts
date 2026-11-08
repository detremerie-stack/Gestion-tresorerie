import { describe, expect, it } from 'vitest'
import { EUR_XPF, effectiveFee, formatMoney, parseAmount, toXPF, fromXPF, roundTo } from './money'

const rates = { USD: 110.5 }

describe('money', () => {
  it('uses the fixed EUR peg', () => {
    expect(EUR_XPF).toBeCloseTo(119.331742, 6)
    expect(toXPF(8.38, 'EUR', rates)).toBe(1000)
  })
  it('converts USD with the given rate and rounds XPF to integer', () => {
    expect(toXPF(10, 'USD', rates)).toBe(1105)
    expect(toXPF(1.99, 'USD', rates)).toBe(220)
    expect(toXPF(1234, 'XPF', rates)).toBe(1234)
  })
  it('converts back from XPF', () => {
    expect(fromXPF(1000, 'EUR', rates)).toBeCloseTo(8.38, 2)
  })
  it('formats XPF without decimals', () => {
    expect(formatMoney(21325.87, 'XPF')).toBe('21 326 F')
    expect(formatMoney(-3900, 'XPF')).toBe('−3 900 F')
  })
  it('formats EUR and USD with 2 decimals', () => {
    expect(formatMoney(13.99, 'EUR')).toBe('13,99 €')
    expect(formatMoney(9.99, 'USD')).toBe('9,99 $US')
  })
  it('parses French and English amounts', () => {
    expect(parseAmount('1 234,56')).toBe(1234.56)
    expect(parseAmount('1.234,56')).toBe(1234.56)
    expect(parseAmount('1,234.56')).toBe(1234.56)
    expect(parseAmount('-12,5 €')).toBe(-12.5)
    expect(parseAmount('3 900 XPF')).toBe(3900)
    expect(parseAmount('(45.00)')).toBe(-45)
    expect(parseAmount('')).toBeNaN()
    expect(parseAmount('1,000')).toBe(1000)
  })
  it('applies FX fees only between non-pegged currencies', () => {
    expect(effectiveFee('USD', 'EUR', 2.8)).toBe(2.8)
    expect(effectiveFee('USD', 'XPF', 2.8)).toBe(2.8)
    expect(effectiveFee('XPF', 'EUR', 2.8)).toBe(0)
    expect(effectiveFee('EUR', 'XPF', 2.8)).toBe(0)
    expect(effectiveFee('EUR', 'EUR', 2.8)).toBe(0)
    expect(effectiveFee('USD', undefined, 2.8)).toBe(0)
  })
  it('rounds by currency', () => {
    expect(roundTo(10.555, 'EUR')).toBe(10.56)
    expect(roundTo(10.5, 'XPF')).toBe(11)
  })
})
