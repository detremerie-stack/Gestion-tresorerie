/** Décode un fichier en UTF-8, ou en Windows-1252 (exports bancaires « Excel ») si l'UTF-8 est invalide. */
export function decodeText(buf: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf).replace(/^﻿/, '')
  } catch {
    return new TextDecoder('windows-1252').decode(buf)
  }
}

export function detectDelimiter(text: string): string {
  const lines = text.split(/\r?\n/).filter((l) => l.trim()).slice(0, 20)
  let best = ';'
  let bestScore = -1
  for (const d of [';', ',', '\t', '|']) {
    const counts = lines.map((l) => splitLine(l, d).length)
    if (!counts.length) continue
    // Le meilleur séparateur donne un nombre de colonnes > 1 et stable d'une ligne à l'autre.
    const mode = counts.sort((a, b) => counts.filter((c) => c === b).length - counts.filter((c) => c === a).length)[0]
    const stable = counts.filter((c) => c === mode).length
    const score = mode > 1 ? stable * 10 + mode : 0
    if (score > bestScore) {
      bestScore = score
      best = d
    }
  }
  return best
}

function splitLine(line: string, d: string): string[] {
  return parseCSV(line, d)[0] ?? []
}

/** Parseur CSV conforme RFC 4180 (guillemets, guillemets doublés, retours à la ligne cités). */
export function parseCSV(text: string, delimiter: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else quoted = false
      } else field += c
    } else if (c === '"' && field === '') quoted = true
    else if (c === delimiter) {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      if (row.some((f) => f.trim() !== '')) rows.push(row.map((f) => f.trim()))
      row = []
      field = ''
    } else field += c
  }
  row.push(field)
  if (row.some((f) => f.trim() !== '')) rows.push(row.map((f) => f.trim()))
  return rows
}
