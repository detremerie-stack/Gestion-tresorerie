import { useMemo, useState } from 'react'
import { Download, Printer } from 'lucide-react'
import { useMap, useStore } from '../data/store'
import { useAccounts, useMemberName, useTransactions } from '../data/hooks'
import { addInterval, formatDate, monthKey, monthRange, today } from '../lib/dates'
import { formatMoney } from '../lib/money'
import { accountBalance } from '../lib/reports'
import { Page } from '../ui/Page'
import { SelectField, TextField } from '../ui/Field'

export default function Statement() {
  const accounts = useAccounts(true)
  const txs = useTransactions()
  const cats = useMap('categories')
  const memberName = useMemberName()
  const household = useStore((s) => s.sync.householdName)
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '')
  const [prevFrom, prevTo] = monthRange(monthKey(addInterval(today(), -1, 'month')))
  const [from, setFrom] = useState(prevFrom)
  const [to, setTo] = useState(prevTo)
  const account = accounts.find((a) => a.id === accountId)

  const data = useMemo(() => {
    if (!account) return null
    const opening = accountBalance(account, txs, addInterval(from, -1, 'day'))
    const lines = txs
      .filter((t) => t.date >= from && t.date <= to && (t.accountId === account.id || t.toAccountId === account.id))
      .filter((t) => !account.initialDate || t.date >= account.initialDate)
      .sort((a, b) => a.date.localeCompare(b.date) || a.updatedAt.localeCompare(b.updatedAt))
    let bal = opening
    let debit = 0
    let credit = 0
    const rows = lines.map((t) => {
      const incoming = t.type === 'income' || (t.type === 'transfer' && t.toAccountId === account.id)
      const amt = t.type === 'transfer' && t.toAccountId === account.id ? (t.toAmount ?? t.amount) : t.amount
      if (incoming) { bal += amt; credit += amt } else { bal -= amt; debit += amt }
      const label = t.type === 'transfer'
        ? (t.toAccountId === account.id ? `Virement depuis ${accounts.find((a) => a.id === t.accountId)?.name ?? '?'}` : `Virement vers ${accounts.find((a) => a.id === t.toAccountId)?.name ?? '?'}`)
        : t.payee || t.rawLabel || cats.get(t.categoryId ?? '')?.name || '—'
      return { t, label, incoming, amt, bal }
    })
    return { opening, rows, debit, credit, closing: bal }
  }, [account, txs, from, to, accounts, cats])

  const cur = account?.currency ?? 'XPF'
  const f = (n: number) => formatMoney(n, cur)

  const exportCSV = () => {
    if (!data || !account) return
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`
    const lines = [
      ['Date', 'Libellé', 'Catégorie', 'Membre', 'Débit', 'Crédit', 'Solde'].join(';'),
      ...data.rows.map((r) => [formatDate(r.t.date), esc(r.label), esc(cats.get(r.t.categoryId ?? '')?.name ?? ''), esc(memberName(r.t.member) ?? ''),
        r.incoming ? '' : String(r.amt).replace('.', ','), r.incoming ? String(r.amt).replace('.', ',') : '', String(Math.round(r.bal * 100) / 100).replace('.', ',')].join(';')),
    ]
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `releve-${account.name.replace(/\s+/g, '-').toLowerCase()}-${from}-${to}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <Page title="Relevé" back>
      <div className="card form no-print">
        <SelectField label="Compte" value={accountId} onChange={setAccountId} options={accounts.map((a) => ({ value: a.id, label: a.name }))} />
        <div className="grid-2">
          <TextField label="Du" type="date" value={from} onChange={setFrom} />
          <TextField label="Au" type="date" value={to} onChange={setTo} />
        </div>
        <div className="btn-row">
          <button className="btn primary" onClick={() => window.print()}><Printer size={18} />Imprimer / PDF</button>
          <button className="btn" onClick={exportCSV}><Download size={18} />CSV</button>
        </div>
      </div>

      {account && data && (
        <div className="card stack">
          <div className="split" style={{ alignItems: 'flex-start' }}>
            <div>
              <strong style={{ fontSize: 18 }}>Relevé de compte · {account.name}</strong>
              <div className="faint">Du {formatDate(from)} au {formatDate(to)} · {cur}{household ? ` · Foyer ${household}` : ''}</div>
            </div>
            <span className="faint print-only">Édité le {formatDate(today())} · Fare Moni</span>
          </div>
          <div className="kpis statement-kpis">
            <div className="kpi"><span className="label">Solde début</span><span className="num">{f(data.opening)}</span></div>
            <div className="kpi"><span className="label">Débits</span><span className="num">{f(-data.debit)}</span></div>
            <div className="kpi"><span className="label">Crédits</span><span className="num">{f(data.credit)}</span></div>
            <div className="kpi"><span className="label">Solde fin</span><strong className="num">{f(data.closing)}</strong></div>
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Date</th><th>Libellé</th><th className="hide-sm">Catégorie</th><th className="r">Débit</th><th className="r">Crédit</th><th className="r">Solde</th></tr></thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.t.id + (r.incoming ? 'in' : 'out')}>
                    <td className="num">{formatDate(r.t.date).slice(0, 5)}<span className="hide-sm">{formatDate(r.t.date).slice(5)}</span></td>
                    <td>{r.label}{r.t.originalCurrency && <span className="faint"> ({formatMoney(r.t.originalAmount ?? 0, r.t.originalCurrency)})</span>}</td>
                    <td className="faint hide-sm">{cats.get(r.t.categoryId ?? '')?.name ?? ''}</td>
                    <td className="r num">{r.incoming ? '' : f(r.amt)}</td>
                    <td className="r num">{r.incoming ? f(r.amt) : ''}</td>
                    <td className="r num">{f(r.bal)}</td>
                  </tr>
                ))}
                {data.rows.length === 0 && <tr><td colSpan={6} className="faint">Aucune opération sur la période.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Page>
  )
}
