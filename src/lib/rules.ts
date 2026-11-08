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

/** Nettoie un libellé bancaire pour en faire un nom de bénéficiaire lisible. */
export function cleanLabel(label: string): string {
  let s = label
    .replace(/^(PRLV( SEPA)?|PRELEVEMENT|CB|CARTE|PAIEMENT CB|VIR( SEPA)?( RECU| EMIS)?|VIREMENT( RECU| EMIS)?|FACTURE CARTE|ACHAT CB|RETRAIT DAB)\s+/i, '')
    .replace(/\s+\d{2}\/\d{2}(\/\d{2,4})?\b.*$/, '')
    .replace(/\s+(CARTE|CB)\s*X?\d{4}.*$/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
  if (s === s.toUpperCase()) s = s.toLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (_, p, c) => p + c.toUpperCase())
  return s || label
}
