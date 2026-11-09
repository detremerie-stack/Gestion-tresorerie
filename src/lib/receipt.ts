import { parseAmount, type Currency } from './money'
import { parseDate, type ISODate } from './dates'

export interface ReceiptData {
  merchant?: string
  amount?: number
  currency?: Currency
  date?: ISODate
}

const TOTAL = /(total\s*(ttc|due|general|à payer|a payer)?|montant\s*(à|a)?\s*payer|net\s*(à|a)\s*payer|à payer|a payer|amount\s*due|grand\s*total|balance\s*due)/i
const SKIP_TOTAL = /(sous[-\s]?total|subtotal|total\s*ht|tva|tax\b|articles|items)/i
const AMOUNT = /(?:[$€£]\s*)?\d{1,3}(?:[ . ]\d{3})*(?:[.,]\d{2})?|\d+(?:[.,]\d{2})?/g

function currencyOf(text: string): Currency | undefined {
  if (/XPF|F\s?CFP|FCFP/i.test(text)) return 'XPF'
  if (/€|EUR\b/i.test(text)) return 'EUR'
  if (/\$|USD/i.test(text)) return 'USD'
  if (/£|GBP/i.test(text)) return 'GBP'
  return undefined
}

function amountsIn(line: string): number[] {
  return (line.match(AMOUNT) ?? []).map((s) => parseAmount(s.replace(/[$€£]/g, ''))).filter((n) => !Number.isNaN(n) && n > 0)
}

/** Extrait commerçant, total, devise et date du texte OCR d'un ticket de caisse. */
export function parseReceipt(text: string, fallbackCurrency?: Currency): ReceiptData {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const out: ReceiptData = {}
  out.merchant = lines.find((l) => /[a-z]{3}/i.test(l) && !/(bienvenue|welcome|ticket|facture|re[çc]u|receipt|merci|thank)/i.test(l) && !/\d{2}[/.-]\d{2}/.test(l))
  const docCurrency = currencyOf(text)
  // Total : dernière ligne « total » (hors sous-total / TVA), sinon le plus grand montant.
  for (let i = lines.length - 1; i >= 0; i--) {
    if (TOTAL.test(lines[i]) && !SKIP_TOTAL.test(lines[i])) {
      const nums = amountsIn(lines[i]).length ? amountsIn(lines[i]) : amountsIn(lines[i + 1] ?? '')
      if (nums.length) {
        out.amount = nums[nums.length - 1]
        out.currency = currencyOf(lines[i]) ?? docCurrency
        break
      }
    }
  }
  if (out.amount == null) {
    const all = lines.filter((l) => !/\d{2}[/.-]\d{2}[/.-]\d{2,4}/.test(l)).flatMap(amountsIn)
    if (all.length) out.amount = Math.max(...all)
  }
  out.currency ??= docCurrency ?? fallbackCurrency
  if (out.currency === 'XPF' && out.amount) out.amount = Math.round(out.amount)
  const dl = text.match(/\b(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|\d{4}-\d{2}-\d{2})\b/)
  if (dl) out.date = parseDate(dl[1].replace(/\./g, '/'), out.currency === 'USD' ? 'MDY' : 'DMY') ?? undefined
  return out
}
