import { Link } from 'react-router-dom'
import { FileText, Plus } from 'lucide-react'
import { useBalances } from '../data/hooks'
import { Page } from '../ui/Page'
import { Money } from '../ui/Money'
import { CatIcon } from '../ui/Icon'
import { INSTITUTIONS } from './AccountForm'

export default function Accounts() {
  const { rows, total, approx } = useBalances()
  return (
    <Page title="Comptes" back actions={<Link className="icon-btn" to="/comptes/nouveau" aria-label="Ajouter un compte"><Plus /></Link>}>
      <div className="card hero">
        <span className="label">Total en francs Pacifique</span>
        <Money className="value" value={total} approx={approx} />
      </div>
      <div className="card flush">
        <ul className="list">
          {rows.map(({ account: a, balance, xpf }) => (
            <li key={a.id}>
              <Link className="row" to={`/comptes/${a.id}`} style={{ color: 'inherit' }}>
                <CatIcon icon={a.type === 'cash' ? 'banknote' : a.type === 'credit' ? 'credit-card' : a.type === 'savings' ? 'piggy-bank' : 'landmark'} color={a.color} />
                <div className="main">
                  <span className="title">{a.name}</span>
                  <span className="sub">
                    {INSTITUTIONS.find((i) => i.value === a.institution)?.label} · {a.currency}
                    {a.fxFeePct ? ` · frais change ${a.fxFeePct} %` : ''}
                    {a.currency !== 'XPF' ? ' · ' : ''}{a.currency !== 'XPF' && <Money value={xpf} approx={a.currency !== 'EUR'} />}
                  </span>
                </div>
                <Money className="amount" value={balance} currency={a.currency} tone />
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <Link className="btn" to="/releve"><FileText size={18} />Relevé imprimable</Link>
    </Page>
  )
}
