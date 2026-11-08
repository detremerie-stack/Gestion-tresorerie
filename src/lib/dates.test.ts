import { describe, expect, it } from 'vitest'
import { addInterval, daysBetween, formatDate, parseDate, monthKey, monthRange, nextOnOrAfter, occurrencesBetween } from './dates'

describe('dates', () => {
  it('adds months clamping to end of month', () => {
    expect(addInterval('2026-01-31', 1, 'month')).toBe('2026-02-28')
    expect(addInterval('2024-01-31', 1, 'month')).toBe('2024-02-29')
    expect(addInterval('2026-11-08', 1, 'year')).toBe('2027-11-08')
    expect(addInterval('2026-11-08', 2, 'week')).toBe('2026-11-22')
    expect(addInterval('2026-12-30', 3, 'day')).toBe('2027-01-02')
  })
  it('finds the next occurrence keeping the anchor day', () => {
    // Abonnement démarré le 31 janvier : on garde le 31 quand le mois le permet.
    expect(nextOnOrAfter('2026-01-31', 1, 'month', '2026-03-15')).toBe('2026-03-31')
    expect(nextOnOrAfter('2026-01-31', 1, 'month', '2026-02-01')).toBe('2026-02-28')
    expect(nextOnOrAfter('2025-04-08', 1, 'year', '2026-11-08')).toBe('2027-04-08')
    expect(nextOnOrAfter('2026-12-01', 1, 'month', '2026-11-08')).toBe('2026-12-01')
    expect(nextOnOrAfter('2026-11-08', 1, 'month', '2026-11-08')).toBe('2026-11-08')
  })
  it('lists occurrences in a range', () => {
    expect(occurrencesBetween('2026-01-15', 1, 'month', '2026-03-01', '2026-05-31')).toEqual(['2026-03-15', '2026-04-15', '2026-05-15'])
  })
  it('counts days', () => {
    expect(daysBetween('2026-11-08', '2026-11-15')).toBe(7)
    expect(daysBetween('2026-11-08', '2027-04-08')).toBe(151)
  })
  it('formats and parses French dates', () => {
    expect(formatDate('2026-11-08')).toBe('08/11/2026')
    expect(parseDate('08/11/2026')).toBe('2026-11-08')
    expect(parseDate('8/11/26')).toBe('2026-11-08')
    expect(parseDate('2026-11-08')).toBe('2026-11-08')
    expect(parseDate('11/25/2025', 'MDY')).toBe('2025-11-25')
    expect(parseDate('20261108')).toBe('2026-11-08')
    expect(parseDate('31/02/2026')).toBeNull()
    expect(parseDate('n/a')).toBeNull()
  })
  it('handles months', () => {
    expect(monthKey('2026-11-08')).toBe('2026-11')
    expect(monthRange('2026-02')).toEqual(['2026-02-01', '2026-02-28'])
  })
})
