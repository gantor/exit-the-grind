import { GAME_VERSION } from '../game/engine'
import type { GameState } from '../game/types'

const KEY = 'exit-the-grind:save'

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as GameState
    if (s.version !== GAME_VERSION || !Array.isArray(s.players)) return null
    return s
  } catch {
    return null
  }
}

export function saveGame(s: GameState | null) {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s))
    else localStorage.removeItem(KEY)
  } catch {
    // Storage can be unavailable (private mode, sandboxed frames). The game still works.
  }
}
