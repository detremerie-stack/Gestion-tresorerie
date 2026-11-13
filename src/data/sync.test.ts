import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Firebase factice : on note seulement s'il a été chargé.
const loaded = vi.hoisted(() => ({ app: 0, auth: 0, firestore: 0, redirect: 0 }))
vi.mock('firebase/app', () => {
  loaded.app++
  return { initializeApp: () => ({}), getApps: () => [], deleteApp: async () => {} }
})
vi.mock('firebase/auth', () => {
  loaded.auth++
  const auth = { authStateReady: async () => {}, currentUser: null }
  return { getAuth: () => auth, setPersistence: async () => {}, browserLocalPersistence: {}, onAuthStateChanged: () => () => {}, getRedirectResult: async () => { loaded.redirect++; return null }, GoogleAuthProvider: class {}, signInWithPopup: async () => { throw new Error('Firebase: Error (auth/popup-blocked).') }, signInWithRedirect: async () => {} }
})
vi.mock('firebase/firestore', () => {
  loaded.firestore++
  return { getFirestore: () => ({}) }
})
vi.mock('idb-keyval', () => ({ get: async () => undefined, set: async () => {}, del: async () => {}, createStore: () => ({}), keys: async () => [] }))

// Environnement navigateur minimal (les tests tournent sous Node).
const win = Object.assign(new EventTarget(), {
  requestIdleCallback: (cb: () => void) => setTimeout(cb, 0) as unknown as number,
  cancelIdleCallback: (h: number) => clearTimeout(h),
  setTimeout, clearTimeout,
})
const doc = Object.assign(new EventTarget(), { visibilityState: 'visible' })
vi.stubGlobal('window', win)
vi.stubGlobal('document', doc)
vi.stubGlobal('navigator', { onLine: true })
const store = new Map<string, string>()
vi.stubGlobal('sessionStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v) }, removeItem: (k: string) => { store.delete(k) } })
vi.stubEnv('VITE_FIREBASE_CONFIG', '{"apiKey":"k","projectId":"p"}')

const { useStore } = await import('./store')
const { initSync, syncNow, onSyncStatus, uploadFile, downloadFile, redirectPending, signInGoogle } = await import('./sync')

const flush = () => new Promise((r) => setTimeout(r, 20))
const total = () => loaded.app + loaded.auth + loaded.firestore

beforeEach(() => useStore.setState({ sync: {}, dirty: {} }))
afterEach(() => vi.restoreAllMocks())

describe('démarrage sans foyer lié', () => {
  it('ne charge jamais Firebase, même après une saisie', async () => {
    const stop = initSync()
    await flush()
    useStore.getState().upsert('members', { id: 'm1', name: 'A', color: '#000' })
    await new Promise((r) => setTimeout(r, 900)) // délai de scheduleSync
    win.dispatchEvent(new Event('online'))
    doc.dispatchEvent(new Event('visibilitychange'))
    await new Promise((r) => setTimeout(r, 150))
    await syncNow()
    expect(await uploadFile('x', new Blob(['a']), 'x')).toBe(false)
    expect(await downloadFile('x')).toBeNull()
    expect(total()).toBe(0)
    let state = ''
    onSyncStatus((s) => { state = s.state })()
    expect(state).toBe('off')
    stop()
  })

  it('retire tous ses écouteurs', () => {
    const addW = vi.spyOn(win, 'addEventListener')
    const remW = vi.spyOn(win, 'removeEventListener')
    const addD = vi.spyOn(doc, 'addEventListener')
    const remD = vi.spyOn(doc, 'removeEventListener')
    const stop = initSync()
    stop()
    expect(remW.mock.calls).toEqual(addW.mock.calls)
    expect(remD.mock.calls).toEqual(addD.mock.calls)
    expect(addW).toHaveBeenCalledTimes(1)
    expect(addD).toHaveBeenCalledTimes(1)
  })

  it('arrêté avant le premier affichage : ne démarre rien', async () => {
    useStore.setState({ sync: { householdId: 'h1' } })
    initSync()()
    await flush()
    expect(total()).toBe(0)
  })
})

describe('foyer lié', () => {
  it('charge Firebase après le premier affichage, pas avant', async () => {
    useStore.setState({ sync: { householdId: 'h1' } })
    const stop = initSync()
    expect(total()).toBe(0) // synchrone : rien encore
    await flush()
    expect(loaded.app).toBe(1)
    expect(loaded.auth).toBe(1)
    expect(loaded.firestore).toBe(1)
    stop()
  })
})

describe('retour d’une connexion Google par redirection', () => {
  it('sans indicateur : rien ; avec indicateur posé avant la redirection : Firebase chargé et résultat lu, même sans foyer', async () => {
    useStore.setState({ sync: {} })
    expect(redirectPending()).toBe(false)
    let stop = initSync()
    await flush()
    expect(loaded.redirect).toBe(0)
    stop()
    store.set('fare-moni-retour-google', '1')
    expect(redirectPending()).toBe(true)
    stop = initSync()
    await flush()
    expect(loaded.redirect).toBe(1)
    expect(redirectPending()).toBe(false) // indicateur effacé : une seule fois
    stop()
  })
  it('fenêtre bloquée : l’indicateur est posé avant de partir chez Google', async () => {
    await signInGoogle()
    expect(redirectPending()).toBe(true)
    store.clear()
  })
})
