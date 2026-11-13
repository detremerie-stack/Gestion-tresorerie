import { formatDate, type ISODate } from './dates'
import { formatMoney, toXPF, type Currency, type Rates } from './money'

/** Au-delà de ce montant (en F), on demande confirmation : une faute de frappe fausserait tous les soldes. */
export const UNUSUAL_XPF = 1_000_000

/** Avertissements avant d'enregistrer une opération (recette R6) : montant inhabituel, date dans le futur. */
export function entryWarnings(p: { amount: number; currency: Currency; date: ISODate; today: ISODate; rates: Rates }): string[] {
  const out: string[] = []
  if (toXPF(p.amount, p.currency, p.rates) >= UNUSUAL_XPF) out.push(`Le montant est inhabituel : ${formatMoney(p.amount, p.currency)}.`)
  if (p.date > p.today) out.push(`La date est dans le futur : ${formatDate(p.date)}.`)
  return out
}
