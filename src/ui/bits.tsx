import { useEffect, useState } from 'react'
import { compactMoney } from '../game/finance'
import type { HistoryPoint } from '../game/types'

const PIPS: Record<number, number[]> = {
  1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8],
}

export function Die({ value, rolling }: { value: number; rolling?: boolean }) {
  return (
    <div className={`die${rolling ? ' rolling' : ''}`} aria-label={`Die showing ${value}`}>
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className={PIPS[value]?.includes(i) ? 'pip' : 'pip off'} />
      ))}
    </div>
  )
}

/** Shows dice that tumble briefly whenever `rollKey` changes. */
export function Dice({ values, rollKey }: { values: number[]; rollKey: string }) {
  const [rolling, setRolling] = useState(false)
  const [faces, setFaces] = useState(values)
  useEffect(() => {
    if (!values.length) return
    setRolling(true)
    let ticks = 0
    const id = setInterval(() => {
      ticks++
      setFaces(values.map(() => 1 + Math.floor(Math.random() * 6)))
      if (ticks >= 6) {
        clearInterval(id)
        setFaces(values)
        setRolling(false)
      }
    }, 70)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rollKey])
  if (!values.length) return null
  return (
    <div className="dice">
      {faces.map((v, i) => (
        <Die key={i} value={v} rolling={rolling} />
      ))}
    </div>
  )
}

export function Meter({ value, label, tone = 'green' }: { value: number; label?: string; tone?: 'green' | 'purple' }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100)
  return (
    <div className={`meter meter-${tone}`} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className="meter-fill" style={{ width: `${pct}%` }} />
    </div>
  )
}

export function Sparkline({ history }: { history: HistoryPoint[] }) {
  if (history.length < 2) return <p className="muted small">Your progress chart appears after a few turns.</p>
  const w = 280
  const h = 70
  const pad = 4
  const max = Math.max(1, ...history.map((x) => Math.max(x.passive, x.expenses)))
  const xs = (i: number) => pad + (i / (history.length - 1)) * (w - pad * 2)
  const ys = (v: number) => h - pad - (v / max) * (h - pad * 2)
  const line = (key: 'passive' | 'expenses') => history.map((pt, i) => `${i ? 'L' : 'M'}${xs(i).toFixed(1)},${ys(pt[key]).toFixed(1)}`).join(' ')
  const last = history[history.length - 1]
  return (
    <figure className="spark">
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label="Passive income versus expenses over time">
        <path d={line('expenses')} className="spark-exp" />
        <path d={line('passive')} className="spark-pass" />
      </svg>
      <figcaption>
        <span className="key key-pass" /> Passive {compactMoney(last.passive)}
        <span className="key key-exp" /> Expenses {compactMoney(last.expenses)}
      </figcaption>
    </figure>
  )
}
