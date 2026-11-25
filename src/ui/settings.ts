import { useSyncExternalStore } from 'react'

export type BotSpeed = 'slow' | 'normal' | 'fast'

export interface Prefs {
  botSpeed: BotSpeed
  sound: boolean
  volume: number // 0..1
  music: boolean
  musicVolume: number // 0..1
  /** Master mute from the top bar; leaves the individual settings alone. */
  muted: boolean
}

const KEY = 'exit-the-grind:prefs'
const DEFAULTS: Prefs = { botSpeed: 'normal', sound: true, volume: 0.7, music: true, musicVolume: 0.35, muted: false }

let prefs: Prefs = load()
const listeners = new Set<() => void>()

function load(): Prefs {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS
  } catch {
    return DEFAULTS
  }
}

export function getPrefs() {
  return prefs
}

export function setPrefs(patch: Partial<Prefs>) {
  prefs = { ...prefs, ...patch }
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs))
  } catch {
    // ignore unavailable storage
  }
  listeners.forEach((l) => l())
}

export function subscribePrefs(fn: () => void) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function usePrefs(): Prefs {
  return useSyncExternalStore(subscribePrefs, getPrefs, getPrefs)
}

/** Multiplier applied to computer-player pauses. */
export const SPEED_FACTOR: Record<BotSpeed, number> = { slow: 1.7, normal: 1, fast: 0.35 }
