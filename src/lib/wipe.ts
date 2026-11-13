import { useStore } from '../data/store'

/** Bases IndexedDB de Fare Moni sur l'appareil (données, justificatifs, session Google, cache Firestore). */
const KNOWN_DBS = ['keyval-store', 'fare-moni-docs', 'fare-moni-docs-pending', 'firebaseLocalStorageDb', 'firebase-heartbeat-database']

/**
 * « Se déconnecter et effacer cet appareil » (P5) : déconnexion Google, puis suppression de toutes les données
 * locales (opérations, justificatifs, réglages, code), et rechargement. Rien n'est supprimé dans le foyer partagé.
 */
export async function wipeDevice(): Promise<void> {
  if (useStore.getState().sync.householdId) {
    const { signOut } = await import('../data/sync')
    await signOut().catch(() => {})
  }
  await useStore.persist.clearStorage()
  let names = KNOWN_DBS
  try {
    const list = await indexedDB.databases?.()
    if (list) names = [...new Set([...KNOWN_DBS, ...list.map((d) => d.name ?? '').filter((n) => n.startsWith('firestore') || KNOWN_DBS.includes(n))])]
  } catch { /* liste indisponible : bases connues seulement */ }
  for (const n of names) indexedDB.deleteDatabase(n)
  localStorage.clear()
  sessionStorage.clear()
  location.replace(location.pathname)
}
