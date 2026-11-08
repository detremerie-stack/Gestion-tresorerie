import type { ImportMapping } from '../../data/types'
import { parseDate, type DateOrder, type ISODate } from '../dates'
import { normalize } from '../id'
import { parseAmount } from '../money'

export interface ParsedRow {
  date: ISODate
  label: string
  /** Signé : négatif = dépense, positif = rentrée. */
  amount: number
  fitId?: string
}

export interface RowError {
  line: number
  reason: string
}

const KEYS = {
  date: ['date operation', 'date de l operation', 'date', 'date comptable', 'transaction date', 'posted date', 'date valeur'],
  label: ['libelle', 'description', 'detail', 'intitule', 'operation', 'nature', 'merchant', 'payee', 'beneficiaire'],
  amount: ['montant', 'amount', 'somme', 'valeur', 'montant xpf', 'montant eur'],
  debit: ['debit', 'debits', 'sortie', 'retrait'],
  credit: ['credit', 'credits', 'entree', 'versement'],
}

function findCol(header: string[], keys: string[], exclude: number[] = []): number | undefined {
  const h = header.map((x) => normalize(x).replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim())
  for (const k of keys) {
    const i = h.findIndex((x, idx) => !exclude.includes(idx) && x === k)
    if (i > -1) return i
  }
  for (const k of keys) {
    const i = h.findIndex((x, idx) => !exclude.includes(idx) && x.includes(k))
    if (i > -1) return i
  }
  return undefined
}

/** Devine le mapping de colonnes à partir de l'en-tête et des premières lignes. */
export function guessMapping(rows: string[][], delimiter: string): ImportMapping {
  // Sauter d'éventuelles lignes de titre avant l'en-tête (relevés « Excel »).
  let skipRows = 0
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    if (findCol(rows[i], KEYS.date) !== undefined && (findCol(rows[i], KEYS.amount) !== undefined || findCol(rows[i], KEYS.debit) !== undefined)) {
      skipRows = i
      break
    }
  }
  const header = rows[skipRows] ?? []
  const hasHeader = header.some((c) => parseDate(c) === null && Number.isNaN(parseAmount(c)))
  const sample = rows.slice(skipRows + (hasHeader ? 1 : 0), skipRows + 30)

  let dateCol = hasHeader ? findCol(header, KEYS.date) : undefined
  dateCol ??= firstCol(sample, (v) => parseDate(v) !== null) ?? 0
  const debitCol = hasHeader ? findCol(header, KEYS.debit, [dateCol]) : undefined
  const creditCol = hasHeader ? findCol(header, KEYS.credit, [dateCol]) : undefined
  let amountCol = hasHeader ? findCol(header, KEYS.amount, [dateCol]) : undefined
  if (amountCol === undefined && (debitCol === undefined || creditCol === undefined)) {
    amountCol = firstCol(sample, (v) => /\d/.test(v) && !Number.isNaN(parseAmount(v)) && parseDate(v) === null, [dateCol])
  }
  let labelCol = hasHeader ? findCol(header, KEYS.label, [dateCol]) : undefined
  labelCol ??= longestTextCol(sample, [dateCol, amountCol ?? -1, debitCol ?? -1, creditCol ?? -1])

  return {
    delimiter,
    hasHeader,
    skipRows,
    dateCol,
    labelCol,
    amountCol: debitCol !== undefined && creditCol !== undefined ? undefined : amountCol,
    debitCol: debitCol !== undefined && creditCol !== undefined ? debitCol : undefined,
    creditCol: debitCol !== undefined && creditCol !== undefined ? creditCol : undefined,
    dateOrder: guessDateOrder(sample.map((r) => r[dateCol!] ?? '')),
    invert: false,
  }
}

function firstCol(rows: string[][], test: (v: string) => boolean, exclude: number[] = []): number | undefined {
  const width = Math.max(0, ...rows.map((r) => r.length))
  for (let c = 0; c < width; c++) {
    if (exclude.includes(c)) continue
    const vals = rows.map((r) => r[c] ?? '').filter(Boolean)
    if (vals.length && vals.filter(test).length / vals.length > 0.8) return c
  }
  return undefined
}

function longestTextCol(rows: string[][], exclude: number[]): number {
  const width = Math.max(0, ...rows.map((r) => r.length))
  let best = 0
  let bestLen = -1
  for (let c = 0; c < width; c++) {
    if (exclude.includes(c)) continue
    const len = rows.reduce((s, r) => s + (r[c]?.replace(/[\d\s.,-]/g, '').length ?? 0), 0)
    if (len > bestLen) {
      bestLen = len
      best = c
    }
  }
  return best
}

function guessDateOrder(values: string[]): DateOrder {
  for (const v of values) {
    const m = v.match(/^(\d{1,2})[-/.](\d{1,2})[-/.]\d{2,4}/)
    if (!m) continue
    if (Number(m[2]) > 12) return 'MDY'
    if (Number(m[1]) > 12) return 'DMY'
  }
  return 'DMY'
}

export function applyMapping(rows: string[][], m: ImportMapping): { rows: ParsedRow[]; errors: RowError[] } {
  const out: ParsedRow[] = []
  const errors: RowError[] = []
  const start = m.skipRows + (m.hasHeader ? 1 : 0)
  rows.slice(start).forEach((r, i) => {
    const line = start + i + 1
    const date = parseDate(r[m.dateCol] ?? '', m.dateOrder)
    if (!date) {
      errors.push({ line, reason: `Date illisible : « ${r[m.dateCol] ?? ''} »` })
      return
    }
    let amount: number
    if (m.amountCol !== undefined) amount = parseAmount(r[m.amountCol])
    else {
      const debit = parseAmount(r[m.debitCol ?? -1] ?? '')
      const credit = parseAmount(r[m.creditCol ?? -1] ?? '')
      amount = (Number.isNaN(credit) ? 0 : Math.abs(credit)) - (Number.isNaN(debit) ? 0 : Math.abs(debit))
      if (Number.isNaN(debit) && Number.isNaN(credit)) amount = NaN
    }
    if (Number.isNaN(amount)) {
      errors.push({ line, reason: 'Montant illisible' })
      return
    }
    if (m.invert) amount = -amount
    if (amount === 0) return
    out.push({ date, label: (r[m.labelCol] ?? '').replace(/\s+/g, ' ').trim(), amount })
  })
  return { rows: out, errors }
}

/**
 * Empreinte anti-doublon. Deux opérations identiques le même jour (deux cafés) restent distinctes
 * grâce au numéro d'occurrence.
 */
export function importHashes(accountId: string, rows: ParsedRow[]): string[] {
  const seen = new Map<string, number>()
  return rows.map((r) => {
    if (r.fitId) return `${accountId}|fit|${r.fitId}`
    const base = `${accountId}|${r.date}|${r.amount.toFixed(2)}|${normalize(r.label)}`
    const n = (seen.get(base) ?? 0) + 1
    seen.set(base, n)
    return `${base}#${n}`
  })
}
