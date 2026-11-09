import { useEffect, useState } from 'react'
import { Cloud, CloudOff, Copy, LogOut, RefreshCw, Users } from 'lucide-react'
import type { User } from 'firebase/auth'
import { useStore } from '../data/store'
import { findHousehold, isBuiltIn, isConfigured, linkHousehold, onSyncStatus, onUser, signInEmail, signInGoogle, signOut, startRealtime, syncNow, type SyncStatus } from '../data/sync'
import { Page, Section } from '../ui/Page'
import { Segmented, TextField } from '../ui/Field'
import { useToast } from '../ui/toast'

const frError = (e: unknown) => {
  const m = e instanceof Error ? e.message : String(e)
  if (m.includes('invalid-credential') || m.includes('wrong-password')) return 'E-mail ou mot de passe incorrect.'
  if (m.includes('email-already-in-use')) return 'Un compte existe déjà avec cet e-mail : connectez-vous.'
  if (m.includes('weak-password')) return 'Mot de passe trop court (8 caractères minimum).'
  if (m.includes('permission-denied')) return 'Accès refusé : vérifiez les règles Firestore et le code d’invitation.'
  if (m.includes('popup-closed')) return 'Connexion annulée.'
  return m.replace(/^Firebase: /, '')
}

export default function SyncPage() {
  const sync = useStore((s) => s.sync)
  const setSync = useStore((s) => s.setSync)
  const pending = useStore((s) => Object.keys(s.dirty).length)
  const toast = useToast((s) => s.show)
  const configured = isConfigured()
  const [user, setUser] = useState<User | null>(null)
  const [status, setStatus] = useState<SyncStatus>({ state: 'off' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string>()

  useEffect(() => onSyncStatus(setStatus), [])
  useEffect(() => {
    let off: (() => void) | undefined
    void onUser(async (u) => {
      setUser(u)
      if (u && !useStore.getState().sync.householdId && (await findHousehold())) {
        startRealtime()
        void syncNow()
      }
    }).then((f) => { off = f })
    return () => off?.()
  }, [configured, sync.firebaseConfig])

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setErr(undefined)
    try {
      await fn()
    } catch (e) {
      setErr(frError(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Page title="Synchronisation" back>
      <div className="callout">
        <Users size={18} />
        <span>Lionel et Véra partagent les mêmes données grâce à <strong>Firebase</strong> (Google). Une personne crée le foyer, l'autre le rejoint avec le code d'invitation. Sans synchronisation, l'app fonctionne seule sur ce téléphone.</span>
      </div>
      {!configured ? <ConfigForm /> : !user ? <AuthForm run={run} busy={busy} err={err} /> : !sync.householdId ? <HouseholdForm run={run} busy={busy} err={err} /> : (
        <>
          <div className="card stack">
            <div className="split">
              <strong>Foyer « {sync.householdName} »</strong>
              {status.state === 'error' || status.state === 'offline' ? <CloudOff size={20} className="warning" /> : <Cloud size={20} className="income" />}
            </div>
            <span className="faint">Connecté : {user.displayName ?? user.email}</span>
            <span className="faint" role="status">
              {status.state === 'syncing' ? 'Synchronisation…'
                : status.state === 'error' ? `Erreur : ${frError(status.message)}`
                  : status.state === 'offline' ? status.message
                    : pending ? `${pending} modification(s) en attente d'envoi`
                      : status.lastSyncAt ? `À jour (${new Date(status.lastSyncAt).toLocaleTimeString('fr-FR')})` : 'À jour'}
            </span>
            <button className="btn" disabled={status.state === 'syncing'} onClick={() => void syncNow()}><RefreshCw size={18} />Synchroniser maintenant</button>
          </div>
          <Section title="Inviter l'autre membre">
            <div className="card stack">
              <span className="muted">Sur son téléphone : Plus › Synchronisation, se connecter avec Google, puis « Rejoindre » avec ce code :</span>
              <div className="split">
                <strong style={{ fontSize: 28, letterSpacing: '0.12em' }} className="num">{sync.inviteCode}</strong>
                <button className="btn sm" onClick={() => { void navigator.clipboard?.writeText(sync.inviteCode ?? ''); toast('Code copié') }}><Copy size={16} />Copier</button>
              </div>
            </div>
          </Section>
          <button className="btn danger" onClick={() => void signOut().then(() => toast('Déconnecté. Les données restent sur ce téléphone.'))}><LogOut size={18} />Se déconnecter</button>
        </>
      )}
      {configured && !isBuiltIn() && (
        <button className="btn sm" style={{ alignSelf: 'center', border: 0 }} onClick={() => { if (confirm('Oublier la configuration Firebase sur ce téléphone ?')) { void signOut(); setSync({ firebaseConfig: undefined }) } }}>
          Changer de projet Firebase
        </button>
      )}
    </Page>
  )
}

function ConfigForm() {
  const setSync = useStore((s) => s.setSync)
  const [cfg, setCfg] = useState('')
  return (
    <Section title="1 · Projet Firebase">
      <div className="card form">
        <p className="faint" style={{ margin: 0 }}>Console Firebase › Paramètres du projet › Vos applications › application Web : copiez l'objet <code>firebaseConfig</code> et collez-le ici.</p>
        <textarea className="input" rows={6} value={cfg} onChange={(e) => setCfg(e.target.value)} placeholder={'{ apiKey: "…", authDomain: "…", projectId: "…", appId: "…" }'} />
        <button className="btn primary" disabled={!/apiKey/.test(cfg) || !/projectId/.test(cfg)} onClick={() => setSync({ firebaseConfig: cfg })}>Enregistrer</button>
      </div>
    </Section>
  )
}

function AuthForm({ run, busy, err }: { run: (fn: () => Promise<void>) => Promise<void>; busy: boolean; err?: string }) {
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  return (
    <Section title="Connexion">
      <div className="card form">
        <button className="btn primary block" disabled={busy} onClick={() => void run(signInGoogle)}>Continuer avec Google</button>
        <details>
          <summary className="faint" style={{ cursor: 'pointer' }}>Ou avec un e-mail et un mot de passe</summary>
          <form className="form" style={{ marginTop: 12 }} onSubmit={(e) => { e.preventDefault(); void run(() => signInEmail(email, password, mode === 'up')) }}>
            <Segmented label="Mode" value={mode} onChange={setMode} options={[{ value: 'in', label: 'Se connecter' }, { value: 'up', label: 'Créer un compte' }]} />
            <TextField label="E-mail" type="email" autoComplete="email" value={email} onChange={setEmail} required />
            <TextField label="Mot de passe" type="password" autoComplete={mode === 'up' ? 'new-password' : 'current-password'} value={password} onChange={setPassword} required minLength={8} />
            <button className="btn" disabled={busy}>{mode === 'up' ? 'Créer le compte' : 'Se connecter'}</button>
          </form>
        </details>
        {err && <p role="alert" style={{ color: 'var(--expense)', margin: 0 }}>{err}</p>}
      </div>
    </Section>
  )
}

function HouseholdForm({ run, busy, err }: { run: (fn: () => Promise<void>) => Promise<void>; busy: boolean; err?: string }) {
  const [mode, setMode] = useState<'create' | 'join'>('create')
  const [value, setValue] = useState('Lionel & Véra')
  return (
    <Section title="Foyer">
      <div className="card form">
        <Segmented label="Foyer" value={mode} onChange={(m) => { setMode(m); setValue(m === 'create' ? 'Lionel & Véra' : '') }} options={[{ value: 'create', label: 'Créer le foyer' }, { value: 'join', label: 'Rejoindre' }]} />
        <TextField label={mode === 'create' ? 'Nom du foyer' : "Code d'invitation"} value={value} onChange={setValue} autoCapitalize={mode === 'join' ? 'characters' : undefined}
          hint={mode === 'create' ? 'Toutes les données de ce téléphone seront envoyées dans le foyer.' : 'Les données du foyer remplacent les valeurs par défaut de ce téléphone ; vos ajouts sont conservés.'} />
        {err && <p role="alert" style={{ color: 'var(--expense)', margin: 0 }}>{err}</p>}
        <button className="btn primary" disabled={busy || !value.trim()} onClick={() => void run(() => linkHousehold(mode, value.trim()))}>{busy ? 'Patientez…' : mode === 'create' ? 'Créer' : 'Rejoindre'}</button>
      </div>
    </Section>
  )
}
