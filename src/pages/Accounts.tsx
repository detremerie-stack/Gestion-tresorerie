import { Link } from 'react-router-dom'
import { FileText, Plus } from 'lucide-react'
import { useBalances } from '../data/hooks'
import { useList, useStore } from '../data/store'
import { today } from '../lib/dates'
import { loanStatus } from '../lib/loans'
import { toXPF } from '../lib/money'
import { Page, Section } from '../ui/Page'
import { Money } from '../ui/Money'
import { CatIcon } from '../ui/Icon'
import { INSTITUTIONS } from './AccountForm'

export default function Accounts() {
  const { rows, total, approx } = useBalances()
  const loans = useList('loans')
  const rates = useStore((s) => s.settings.rates)
  const debts = loans.map((l) => ({ l, st: loanStatus(l, today()) })).filter((d) => d.st.remaining > 0)
  const debt = debts.reduce((s, d) => s + toXPF(d.st.remaining, d.l.currency, rates), 0)
  return (
    <Page title="Comptes" back actions={<Link className="icon-btn" to="/comptes/nouveau" aria-label="Ajouter un compte"><Plus /></Link>}>
      <div className="card hero">
        <span className="label">Total en francs Pacifique</span>
        <Money className="value" value={total} approx={approx} />
        {debt > 0 && <span className="faint">Prêts : <Money value={-debt} /> · patrimoine net <Money value={total - debt} /></span>}
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
      {debts.length > 0 && (
        <Section title="Dettes (prêts)">
          <div className="card flush"><ul className="list">
            {debts.map(({ l, st }) => (
              <li key={l.id}><Link className="row" to={`/prets/${l.id}`} style={{ color: 'inherit' }}>
                <CatIcon icon="landmark" color={l.color} />
                <div className="main"><span className="title">{l.name}</span><span className="sub">{l.lender ?? 'Prêt'} · {Math.round(st.progress * 100)} % remboursé</span></div>
                <Money className="amount expense" value={-st.remaining} currency={l.currency} />
              </Link></li>
            ))}
          </ul></div>
        </Section>
      )}
      <Link className="btn" to="/releve"><FileText size={18} />Relevé imprimable</Link>
    </Page>
  )
}
