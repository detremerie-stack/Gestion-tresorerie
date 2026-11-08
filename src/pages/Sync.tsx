import { useEffect, useState } from 'react'
import { Cloud, CloudOff, Copy, LogOut, RefreshCw, Users } from 'lucide-react'
import type { Session } from '@supabase/supabase-js'
import { useStore } from '../data/store'
import { findHousehold, getClient, getSession, linkHousehold, onSyncStatus, signOut, startRealtime, syncCredentials, syncNow, type SyncStatus } from '../data/sync'
import { Page, Section } from '../ui/Page'
import { Segmented, TextField } from '../ui/Field'
import { useToast } from '../ui/toast'

export default function SyncPage() {
  const sync = useStore((s) => s.sync)
  const setSync = useStore((s) => s.setSync)
  const pending = useStore((s) => Object.keys(s.dirty).length)
  const toast = useToast((s) => s.show)
  const creds = syncCredentials()
  const configured = !!(creds.url && creds.anonKey)
  const [session, setSession] = useState<Session | null>(null)
  const [status, setStatus] = useState<SyncStatus>({ state: 'off' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string>()

  useEffect(() => {
    const off = onSyncStatus(setStatus)
    return () => {
      off()
    }
  }, [])
  useEffect(() => {
    let off: (() => void) | undefined
    void getSession().then(setSession)
    const c = getClient()
    if (c) {
      const { data } = c.auth.onAuthStateChange((_e, s) => setSession(s))
      off = () => data.subscription.unsubscribe()
    }
    return () => off?.()
  }, [configured, creds.url, creds.anonKey])

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setErr(undefined)
    try {
      await fn()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Page title="Synchronisation" back>
      <div className="callout">
        <Users size={18} />
        <span>Pour que Lionel et Véra voient les mêmes données, l'app utilise <strong>Supabase</strong> (base de données gratuite). Une personne crée le foyer, l'autre le rejoint avec le code d'invitation. Sans synchronisation, l'app fonctionne seule sur ce téléphone.</span>
      </div>
      {!configured || !session ? (
        <>
          {!configured || sync.url ? <ServerForm /> : null}
          {configured && <AuthForm run={run} busy={busy} err={err} />}
        </>
      ) : !sync.householdId ? (
        <HouseholdForm run={run} busy={busy} err={err} onFound={() => toast('Foyer retrouvé')} />
      ) : (
        <>
          <div className="card stack">
            <div className="split">
              <strong>Foyer « {sync.householdName} »</strong>
              {status.state === 'error' || status.state === 'offline' ? <CloudOff size={20} className="warning" /> : <Cloud size={20} className="income" />}
            </div>
            <span className="faint">Connecté : {session.user.email}</span>
            <span className="faint" role="status">
              {status.state === 'syncing' ? 'Synchronisation…'
                : status.state === 'error' ? `Erreur : ${status.message}`
                  : status.state === 'offline' ? status.message
                    : pending ? `${pending} modification(s) en attente d'envoi`
                      : status.lastSyncAt ? `À jour (${new Date(status.lastSyncAt).toLocaleTimeString('fr-FR')})` : 'À jour'}
            </span>
            <button className="btn" disabled={status.state === 'syncing'} onClick={() => void syncNow()}><RefreshCw size={18} />Synchroniser maintenant</button>
          </div>
          <Section title="Inviter l'autre membre">
            <div className="card stack">
              <span className="muted">Sur son téléphone : Plus › Synchronisation, créer un compte, puis « Rejoindre » avec ce code :</span>
              <div className="split">
                <strong style={{ fontSize: 28, letterSpacing: '0.12em' }} className="num">{sync.inviteCode}</strong>
                <button className="btn sm" onClick={() => { void navigator.clipboard?.writeText(sync.inviteCode ?? ''); toast('Code copié') }}><Copy size={16} />Copier</button>
              </div>
            </div>
          </Section>
          <button className="btn danger" onClick={() => void signOut().then(() => toast('Déconnecté. Les données restent sur ce téléphone.'))}><LogOut size={18} />Se déconnecter</button>
        </>
      )}
      {sync.url && (
        <button className="btn sm" style={{ alignSelf: 'center', border: 0 }} onClick={() => { if (confirm('Oublier le serveur de synchronisation sur ce téléphone ?')) { void signOut(); setSync({ url: undefined, anonKey: undefined }) } }}>
          Changer de serveur
        </button>
      )}
    </Page>
  )
}

function ServerForm() {
  const sync = useStore((s) => s.sync)
  const setSync = useStore((s) => s.setSync)
  const [url, setUrl] = useState(sync.url ?? '')
  const [key, setKey] = useState(sync.anonKey ?? '')
  return (
    <Section title="1 · Serveur Supabase">
      <div className="card form">
        <p className="faint" style={{ margin: 0 }}>
          Créez un projet gratuit sur supabase.com, exécutez le fichier <code>supabase/schema.sql</code> du projet dans « SQL Editor »,
          puis copiez ici l'URL du projet et la clé publique « anon » (Project Settings › API). Une seule fois par téléphone.
        </p>
        <TextField label="URL du projet" value={url} onChange={setUrl} placeholder="https://xxxx.supabase.co" type="url" />
        <TextField label="Clé publique (anon)" value={key} onChange={setKey} placeholder="eyJhbGciOi…" />
        <button className="btn primary" disabled={!url.startsWith('https://') || key.length < 20} onClick={() => setSync({ url: url.trim(), anonKey: key.trim() })}>Enregistrer</button>
      </div>
    </Section>
  )
}

function AuthForm({ run, busy, err }: { run: (fn: () => Promise<void>) => Promise<void>; busy: boolean; err?: string }) {
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [info, setInfo] = useState<string>()
  const submit = () => run(async () => {
    const c = getClient()!
    if (mode === 'up') {
      const { data, error } = await c.auth.signUp({ email, password })
      if (error) throw new Error(error.message)
      if (!data.session) setInfo('Compte créé. Confirmez votre adresse via l’e-mail reçu, puis connectez-vous.')
    } else {
      const { error } = await c.auth.signInWithPassword({ email, password })
      if (error) throw new Error(error.message === 'Invalid login credentials' ? 'E-mail ou mot de passe incorrect.' : error.message)
      if (!(await findHousehold())) return
      await syncNow()
      startRealtime()
    }
  })
  return (
    <Section title="2 · Compte">
      <form className="card form" onSubmit={(e) => { e.preventDefault(); void submit() }}>
        <Segmented label="Mode" value={mode} onChange={setMode} options={[{ value: 'in', label: 'Se connecter' }, { value: 'up', label: 'Créer un compte' }]} />
        <TextField label="E-mail" type="email" autoComplete="email" value={email} onChange={setEmail} required />
        <TextField label="Mot de passe" type="password" autoComplete={mode === 'up' ? 'new-password' : 'current-password'} value={password} onChange={setPassword} required minLength={8} hint={mode === 'up' ? '8 caractères minimum.' : undefined} />
        {err && <p role="alert" style={{ color: 'var(--expense)', margin: 0 }}>{err}</p>}
        {info && <p role="status" className="muted" style={{ margin: 0 }}>{info}</p>}
        <button className="btn primary" disabled={busy}>{busy ? 'Patientez…' : mode === 'up' ? 'Créer le compte' : 'Se connecter'}</button>
      </form>
    </Section>
  )
}

function HouseholdForm({ run, busy, err, onFound }: { run: (fn: () => Promise<void>) => Promise<void>; busy: boolean; err?: string; onFound: () => void }) {
  const [mode, setMode] = useState<'create' | 'join'>('create')
  const [value, setValue] = useState(mode === 'create' ? 'Lionel & Véra' : '')
  useEffect(() => { void findHousehold().then((ok) => ok && onFound()) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Section title="3 · Foyer">
      <div className="card form">
        <Segmented label="Foyer" value={mode} onChange={(m) => { setMode(m); setValue(m === 'create' ? 'Lionel & Véra' : '') }} options={[{ value: 'create', label: 'Créer le foyer' }, { value: 'join', label: 'Rejoindre' }]} />
        <TextField label={mode === 'create' ? 'Nom du foyer' : "Code d'invitation"} value={value} onChange={setValue} autoCapitalize={mode === 'join' ? 'characters' : undefined}
          hint={mode === 'create' ? 'Vos données actuelles seront envoyées dans ce foyer.' : 'Les données du foyer remplaceront les valeurs par défaut de ce téléphone ; vos ajouts sont conservés.'} />
        {err && <p role="alert" style={{ color: 'var(--expense)', margin: 0 }}>{err}</p>}
        <button className="btn primary" disabled={busy || !value.trim()} onClick={() => void run(() => linkHousehold(mode, value.trim()))}>{busy ? 'Patientez…' : mode === 'create' ? 'Créer' : 'Rejoindre'}</button>
      </div>
    </Section>
  )
}
