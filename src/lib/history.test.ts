import { readFileSync, existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import fixture from '../test/fixture-sauvegarde.json'
import type { Category, Transaction } from '../data/types'
import { buildSearchIndex, filterTransactions, groupByDay, type HistoryFilter } from './history'
import { monthKey } from './dates'
import { normalize } from './id'

/** Copie du filtre v1 (Transactions.tsx) : référence pour « même nombre de résultats ». */
function v1Filter(all: Transaction[], f: HistoryFilter, cats: Map<string, Category>) {
  const nq = normalize(f.q)
  return all.filter((t) => {
    if (!f.q && monthKey(t.date) !== f.month) return false
    if (!f.archives && t.date < f.archiveFrom) return false
    if (f.type !== 'all' && t.type !== f.type) return false
    if (f.accountId && t.accountId !== f.accountId && t.toAccountId !== f.accountId) return false
    if (f.catId && (f.catId === 'none' ? !!t.categoryId : t.categoryId !== f.catId)) return false
    if (f.member && (t.member ?? f.common) !== f.member) return false
    if (f.tag && !t.tags.includes(f.tag)) return false
    if (nq) {
      const hay = normalize([t.payee, t.note, t.rawLabel, cats.get(t.categoryId ?? '')?.name, ...t.tags].filter(Boolean).join(' '))
      if (!hay.includes(nq)) return false
    }
    return true
  })
}

const base: HistoryFilter = { q: '', month: '2026-11', archives: false, archiveFrom: '2025-01-01', type: 'all', accountId: '', catId: '', member: '', tag: '', common: 'commun' }
const cases: Partial<HistoryFilter>[] = [{}, { q: 'a' }, { q: 'épicerie' }, { q: 'COURSES' }, { q: 'zzz' }, { type: 'expense' }, { accountId: 'a-deblock' }, { catId: 'none' }, { member: 'commun', q: 'e' }, { month: '2026-09', type: 'income' }]

function check(data: Record<string, Record<string, unknown>>) {
  const all = Object.values(data.transactions).filter((t) => !(t as Transaction).deleted) as Transaction[]
  all.sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt))
  const cats = new Map(Object.values(data.categories ?? {}).map((c) => [(c as Category).id, c as Category]))
  const index = buildSearchIndex(all, cats)
  for (const c of cases) {
    const f = { ...base, ...c }
    expect(filterTransactions(all, f, index)).toEqual(v1Filter(all, f, cats))
  }
}

describe('Historique : même résultat qu’en v1', () => {
  it('fixture', () => check(fixture.data as unknown as Record<string, Record<string, unknown>>))
  const real = process.env.FARE_MONI_SAUVEGARDE
  it.skipIf(!real || !existsSync(real))('sauvegarde réelle', () => check(JSON.parse(readFileSync(real!, 'utf8')).data))
  it('regroupement par jour, ordre conservé', () => {
    const t = (id: string, date: string) => ({ id, date }) as Transaction
    expect(groupByDay([t('a', '2026-11-13'), t('b', '2026-11-13'), t('c', '2026-11-12')]).map(([d, xs]) => [d, xs.map((x) => x.id)])).toEqual([['2026-11-13', ['a', 'b']], ['2026-11-12', ['c']]])
  })
})
