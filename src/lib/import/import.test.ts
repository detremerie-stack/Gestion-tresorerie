import { describe, expect, it } from 'vitest'
import { detectDelimiter, parseCSV, decodeText } from './csv'
import { applyMapping, guessMapping, importHashes } from './mapping'
import { parseOFX } from './ofx'

const btCSV = `Relevé de compte;;;;
Compte courant n° 12345;;;;
Date opération;Date valeur;Libellé;Débit;Crédit
05/11/2026;05/11/2026;PRLV VINI ABONNEMENT;3 900;
06/11/2026;06/11/2026;"CB CARREFOUR ARUE; FAAA";12 450;
07/11/2026;07/11/2026;VIR SALAIRE NOVEMBRE;;385 000
`

const amexCSV = `Date,Description,Montant
11/03/2026,NETFLIX.COM,13.99
11/04/2026,"SPOTIFY P1234, STOCKHOLM",10.99
11/05/2026,PAIEMENT REÇU - MERCI,-250.00
`

describe('csv', () => {
  it('detects delimiter and quotes', () => {
    expect(detectDelimiter(btCSV)).toBe(';')
    expect(detectDelimiter(amexCSV)).toBe(',')
    const rows = parseCSV(amexCSV, ',')
    expect(rows[2]).toEqual(['11/04/2026', 'SPOTIFY P1234, STOCKHOLM', '10.99'])
  })
  it('decodes windows-1252', () => {
    const bytes = new Uint8Array([0x4c, 0x69, 0x62, 0x65, 0x6c, 0x6c, 0xe9]) // "Libellé" en cp1252
    expect(decodeText(bytes.buffer)).toBe('Libellé')
  })
  it('maps a Banque de Tahiti-like debit/credit export with title rows', () => {
    const rows = parseCSV(btCSV, ';')
    const m = guessMapping(rows, ';')
    expect(m.skipRows).toBe(2)
    expect(m.dateCol).toBe(0)
    expect(m.labelCol).toBe(2)
    expect(m.debitCol).toBe(3)
    expect(m.creditCol).toBe(4)
    const { rows: parsed, errors } = applyMapping(rows, m)
    expect(errors).toEqual([])
    expect(parsed).toEqual([
      { date: '2026-11-05', label: 'PRLV VINI ABONNEMENT', amount: -3900 },
      { date: '2026-11-06', label: 'CB CARREFOUR ARUE; FAAA', amount: -12450 },
      { date: '2026-11-07', label: 'VIR SALAIRE NOVEMBRE', amount: 385000 },
    ])
  })
  it('maps an AmEx-like export (US dates, positive charges) with invert', () => {
    const rows = parseCSV(amexCSV, ',')
    const m = guessMapping(rows, ',')
    expect(m.amountCol).toBe(2)
    expect(m.labelCol).toBe(1)
    const parsed = applyMapping(rows, { ...m, dateOrder: 'MDY', invert: true }).rows
    expect(parsed[0]).toEqual({ date: '2026-11-03', label: 'NETFLIX.COM', amount: -13.99 })
    expect(parsed[2].amount).toBe(250)
  })
  it('reports unreadable rows', () => {
    const rows = parseCSV('Date;Libellé;Montant\nhier;X;12\n01/11/2026;Y;abc\n', ';')
    const { errors } = applyMapping(rows, guessMapping(rows, ';'))
    expect(errors.map((e) => e.line)).toEqual([2, 3])
  })
  it('hashes duplicates distinctly within a file but stably across imports', () => {
    const rows = [
      { date: '2026-11-01', label: 'Café', amount: -500 },
      { date: '2026-11-01', label: 'CAFE', amount: -500 },
    ]
    const h = importHashes('acc', rows)
    expect(h[0]).not.toBe(h[1])
    expect(importHashes('acc', rows)).toEqual(h)
  })
})

describe('ofx', () => {
  it('parses SGML OFX', () => {
    const ofx = `OFXHEADER:100
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261102120000<TRNAMT>-12.50<FITID>A1<NAME>BOULANGERIE<MEMO>CB 01/11
</STMTTRN>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20261103<TRNAMT>100.00<FITID>A2<NAME>VIREMENT
</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`
    expect(parseOFX(ofx)).toEqual([
      { date: '2026-11-02', label: 'BOULANGERIE — CB 01/11', amount: -12.5, fitId: 'A1' },
      { date: '2026-11-03', label: 'VIREMENT', amount: 100, fitId: 'A2' },
    ])
  })
})
