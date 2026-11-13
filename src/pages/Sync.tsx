import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { QrCode } from '../ui/QrCode'
import { AlertTriangle, Cloud, CloudOff, Copy, KeyRound, LogOut, RefreshCw, Share2, Users } from 'lucide-react'
import type { User } from 'firebase/auth'
import { useStore } from '../data/store'
import { cancelJoin, changeInviteCode, confirmJoin, findHousehold, householdMembers, isBuiltIn, isConfigured, linkHousehold, onSyncStatus, onUser, signInGoogle, signOut, startJoin, startRealtime, syncNow, type PendingJoin, type SyncStatus } from '../data/sync'
import { Dialog } from '../ui/Dialog'
import { WipeButton } from '../ui/WipeButton'
import { Page, Section } from '../ui/Page'
import { Segmented, TextField } from '../ui/Field'
import { useToast } from '../ui/toast'

const frError = (e: unknown) => {
  const m = e instanceof Error ? e.message : String(e)
  if (m.includes('invalid-credential') || m.includes('wrong-password')) return 'E-mail ou mot de passe incorrect.'
  if (m.includes('email-already-in-use')) return 'Un compte existe déjà avec cet e-mail : connectez-vous.'
  if (m.includes('weak-password')) return 'Mot de passe trop court (8 caractères minimum).'
  if (m.includes('permission-denied') || m.includes('insufficient permissions')) return 'Accès refusé : le foyer est peut-être complet (2 personnes) ou le code a changé.'
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
  // Qui a accès : nombre de comptes Google membres du foyer.
  const [members, setMembers] = useState<number | null>(null)
  const [askCode, setAskCode] = useState(false)
  useEffect(() => {
    if (!user || !sync.householdId) return
    let alive = true
    void householdMembers().then((n) => { if (alive) setMembers(n) })
    return () => { alive = false }
  }, [user, sync.householdId])
  const full = members != null && members >= 2
  const newCode = async () => {
    setAskCode(false)
    try { await changeInviteCode(); toast('Nouveau code créé') } catch { toast("Le code n'a pas pu être changé pour l'instant. Rien n'est cassé ; réessayez plus tard.") }
  }
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
    <Page title="Partage" back>
      <div className="callout">
        <Users size={18} />
        <span>Lionel et Véra partagent les mêmes données grâce à <strong>Firebase</strong> (Google). Une personne crée le foyer, l'autre le rejoint avec le code d'invitation. Sans synchronisation, l'app fonctionne seule sur ce téléphone.</span>
      </div>
      <JoinGuide open={!user || !sync.householdId} code={full ? undefined : sync.inviteCode} />
      {!configured ? <ConfigForm /> : !user ? <AuthForm run={run} busy={busy} err={err} /> : !sync.householdId ? <HouseholdForm run={run} busy={busy} err={err} /> : (
        <>
          <div className="card stack">
            <div className="split">
              <strong>Foyer « {sync.householdName} »</strong>
              {status.state === 'error' || status.state === 'offline' ? <CloudOff size={20} className="warning" /> : <Cloud size={20} className="income" />}
            </div>
            <span className="faint">Connecté : {user.displayName ?? user.email}</span>
            <span className="faint" role="status">
              {status.state === 'syncing' ? 'Mise à jour…'
                : status.state === 'error' ? `Erreur : ${frError(status.message)}`
                  : status.state === 'offline' ? status.message
                    : pending ? `${pending} modification(s) en attente d'envoi`
                      : status.lastSyncAt ? `À jour (${new Date(status.lastSyncAt).toLocaleTimeString('fr-FR')})` : 'À jour'}
            </span>
            <button className="btn" disabled={status.state === 'syncing'} onClick={() => void syncNow()}><RefreshCw size={18} />Mettre à jour maintenant</button>
          </div>
          <Section title={members != null ? `Qui a accès : ${members} personne${members > 1 ? 's' : ''}` : 'Qui a accès'}>
            <div className="card stack">
              {members != null && members > 2 && (
                <div className="callout danger-callout"><AlertTriangle size={18} /><span>Plus de 2 personnes ont accès. Si vous ne reconnaissez pas quelqu'un, changez le code tout de suite.</span></div>
              )}
              {full ? (
                <span className="muted">Le foyer est complet (2 personnes). Le code d'invitation est masqué.</span>
              ) : (
                <>
                  <span className="muted">Sur son téléphone : Menu › Partage, se connecter avec Google, puis « Rejoindre » avec ce code :</span>
                  <div className="split">
                    <strong style={{ fontSize: 28, letterSpacing: '0.12em' }} className="num">{sync.inviteCode}</strong>
                    <button className="btn sm" onClick={() => { void navigator.clipboard?.writeText(sync.inviteCode ?? ''); toast('Code copié') }}><Copy size={16} />Copier</button>
                  </div>
                </>
              )}
              <button className="btn" onClick={() => setAskCode(true)}><KeyRound size={18} />Changer le code</button>
            </div>
          </Section>
          <Dialog open={askCode} onClose={() => setAskCode(false)} title="Changer le code d'invitation ?"
            actions={<><button className="btn primary" onClick={() => void newCode()}>Changer le code</button><button className="btn" data-autofocus onClick={() => setAskCode(false)}>Annuler</button></>}>
            <p style={{ margin: 0 }}>L'ancien ne marchera plus. Les téléphones déjà connectés ne sont pas touchés.</p>
          </Dialog>
          <button className="btn danger" onClick={() => void signOut().then(() => toast('Déconnecté. Les données restent sur ce téléphone.'))}><LogOut size={18} />Se déconnecter</button>
          <WipeButton />
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
  const appUrl = `${location.origin}${location.pathname}`
  const joinUrl = code ? `${appUrl}#/parametres/synchro?rejoindre=${code}` : appUrl
  const share = () => {
    const text = code ? `Fare Moni : ouvre ce lien dans Chrome pour rejoindre notre foyer (code ${code}) : ${joinUrl}` : `Fare Moni : ${appUrl}`
    if (navigator.share) void navigator.share({ title: 'Fare Moni', text, url: joinUrl }).catch(() => {})
    else void navigator.clipboard?.writeText(text)
  }
  return (
    <details className="card" open={open}>
      <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Mode opératoire : rejoindre le foyer depuis un autre téléphone</summary>
      <div className="stack" style={{ alignItems: 'center', marginTop: 12, gap: 8 }}>
        <QrCode value={joinUrl} />
        <span className="faint" style={{ textAlign: 'center' }}>{code ? 'À scanner avec l’appareil photo de l’autre téléphone : il ouvre l’app directement sur « Rejoindre », code déjà rempli.' : 'À scanner avec l’appareil photo de l’autre téléphone pour ouvrir l’app.'}</span>
        <code style={{ wordBreak: 'break-all', fontSize: 13, textAlign: 'center' }}>{appUrl}</code>
        <button type="button" className="btn sm" onClick={share}><Share2 size={16} />Envoyer le lien (SMS, WhatsApp…)</button>
      </div>
      <ol className="stack" style={{ margin: '12px 0 0', paddingLeft: 22, gap: 10 }}>
        <li>Scannez le QR code ci-dessus (ou ouvrez l'adresse <strong>{appUrl}</strong>) dans <strong>Chrome</strong> sur le téléphone, puis menu <strong>⋮ › Installer l'application</strong>.</li>
        <li>Au premier lancement, choisissez votre prénom puis <strong>« Commencer à vide »</strong> (ne pas reprendre les abonnements : ils sont déjà dans le foyer).</li>
        <li>Allez dans <strong>Menu › Partage</strong> et touchez <strong>« Continuer avec Google »</strong> ; choisissez votre propre compte Google.</li>
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
  const [params] = useSearchParams()
  const invited = params.get('rejoindre')?.toUpperCase()
  const [mode, setMode] = useState<'create' | 'join'>(invited ? 'join' : 'create')
  const [value, setValue] = useState(invited ?? 'Lionel & Véra')
  const onboarded = useStore((s) => s.onboarded)
  const [me, setMe] = useState('m-vera')
  // P4 : en « Rejoindre », on lit d'abord le nom du foyer et on demande confirmation ; rien n'est envoyé avant.
  const [pending, setPending] = useState<PendingJoin>()
  const finish = () => {
    // Arrivé par le QR code sans passer par l'accueil : on termine l'accueil sans recréer de données par défaut
    // (elles écraseraient celles du foyer).
    if (!useStore.getState().onboarded) {
      useStore.setState({ onboarded: true })
      useStore.getState().setSettings({ currentMember: me })
    }
  }
  const go = () => run(async () => {
    if (mode === 'join') { setPending(await startJoin(value.trim())); return }
    await linkHousehold(mode, value.trim())
    finish()
  })
  const accept = () => { const p = pending!; setPending(undefined); void run(async () => { await confirmJoin(p); finish() }) }
  const refuse = () => { const p = pending; setPending(undefined); if (p) void cancelJoin(p) }
  return (
    <Section title="Foyer">
      <div className="card form">
        <Segmented label="Foyer" value={mode} onChange={(m) => { setMode(m); setValue(m === 'create' ? 'Lionel & Véra' : '') }} options={[{ value: 'create', label: 'Créer le foyer' }, { value: 'join', label: 'Rejoindre' }]} />
        <TextField label={mode === 'create' ? 'Nom du foyer' : "Code d'invitation"} value={value} onChange={setValue} autoCapitalize={mode === 'join' ? 'characters' : undefined}
          hint={mode === 'create' ? 'Toutes les données de ce téléphone seront envoyées dans le foyer.' : 'Les données du foyer remplacent les valeurs par défaut de ce téléphone ; vos ajouts sont conservés.'} />
        {err && <p role="alert" style={{ color: 'var(--expense)', margin: 0 }}>{err}</p>}
        {!onboarded && (
          <div className="field">
            <span className="label">Je suis</span>
            <Segmented label="Je suis" value={me} onChange={setMe} options={[{ value: 'm-lionel', label: 'Lionel' }, { value: 'm-vera', label: 'Véra' }]} />
          </div>
        )}
        <button className="btn primary" disabled={busy || !value.trim()} onClick={() => void go()}>{busy ? 'Patientez…' : mode === 'create' ? 'Créer' : 'Rejoindre'}</button>
      </div>
      <Dialog open={!!pending} onClose={refuse} title={`Rejoindre le foyer « ${pending?.name ?? ''} » ?`}
        actions={<><button className="btn primary" onClick={accept}>Rejoindre</button><button className="btn" data-autofocus onClick={refuse}>Annuler</button></>}>
        <p style={{ margin: 0 }}>Vos données de cet appareil y seront partagées avec les personnes du foyer. Continuez seulement si ce code vient de Lionel ou de Véra.</p>
      </Dialog>
    </Section>
  )
}
