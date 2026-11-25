import { useEffect, useRef, useState } from 'react'
import { compactMoney, money } from '../game/finance'
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

/**
 * Money that counts up/down to its new value with a floating "+$1,200" bubble.
 * While `hold` is true (tokens still moving) it keeps showing the old amount.
 */
export function CashTicker({ value, hold = false, className }: { value: number; hold?: boolean; className?: string }) {
  const [shown, setShown] = useState(value)
  const [pops, setPops] = useState<{ id: number; diff: number }[]>([])
  const target = useRef(value)
  const from = useRef(value)

  useEffect(() => {
    if (hold || value === target.current) return
    const diff = value - target.current
    from.current = target.current
    target.current = value
    const id = Date.now() + Math.random()
    setPops((p) => [...p.slice(-2), { id, diff }])
    const t0 = performance.now()
    const dur = Math.min(900, 250 + Math.abs(diff) / 40)
    let raf = 0
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / dur)
      const eased = 1 - Math.pow(1 - k, 3)
      setShown(Math.round(from.current + (target.current - from.current) * eased))
      if (k < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    setTimeout(() => setPops((p) => p.filter((x) => x.id !== id)), 1600)
    return () => {
      cancelAnimationFrame(raf)
      setShown(target.current)
    }
  }, [value, hold])

  return (
    <span className={`ticker ${className ?? ''}`}>
      {money(shown)}
      {pops.map((p) => (
        <span key={p.id} className={`pop ${p.diff >= 0 ? 'pop-up' : 'pop-down'}`} aria-hidden>
          {money(p.diff, { sign: true })}
        </span>
      ))}
    </span>
  )
}

const CONFETTI_COLORS = ['#34d399', '#a78bfa', '#fbbf24', '#60a5fa', '#f472b6', '#2dd4bf']

/** A one-shot burst of confetti over the whole screen. */
export function Confetti({ pieces = 120 }: { pieces?: number }) {
  const [bits] = useState(() =>
    Array.from({ length: pieces }, (_, i) => ({
      left: Math.random() * 100,
      delay: Math.random() * 0.6,
      dur: 2.2 + Math.random() * 1.6,
      drift: (Math.random() - 0.5) * 240,
      spin: (Math.random() - 0.5) * 1080,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      w: 6 + Math.random() * 6,
      round: Math.random() < 0.3,
    })),
  )
  return (
    <div className="confetti-layer" aria-hidden>
      {bits.map((b, i) => (
        <span
          key={i}
          className="confetti-bit"
          style={{
            left: `${b.left}%`,
            width: b.w,
            height: b.round ? b.w : b.w * 1.6,
            borderRadius: b.round ? '50%' : 2,
            background: b.color,
            animationDelay: `${b.delay}s`,
            animationDuration: `${b.dur}s`,
            ['--drift' as string]: `${b.drift}px`,
            ['--spin' as string]: `${b.spin}deg`,
          }}
        />
      ))}
    </div>
  )
}
