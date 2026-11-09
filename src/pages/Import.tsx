import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileUp, Info } from 'lucide-react'
import { useList, useMap, useStore } from '../data/store'
import { useAccounts } from '../data/hooks'
import type { ImportMapping, Transaction } from '../data/types'
import { decodeText, detectDelimiter, parseCSV } from '../lib/import/csv'
import { applyMapping, guessMapping, importHashes, type ParsedRow } from '../lib/import/mapping'
import { looksLikeOFX, parseOFX } from '../lib/import/ofx'
import { cleanLabel, foreignAmount, matchRule } from '../lib/rules'
import { formatDate } from '../lib/dates'
import { CURRENCIES, formatMoney, fromXPF, toXPF, type Currency } from '../lib/money'
import { uid } from '../lib/id'
import { findManualMatch } from '../lib/reconcile'
import { Page, Section } from '../ui/Page'
import { SelectField } from '../ui/Field'
import { useToast } from '../ui/toast'

const HELP: Record<string, string> = {
  'banque-de-tahiti': 'Depuis la banque en ligne, exportez l’historique du compte au format CSV ou OFX (souvent « Exporter » ou « Télécharger »).',
  socredo: 'Depuis la banque en ligne, exportez l’historique du compte au format CSV ou OFX.',
  'banque-de-polynesie': 'Depuis la banque en ligne, exportez l’historique du compte au format CSV ou OFX.',
  amex: 'Téléchargez le relevé au format CSV. Sur les cartes, les dépenses sont souvent positives : l’option « Inverser les signes » est cochée automatiquement si c’est le cas.',
  deblock: 'Exportez vos opérations au format CSV depuis l’application. Les montants sont en euros.',
}

export default function Import() {
  const nav = useNavigate()
  const accounts = useAccounts()
  const accountsMap = useMap('accounts')
  const rules = useList('rules')
  const existing = useList('transactions')
  const upsert = useStore((s) => s.upsert)
  const upsertMany = useStore((s) => s.upsertMany)
  const member = useStore((s) => s.settings.currentMember)
  const rates = useStore((s) => s.settings.rates)
  const toast = useToast((s) => s.show)

  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '')
  const account = accountsMap.get(accountId)
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState<string[][] | null>(null)
  const [ofxRows, setOfxRows] = useState<ParsedRow[] | null>(null)
  const [mapping, setMapping] = useState<ImportMapping | null>(null)
  const [error, setError] = useState<string>()
  const [skipDup, setSkipDup] = useState(true)

  const onFile = async (file: File) => {
    setError(undefined)
    setFileName(file.name)
    const text = decodeText(await file.arrayBuffer())
    if (looksLikeOFX(text)) {
      const parsed = parseOFX(text)
      if (!parsed.length) return setError('Aucune opération trouvée dans ce fichier OFX.')
      setOfxRows(parsed)
      setRows(null)
      setMapping(null)
      return
    }
    const delimiter = detectDelimiter(text)
    const r = parseCSV(text, delimiter)
    if (r.length < 2) return setError('Fichier vide ou illisible. Exportez au format CSV ou OFX depuis votre banque.')
    setOfxRows(null)
    setRows(r)
    // Mapping mémorisé pour ce compte, sinon détection automatique.
    const saved = account?.importMapping
    const guess = guessMapping(r, delimiter)
    const m = saved && saved.delimiter === delimiter ? saved : guess
    // Cartes de crédit : si la majorité des montants sont positifs, ce sont des dépenses.
    if (!saved && account?.type === 'credit') {
      const sample = applyMapping(r, guess).rows
      if (sample.filter((x) => x.amount > 0).length > sample.length / 2) m.invert = true
    }
    setMapping({ ...m })
  }

  const parsed = useMemo(() => {
    if (ofxRows) return { rows: ofxRows, errors: [] }
    if (rows && mapping) return applyMapping(rows, mapping)
    return { rows: [], errors: [] }
  }, [rows, mapping, ofxRows])

  const existingHashes = useMemo(() => new Set(existing.map((t) => t.importHash).filter(Boolean)), [existing])
  const hashes = useMemo(() => importHashes(accountId, parsed.rows), [accountId, parsed.rows])
  // Rapprochement : une saisie manuelle (ou Wallet) correspondante est complétée au lieu d'être dupliquée.
  const preview = (() => {
    const used = new Set<string>()
    return parsed.rows.map((r, i) => {
      const rule = matchRule(r.label, rules)
      const dup = existingHashes.has(hashes[i])
      const match = dup ? undefined : findManualMatch(r, accountId, existing, used)
      if (match) used.add(match.id)
      return { r, hash: hashes[i], dup, rule, match }
    })
  })()
  const toImport = preview.filter((p) => !(skipDup && p.dup))
  const cats = useMap('categories')

  // Paiement d'une carte ou rechargement d'un autre compte du foyer = virement interne, pas une dépense.
  const internalTarget = (label: string) => {
    const l = label.toLowerCase()
    const inst = /american express|amex/.test(l) ? 'amex' : /deblock/.test(l) ? 'deblock' : undefined
    return inst ? accounts.find((a) => a.institution === inst && a.id !== accountId) : undefined
  }

  const doImport = () => {
    if (!account) return
    const matched = toImport.filter((p) => p.match)
    for (const { r, hash, match } of matched) {
      upsert('transactions', { ...match!, amount: Math.abs(r.amount), importHash: hash, rawLabel: r.label, reconciledAt: new Date().toISOString() })
    }
    const txs: Transaction[] = toImport.filter((p) => !p.match).map(({ r, hash, rule }) => {
      const target = r.amount < 0 ? internalTarget(r.label) : undefined
      const fx = foreignAmount(r.label)
      const fxOk = fx && fx.currency !== account.currency && CURRENCIES.some((c) => c.code === fx.currency)
      if (target) {
        return {
          id: uid(), updatedAt: '', date: r.date, type: 'transfer' as const, amount: Math.abs(r.amount), accountId, toAccountId: target.id,
          toAmount: fromXPF(toXPF(Math.abs(r.amount), account.currency, rates), target.currency, rates),
          rawLabel: r.label, tags: [], member: account.owner ?? member, importHash: hash,
        }
      }
      return {
      id: uid(),
      updatedAt: '',
      date: r.date,
      type: r.amount < 0 ? 'expense' : 'income',
      amount: Math.abs(r.amount),
      accountId,
      categoryId: rule?.categoryId && cats.get(rule.categoryId)?.kind === (r.amount < 0 ? 'expense' : 'income') ? rule.categoryId : undefined,
      payee: rule?.payee ?? cleanLabel(r.label),
      rawLabel: r.label,
      tags: rule?.tags ?? [],
      member: account.owner ?? member,
      importHash: hash,
      ...(fxOk ? { originalAmount: fx!.amount, originalCurrency: fx!.currency as Currency } : {}),
    }
    })
    upsertMany('transactions', txs)
    if (mapping) upsert('accounts', { ...account, importMapping: mapping })
    toast(`${txs.length} opération${txs.length > 1 ? 's' : ''} importée${txs.length > 1 ? 's' : ''}${matched.length ? ` · ${matched.length} rapprochée${matched.length > 1 ? 's' : ''} avec vos saisies` : ''}`)
    nav(`/operations?compte=${accountId}&mois=${txs[0]?.date.slice(0, 7) ?? ''}`)
  }

  const header = rows && mapping ? rows[mapping.skipRows] ?? [] : []
  const colOptions = header.map((h, i) => ({ value: String(i), label: `${i + 1}. ${mapping?.hasHeader ? h : rows?.[mapping!.skipRows]?.[i] ?? ''}`.slice(0, 40) }))
  const setM = (p: Partial<ImportMapping>) => setMapping((m) => (m ? { ...m, ...p } : m))
  const uncategorized = toImport.filter((p) => !p.rule).length

  return (
    <Page title="Importer un relevé" back>
      <div className="card form">
        <SelectField label="Compte" value={accountId} onChange={(v) => { setAccountId(v); setRows(null); setOfxRows(null); setFileName('') }}
          options={accounts.map((a) => ({ value: a.id, label: `${a.name} (${a.currency})` }))} />
        {account && HELP[account.institution] && <div className="callout"><Info size={18} /><span>{HELP[account.institution]}</span></div>}
        <label className="btn primary block" style={{ cursor: 'pointer' }}>
          <FileUp size={18} />{fileName || 'Choisir un fichier CSV ou OFX'}
          <input type="file" accept=".csv,.txt,.ofx,.qfx,text/csv" className="sr-only" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        </label>
        {error && <p className="error" role="alert" style={{ color: 'var(--expense)', margin: 0 }}>{error}</p>}
        <p className="faint" style={{ margin: 0 }}>Le fichier est lu sur votre téléphone ; rien n'est envoyé ailleurs (sauf la synchronisation de votre foyer). PDF : non pris en charge pour l'instant, exportez en CSV.</p>
      </div>

      {mapping && rows && (
        <Section title="Colonnes">
          <div className="card form">
            <div className="grid-2">
              <SelectField label="Date" value={String(mapping.dateCol)} onChange={(v) => setM({ dateCol: Number(v) })} options={colOptions} />
              <SelectField label="Libellé" value={String(mapping.labelCol)} onChange={(v) => setM({ labelCol: Number(v) })} options={colOptions} />
            </div>
            <SelectField label="Montant" value={mapping.amountCol !== undefined ? 'single' : 'split'} onChange={(v) => setM(v === 'single' ? { amountCol: mapping.amountCol ?? mapping.debitCol ?? 0, debitCol: undefined, creditCol: undefined } : { amountCol: undefined, debitCol: mapping.debitCol ?? 0, creditCol: mapping.creditCol ?? 1 })}
              options={[{ value: 'single', label: 'Une colonne (signée)' }, { value: 'split', label: 'Deux colonnes Débit / Crédit' }]} />
            {mapping.amountCol !== undefined ? (
              <SelectField label="Colonne du montant" value={String(mapping.amountCol)} onChange={(v) => setM({ amountCol: Number(v) })} options={colOptions} />
            ) : (
              <div className="grid-2">
                <SelectField label="Débit" value={String(mapping.debitCol)} onChange={(v) => setM({ debitCol: Number(v) })} options={colOptions} />
                <SelectField label="Crédit" value={String(mapping.creditCol)} onChange={(v) => setM({ creditCol: Number(v) })} options={colOptions} />
              </div>
            )}
            <div className="grid-2">
              <SelectField label="Format de date" value={mapping.dateOrder} onChange={(v) => setM({ dateOrder: v })} options={[{ value: 'DMY', label: 'JJ/MM/AAAA' }, { value: 'MDY', label: 'MM/JJ/AAAA (US)' }, { value: 'YMD', label: 'AAAA-MM-JJ' }]} />
              <SelectField label="Lignes à ignorer" value={String(mapping.skipRows)} onChange={(v) => setM({ skipRows: Number(v) })} options={Array.from({ length: 11 }, (_, i) => ({ value: String(i), label: String(i) }))} />
            </div>
            <label className="check"><input type="checkbox" checked={mapping.hasHeader} onChange={(e) => setM({ hasHeader: e.target.checked })} />La première ligne est un en-tête</label>
            <label className="check"><input type="checkbox" checked={mapping.invert} onChange={(e) => setM({ invert: e.target.checked })} />Inverser les signes (dépenses positives dans le fichier)</label>
          </div>
        </Section>
      )}

      {parsed.rows.length > 0 && (
        <Section title={`Aperçu · ${parsed.rows.length} opérations`}>
          {parsed.errors.length > 0 && (
            <div className="callout warn"><Info size={18} /><span>{parsed.errors.length} ligne(s) ignorée(s) : {parsed.errors.slice(0, 3).map((e) => `ligne ${e.line} (${e.reason})`).join(', ')}{parsed.errors.length > 3 ? '…' : ''}</span></div>
          )}
          {preview.some((p) => p.dup) && (
            <label className="check"><input type="checkbox" checked={skipDup} onChange={(e) => setSkipDup(e.target.checked)} />Ignorer les {preview.filter((p) => p.dup).length} opération(s) déjà importée(s)</label>
          )}
          <div className="card flush table-wrap">
            <table className="data">
              <thead><tr><th>Date</th><th>Libellé · catégorie</th><th className="r">Montant</th></tr></thead>
              <tbody>
                {preview.slice(0, 200).map((p) => (
                  <tr key={p.hash} className={p.dup && skipDup ? 'dup' : ''}>
                    <td className="num">{formatDate(p.r.date).slice(0, 5)}</td>
                    <td>
                      {p.r.label}{p.dup && <span className="badge" style={{ marginLeft: 6 }}>déjà importée</span>}
                      <div className="faint">{p.match ? <span className="income">↔ Rapprochée avec « {p.match.payee ?? 'saisie'} » du {formatDate(p.match.date).slice(0, 5)}</span> : p.r.amount < 0 && internalTarget(p.r.label) ? `Virement → ${internalTarget(p.r.label)!.name}` : p.rule ? cats.get(p.rule.categoryId ?? '')?.name : 'Sans catégorie'}</div>
                    </td>
                    <td className={`r num ${p.r.amount < 0 ? 'expense' : 'income'}`}>{formatMoney(p.r.amount, account?.currency ?? 'XPF', { sign: true })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.length > 200 && <p className="faint">… et {preview.length - 200} autres.</p>}
          {uncategorized > 0 && <p className="faint" style={{ margin: 0 }}>{uncategorized} opération(s) sans catégorie : complétez-les ensuite, ou ajoutez des règles automatiques.</p>}
          <div className="sticky-actions">
            <button className="btn primary" disabled={!toImport.length} onClick={doImport}>Importer {toImport.length} opération{toImport.length > 1 ? 's' : ''}</button>
          </div>
        </Section>
      )}
    </Page>
  )
}
