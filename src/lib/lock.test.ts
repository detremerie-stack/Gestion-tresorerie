import { beforeEach, describe, expect, it, vi } from 'vitest'

const mem = new Map<string, string>()
vi.stubGlobal('localStorage', { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => { mem.set(k, v) }, removeItem: (k: string) => { mem.delete(k) } })
const { lockDelay, lockTries, recordFailure, resetFailures } = await import('./lock')

beforeEach(() => mem.clear())

describe('P5 — délai croissant après 5 codes faux', () => {
  it('rien avant 5 erreurs, puis 30 s, 1 min, 2 min, 5 min', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 12].map(lockDelay)).toEqual([0, 0, 0, 0, 30, 60, 120, 300, 300])
  })
  it('compte les erreurs (gardées si l’on recharge) et se remet à zéro au bon code', () => {
    const t0 = 1_000_000
    for (let i = 0; i < 4; i++) expect(recordFailure(t0)).toBe(0)
    expect(recordFailure(t0)).toBe(t0 + 30_000)
    expect(lockTries()).toEqual({ failures: 5, until: t0 + 30_000 })
    expect(recordFailure(t0)).toBe(t0 + 60_000)
    resetFailures()
    expect(lockTries()).toEqual({ failures: 0, until: 0 })
  })
})
