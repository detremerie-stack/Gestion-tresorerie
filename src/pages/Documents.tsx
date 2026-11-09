import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FolderOpen, Search } from 'lucide-react'
import { useMap } from '../data/store'
import { useTransactions } from '../data/hooks'
import { formatDate, monthLabel } from '../lib/dates'
import { normalize } from '../lib/id'
import { Empty, Page, Section } from '../ui/Page'
import { AttachmentThumb } from '../ui/Attachments'
import { Money } from '../ui/Money'

/** GED légère : tous les justificatifs (tickets, factures) rattachés aux opérations. */
export default function Documents() {
  const txs = useTransactions()
  const cats = useMap('categories')
  const accounts = useMap('accounts')
  const trips = useMap('trips')
  const [q, setQ] = useState('')
  const withDocs = useMemo(() => {
    const nq = normalize(q)
    return txs.filter((t) => t.attachments?.length && (!nq || normalize([t.payee, t.note, cats.get(t.categoryId ?? '')?.name, trips.get(t.tripId ?? '')?.name, ...t.tags].filter(Boolean).join(' ')).includes(nq)))
  }, [txs, q, cats, trips])
  const months = useMemo(() => {
    const m = new Map<string, typeof withDocs>()
    for (const t of withDocs) m.set(t.date.slice(0, 7), [...(m.get(t.date.slice(0, 7)) ?? []), t])
    return [...m.entries()]
  }, [withDocs])
  return (
    <Page title="Documents" back>
      <div className="search"><Search size={18} /><input className="input" type="search" placeholder="Rechercher (commerçant, catégorie, voyage…)" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher" /></div>
      {months.length === 0 ? (
        <Empty icon={<FolderOpen size={40} />} title="Aucun justificatif">
          <span>Photographiez un ticket depuis « Dépense rapide » ou ajoutez une facture dans une opération.</span>
        </Empty>
      ) : months.map(([m, list]) => (
        <Section key={m} title={<span style={{ textTransform: 'capitalize' }}>{monthLabel(m)}</span>}>
          <div className="card flush"><ul className="list">
            {list.map((t) => (
              <li key={t.id}><div className="row" style={{ alignItems: 'flex-start' }}>
                <Link to={`/operations/${t.id}`} className="main" style={{ color: 'inherit' }}>
                  <span className="title">{t.payee || cats.get(t.categoryId ?? '')?.name || 'Opération'}</span>
                  <span className="sub">{formatDate(t.date)} · {cats.get(t.categoryId ?? '')?.name ?? 'Sans catégorie'}{t.tripId ? ` · ${trips.get(t.tripId)?.name}` : ''}</span>
                  <div className="thumbs" style={{ marginTop: 6 }}>{t.attachments!.map((a) => <AttachmentThumb key={a.id} meta={a} />)}</div>
                </Link>
                <span className="end"><Money className="amount" value={t.type === 'expense' ? -t.amount : t.amount} currency={accounts.get(t.accountId)?.currency} />{t.originalCurrency && <span className="faint"><Money value={t.originalAmount ?? 0} currency={t.originalCurrency} /></span>}</span>
              </div></li>
            ))}
          </ul></div>
        </Section>
      ))}
      <p className="faint" style={{ margin: 0 }}>Avec la synchronisation active, les justificatifs sont copiés dans l'espace privé du foyer (Firebase) et visibles sur les deux téléphones ; sinon ils restent sur ce téléphone.</p>
    </Page>
  )
}
