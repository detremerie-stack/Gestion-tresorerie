import { EUR_XPF, type Rates } from './money'

/**
 * Taux du jour via la BCE (frankfurter.app, gratuit, sans clé) : on obtient USD/EUR etc.
 * puis on déduit le taux en XPF grâce à la parité fixe EUR/XPF.
 */
export async function fetchRates(): Promise<Rates> {
  const res = await fetch('https://api.frankfurter.app/latest?from=EUR&to=USD,AUD,NZD,CAD,GBP,JPY')
  if (!res.ok) throw new Error(`Taux indisponibles (${res.status})`)
  const json = (await res.json()) as { rates: Record<string, number> }
  const out: Rates = {}
  for (const [code, perEur] of Object.entries(json.rates)) {
    out[code as keyof Rates] = Math.round((EUR_XPF / perEur) * 10000) / 10000
  }
  return out
}
