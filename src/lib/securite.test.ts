import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { isValidAmount, knownCurrency, quickParams } from './quick'
import { safeType, withSafeType } from './attachments'
import { csvCell } from './csvExport'
import { isValidRecord } from '../data/validate'
import { parseBackup } from './backup'

const q = (query: string) => { const p = new URLSearchParams(query); return quickParams((k) => p.get(k)) }

describe('P3 — lien #/rapide piégé', () => {
  it('ignore une devise inconnue et n’accepte que la liste CURRENCIES', () => {
    expect(q('montant=1000&devise=constructor').currency).toBeUndefined()
    expect(q('montant=1000&devise=__proto__').currency).toBeUndefined()
    expect(q('montant=1000&devise=XYZ').currency).toBeUndefined()
    expect(q('montant=1000&devise=EUR').currency).toBe('EUR')
    expect(q('montant=1000&devise=usd').currency).toBe('USD')
    expect(knownCurrency('toString')).toBeUndefined()
  })
  it('borne le montant : fini, > 0, au plus 9 chiffres', () => {
    expect(q('montant=2890&marchand=LE%20FOURNIL&carte=1234')).toEqual({ amount: 2890, currency: undefined, merchant: 'LE FOURNIL', last4: '1234' })
    for (const bad of ['abc', '-5', '0', '1234567890', 'Infinity', 'NaN', '']) expect(q(`montant=${bad}`).amount).toBeUndefined()
    expect(q('montant=999999999').amount).toBe(999999999)
    expect(q('montant=13,99&devise=EUR')).toMatchObject({ amount: 13.99, currency: 'EUR' })
    expect(q('carte=abcd').last4).toBeUndefined()
  })
  it('isValidAmount (contrôle de save())', () => {
    for (const ok of [1, 2890, 0.5, 999_999_999]) expect(isValidAmount(ok)).toBe(true)
    for (const bad of [0, -1, NaN, Infinity, 1_000_000_000, null, undefined, '12']) expect(isValidAmount(bad)).toBe(false)
  })
  it('les notifications Wallet restent lues comme avant', () => {
    expect(q(`titre=${encodeURIComponent('LE FOURNIL ARUE')}&texte=${encodeURIComponent('XPF 2 890 avec Visa •••• 1234')}`)).toEqual({ amount: 2890, currency: 'XPF', merchant: 'LE FOURNIL ARUE', last4: '1234' })
  })
})

describe('P2 — type des justificatifs en liste blanche', () => {
  it('HTML, SVG, scripts → fichier opaque ; images et PDF conservés', () => {
    for (const bad of ['text/html', 'image/svg+xml', 'application/javascript', 'text/xml', '', undefined, 'TEXT/HTML; charset=utf-8']) expect(safeType(bad)).toBe('application/octet-stream')
    for (const ok of ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']) expect(safeType(ok)).toBe(ok)
    expect(safeType('IMAGE/JPEG; q=1')).toBe('image/jpeg')
  })
  it('un fichier reçu en text/html est requalifié avant d’être ouvert', async () => {
    const b = withSafeType(new Blob(['<script>alert(1)</script>'], { type: 'text/html' }))
    expect(b.type).toBe('application/octet-stream')
    expect(await b.text()).toBe('<script>alert(1)</script>')
    const img = new Blob(['x'], { type: 'image/jpeg' })
    expect(withSafeType(img)).toBe(img)
  })
})

describe('P9 — formules dans l’export CSV', () => {
  it('préfixe d’une apostrophe les cellules commençant par = + - @', () => {
    expect(csvCell('=HYPERLINK("http://x","clic")')).toBe('"\'=HYPERLINK(""http://x"",""clic"")"')
    expect(csvCell('+33 1')).toBe('"\'+33 1"')
    expect(csvCell('-2+3')).toBe('"\'-2+3"')
    expect(csvCell('@SUM(A1)')).toBe('"\'@SUM(A1)"')
    expect(csvCell('\t=1')).toBe('"\'\t=1"')
    expect(csvCell('VIR SALAIRE')).toBe('"VIR SALAIRE"')
    expect(csvCell('Café "chez Jo"')).toBe('"Café ""chez Jo"""')
  })
})

describe('P10 — forme des enregistrements reçus', () => {
  it('rejette sans id texte, montant non numérique ou collection inconnue', () => {
    expect(isValidRecord('transactions', { id: 't1', amount: 10 })).toBe(true)
    expect(isValidRecord('transactions', { id: 't1', amount: null })).toBe(false)
    expect(isValidRecord('transactions', { id: 't1', amount: '10' })).toBe(false)
    expect(isValidRecord('transactions', { id: 't1', amount: 10, toAmount: 'x' })).toBe(false)
    expect(isValidRecord('transactions', { id: 42, amount: 10 })).toBe(false)
    expect(isValidRecord('transactions', { amount: 10 })).toBe(false)
    expect(isValidRecord('transactions', null)).toBe(false)
    expect(isValidRecord('transactions', [])).toBe(false)
    expect(isValidRecord('hack', { id: 'x' })).toBe(false)
    expect(isValidRecord('constructor', { id: 'x' })).toBe(false)
    expect(isValidRecord('accounts', { id: 'a', initialBalance: 'beaucoup' })).toBe(false)
    expect(isValidRecord('categories', { id: 'c', name: 'Sans montant' })).toBe(true)
    // Une suppression passe toujours, même si l'enregistrement d'origine était abîmé.
    expect(isValidRecord('transactions', { id: 't1', amount: null, deleted: true })).toBe(true)
  })
  it('restauration : les éléments mal formés sont ignorés et comptés', () => {
    const b = parseBackup({ app: 'moni', data: { transactions: { ok: { id: 'ok', amount: 1 }, ko: { id: 'ko', amount: null }, sansid: { amount: 3 } }, inconnu: { x: { id: 'x' } } } })
    expect(Object.keys(b.data.transactions ?? {})).toEqual(['ok'])
    expect(b.counts.transactions).toBe(1)
    expect(b.ignored).toBe(2)
    expect(b.total).toBe(1)
  })
})

describe('P8 — pas de vrais chiffres de carte dans le code', () => {
  const real = String(5777 + 1) // écrit ainsi pour ne pas figurer dans le dépôt
  const files = (dir: string): string[] => readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? files(p) : [p] })
  it('aucun fichier source ne contient les 4 derniers chiffres retirés', () => {
    const hits = files(join(__dirname, '..')).filter((p) => /\.(tsx?|json|css)$/.test(p) && readFileSync(p, 'utf8').includes(real))
    expect(hits).toEqual([])
  })
})
