import { describe, expect, it, vi } from 'vitest'

// Firestore simulé : un foyer avec 1 membre, un code récent (nom + membres) et un ancien code (v1, sans nom).
const db = vi.hoisted(() => ({
  invites: {
    ABCD2345: { householdId: 'h1', name: 'Lionel & Véra', members: ['Lionel · li…@gmail.com'] },
    VIEUX234: { householdId: 'h1' },
  } as Record<string, object>,
  households: { h1: { name: 'Lionel & Véra', inviteCode: 'ABCD2345', members: ['u1'] as string[] } } as Record<string, { name: string; inviteCode: string; members: string[] }>,
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
  collection: (_db: unknown, ...path: string[]) => ({ path: path.join('/') }),
  query: (c: unknown) => c,
  where: () => ({}),
  Timestamp: { fromMillis: (n: number) => n },
  getDoc: async (r: { col: 'invites' | 'households'; id: string }) => { const d = (db[r.col] as Record<string, object>)[r.id]; return { exists: () => !!d, data: () => d } },
  getDocs: async () => ({ forEach: () => {}, empty: true, docs: [] }),
  onSnapshot: () => () => {},
  writeBatch: () => ({ set: () => { db.writes.push('records') }, commit: async () => {} }),
  serverTimestamp: () => 0,
  updateDoc: async (r: { col: string; id: string }, patch: { members?: { uid: string } }) => {
    db.writes.push(`${r.col}/${r.id}`)
    if (patch.members) db.households[r.id].members.push(patch.members.uid)
  },
  arrayUnion: (uid: string) => ({ uid }),
}))
vi.mock('idb-keyval', () => ({ get: async () => undefined, set: async () => {}, del: async () => {}, createStore: () => ({}), keys: async () => [] }))
vi.stubGlobal('navigator', { onLine: true })
vi.stubEnv('VITE_FIREBASE_CONFIG', '{"apiKey":"k","projectId":"p"}')

const { useStore } = await import('./store')
const { startJoin, confirmJoin, memberLabel } = await import('./sync')

describe('P4 — rejoindre un foyer : rien n’est écrit avant la confirmation', () => {
  it('étape 1 : lecture seule ; nom du foyer et membres déjà présents ; aucune écriture, aucun lien local', async () => {
    useStore.getState().upsert('members', { id: 'm1', name: 'Local', color: '#000' })
    const dirtyBefore = { ...useStore.getState().dirty }
    const p = await startJoin('abcd2345')
    expect(p).toEqual({ hid: 'h1', code: 'ABCD2345', name: 'Lionel & Véra', members: ['Lionel · li…@gmail.com'] })
    expect(db.writes).toEqual([]) // ni membre ajouté, ni envoi
    expect(db.households.h1.members).toEqual(['u1'])
    expect(useStore.getState().sync.householdId).toBeUndefined()
    expect(useStore.getState().dirty).toEqual(dirtyBefore)
    // Fermer l'appli sans répondre = ne jamais appeler confirmJoin : il n'y a rien à défaire.
  })
  it('ancien code (v1) : ni nom ni membres connus, toujours sans écriture', async () => {
    expect(await startJoin('VIEUX234')).toEqual({ hid: 'h1', code: 'VIEUX234', name: undefined, members: [] })
    expect(db.writes).toEqual([])
  })
  it('étape 2, après « Rejoindre » seulement : ajout au foyer puis lien local', async () => {
    await confirmJoin(await startJoin('ABCD2345'))
    expect(db.writes[0]).toBe('households/h1')
    expect(db.households.h1.members).toEqual(['u1', 'u2'])
    expect(useStore.getState().sync).toMatchObject({ householdId: 'h1', householdName: 'Lionel & Véra', inviteCode: 'ABCD2345' })
  })
  it('code inconnu : message clair', async () => {
    await expect(startJoin('ZZZZ')).rejects.toThrow('Code d’invitation inconnu.')
  })
  it('libellé d’un membre : prénom et e-mail partiel', () => {
    expect(memberLabel({ displayName: 'Lionel Dupont', email: 'lionel.d@gmail.com' })).toBe('Lionel · li…@gmail.com')
    expect(memberLabel({ email: 'v@x.pf' })).toBe('v…@x.pf')
    expect(memberLabel({})).toBe('Membre')
  })
})
