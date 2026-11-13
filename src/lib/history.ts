import type { Category, Transaction, TxType } from '../data/types'
import { monthKey } from './dates'
import { normalize } from './id'

/** Texte de recherche normalisé de chaque opération, calculé une fois (et non à chaque frappe). */
export function buildSearchIndex(txs: Transaction[], cats: Map<string, Category>): Map<string, string> {
  const m = new Map<string, string>()
  for (const t of txs) m.set(t.id, normalize([t.payee, t.note, t.rawLabel, cats.get(t.categoryId ?? '')?.name, ...t.tags].filter(Boolean).join(' ')))
  return m
}

export interface HistoryFilter {
  q: string
  month: string
  archives: boolean
  archiveFrom: string
  type: TxType | 'all'
  accountId: string
  catId: string
  member: string
  tag: string
  common: string
}

/** Filtre de l'Historique (mêmes règles qu'en v1) : sans recherche, un mois ; avec recherche, toutes les périodes. */
export function filterTransactions(all: Transaction[], f: HistoryFilter, index: Map<string, string>): Transaction[] {
  const nq = normalize(f.q)
  return all.filter((t) => {
    if (!f.q && monthKey(t.date) !== f.month) return false
    if (!f.archives && t.date < f.archiveFrom) return false
    if (f.type !== 'all' && t.type !== f.type) return false
    if (f.accountId && t.accountId !== f.accountId && t.toAccountId !== f.accountId) return false
    if (f.catId && (f.catId === 'none' ? !!t.categoryId : t.categoryId !== f.catId)) return false
    if (f.member && (t.member ?? f.common) !== f.member) return false
    if (f.tag && !t.tags.includes(f.tag)) return false
    if (nq && !(index.get(t.id) ?? '').includes(nq)) return false
    return true
  })
}

/** Regroupement par jour, dans l'ordre reçu (linéaire). */
export function groupByDay(txs: Transaction[]): [string, Transaction[]][] {
  const m = new Map<string, Transaction[]>()
  for (const t of txs) {
    const g = m.get(t.date)
    if (g) g.push(t)
    else m.set(t.date, [t])
  }
  return [...m.entries()]
}

/** Nombre de lignes affichées d'un coup ; « Voir plus » en ajoute autant. */
export const PAGE_SIZE = 200
