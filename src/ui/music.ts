// Background music: a shuffled playlist with crossfades, routed through Web Audio so volume,
// fades and ducking work everywhere (iOS Safari ignores HTMLAudioElement.volume).
import { useSyncExternalStore } from 'react'
import { getPrefs, subscribePrefs } from './settings'
import { getAudioContext, setDuckHandler, unlockAudio } from './sound'

export const TRACKS = [
  { src: './audio/theme-1.mp3', title: 'Exit the Grind I' },
  { src: './audio/theme-2.mp3', title: 'Exit the Grind II' },
  { src: './audio/theme-3.mp3', title: 'Exit the Grind III' },
]

const CROSSFADE = 4 // seconds
const SKIP_FADE = 1.2

interface Deck {
  el: HTMLAudioElement
  gain: GainNode
  track: number
}

let available: boolean | null = null
let decks: Deck[] | null = null
let bus: GainNode | null = null
let active = 0
let order: number[] = []
let pos = -1
let playing = false
let fading = false
let nowPlaying: string | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

function shuffle(n: number, avoidFirst?: number) {
  const a = Array.from({ length: n }, (_, i) => i)
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  if (avoidFirst !== undefined && a.length > 1 && a[0] === avoidFirst) [a[0], a[1]] = [a[1], a[0]]
  return a
}

async function checkAvailable() {
  if (available !== null) return available
  try {
    const r = await fetch(TRACKS[0].src, { method: 'HEAD' })
    available = r.ok && (r.headers.get('content-type') ?? '').startsWith('audio')
  } catch {
    available = false
  }
  emit()
  return available
}

const targetVolume = () => {
  const p = getPrefs()
  return p.music && !p.muted ? p.musicVolume : 0
}

function ensureDecks(): boolean {
  if (decks) return true
  const ctx = getAudioContext()
  if (!ctx) return false
  bus = ctx.createGain()
  bus.gain.value = targetVolume()
  bus.connect(ctx.destination)
  decks = [0, 1].map(() => {
    const el = new Audio()
    el.preload = 'auto'
    el.crossOrigin = 'anonymous'
    const src = ctx.createMediaElementSource(el)
    const gain = ctx.createGain()
    gain.gain.value = 0
    src.connect(gain).connect(bus!)
    const deck: Deck = { el, gain, track: -1 }
    el.addEventListener('timeupdate', () => {
      if (deck === decks![active] && !fading && el.duration && el.duration - el.currentTime <= CROSSFADE) advance(CROSSFADE)
    })
    el.addEventListener('ended', () => {
      if (deck === decks![active]) advance(0.3)
    })
    el.addEventListener('error', () => {
      if (el.src && deck === decks![active]) {
        available = false
        stop()
      }
    })
    return deck
  })
  setDuckHandler(duck)
  return true
}

function ramp(g: GainNode, to: number, secs: number) {
  const ctx = getAudioContext()!
  const t = ctx.currentTime
  g.gain.cancelScheduledValues(t)
  g.gain.setValueAtTime(g.gain.value, t)
  g.gain.linearRampToValueAtTime(to, t + Math.max(0.01, secs))
}

function nextIndex() {
  pos += 1
  if (pos >= order.length) {
    const last = order[order.length - 1]
    order = shuffle(TRACKS.length, last)
    pos = 0
  }
  return order[pos]
}

/** Crossfade from the current deck into the next track. */
function advance(fade: number) {
  if (!decks) return
  fading = true
  const from = decks[active]
  active = 1 - active
  const to = decks[active]
  to.track = nextIndex()
  to.el.src = TRACKS[to.track].src
  to.el.currentTime = 0
  to.gain.gain.value = 0
  void to.el.play().catch(() => undefined)
  ramp(to.gain, 1, fade)
  ramp(from.gain, 0, fade)
  nowPlaying = TRACKS[to.track].title
  emit()
  setTimeout(() => {
    from.el.pause()
    fading = false
  }, fade * 1000 + 100)
}

function start() {
  if (!decks) return
  if (order.length === 0) {
    order = shuffle(TRACKS.length)
    pos = -1
  }
  const d = decks[active]
  if (d.track < 0) {
    d.track = nextIndex()
    d.el.src = TRACKS[d.track].src
  }
  d.gain.gain.value = 0
  void d.el.play().catch(() => undefined)
  ramp(d.gain, 1, 1.5)
  playing = true
  nowPlaying = TRACKS[d.track].title
  emit()
}

function stop() {
  if (!decks || !playing) return
  playing = false
  for (const d of decks) {
    ramp(d.gain, 0, 0.4)
    setTimeout(() => {
      if (!playing) d.el.pause()
    }, 450)
  }
  nowPlaying = null
  emit()
}

function duck(depth: number, ms: number) {
  if (!bus || !playing) return
  const ctx = getAudioContext()!
  const v = targetVolume()
  const t = ctx.currentTime
  bus.gain.cancelScheduledValues(t)
  bus.gain.setValueAtTime(bus.gain.value, t)
  bus.gain.linearRampToValueAtTime(v * depth, t + 0.08)
  bus.gain.setValueAtTime(v * depth, t + ms / 1000)
  bus.gain.linearRampToValueAtTime(v, t + ms / 1000 + 0.8)
}

function sync() {
  if (available === false) return
  const want = targetVolume() > 0 && document.visibilityState === 'visible'
  if (want) {
    if (!ensureDecks()) return
    ramp(bus!, targetVolume(), 0.2)
    if (!playing) start()
  } else stop()
}

/** Skip to the next song. */
export function nextTrack() {
  if (!playing || !decks) return
  advance(SKIP_FADE)
}

/** iOS only lets an audio element play after a tap, so warm up the second deck on the first one. */
function primeSpareDeck() {
  if (!decks) return
  const spare = decks[1 - active]
  if (spare.el.src) return
  spare.el.src = TRACKS[TRACKS.length - 1].src
  void spare.el.play().then(() => spare.el.pause()).catch(() => undefined)
}

if (typeof window !== 'undefined') {
  subscribePrefs(sync)
  document.addEventListener('visibilitychange', sync)
  // Browsers block autoplay until the player interacts, so start on the first tap or key.
  const begin = () => {
    unlockAudio()
    if (targetVolume() > 0 && ensureDecks()) {
      sync()
      primeSpareDeck()
    }
    void checkAvailable().then((ok) => (ok ? sync() : stop()))
    window.removeEventListener('pointerdown', begin)
    window.removeEventListener('keydown', begin)
  }
  window.addEventListener('pointerdown', begin)
  window.addEventListener('keydown', begin)
  // If the phone paused us (app switch, lock screen), the next tap picks the music back up.
  window.addEventListener('pointerdown', () => {
    const d = decks?.[active]
    if (playing && d && d.el.paused && !fading) void d.el.play().catch(() => undefined)
  })
}

const subscribe = (fn: () => void) => {
  listeners.add(fn)
  if (available === null) void checkAvailable()
  return () => listeners.delete(fn)
}

/** Whether music files exist (null while unknown). */
export function useMusicAvailable() {
  return useSyncExternalStore(subscribe, () => available)
}

/** Title of the song playing now, or null. */
export function useNowPlaying() {
  return useSyncExternalStore(subscribe, () => nowPlaying)
}

if (import.meta.env.DEV && typeof window !== 'undefined') {
  ;(window as unknown as { __musicSeekEnd: () => void }).__musicSeekEnd = () => {
    const d = decks?.[active]
    if (d && d.el.duration) d.el.currentTime = d.el.duration - 6
  }
  ;(window as unknown as { __music: () => unknown }).__music = () => ({
    available,
    playing,
    active,
    nowPlaying,
    bus: bus?.gain.value,
    decks: decks?.map((d) => ({ src: d.el.src.split('/').pop(), paused: d.el.paused, t: Math.round(d.el.currentTime * 10) / 10, gain: d.gain.gain.value })),
  })
}
