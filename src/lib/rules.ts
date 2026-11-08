import type { Rule } from '../data/types'
import { normalize } from './id'

/** Première règle dont le motif apparaît dans le libellé (les motifs les plus longs d'abord). */
export function matchRule(label: string, rules: Rule[]): Rule | undefined {
  const l = normalize(label)
  return [...rules]
    .filter((r) => !r.deleted && r.pattern.trim())
    .sort((a, b) => b.pattern.length - a.pattern.length)
    .find((r) => containsWords(l, normalize(r.pattern)))
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Le motif apparaît-il comme mot(s) entier(s) ? « ora » trouve « VITI ORA » mais pas « DECORATION ». */
export function containsWords(text: string, pattern: string): boolean {
  if (!pattern) return false
  return new RegExp(`(^|[^a-z0-9])${escape(pattern)}($|[^a-z0-9])`).test(text)
}

/**
 * Montant d'origine en devise d'un paiement carte Banque de Tahiti :
 * « CB92577- 28/09 GARE MARITIME P EUR 9,22 » → { amount: 9.22, currency: 'EUR' }.
 */
export function foreignAmount(label: string): { amount: number; currency: string } | undefined {
  const m = label.match(/\b(EUR|USD|AUD|NZD|CAD|GBP|JPY)\s+(\d[\d\s]*,\d{2})\b/)
  if (!m) return undefined
  return { currency: m[1], amount: Number(m[2].replace(/\s/g, '').replace(',', '.')) }
}

/** Nettoie un libellé bancaire pour en faire un nom de bénéficiaire lisible. */
export function cleanLabel(label: string): string {
  const withdrawal = /^RET\.?CB/i.test(label)
  let s = label
    // Banque de Tahiti : « CB92577- 03/11 ANIMALAND ARUE EUR 148,07 », « RET.CB 65026- PIRAE »
    .replace(/^CB\d*-?\s*\d{2}\/\d{2}\s+/i, '')
    .replace(/^RET\.?CB\s*\d*-?\s*/i, '')
    .replace(/\s+(XPF|EUR|USD|AUD|NZD|CAD|GBP|JPY)\s+[\d\s,.]+$/i, '')
    .replace(/^(PREL( C\/C)?( SAS| SARL)?|VIRT? FAV|VIR DE( SAS| SARL)?)\s+/i, '')
    .replace(/^(PRLV( SEPA)?|PRELEVEMENT|CB|CARTE|PAIEMENT CB|VIR( SEPA)?( RECU| EMIS)?|VIREMENT( RECU| EMIS)?|FACTURE CARTE|ACHAT CB|RETRAIT DAB)\s+/i, '')
    .replace(/\s+\d{2}\/\d{2}(\/\d{2,4})?\b.*$/, '')
    .replace(/\s+(CARTE|CB)\s*X?\d{4}.*$/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
  if (s === s.toUpperCase()) s = s.toLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (_, p, c) => p + c.toUpperCase())
  if (withdrawal) s = `Retrait ${s}`.trim()
  return s || label
}
