/** Devises gérées. XPF = Franc Pacifique (F CFP). */
export type Currency = 'XPF' | 'EUR' | 'USD' | 'AUD' | 'NZD' | 'JPY' | 'GBP' | 'CAD'

export const CURRENCIES: { code: Currency; label: string; decimals: number; symbol: string }[] = [
  { code: 'XPF', label: 'Franc Pacifique (F CFP)', decimals: 0, symbol: 'F' },
  { code: 'EUR', label: 'Euro', decimals: 2, symbol: '€' },
  { code: 'USD', label: 'Dollar américain', decimals: 2, symbol: '$US' },
  { code: 'AUD', label: 'Dollar australien', decimals: 2, symbol: '$AU' },
  { code: 'NZD', label: 'Dollar néo-zélandais', decimals: 2, symbol: '$NZ' },
  { code: 'CAD', label: 'Dollar canadien', decimals: 2, symbol: '$CA' },
  { code: 'GBP', label: 'Livre sterling', decimals: 2, symbol: '£' },
  { code: 'JPY', label: 'Yen', decimals: 0, symbol: '¥' },
]

/** Parité fixe : 1 000 XPF = 8,38 EUR. */
export const EUR_XPF = 1000 / 8.38

/** Taux variables : nombre de XPF pour 1 unité de devise (l'euro est fixe et n'y figure pas). */
export type Rates = Partial<Record<Currency, number>>

export const DEFAULT_RATES: Rates = { USD: 110, AUD: 72, NZD: 66, CAD: 80, GBP: 140, JPY: 0.73 }

export function decimalsOf(currency: Currency): number {
  return CURRENCIES.find((c) => c.code === currency)?.decimals ?? 2
}

export function roundTo(value: number, currency: Currency): number {
  const f = 10 ** decimalsOf(currency)
  return Math.round((value + Number.EPSILON) * f) / f
}

export function rateOf(currency: Currency, rates: Rates): number {
  if (currency === 'XPF') return 1
  if (currency === 'EUR') return EUR_XPF
  return rates[currency] ?? DEFAULT_RATES[currency] ?? 1
}

/** true si la conversion vers XPF est exacte (XPF, ou EUR à parité fixe). */
export function isFixedRate(currency: Currency): boolean {
  return currency === 'XPF' || currency === 'EUR'
}

/**
 * Frais de change effectifs (%) d'un paiement en `payCurrency` débité sur un compte en `accountCurrency`.
 * Aucun frais si même devise, ni entre XPF et EUR (parité fixe : ni la BT ni AmEx ne prennent de commission).
 */
export function effectiveFee(payCurrency: Currency, accountCurrency: Currency | undefined, feePct: number | undefined): number {
  if (!feePct || !accountCurrency || payCurrency === accountCurrency) return 0
  if (isFixedRate(payCurrency) && isFixedRate(accountCurrency)) return 0
  return feePct
}

export function toXPF(amount: number, currency: Currency, rates: Rates): number {
  return Math.round(amount * rateOf(currency, rates))
}

export function fromXPF(amountXPF: number, currency: Currency, rates: Rates): number {
  return roundTo(amountXPF / rateOf(currency, rates), currency)
}

const formatters = new Map<string, Intl.NumberFormat>()
function nf(decimals: number): Intl.NumberFormat {
  const key = String(decimals)
  let f = formatters.get(key)
  if (!f) {
    f = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    formatters.set(key, f)
  }
  return f
}

/** Formate un montant : « 21 326 F », « 13,99 € ». Signe moins typographique. */
export function formatMoney(amount: number, currency: Currency = 'XPF', opts: { sign?: boolean } = {}): string {
  const def = CURRENCIES.find((c) => c.code === currency)
  const decimals = def?.decimals ?? 2
  const abs = nf(decimals).format(Math.abs(roundTo(amount, currency)))
  const symbol = def?.symbol ?? currency
  let sign = ''
  if (amount < 0 && Math.abs(roundTo(amount, currency)) > 0) sign = '−'
  else if (opts.sign && amount > 0) sign = '+'
  return `${sign}${abs} ${symbol}`
}

/**
 * Lit un montant saisi ou importé, en format français (1 234,56) ou anglais (1,234.56).
 * Parenthèses = négatif (format comptable). Retourne NaN si illisible.
 */
export function parseAmount(raw: string | number | null | undefined): number {
  if (typeof raw === 'number') return raw
  if (raw == null) return NaN
  let s = String(raw).trim()
  if (!s) return NaN
  let negative = false
  if (/^\(.*\)$/.test(s)) {
    negative = true
    s = s.slice(1, -1)
  }
  s = s.replace(/[^\d.,\-+]/g, '')
  if (s.startsWith('-') || s.endsWith('-')) negative = !negative
  s = s.replace(/[-+]/g, '')
  if (!s) return NaN
  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')
  if (lastComma > -1 && lastDot > -1) {
    // Le dernier séparateur rencontré est le séparateur décimal.
    if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.')
    else s = s.replace(/,/g, '')
  } else if (lastComma > -1) {
    const decimals = s.length - lastComma - 1
    const commas = s.split(',').length - 1
    // « 1,000 » ou « 1,000,000 » = séparateur de milliers ; sinon virgule décimale.
    if (commas > 1 || decimals === 3) s = s.replace(/,/g, '')
    else s = s.replace(',', '.')
  } else if (lastDot > -1) {
    const dots = s.split('.').length - 1
    if (dots > 1) s = s.replace(/\./g, '')
  }
  const n = Number(s)
  if (Number.isNaN(n)) return NaN
  return negative ? -n : n
}
