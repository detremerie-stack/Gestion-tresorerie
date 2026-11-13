import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Cloud, Repeat } from 'lucide-react'
import { useStore } from '../data/store'
import { defaultMembers } from '../data/defaults'
import { Segmented } from '../ui/Field'
import { InstallCard } from '../ui/install'

export default function Onboarding() {
  const complete = useStore((s) => s.completeOnboarding)
  const members = defaultMembers()
  const [member, setMember] = useState(members[0].id)

  return (
    <main className="page" style={{ paddingTop: 48 }}>
      <div className="stack">
        <p className="faint" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}><img src="./icon.svg" alt="" width={28} height={28} style={{ borderRadius: 8 }} />Fare Moni</p>
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
        <button className="btn primary block" onClick={() => complete({ member })}>
          <Repeat size={18} /> Commencer
        </button>
      </div>

      <InstallCard />

      <div className="card stack">
        <strong>Véra, Lionel a déjà commencé ?</strong>
        <p className="muted" style={{ margin: 0, fontSize: 14 }}>
          Commencez à vide, puis rejoignez le foyer avec son code d'invitation dans
          <em> Plus › Synchronisation</em>.
        </p>
        <button className="btn block" onClick={() => complete({ member })}>
          <Cloud size={18} /> Commencer à vide
        </button>
        <Link to="/parametres/synchro" className="faint" style={{ textAlign: 'center' }}>Configurer la synchronisation d'abord</Link>
      </div>
    </main>
  )
}
