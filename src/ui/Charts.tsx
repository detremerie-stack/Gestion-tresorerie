import { useState } from 'react'
import { formatMoney } from '../lib/money'
import { monthLabel } from '../lib/dates'
import { CatIcon } from './Icon'

export interface BarItem {
  key: string
  label: string
  value: number
  icon?: string
  color?: string
  sub?: string
}

/** Barres horizontales classées, une teinte : comparer des parts (préféré au camembert). */
export function RankedBars({ items, kind = 'expense', onSelect, total }: { items: BarItem[]; kind?: 'expense' | 'income'; onSelect?: (key: string) => void; total?: number }) {
  const max = Math.max(1, ...items.map((i) => i.value))
  const sum = total ?? items.reduce((s, i) => s + i.value, 0)
  return (
    <div className="hbars">
      {items.map((i) => {
        const pct = sum ? Math.round((i.value / sum) * 100) : 0
        const Tag = onSelect ? 'button' : 'div'
        return (
          <Tag key={i.key} className="hbar" onClick={onSelect ? () => onSelect(i.key) : undefined} type={onSelect ? 'button' : undefined}>
            <CatIcon icon={i.icon} color={i.color} small />
            <div>
              <div className="lbl">
                <span>{i.label}{i.sub && <span className="faint"> · {i.sub}</span>}</span>
                <span className="faint num">{pct} %</span>
              </div>
              <div className="track">
                <div className={`bar ${kind}`} style={{ width: `${(i.value / max) * 100}%` }} />
              </div>
            </div>
            <span className="val num">{formatMoney(i.value)}</span>
          </Tag>
        )
      })}
    </div>
  )
}

export function Meter({ value, max, label }: { value: number; max: number; label: string }) {
  const ratio = max > 0 ? value / max : 0
  const cls = ratio > 1 ? 'over' : ratio > 0.85 ? 'warn' : ''
  return (
    <div className={`meter ${cls}`} role="meter" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-label={label}>
      <span style={{ width: `${Math.min(100, ratio * 100)}%` }} />
    </div>
  )
}

/** Colonnes groupées revenus / dépenses par mois, avec info-bulle au toucher ou au survol. */
export function MonthColumns({ data }: { data: { month: string; income: number; expense: number }[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const W = 340
  const H = 180
  const padL = 4
  const padB = 22
  const plotH = H - padB - 8
  const max = niceMax(Math.max(1, ...data.flatMap((d) => [d.income, d.expense])))
  const slot = (W - padL) / data.length
  const barW = Math.min(14, (slot - 10) / 2)
  const y = (v: number) => 8 + plotH - (v / max) * plotH
  const ticks = [0, max / 2, max]
  const h = hover != null ? data[hover] : null
  return (
    <div className="colchart">
      <div className="chart-legend" aria-hidden="true" style={{ marginBottom: 8 }}>
        <span><i style={{ background: 'var(--chart-income)' }} />Revenus</span>
        <span><i style={{ background: 'var(--chart-expense)' }} />Dépenses</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Revenus et dépenses par mois" onMouseLeave={() => setHover(null)}>
        <g className="grid">
          {ticks.map((t) => (
            <line key={t} x1={padL} x2={W} y1={y(t)} y2={y(t)} />
          ))}
        </g>
        {data.map((d, i) => {
          const cx = padL + slot * i + slot / 2
          return (
            <g key={d.month} onMouseEnter={() => setHover(i)} onClick={() => setHover(hover === i ? null : i)}>
              <rect x={cx - slot / 2} y={0} width={slot} height={H} fill={hover === i ? 'var(--surface-2)' : 'transparent'} rx={6} />
              <Bar x={cx - barW - 1} w={barW} y0={y(0)} y1={y(d.income)} fill="var(--chart-income)" />
              <Bar x={cx + 1} w={barW} y0={y(0)} y1={y(d.expense)} fill="var(--chart-expense)" />
              <g className="axis">
                <text x={cx} y={H - 6} textAnchor="middle">{monthLabel(d.month, true).split(' ')[0]}</text>
              </g>
            </g>
          )
        })}
      </svg>
      {h && hover != null && (
        <div className="tip" style={{ left: `${((padL + slot * hover + slot / 2) / W) * 100}%`, top: 24 }}>
          <strong style={{ textTransform: 'capitalize' }}>{monthLabel(h.month)}</strong>
          <div>Revenus : {formatMoney(h.income)}</div>
          <div>Dépenses : {formatMoney(h.expense)}</div>
          <div>Solde : {formatMoney(h.income - h.expense, 'XPF', { sign: true })}</div>
        </div>
      )}
      <table className="sr-only">
        <caption>Revenus et dépenses par mois</caption>
        <thead><tr><th>Mois</th><th>Revenus</th><th>Dépenses</th></tr></thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.month}><td>{monthLabel(d.month)}</td><td>{formatMoney(d.income)}</td><td>{formatMoney(d.expense)}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Barre à bout supérieur arrondi (4px), ancrée sur la ligne de base. */
function Bar({ x, w, y0, y1, fill }: { x: number; w: number; y0: number; y1: number; fill: string }) {
  const h = Math.max(0, y0 - y1)
  if (h < 0.5) return null
  const r = Math.min(4, h, w / 2)
  const d = `M${x},${y0} V${y1 + r} Q${x},${y1} ${x + r},${y1} H${x + w - r} Q${x + w},${y1} ${x + w},${y1 + r} V${y0} Z`
  return <path d={d} fill={fill} />
}

function niceMax(v: number): number {
  const p = 10 ** Math.floor(Math.log10(v))
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p
  return 10 * p
}
