/**
 * Synchronisation du foyer avec Firebase (Auth + Firestore).
 * Structure : households/{hid} { name, inviteCode, members[] }
 *             households/{hid}/records/{kind__id} { kind, id, data, deleted, updatedAt, updatedBy }
 *             households/{hid}/files/{id} { name, type, data: Bytes }   (justificatifs ≤ 900 Ko)
 *             invites/{code} { householdId }
 * Les données vivent d'abord sur le téléphone (IndexedDB) ; Firestore sert de point d'échange.
 */
import type { FirebaseApp, FirebaseOptions } from 'firebase/app'
import type { Auth, User } from 'firebase/auth'
import type { Firestore, Unsubscribe } from 'firebase/firestore'
import { useStore } from './store'
import type { Collections, Kind } from './types'
import { KINDS } from './types'

type FB = { app: FirebaseApp; auth: Auth; db: Firestore; mod: typeof import('firebase/firestore'); authMod: typeof import('firebase/auth') }
let fb: FB | null = null
let fbKey = ''
let unsub: Unsubscribe | null = null
let timer: ReturnType<typeof setTimeout> | undefined
let running = false
let again = false

export interface SyncStatus {
  state: 'off' | 'idle' | 'syncing' | 'error' | 'offline'
  message?: string
  lastSyncAt?: string
}
let status: SyncStatus = { state: 'off' }
const listeners = new Set<(s: SyncStatus) => void>()
function setStatus(s: SyncStatus) {
  status = s
  listeners.forEach((l) => l(s))
}
export function onSyncStatus(l: (s: SyncStatus) => void): () => void {
  listeners.add(l)
  l(status)
  return () => {
    listeners.delete(l)
  }
}

/** Configuration : intégrée au build (VITE_FIREBASE_CONFIG) ou collée dans l'app. */
export function firebaseOptions(): FirebaseOptions | null {
  const raw = useStore.getState().sync.firebaseConfig || import.meta.env.VITE_FIREBASE_CONFIG
  if (!raw) return null
  try {
    // Accepte le JSON brut ou l'objet JS copié depuis la console Firebase (clés sans guillemets).
    const json = raw.trim().replace(/^[^{]*/, '').replace(/[^}]*$/, '').replace(/([{,]\s*)([A-Za-z_]\w*)\s*:/g, '$1"$2":').replace(/'/g, '"').replace(/,\s*}/g, '}')
    const o = JSON.parse(json) as FirebaseOptions
    return o.apiKey && o.projectId ? o : null
  } catch {
    return null
  }
}
export const isConfigured = () => !!firebaseOptions()
export const isBuiltIn = () => !!import.meta.env.VITE_FIREBASE_CONFIG

let fbPromise: Promise<FB> | null = null

export async function getFb(): Promise<FB | null> {
  const opts = firebaseOptions()
  if (!opts) return null
  const key = JSON.stringify(opts)
  // Une seule initialisation, même si plusieurs écrans la demandent en même temps.
  if (fbPromise && key === fbKey) return fbPromise
  fbKey = key
  fbPromise = (async () => {
    const [{ initializeApp, getApps, deleteApp }, authMod, mod] = await Promise.all([import('firebase/app'), import('firebase/auth'), import('firebase/firestore')])
    for (const a of getApps()) await deleteApp(a)
    const app = initializeApp(opts)
    const auth = authMod.getAuth(app)
    await authMod.setPersistence(auth, authMod.browserLocalPersistence)
    fb = { app, auth, db: mod.getFirestore(app), mod, authMod }
    return fb
  })()
  return fbPromise
}

export async function currentUser(): Promise<User | null> {
  const f = await getFb()
  if (!f) return null
  await f.auth.authStateReady()
  return f.auth.currentUser
}

export async function onUser(cb: (u: User | null) => void): Promise<() => void> {
  const f = await getFb()
  if (!f) {
    cb(null)
    return () => {}
  }
  return f.authMod.onAuthStateChanged(f.auth, cb)
}

export async function signInGoogle() {
  const f = await getFb()
  if (!f) throw new Error('Synchronisation non configurée')
  const provider = new f.authMod.GoogleAuthProvider()
  try {
    await f.authMod.signInWithPopup(f.auth, provider)
  } catch (e) {
    // Application installée : certains téléphones bloquent la fenêtre, on passe par une redirection.
    if (String(e).includes('popup')) await f.authMod.signInWithRedirect(f.auth, provider)
    else throw e
  }
}
export async function signInEmail(email: string, password: string, create: boolean) {
  const f = await getFb()
  if (!f) throw new Error('Synchronisation non configurée')
  if (create) await f.authMod.createUserWithEmailAndPassword(f.auth, email, password)
  else await f.authMod.signInWithEmailAndPassword(f.auth, email, password)
}

function inviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => chars[b % chars.length]).join('')
}

/** Crée le foyer ou le rejoint avec un code d'invitation, puis envoie les données locales. */
export async function linkHousehold(mode: 'create' | 'join', value: string) {
  const f = await getFb()
  const user = await currentUser()
  if (!f || !user) throw new Error('Connectez-vous d’abord.')
  const { doc, collection, setDoc, getDoc, updateDoc, arrayUnion, serverTimestamp, getDocs } = f.mod
  let hid: string
  let name: string
  let code: string
  if (mode === 'create') {
    const ref = doc(collection(f.db, 'households'))
    code = inviteCode()
    name = value || 'Foyer'
    await setDoc(ref, { name, inviteCode: code, members: [user.uid], createdAt: serverTimestamp() })
    await setDoc(doc(f.db, 'invites', code), { householdId: ref.id })
    hid = ref.id
  } else {
    code = value.trim().toUpperCase()
    const inv = await getDoc(doc(f.db, 'invites', code))
    if (!inv.exists()) throw new Error('Code d’invitation inconnu.')
    hid = inv.data().householdId as string
    await updateDoc(doc(f.db, 'households', hid), { members: arrayUnion(user.uid), lastJoinCode: code })
    name = ((await getDoc(doc(f.db, 'households', hid))).data()?.name as string) ?? 'Foyer'
  }
  const st = useStore.getState()
  st.setSync({ householdId: hid, householdName: name, inviteCode: code, lastPulledAt: undefined })
  const dirty: Record<string, true> = {}
  for (const k of KINDS) for (const id of Object.keys(st.data[k])) dirty[`${k}:${id}`] = true
  if (mode === 'join') {
    // En rejoignant, les données du foyer font foi : on n'écrase pas celles de l'autre membre.
    const snap = await getDocs(collection(f.db, 'households', hid, 'records'))
    snap.forEach((d) => delete dirty[`${d.data().kind}:${d.data().id}`])
  }
  useStore.setState({ dirty })
  startRealtime()
  await syncNow()
}

export async function findHousehold(): Promise<boolean> {
  const f = await getFb()
  const user = await currentUser()
  if (!f || !user) return false
  const { collection, query, where, getDocs, limit } = f.mod
  const snap = await getDocs(query(collection(f.db, 'households'), where('members', 'array-contains', user.uid), limit(1)))
  if (snap.empty) return false
  const d = snap.docs[0]
  useStore.getState().setSync({ householdId: d.id, householdName: d.data().name, inviteCode: d.data().inviteCode })
  return true
}

export function scheduleSync(delay = 800) {
  clearTimeout(timer)
  timer = setTimeout(() => void syncNow(), delay)
}

/** Envoie les modifications locales (par lots de 400). */
export async function syncNow(): Promise<void> {
  const f = await getFb()
  const hid = useStore.getState().sync.householdId
  const user = f ? await currentUser() : null
  if (!f || !hid || !user) {
    setStatus({ state: 'off' })
    return
  }
  if (!navigator.onLine) {
    setStatus({ ...status, state: 'offline', message: 'Hors ligne : les modifications partiront au retour du réseau.' })
    return
  }
  if (running) {
    again = true
    return
  }
  running = true
  setStatus({ ...status, state: 'syncing' })
  try {
    const st = useStore.getState()
    const keys = Object.keys(st.dirty)
    const sent = new Map<string, string>()
    const { doc, writeBatch, serverTimestamp } = f.mod
    for (let i = 0; i < keys.length; i += 400) {
      const batch = writeBatch(f.db)
      for (const key of keys.slice(i, i + 400)) {
        const [kind, ...rest] = key.split(':')
        const id = rest.join(':')
        const rec = st.data[kind as Kind]?.[id]
        if (!rec) continue
        batch.set(doc(f.db, 'households', hid, 'records', `${kind}__${id}`.replace(/\//g, '_')), {
          kind, id, data: JSON.parse(JSON.stringify(rec)), deleted: !!rec.deleted, updatedAt: serverTimestamp(), updatedBy: user.uid,
        })
        sent.set(key, rec.updatedAt)
      }
      await batch.commit()
    }
    const now = useStore.getState()
    now.clearDirty(keys.filter((k) => {
      const [kind, ...rest] = k.split(':')
      return now.data[kind as Kind]?.[rest.join(':')]?.updatedAt === sent.get(k)
    }))
    const { flushUploads } = await import('../lib/attachments')
    await flushUploads().catch(() => {})
    if (!unsub) startRealtime()
    setStatus({ state: 'idle', lastSyncAt: new Date().toISOString() })
  } catch (e) {
    setStatus({ ...status, state: 'error', message: e instanceof Error ? e.message : String(e) })
  } finally {
    running = false
    if (again) {
      again = false
      scheduleSync(200)
    }
  }
}

/** Écoute en direct les changements du foyer (depuis la dernière réception). */
export function startRealtime() {
  void (async () => {
    const f = await getFb()
    const hid = useStore.getState().sync.householdId
    if (!f || !hid || !(await currentUser())) return
    unsub?.()
    const { collection, query, where, onSnapshot, Timestamp } = f.mod
    const since = useStore.getState().sync.lastPulledAt
    const col = collection(f.db, 'households', hid, 'records')
    const q = since ? query(col, where('updatedAt', '>', Timestamp.fromMillis(Number(since)))) : col
    unsub = onSnapshot(q, (snap) => {
      const rows: { kind: Kind; data: Collections[Kind] }[] = []
      let latest = Number(useStore.getState().sync.lastPulledAt ?? 0)
      for (const ch of snap.docChanges()) {
        if (ch.type === 'removed' || ch.doc.metadata.hasPendingWrites) continue
        const d = ch.doc.data()
        rows.push({ kind: d.kind as Kind, data: d.data as Collections[Kind] })
        const ms = d.updatedAt?.toMillis?.() ?? 0
        if (ms > latest) latest = ms
      }
      useStore.getState().applyRemote(rows)
      if (latest) useStore.getState().setSync({ lastPulledAt: String(latest) })
      setStatus({ state: 'idle', lastSyncAt: new Date().toISOString() })
    }, (err) => setStatus({ state: 'error', message: err.message }))
  })()
}

export async function signOut() {
  unsub?.()
  unsub = null
  const f = await getFb()
  if (f) await f.authMod.signOut(f.auth)
  useStore.getState().setSync({ householdId: undefined, householdName: undefined, inviteCode: undefined, lastPulledAt: undefined })
  setStatus({ state: 'off' })
}

/** Justificatifs : copie dans Firestore (fichiers compressés ≤ 900 Ko). */
export async function uploadFile(id: string, blob: Blob, name: string): Promise<boolean> {
  const f = await getFb()
  const hid = useStore.getState().sync.householdId
  if (!f || !hid || !(await currentUser()) || blob.size > 900_000) return false
  const { doc, setDoc, Bytes } = f.mod
  await setDoc(doc(f.db, 'households', hid, 'files', id), { name, type: blob.type, data: Bytes.fromUint8Array(new Uint8Array(await blob.arrayBuffer())) })
  return true
}
export async function downloadFile(id: string): Promise<Blob | null> {
  const f = await getFb()
  const hid = useStore.getState().sync.householdId
  if (!f || !hid || !(await currentUser())) return null
  const { doc, getDoc } = f.mod
  const d = await getDoc(doc(f.db, 'households', hid, 'files', id))
  if (!d.exists()) return null
  return new Blob([d.data().data.toUint8Array()], { type: d.data().type })
}
export async function removeFile(id: string) {
  const f = await getFb()
  const hid = useStore.getState().sync.householdId
  if (!f || !hid) return
  const { doc, deleteDoc } = f.mod
  await deleteDoc(doc(f.db, 'households', hid, 'files', id)).catch(() => {})
}

export function initSync() {
  void (async () => {
    if (!isConfigured()) return
    const user = await currentUser()
    if (!user) return
    if (!useStore.getState().sync.householdId) await findHousehold()
    startRealtime()
    await syncNow()
  })()
  useStore.subscribe((s, prev) => {
    if (s.dirty !== prev.dirty && Object.keys(s.dirty).length) scheduleSync()
  })
  window.addEventListener('online', () => scheduleSync(100))
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') scheduleSync(100)
  })
}
