import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Cloud, Repeat } from 'lucide-react'
import { useStore } from '../data/store'
import { defaultMembers, paramappSubscriptions } from '../data/defaults'
import { Segmented } from '../ui/Field'
import { InstallCard } from '../ui/install'

export default function Onboarding() {
  const complete = useStore((s) => s.completeOnboarding)
  const members = defaultMembers()
  const [member, setMember] = useState(members[0].id)
  const [importParamapp, setImport] = useState(true)
  const subs = paramappSubscriptions()

  return (
    <main className="page" style={{ paddingTop: 48 }}>
      <div className="stack">
        <p className="faint" style={{ margin: 0 }}>Moni · budget du foyer</p>
        <h1 style={{ fontSize: 34, margin: 0, letterSpacing: '-0.02em' }}>Ia ora na&nbsp;!</h1>
        <p className="muted" style={{ margin: 0 }}>
          Vos abonnements, vos comptes et votre budget en francs Pacifique, partagés entre Lionel et Véra.
        </p>
      </div>

      <div className="card form">
        <div className="field">
          <span className="label">Qui utilise ce téléphone ?</span>
          <Segmented label="Membre" value={member} onChange={setMember} options={members.map((m) => ({ value: m.id, label: m.name }))} />
        </div>
        <label className="check">
          <input type="checkbox" checked={importParamapp} onChange={(e) => setImport(e.target.checked)} />
          <span>
            <strong>Reprendre mes {subs.length} abonnements actuels</strong>
            <br />
            <span className="faint">Netflix, Spotify, Vini, Viti Ora, Dashlane… repris des captures. À vérifier ensuite.</span>
          </span>
        </label>
        <button className="btn primary block" onClick={() => complete({ member, importParamapp })}>
          <Repeat size={18} /> Commencer
        </button>
      </div>

      <InstallCard />

      <div className="card stack">
        <strong>Véra, Lionel a déjà commencé ?</strong>
        <p className="muted" style={{ margin: 0, fontSize: 14 }}>
          Commencez sans reprendre les abonnements, puis rejoignez le foyer avec son code d'invitation dans
          <em> Plus › Synchronisation</em>.
        </p>
        <button className="btn block" onClick={() => complete({ member, importParamapp: false })}>
          <Cloud size={18} /> Commencer à vide
        </button>
        <Link to="/parametres/synchro" className="faint" style={{ textAlign: 'center' }}>Configurer la synchronisation d'abord</Link>
      </div>
    </main>
  )
}
