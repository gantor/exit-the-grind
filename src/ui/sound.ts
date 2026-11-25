// Synthesized sound effects (Web Audio API): no files, works offline.
import { getPrefs, subscribePrefs } from './settings'

export type Sfx =
  | 'dice'
  | 'hop'
  | 'payday'
  | 'deal'
  | 'card'
  | 'buy'
  | 'sell'
  | 'market'
  | 'splurge'
  | 'good'
  | 'bad'
  | 'give'
  | 'learn'
  | 'payoff'
  | 'turn'
  | 'escape'
  | 'win'
  | 'tap'

let ctx: AudioContext | null = null
let master: GainNode | null = null
let noiseBuf: AudioBuffer | null = null

let duckHandler: ((depth: number, ms: number) => void) | null = null
/** Lets the music player lower itself while an important sound plays. */
export function setDuckHandler(fn: typeof duckHandler) {
  duckHandler = fn
}

const DUCK: Partial<Record<Sfx, [number, number]>> = {
  payday: [0.6, 700],
  sell: [0.6, 700],
  bad: [0.55, 900],
  escape: [0.2, 2600],
  win: [0.15, 3600],
}

/** The shared audio context (created lazily). Music routes through it too. */
export function getAudioContext(): AudioContext | null {
  return audio()
}

function audio(): AudioContext | null {
  if (ctx) return ctx
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return null
  ctx = new AC()
  master = ctx.createGain()
  master.gain.value = getPrefs().volume
  // Gentle limiter so stacked sounds never clip.
  const comp = ctx.createDynamicsCompressor()
  comp.threshold.value = -12
  comp.ratio.value = 6
  master.connect(comp).connect(ctx.destination)
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
  const d = noiseBuf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  return ctx
}

subscribePrefs(() => {
  if (master) master.gain.value = getPrefs().volume
})

/** Browsers (iOS especially) only allow audio after a user gesture; call this from one. */
export function unlockAudio() {
  const c = audio()
  if (c && c.state !== 'running') void c.resume()
}

if (typeof window !== 'undefined') {
  const once = () => {
    unlockAudio()
    window.removeEventListener('pointerdown', once)
    window.removeEventListener('keydown', once)
  }
  window.addEventListener('pointerdown', once)
  window.addEventListener('keydown', once)
}

interface ToneOpts {
  freq: number
  to?: number
  type?: OscillatorType
  at?: number
  dur?: number
  vol?: number
  attack?: number
}

function tone({ freq, to, type = 'sine', at = 0, dur = 0.15, vol = 0.3, attack = 0.005 }: ToneOpts) {
  const c = ctx!
  const t = c.currentTime + at
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, t)
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(vol, t + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(master!)
  o.start(t)
  o.stop(t + dur + 0.02)
}

function noise({ at = 0, dur = 0.05, vol = 0.2, freq = 2000, q = 1, type = 'bandpass' as BiquadFilterType, sweepTo }: {
  at?: number; dur?: number; vol?: number; freq?: number; q?: number; type?: BiquadFilterType; sweepTo?: number
}) {
  const c = ctx!
  const t = c.currentTime + at
  const src = c.createBufferSource()
  src.buffer = noiseBuf
  const f = c.createBiquadFilter()
  f.type = type
  f.frequency.setValueAtTime(freq, t)
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur)
  f.Q.value = q
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(vol, t + 0.005)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  src.connect(f).connect(g).connect(master!)
  src.start(t, Math.random() * 0.5)
  src.stop(t + dur + 0.02)
}

const N = (semis: number) => 440 * Math.pow(2, semis / 12) // semitones from A4
const C5 = N(3), D5 = N(5), E5 = N(7), G5 = N(10), A5 = N(12), C6 = N(15), E6 = N(19), G6 = N(22), C4 = N(-9), G4 = N(-2)

const RECIPES: Record<Sfx, () => void> = {
  dice: () => {
    for (let i = 0; i < 7; i++) noise({ at: i * 0.045 + Math.random() * 0.02, dur: 0.04, vol: 0.35, freq: 1800 + Math.random() * 2500, q: 3 })
    noise({ at: 0.36, dur: 0.08, vol: 0.3, freq: 900, q: 2 })
  },
  hop: () => {
    tone({ freq: 520 + Math.random() * 40, to: 760, type: 'triangle', dur: 0.06, vol: 0.12 })
  },
  payday: () => {
    noise({ dur: 0.06, vol: 0.25, freq: 3500, q: 4 })
    ;[C6, E6, G6].forEach((f, i) => tone({ freq: f, type: 'triangle', at: 0.05 + i * 0.07, dur: 0.35, vol: 0.22 }))
    tone({ freq: C6 * 2, type: 'sine', at: 0.26, dur: 0.6, vol: 0.12 })
  },
  deal: () => {
    tone({ freq: G5, type: 'triangle', dur: 0.12, vol: 0.2 })
    tone({ freq: C6, type: 'triangle', at: 0.09, dur: 0.22, vol: 0.2 })
  },
  card: () => {
    noise({ dur: 0.12, vol: 0.18, freq: 1200, sweepTo: 4000, q: 0.8 })
    tone({ freq: E5, type: 'sine', at: 0.06, dur: 0.18, vol: 0.12 })
  },
  buy: () => {
    tone({ freq: 1320, type: 'square', dur: 0.06, vol: 0.08 })
    tone({ freq: 1760, type: 'square', at: 0.06, dur: 0.25, vol: 0.08 })
    tone({ freq: 2640, type: 'sine', at: 0.06, dur: 0.4, vol: 0.1 })
  },
  sell: () => {
    ;[E5, G5, C6, E6].forEach((f, i) => tone({ freq: f, type: 'triangle', at: i * 0.05, dur: 0.25, vol: 0.18 }))
    noise({ at: 0.18, dur: 0.05, vol: 0.18, freq: 5000, q: 5 })
  },
  market: () => {
    noise({ dur: 0.35, vol: 0.2, freq: 400, sweepTo: 3000, q: 1.5 })
    tone({ freq: A5, type: 'sine', at: 0.2, dur: 0.3, vol: 0.14 })
  },
  splurge: () => {
    tone({ freq: 700, to: 300, type: 'sawtooth', dur: 0.35, vol: 0.07 })
    tone({ freq: 523, to: 220, type: 'triangle', at: 0.05, dur: 0.4, vol: 0.12 })
  },
  good: () => {
    ;[C5, E5, G5].forEach((f, i) => tone({ freq: f, type: 'triangle', at: i * 0.06, dur: 0.3, vol: 0.18 }))
  },
  bad: () => {
    tone({ freq: 110, to: 60, type: 'sine', dur: 0.4, vol: 0.4 })
    tone({ freq: E5, to: D5 * 0.94, type: 'triangle', at: 0.05, dur: 0.25, vol: 0.12 })
    tone({ freq: C5 * 0.94, to: G4, type: 'triangle', at: 0.25, dur: 0.4, vol: 0.12 })
  },
  give: () => {
    ;[C5, E5, G5, C6].forEach((f) => tone({ freq: f, type: 'sine', dur: 0.9, vol: 0.09, attack: 0.08 }))
  },
  learn: () => {
    ;[C6, D5 * 2, E6, G6].forEach((f, i) => tone({ freq: f, type: 'sine', at: i * 0.06, dur: 0.2, vol: 0.12 }))
  },
  payoff: () => {
    noise({ dur: 0.05, vol: 0.4, freq: 300, q: 1, type: 'lowpass' })
    tone({ freq: 160, to: 90, type: 'sine', dur: 0.12, vol: 0.35 })
    tone({ freq: G5, type: 'triangle', at: 0.1, dur: 0.15, vol: 0.15 })
    tone({ freq: C6, type: 'triangle', at: 0.18, dur: 0.3, vol: 0.15 })
  },
  turn: () => {
    tone({ freq: E6, type: 'sine', dur: 0.25, vol: 0.1 })
    tone({ freq: A5, type: 'sine', at: 0.08, dur: 0.35, vol: 0.08 })
  },
  escape: () => {
    const seq = [C5, E5, G5, C6, G5, C6, E6]
    seq.forEach((f, i) => tone({ freq: f, type: 'triangle', at: i * 0.09, dur: 0.25, vol: 0.2 }))
    ;[C4, G4, C5, E5].forEach((f) => tone({ freq: f, type: 'sawtooth', at: 0.65, dur: 1.2, vol: 0.05, attack: 0.05 }))
    ;[C6, E6, G6].forEach((f) => tone({ freq: f, type: 'sine', at: 0.65, dur: 1.2, vol: 0.1, attack: 0.02 }))
  },
  win: () => {
    const seq = [G4, C5, E5, G5, E5, G5, C6]
    const times = [0, 0.12, 0.24, 0.36, 0.6, 0.72, 0.9]
    seq.forEach((f, i) => tone({ freq: f, type: 'square', at: times[i], dur: 0.22, vol: 0.06 }))
    seq.forEach((f, i) => tone({ freq: f * 2, type: 'triangle', at: times[i], dur: 0.25, vol: 0.12 }))
    ;[C4, G4, C5, E5, G5, C6].forEach((f) => tone({ freq: f, type: 'triangle', at: 1.05, dur: 1.8, vol: 0.09, attack: 0.03 }))
    for (let i = 0; i < 10; i++) noise({ at: 1.1 + i * 0.08, dur: 0.05, vol: 0.12, freq: 5000 + Math.random() * 3000, q: 6 })
  },
  tap: () => {
    tone({ freq: 900, type: 'sine', dur: 0.03, vol: 0.06 })
  },
}

export function play(name: Sfx) {
  if (import.meta.env.DEV) {
    const w = window as unknown as { __sfx?: string[] }
    ;(w.__sfx ??= []).push(name)
  }
  const prefs = getPrefs()
  if (!prefs.sound || prefs.muted) return
  const c = audio()
  if (!c || c.state !== 'running') return
  const duck = DUCK[name]
  if (duck) duckHandler?.(duck[0], duck[1])
  try {
    RECIPES[name]()
  } catch {
    // Audio should never break the game.
  }
}
