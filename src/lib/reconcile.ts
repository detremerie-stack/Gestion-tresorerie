import type { Transaction } from '../data/types'
import { daysBetween, type ISODate } from './dates'

/**
 * Trouve une opération saisie à la main (ou via Wallet) correspondant à une ligne de relevé :
 * même compte, même sens, pas encore rapprochée, date de 7 jours avant à 2 jours après,
 * montant identique (à 1 F / 1 centime près) ou à 4 % près si payée en devise étrangère.
 */
export function findManualMatch(row: { date: ISODate; amount: number }, accountId: string, txs: Transaction[], used: Set<string>): Transaction | undefined {
  const type = row.amount < 0 ? 'expense' : 'income'
  const target = Math.abs(row.amount)
  let best: { t: Transaction; score: number } | undefined
  for (const t of txs) {
    if (t.deleted || t.importHash || used.has(t.id) || t.accountId !== accountId || t.type !== type) continue
    const lag = daysBetween(t.date, row.date)
    if (lag < -2 || lag > 7) continue
    const diff = Math.abs(t.amount - target)
    const tolerance = t.originalCurrency ? target * 0.04 : Math.max(1, target * 0.0001)
    if (diff > tolerance) continue
    const score = diff / Math.max(1, target) * 100 + Math.abs(lag) * 0.1
    if (!best || score < best.score) best = { t, score }
  }
  return best?.t
}
