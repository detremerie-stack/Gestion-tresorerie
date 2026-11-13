import { describe, expect, it, vi } from 'vitest'

// Firestore simulé : un foyer « Test » avec 1 membre et le code ABCD2345.
const db = vi.hoisted(() => ({
  invites: { ABCD2345: { householdId: 'h1' } } as Record<string, { householdId: string }>,
  households: { h1: { name: 'Foyer test', inviteCode: 'ABCD2345', members: ['u1'] as string[] } } as Record<string, { name: string; inviteCode: string; members: string[] }>,
  writes: [] as string[],
}))
vi.mock('firebase/app', () => ({ initializeApp: () => ({}), getApps: () => [], deleteApp: async () => {} }))
vi.mock('firebase/auth', () => {
  const auth = { authStateReady: async () => {}, currentUser: { uid: 'u2' } }
  return { getAuth: () => auth, setPersistence: async () => {}, browserLocalPersistence: {}, onAuthStateChanged: () => () => {} }
})
vi.mock('firebase/firestore', () => ({
  getFirestore: () => ({}),
  doc: (_db: unknown, col: string, id: string) => ({ col, id }),
  getDoc: async (r: { col: 'invites' | 'households'; id: string }) => { const d = (db[r.col] as Record<string, object>)[r.id]; return { exists: () => !!d, data: () => d } },
  updateDoc: async (r: { col: string; id: string }, patch: { members?: { op: string; uid: string } }) => {
    db.writes.push(`${r.col}/${r.id}`)
    const h = db.households[r.id]
    if (patch.members?.op === 'union' && !h.members.includes(patch.members.uid)) h.members.push(patch.members.uid)
    if (patch.members?.op === 'remove') h.members = h.members.filter((m) => m !== patch.members!.uid)
  },
  arrayUnion: (uid: string) => ({ op: 'union', uid }),
  arrayRemove: (uid: string) => ({ op: 'remove', uid }),
}))
vi.mock('idb-keyval', () => ({ get: async () => undefined, set: async () => {}, del: async () => {}, createStore: () => ({}), keys: async () => [] }))
vi.stubEnv('VITE_FIREBASE_CONFIG', '{"apiKey":"k","projectId":"p"}')

const { useStore } = await import('./store')
const { startJoin, cancelJoin } = await import('./sync')

describe('P4 — rejoindre un foyer : confirmation avant tout envoi', () => {
  it('étape 1 : lit le nom du foyer, n’envoie aucune donnée et ne lie pas l’appareil', async () => {
    useStore.getState().upsert('members', { id: 'm1', name: 'Local', color: '#000' })
    const dirtyBefore = { ...useStore.getState().dirty }
    const p = await startJoin('abcd2345')
    expect(p).toEqual({ hid: 'h1', name: 'Foyer test', members: 2, code: 'ABCD2345' })
    expect(useStore.getState().sync.householdId).toBeUndefined()
    expect(useStore.getState().dirty).toEqual(dirtyBefore)
    expect(db.writes).toEqual(['households/h1']) // seulement l'ajout comme membre, aucun enregistrement
    // Annuler : la personne est retirée du foyer.
    await cancelJoin(p)
    expect(db.households.h1.members).toEqual(['u1'])
  })
  it('code inconnu : message clair', async () => {
    await expect(startJoin('ZZZZ')).rejects.toThrow('Code d’invitation inconnu.')
  })
})
