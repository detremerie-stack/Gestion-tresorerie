import type { Collections, Kind } from '../data/types'
import { KINDS } from '../data/types'
import { isValidRecord } from '../data/validate'

type Maps = { [K in Kind]: Record<string, Collections[K]> }

export interface Backup {
  data: Partial<Maps>
  /** Nombre d'éléments valides par collection dans le fichier. */
  counts: Record<Kind, number>
  total: number
  /** Éléments mal formés, ignorés (sans identifiant texte, montant non numérique…). */
  ignored: number
}

/** Lit une sauvegarde Fare Moni (`{ app: 'moni', data }`). Lève une erreur lisible sinon. */
export function parseBackup(json: unknown): Backup {
  const j = json as { app?: unknown; data?: unknown } | null
  if (!j || j.app !== 'moni' || !j.data || typeof j.data !== 'object') throw new Error('Ce fichier n’est pas une sauvegarde Moni.')
  const src = j.data as Record<string, unknown>
  const data: Partial<Maps> = {}
  const counts = {} as Record<Kind, number>
  let ignored = 0
  for (const k of KINDS) {
    const m = src[k]
    if (!m || typeof m !== 'object') { counts[k] = 0; continue }
    const entries = Object.entries(m as Record<string, unknown>)
    const ok = entries.filter(([, rec]) => isValidRecord(k, rec))
    ignored += entries.length - ok.length
    data[k] = Object.fromEntries(ok) as never
    counts[k] = ok.length
  }
  return { data, counts, total: KINDS.reduce((s, k) => s + counts[k], 0), ignored }
}

/** Fusion d'une sauvegarde avec les données de l'appareil : les éléments de même identifiant sont remplacés, rien n'est supprimé. */
export function mergeBackup(current: Maps, backup: Partial<Maps>): Maps {
  return Object.fromEntries(KINDS.map((k) => [k, { ...current[k], ...backup[k] }])) as unknown as Maps
}
