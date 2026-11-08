import { formatMoney, type Currency } from '../lib/money'

/** Montant formaté. `approx` ajoute « ≈ » (conversion à taux variable). Le signe porte le sens, pas la couleur seule. */
export function Money({ value, currency = 'XPF', approx, sign, tone, className = '' }: {
  value: number
  currency?: Currency
  approx?: boolean
  sign?: boolean
  tone?: boolean
  className?: string
}) {
  const t = tone ? (value < 0 ? ' expense' : value > 0 ? ' income' : '') : ''
  return (
    <span className={`money${t} ${className}`}>
      {approx ? '≈ ' : ''}
      {formatMoney(value, currency, { sign })}
    </span>
  )
}
