import { useEffect, useState } from 'react'
import { Cloud, CloudOff, Copy, LogOut, RefreshCw, Users } from 'lucide-react'
import type { User } from 'firebase/auth'
import { useStore } from '../data/store'
import { findHousehold, isBuiltIn, isConfigured, linkHousehold, onSyncStatus, onUser, signInGoogle, signOut, startRealtime, syncNow, type SyncStatus } from '../data/sync'
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
      <JoinGuide open={!user || !sync.householdId} code={sync.inviteCode} />
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

/** Mode opératoire pour rejoindre le foyer depuis un 2e téléphone (Véra). */
function JoinGuide({ open, code }: { open: boolean; code?: string }) {
  return (
    <details className="card" open={open}>
      <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Mode opératoire : rejoindre le foyer depuis un autre téléphone</summary>
      <ol className="stack" style={{ margin: '12px 0 0', paddingLeft: 22, gap: 10 }}>
        <li>Ouvrez l'adresse de l'app dans <strong>Chrome</strong> sur le téléphone, puis menu <strong>⋮ › Installer l'application</strong> (ou <em>Plus › Installer l'application</em>).</li>
        <li>Au premier lancement, choisissez votre prénom puis <strong>« Commencer à vide »</strong> (ne pas reprendre les abonnements : ils sont déjà dans le foyer).</li>
        <li>Allez dans <strong>Plus › Synchronisation</strong> et touchez <strong>« Continuer avec Google »</strong> ; choisissez votre propre compte Google.</li>
        <li>Choisissez <strong>« Rejoindre »</strong> et tapez le code d'invitation{code ? <> : <strong className="num" style={{ letterSpacing: '0.1em' }}>{code}</strong></> : ' (visible sur le téléphone de la personne qui a créé le foyer, dans cette même page)'}, puis <strong>« Rejoindre »</strong>.</li>
        <li>Patientez quelques secondes : comptes, opérations, prêt, abonnements et prévisions apparaissent. Ensuite, tout ce que l'un saisit apparaît chez l'autre.</li>
      </ol>
      <p className="faint" style={{ margin: '10px 0 0' }}>En cas de message d'erreur, faites une capture d'écran et envoyez-la à Lionel.</p>
    </details>
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
  return (
    <Section title="Connexion">
      <div className="card form">
        <button className="btn primary block" disabled={busy} onClick={() => void run(signInGoogle)}>Continuer avec Google</button>
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
