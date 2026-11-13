import type { Kind } from './types'
import { KINDS } from './types'

/** Champs numériques qui, s'ils sont présents, doivent être des nombres finis. */
const NUMBER_FIELDS = ['amount', 'toAmount', 'originalAmount', 'initialBalance', 'principal'] as const

/**
 * Forme minimale d'un enregistrement reçu d'ailleurs (synchro, sauvegarde) : collection connue,
 * objet avec un `id` texte, montants numériques. Un enregistrement supprimé n'a besoin que de son `id`
 * (une suppression doit toujours pouvoir passer). Les enregistrements invalides sont ignorés, jamais réparés.
 */
export function isValidRecord(kind: unknown, rec: unknown): boolean {
  if (!KINDS.includes(kind as Kind)) return false
  if (!rec || typeof rec !== 'object' || Array.isArray(rec)) return false
  const r = rec as Record<string, unknown>
  if (typeof r.id !== 'string' || !r.id || r.id.length > 200) return false
  if (r.deleted === true) return true
  for (const f of NUMBER_FIELDS) {
    const v = r[f]
    if (v !== undefined && !(typeof v === 'number' && Number.isFinite(v))) return false
  }
  return true
}
