import { createClient, type RealtimeChannel, type Session, type SupabaseClient } from '@supabase/supabase-js'
import { useStore } from './store'
import type { Collections, Kind } from './types'
import { KINDS } from './types'

let client: SupabaseClient | null = null
let clientKey = ''
let channel: RealtimeChannel | null = null
let timer: ReturnType<typeof setTimeout> | undefined
let running = false
let again = false

type Listener = (s: SyncStatus) => void
export interface SyncStatus {
  state: 'off' | 'idle' | 'syncing' | 'error' | 'offline'
  message?: string
  lastSyncAt?: string
}
let status: SyncStatus = { state: 'off' }
const listeners = new Set<Listener>()
function setStatus(s: SyncStatus) {
  status = s
  listeners.forEach((l) => l(s))
}
export function onSyncStatus(l: Listener): () => void {
  listeners.add(l)
  l(status)
  return () => {
    listeners.delete(l)
  }
}

/** URL/clé : configurées dans l'app, sinon via variables d'environnement au build. */
export function syncCredentials(): { url?: string; anonKey?: string } {
  const s = useStore.getState().sync
  return {
    url: s.url || import.meta.env.VITE_SUPABASE_URL,
    anonKey: s.anonKey || import.meta.env.VITE_SUPABASE_ANON_KEY,
  }
}

export function getClient(): SupabaseClient | null {
  const { url, anonKey } = syncCredentials()
  if (!url || !anonKey) return null
  const key = `${url}|${anonKey}`
  if (!client || key !== clientKey) {
    client = createClient(url, anonKey, { auth: { persistSession: true, storageKey: 'moni-auth' } })
    clientKey = key
  }
  return client
}

export async function getSession(): Promise<Session | null> {
  const c = getClient()
  if (!c) return null
  const { data } = await c.auth.getSession()
  return data.session
}

/** Lie l'appareil à un foyer (créé ou rejoint). */
export async function linkHousehold(mode: 'create' | 'join', value: string) {
  const c = getClient()
  if (!c) throw new Error('Synchronisation non configurée')
  const { data, error } =
    mode === 'create' ? await c.rpc('create_household', { p_name: value }) : await c.rpc('join_household', { p_code: value })
  if (error) throw new Error(error.message)
  const h = data as { id: string; name: string; invite_code: string }
  const st = useStore.getState()
  st.setSync({ householdId: h.id, householdName: h.name, inviteCode: h.invite_code, lastPulledAt: undefined })
  // Envoyer tout ce qui existe localement…
  const dirty: Record<string, true> = {}
  for (const k of KINDS) for (const id of Object.keys(st.data[k])) dirty[`${k}:${id}`] = true
  if (mode === 'join') {
    // …sauf ce que le foyer possède déjà : en rejoignant, les données du foyer font foi
    // (évite d'écraser les modifications de l'autre membre avec les valeurs par défaut).
    for (let from = 0; ; from += 1000) {
      const { data: rows, error: e2 } = await c.from('records').select('kind,id').eq('household_id', h.id).range(from, from + 999)
      if (e2) throw new Error(e2.message)
      for (const r of rows ?? []) delete dirty[`${r.kind}:${r.id}`]
      if (!rows || rows.length < 1000) break
    }
  }
  useStore.setState({ dirty })
  await syncNow()
  startRealtime()
}

export async function findHousehold(): Promise<boolean> {
  const c = getClient()
  if (!c) return false
  const { data, error } = await c.from('households').select('id,name,invite_code').limit(1)
  if (error || !data?.length) return false
  const h = data[0]
  useStore.getState().setSync({ householdId: h.id, householdName: h.name, inviteCode: h.invite_code })
  return true
}

export function scheduleSync(delay = 800) {
  clearTimeout(timer)
  timer = setTimeout(() => void syncNow(), delay)
}

export async function syncNow(): Promise<void> {
  const c = getClient()
  const householdId = useStore.getState().sync.householdId
  if (!c || !householdId) {
    setStatus({ state: 'off' })
    return
  }
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    setStatus({ ...status, state: 'offline', message: 'Hors ligne : les modifications seront envoyées au retour du réseau.' })
    return
  }
  if (running) {
    again = true
    return
  }
  running = true
  setStatus({ ...status, state: 'syncing' })
  try {
    await push(c, householdId)
    await pull(c, householdId)
    const { flushUploads } = await import('../lib/attachments')
    await flushUploads().catch(() => {})
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

async function push(c: SupabaseClient, householdId: string) {
  const st = useStore.getState()
  const keys = Object.keys(st.dirty)
  if (!keys.length) return
  const rows = keys
    .map((key) => {
      const [kind, ...rest] = key.split(':')
      const id = rest.join(':')
      const rec = st.data[kind as Kind]?.[id]
      return rec ? { household_id: householdId, kind, id, data: rec, deleted: !!rec.deleted } : null
    })
    .filter(Boolean) as { household_id: string; kind: string; id: string; data: unknown; deleted: boolean }[]
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await c.from('records').upsert(rows.slice(i, i + 500), { onConflict: 'household_id,kind,id' })
    if (error) throw new Error(error.message)
  }
  // Ne retirer que les clés envoyées et non modifiées entre-temps.
  const sent = new Map(rows.map((r) => [`${r.kind}:${r.id}`, (r.data as { updatedAt: string }).updatedAt]))
  const now = useStore.getState()
  useStore.getState().clearDirty(
    keys.filter((k) => {
      const [kind, ...rest] = k.split(':')
      return now.data[kind as Kind]?.[rest.join(':')]?.updatedAt === sent.get(k)
    }),
  )
}

async function pull(c: SupabaseClient, householdId: string) {
  const since = useStore.getState().sync.lastPulledAt
  let from = 0
  let latest = since
  for (;;) {
    let q = c.from('records').select('kind,data,updated_at').eq('household_id', householdId).order('updated_at').range(from, from + 999)
    if (since) q = q.gte('updated_at', since)
    const { data, error } = await q
    if (error) throw new Error(error.message)
    if (!data?.length) break
    useStore.getState().applyRemote(data.map((r) => ({ kind: r.kind as Kind, data: r.data as Collections[Kind] })))
    latest = data[data.length - 1].updated_at
    if (data.length < 1000) break
    from += 1000
  }
  if (latest) useStore.getState().setSync({ lastPulledAt: latest })
}

export function startRealtime() {
  const c = getClient()
  const householdId = useStore.getState().sync.householdId
  if (!c || !householdId) return
  if (channel) void c.removeChannel(channel)
  channel = c
    .channel(`records-${householdId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'records', filter: `household_id=eq.${householdId}` }, (payload) => {
      const row = payload.new as { kind?: string; data?: Collections[Kind] }
      if (row?.kind && row.data) useStore.getState().applyRemote([{ kind: row.kind as Kind, data: row.data }])
    })
    .subscribe()
}

export async function signOut() {
  const c = getClient()
  if (channel && c) await c.removeChannel(channel)
  channel = null
  await c?.auth.signOut()
  useStore.getState().setSync({ householdId: undefined, householdName: undefined, inviteCode: undefined, lastPulledAt: undefined })
  setStatus({ state: 'off' })
}

/** Démarre la synchro : au lancement, à chaque modification, au retour du réseau. */
export function initSync() {
  void (async () => {
    const session = await getSession()
    if (!session) return
    if (!useStore.getState().sync.householdId) await findHousehold()
    await syncNow()
    startRealtime()
  })()
  useStore.subscribe((s, prev) => {
    if (s.dirty !== prev.dirty && Object.keys(s.dirty).length) scheduleSync()
  })
  window.addEventListener('online', () => scheduleSync(100))
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') scheduleSync(100)
  })
}
