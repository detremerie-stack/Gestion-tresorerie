/**
 * Dates « calendrier » au format ISO AAAA-MM-JJ (sans heure ni fuseau) :
 * on évite ainsi tout décalage lié au fuseau de Tahiti (UTC−10).
 */
export type ISODate = string
export type IntervalUnit = 'day' | 'week' | 'month' | 'year'

const pad = (n: number) => String(n).padStart(2, '0')

export function toISO(y: number, m: number, d: number): ISODate {
  return `${y}-${pad(m)}-${pad(d)}`
}

export function split(date: ISODate): [number, number, number] {
  const [y, m, d] = date.split('-').map(Number)
  return [y, m, d]
}

export function today(): ISODate {
  const now = new Date()
  return toISO(now.getFullYear(), now.getMonth() + 1, now.getDate())
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

function toUTC(date: ISODate): number {
  const [y, m, d] = split(date)
  return Date.UTC(y, m - 1, d)
}

function fromUTC(ms: number): ISODate {
  const dt = new Date(ms)
  return toISO(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate())
}

export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((toUTC(b) - toUTC(a)) / 86_400_000)
}

/** Ajoute n unités. Pour les mois/années, le jour est ramené à la fin du mois si besoin. */
export function addInterval(date: ISODate, n: number, unit: IntervalUnit, anchorDay?: number): ISODate {
  const [y, m, d] = split(date)
  if (unit === 'day') return fromUTC(toUTC(date) + n * 86_400_000)
  if (unit === 'week') return fromUTC(toUTC(date) + n * 7 * 86_400_000)
  const months = unit === 'year' ? n * 12 : n
  const total = y * 12 + (m - 1) + months
  const ny = Math.floor(total / 12)
  const nm = (total % 12) + 1
  const day = Math.min(anchorDay ?? d, daysInMonth(ny, nm))
  return toISO(ny, nm, day)
}

/** k-ième occurrence d'une série démarrant à `start` (k = 0 → start). */
export function nthOccurrence(start: ISODate, every: number, unit: IntervalUnit, k: number): ISODate {
  if (unit === 'day' || unit === 'week') return addInterval(start, every * k, unit)
  return addInterval(start, every * k, unit, split(start)[2])
}

/** Première occurrence ≥ `from`. */
export function nextOnOrAfter(start: ISODate, every: number, unit: IntervalUnit, from: ISODate): ISODate {
  if (start >= from) return start
  // Estimation pour éviter de boucler sur des années de jours.
  const approxDays = { day: 1, week: 7, month: 30.44, year: 365.25 }[unit] * every
  let k = Math.max(0, Math.floor(daysBetween(start, from) / approxDays) - 1)
  let d = nthOccurrence(start, every, unit, k)
  while (d < from) {
    k++
    d = nthOccurrence(start, every, unit, k)
  }
  return d
}

export function occurrencesBetween(start: ISODate, every: number, unit: IntervalUnit, from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = []
  let d = nextOnOrAfter(start, every, unit, from)
  const anchor = split(start)[2]
  let guard = 0
  while (d <= to && guard++ < 2000) {
    out.push(d)
    d = unit === 'day' || unit === 'week' ? addInterval(d, every, unit) : addInterval(d, every, unit, anchor)
  }
  return out
}

export function formatDate(date: ISODate): string {
  const [y, m, d] = split(date)
  return `${pad(d)}/${pad(m)}/${y}`
}

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
const MONTHS_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
const WEEKDAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']

export function formatLongDate(date: ISODate): string {
  const [y, m, d] = split(date)
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return `${WEEKDAYS[wd]} ${d} ${MONTHS[m - 1]}${y !== split(today())[0] ? ' ' + y : ''}`
}

export function formatShortDate(date: ISODate): string {
  const [, m, d] = split(date)
  return `${d} ${MONTHS_SHORT[m - 1]}`
}

export function monthLabel(key: string, short = false): string {
  const [y, m] = key.split('-').map(Number)
  return short ? `${MONTHS_SHORT[m - 1]} ${String(y).slice(2)}` : `${MONTHS[m - 1]} ${y}`
}

export function monthKey(date: ISODate): string {
  return date.slice(0, 7)
}

export function addMonths(key: string, n: number): string {
  return monthKey(addInterval(`${key}-01`, n, 'month'))
}

export function monthRange(key: string): [ISODate, ISODate] {
  const [y, m] = key.split('-').map(Number)
  return [toISO(y, m, 1), toISO(y, m, daysInMonth(y, m))]
}

export type DateOrder = 'DMY' | 'MDY' | 'YMD'

/** Lit une date de relevé : JJ/MM/AAAA (défaut), MM/JJ/AAAA, AAAA-MM-JJ, AAAAMMJJ. */
export function parseDate(raw: string, order: DateOrder = 'DMY'): ISODate | null {
  const s = String(raw ?? '').trim()
  let y: number, m: number, d: number
  let match = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/)
  if (match) {
    ;[y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])]
  } else if ((match = s.match(/^(\d{4})(\d{2})(\d{2})/))) {
    ;[y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])]
  } else if ((match = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/))) {
    const a = Number(match[1])
    const b = Number(match[2])
    y = Number(match[3])
    if (y < 100) y += 2000
    ;[d, m] = order === 'MDY' ? [b, a] : [a, b]
  } else {
    return null
  }
  if (m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) return null
  return toISO(y, m, d)
}
