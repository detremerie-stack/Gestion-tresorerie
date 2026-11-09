import { parseAmount, type Currency } from './money'

export interface ParsedPayment {
  amount?: number
  currency?: Currency
  merchant?: string
  last4?: string
}

const CUR: [RegExp, Currency][] = [[/XPF|F\s?CFP|\bF\b|FCFP/i, 'XPF'], [/€|EUR/i, 'EUR'], [/\$US|USD|US\$|\$/i, 'USD']]

/**
 * Lit une notification de paiement (Google Wallet, banque…) transmise par une automatisation
 * (titre = souvent le commerçant, texte = montant + carte). Tolérant aux formats.
 */
export function parsePaymentText(title: string, text: string): ParsedPayment {
  const all = `${title ?? ''} ${text ?? ''}`
  const out: ParsedPayment = {}
  const amt =
    all.match(/(XPF|EUR|USD|€|\$)\s*(\d[\d\s  ]*(?:[.,]\d{1,2})?)/i) ??
    all.match(/(\d[\d\s  ]*(?:[.,]\d{1,2})?)\s*(XPF|F\s?CFP|FCFP|F\b|€|EUR|USD|\$)/i)
  if (amt) {
    const [num, cur] = /^\d/.test(amt[1]) ? [amt[1], amt[2]] : [amt[2], amt[1]]
    const v = parseAmount(num.replace(/[  ]/g, ' '))
    if (!Number.isNaN(v) && v > 0) {
      out.amount = v
      out.currency = CUR.find(([re]) => re.test(cur))?.[1] ?? 'XPF'
    }
  }
  const card = all.match(/(?:•|\*|x|X){2,}\s?(\d{4})\b/) ?? all.match(/carte\D{0,12}(\d{4})\b/i) ?? all.match(/\b(\d{4})\s*$/)
  if (card) out.last4 = card[1]
  const chez = text?.match(/\bchez\s+(.+?)(?:\s+avec\b|\s+le\s+\d|[.,;]|$)/i)
  const merchant = (chez?.[1] ?? title ?? '').trim()
  if (merchant && !/^(google wallet|wallet|paiement|payment)$/i.test(merchant)) out.merchant = merchant
  return out
}
