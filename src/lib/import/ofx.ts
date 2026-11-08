import type { ParsedRow } from './mapping'

/** Lit un relevé OFX/QFX (SGML ou XML) : une ligne par <STMTTRN>. */
export function parseOFX(text: string): ParsedRow[] {
  const out: ParsedRow[] = []
  const blocks = text.split(/<STMTTRN>/i).slice(1)
  for (const block of blocks) {
    const body = block.split(/<\/STMTTRN>/i)[0]
    const tag = (name: string) => body.match(new RegExp(`<${name}>([^<\\r\\n]*)`, 'i'))?.[1]?.trim()
    const dt = tag('DTPOSTED') ?? tag('DTUSER')
    const amt = Number((tag('TRNAMT') ?? '').replace(',', '.'))
    if (!dt || Number.isNaN(amt)) continue
    const date = `${dt.slice(0, 4)}-${dt.slice(4, 6)}-${dt.slice(6, 8)}`
    const name = tag('NAME') ?? ''
    const memo = tag('MEMO') ?? ''
    const label = [name, memo && memo !== name ? memo : ''].filter(Boolean).join(' — ')
    out.push({ date, label, amount: amt, fitId: tag('FITID') })
  }
  return out
}

export function looksLikeOFX(text: string): boolean {
  return /<OFX>/i.test(text) || /OFXHEADER/i.test(text)
}
