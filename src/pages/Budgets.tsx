import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { useList, useMap, useStore } from '../data/store'
import { useCategories } from '../data/hooks'
import { addMonths, daysInMonth, monthKey, monthLabel, split, today } from '../lib/dates'
import { formatMoney, parseAmount } from '../lib/money'
import { byCategory } from '../lib/reports'
import { Page, Section } from '../ui/Page'
import { Meter } from '../ui/Charts'
import { CatIcon } from '../ui/Icon'
import { Money } from '../ui/Money'
import { useToast } from '../ui/toast'

export default function Budgets() {
  const [month, setMonth] = useState(monthKey(today()))
  const budgets = useList('budgets')
  const txs = useList('transactions')
  const accounts = useMap('accounts')
  const rates = useStore((s) => s.settings.rates)
  const upsert = useStore((s) => s.upsert)
  const remove = useStore((s) => s.remove)
  const toast = useToast((s) => s.show)
  const categories = useCategories().filter((c) => c.kind === 'expense')
  const [newCat, setNewCat] = useState('')
  const [newAmount, setNewAmount] = useState('')
  const [editing, setEditing] = useState<string>()
  const [editAmount, setEditAmount] = useState('')

  const spent = useMemo(() => byCategory(txs.filter((t) => monthKey(t.date) === month), accounts, rates), [txs, month, accounts, rates])
  const spentOf = (id: string) => spent.find((s) => s.categoryId === id)?.total ?? 0
  const rows = budgets.map((b) => ({ b, cat: categories.find((c) => c.id === b.categoryId), spent: spentOf(b.categoryId) })).filter((r) => r.cat)
  const totalBudget = rows.reduce((s, r) => s + r.b.amount, 0)
  const totalSpent = rows.reduce((s, r) => s + r.spent, 0)
  const unbudgeted = spent.filter((s) => !budgets.some((b) => b.categoryId === s.categoryId)).reduce((s, x) => s + x.total, 0)
  const free = categories.filter((c) => !budgets.some((b) => b.categoryId === c.id))

  // Rythme : part du mois écoulée (seulement pour le mois en cours).
  const isCurrent = month === monthKey(today())
  const [y, m] = month.split('-').map(Number)
  const elapsed = isCurrent ? split(today())[2] / daysInMonth(y, m) : 1

  const add = () => {
    const v = parseAmount(newAmount)
    if (!newCat || Number.isNaN(v) || v <= 0) return
    upsert('budgets', { categoryId: newCat, amount: Math.round(v) })
    setNewCat('')
    setNewAmount('')
  }

  return (
    <Page title="Limites de dépenses" back>
      <div className="month-nav">
        <button className="icon-btn" aria-label="Mois précédent" onClick={() => setMonth(addMonths(month, -1))}><ChevronLeft /></button>
        <strong>{monthLabel(month)}</strong>
        <button className="icon-btn" aria-label="Mois suivant" onClick={() => setMonth(addMonths(month, 1))}><ChevronRight /></button>
      </div>

      {rows.length > 0 && (
        <div className="card stack" style={{ gap: 10 }}>
          <div className="split"><span className="muted">Dépensé / limite</span><span className="num"><Money value={totalSpent} /> / <Money value={totalBudget} /></span></div>
          <Meter value={totalSpent} max={totalBudget} label="Limite totale" />
          <div className="split faint">
            <span>{totalSpent <= totalBudget ? `Reste ${formatMoney(totalBudget - totalSpent)}` : `Dépassement ${formatMoney(totalSpent - totalBudget)}`}</span>
            {unbudgeted > 0 && <span>Hors budget : {formatMoney(unbudgeted)}</span>}
          </div>
        </div>
      )}

      <Section title="Par catégorie">
        <div className="card flush">
          <ul className="list">
            {rows.sort((a, b) => b.spent / b.b.amount - a.spent / a.b.amount).map(({ b, cat, spent: s }) => {
              const over = s > b.amount
              const ahead = isCurrent && !over && s / b.amount > elapsed + 0.1
              return (
                <li key={b.id}>
                  <div className="row" style={{ alignItems: 'flex-start' }}>
                    <CatIcon icon={cat!.icon} color={cat!.color} small />
                    <div className="main" style={{ gap: 6 }}>
                      <div className="split">
                        <Link to={`/operations?cat=${cat!.id}&mois=${month}`} className="title" style={{ color: 'inherit' }}>{cat!.name}</Link>
                        {editing === b.id ? (
                          <span className="input-group" style={{ maxWidth: 180 }}>
                            <input className="input" inputMode="numeric" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} aria-label="Plafond" autoFocus />
                            <button className="btn sm primary" onClick={() => { const v = parseAmount(editAmount); if (v > 0) upsert('budgets', { ...b, amount: Math.round(v) }); setEditing(undefined) }}>OK</button>
                          </span>
                        ) : (
                          <button className="btn sm" style={{ border: 0 }} onClick={() => { setEditing(b.id); setEditAmount(String(b.amount)) }} aria-label={`Modifier le plafond ${cat!.name}`}>
                            <span className="num"><Money value={s} /> / <Money value={b.amount} /></span>
                          </button>
                        )}
                      </div>
                      <Meter value={s} max={b.amount} label={`Budget ${cat!.name}`} />
                      <span className="sub">
                        {over ? <strong className="expense">⚠ Dépassé de {formatMoney(s - b.amount)}</strong>
                          : ahead ? <span className="warning">Dépenses en avance sur le mois · reste {formatMoney(b.amount - s)}</span>
                            : `Reste ${formatMoney(b.amount - s)}`}
                      </span>
                    </div>
                    <button className="icon-btn" aria-label={`Supprimer le budget ${cat!.name}`} onClick={() => { remove('budgets', b.id); toast('Budget supprimé', { label: 'Annuler', run: () => upsert('budgets', { ...b, deleted: false }) }) }}><Trash2 size={18} /></button>
                  </div>
                </li>
              )
            })}
            {rows.length === 0 && <li className="row muted">Aucun budget. Fixez un plafond mensuel pour les catégories qui comptent.</li>}
          </ul>
        </div>
      </Section>

      {free.length > 0 && (
        <Section title="Ajouter une limite">
          <div className="card form">
            <select className="input" value={newCat} onChange={(e) => setNewCat(e.target.value)} aria-label="Catégorie">
              <option value="">Choisir une catégorie…</option>
              {free.map((c) => <option key={c.id} value={c.id}>{c.name}{spentOf(c.id) ? ` (${formatMoney(spentOf(c.id))} ce mois)` : ''}</option>)}
            </select>
            <div className="input-group">
              <input className="input" inputMode="numeric" placeholder="Plafond mensuel en F" value={newAmount} onChange={(e) => setNewAmount(e.target.value)} aria-label="Plafond mensuel" />
              <button className="btn primary" onClick={add} disabled={!newCat || !(parseAmount(newAmount) > 0)}><Plus size={18} />Ajouter</button>
            </div>
          </div>
        </Section>
      )}
    </Page>
  )
}
