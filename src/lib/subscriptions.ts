import type { Subscription } from '../data/types'
import { addInterval, nextOnOrAfter, occurrencesBetween, split, type ISODate } from './dates'
import { isFixedRate, rateOf, type Rates } from './money'

const PER_MONTH = { day: 365.25 / 12, week: 365.25 / 12 / 7, month: 1, year: 1 / 12 }

export function isActive(s: Subscription): boolean {
  return s.status === 'active' || s.status === 'trial'
}

/** Coût mensuel en XPF (0 si en pause ou résilié). `fxFeePct` s'applique aux devises étrangères. */
export function monthlyCost(s: Subscription, rates: Rates, fxFeePct = 0): number {
  if (!isActive(s)) return 0
  return Math.round(paymentXPF(s, rates, fxFeePct) * (PER_MONTH[s.unit] / s.every))
}

export function yearlyCost(s: Subscription, rates: Rates, fxFeePct = 0): number {
  if (!isActive(s)) return 0
  return Math.round(paymentXPF(s, rates, fxFeePct) * ((PER_MONTH[s.unit] * 12) / s.every))
}

/** Montant d'un prélèvement converti en XPF (non arrondi). */
export function paymentXPF(s: Subscription, rates: Rates, fxFeePct = 0): number {
  const fee = s.currency === 'XPF' ? 0 : fxFeePct
  return s.amount * rateOf(s.currency, rates) * (1 + fee / 100)
}

/** Le montant XPF est-il exact (XPF ou EUR à parité fixe, sans frais) ? */
export function isExact(s: Subscription, fxFeePct = 0): boolean {
  return isFixedRate(s.currency) && (s.currency === 'XPF' || fxFeePct === 0)
}

function seriesStart(s: Subscription): ISODate {
  return s.trialEnd && s.trialEnd > s.startDate ? s.trialEnd : s.startDate
}

function afterPaid(s: Subscription): ISODate | undefined {
  return s.lastPaidDate ? addInterval(s.lastPaidDate, 1, 'day') : undefined
}

/** Prochaine échéance à partir de `from`, ou null si résilié/en pause. */
export function nextPayment(s: Subscription, from: ISODate): ISODate | null {
  if (!isActive(s)) return null
  const paid = afterPaid(s)
  const min = paid && paid > from ? paid : from
  return nextOnOrAfter(seriesStart(s), s.every, s.unit, min)
}

export interface Upcoming {
  sub: Subscription
  date: ISODate
}

export function upcomingPayments(subs: Subscription[], from: ISODate, to: ISODate): Upcoming[] {
  const out: Upcoming[] = []
  for (const sub of subs) {
    if (!isActive(sub) || sub.deleted) continue
    const paid = afterPaid(sub)
    const min = paid && paid > from ? paid : from
    for (const date of occurrencesBetween(seriesStart(sub), sub.every, sub.unit, min, to)) out.push({ sub, date })
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.sub.name.localeCompare(b.sub.name))
}

/** Échéances passées (≤ today) non encore marquées payées, depuis la dernière payée (max 12). */
export function dueForPayment(s: Subscription, today: ISODate): ISODate[] {
  if (!isActive(s) || s.deleted) return []
  const from = afterPaid(s) ?? seriesStart(s)
  return occurrencesBetween(seriesStart(s), s.every, s.unit, from, today).slice(-12)
}

export function costByTag(subs: Subscription[], rates: Rates): { tag: string; count: number; monthly: number }[] {
  const map = new Map<string, { tag: string; count: number; monthly: number }>()
  for (const s of subs) {
    if (!isActive(s) || s.deleted) continue
    const tags = s.tags.length ? s.tags : ['Sans étiquette']
    for (const tag of tags) {
      const e = map.get(tag) ?? { tag, count: 0, monthly: 0 }
      e.count++
      e.monthly += monthlyCost(s, rates)
      map.set(tag, e)
    }
  }
  return [...map.values()].sort((a, b) => b.monthly - a.monthly || a.tag.localeCompare(b.tag))
}

export function cycleLabel(s: Pick<Subscription, 'every' | 'unit'>): string {
  const names = { day: ['jour', 'jours'], week: ['semaine', 'semaines'], month: ['mois', 'mois'], year: ['an', 'ans'] }
  if (s.every === 1) return { day: 'Quotidien', week: 'Hebdomadaire', month: 'Mensuel', year: 'Annuel' }[s.unit]
  if (s.unit === 'month' && s.every === 3) return 'Trimestriel'
  if (s.unit === 'month' && s.every === 6) return 'Semestriel'
  return `Tous les ${s.every} ${names[s.unit][1]}`
}

export function dayOfMonth(date: ISODate): number {
  return split(date)[2]
}
