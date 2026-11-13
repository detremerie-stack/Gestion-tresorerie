import { CURRENCIES, parseAmount, type Currency } from './money'

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

/** Montant maximal accepté : 9 chiffres avant la virgule (comme le pavé de saisie). */
export const MAX_AMOUNT = 999_999_999

/** Montant enregistrable : nombre fini, strictement positif, au plus 9 chiffres avant la virgule. */
export function isValidAmount(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0 && n <= MAX_AMOUNT
}

/** Devise connue de l'application (liste `CURRENCIES`), sinon `undefined`. */
export function knownCurrency(code: string | null | undefined): Currency | undefined {
  if (!code) return undefined
  const c = code.trim().toUpperCase()
  return CURRENCIES.some((x) => x.code === c) ? (c as Currency) : undefined
}

/**
 * Paramètres de `#/rapide?montant=…&devise=…&marchand=…&carte=…` (ou `titre`/`texte` d'une notification),
 * validés : montant hors bornes ou devise inconnue → ignorés (champ laissé vide).
 */
export function quickParams(get: (name: string) => string | null): ParsedPayment {
  const titre = get('titre')
  const texte = get('texte')
  const parsed = texte || titre ? parsePaymentText(titre ?? '', texte ?? '') : {}
  const montant = get('montant')
  const amount = montant ? parseAmount(montant) : parsed.amount
  const devise = get('devise')
  const carte = get('carte') ?? parsed.last4
  return {
    amount: isValidAmount(amount) ? amount : undefined,
    currency: devise ? knownCurrency(devise) : parsed.currency,
    merchant: get('marchand') ?? parsed.merchant,
    last4: carte && /^\d{1,4}$/.test(carte) ? carte : undefined,
  }
}
