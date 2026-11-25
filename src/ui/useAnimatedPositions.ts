import { useEffect, useRef, useState } from 'react'
import type { Player } from '../game/types'

const STEP_MS = 150
const BOARD = 24

const key = (p: Player) => `${p.track}:${p.track === 'grind' ? p.position : (p.freedom?.position ?? 0)}`

/**
 * Animates tokens hopping square by square toward their real positions.
 * Returns the displayed position per player and whether any token is still moving.
 */
export function useAnimatedPositions(players: Player[]) {
  const [shown, setShown] = useState<Record<string, { track: string; pos: number }>>(() =>
    Object.fromEntries(players.map((p) => [p.id, parse(key(p))])),
  )
  const targetsRef = useRef<Record<string, { track: string; pos: number }>>({})
  targetsRef.current = Object.fromEntries(players.map((p) => [p.id, parse(key(p))]))
  const signature = players.map(key).join('|')

  useEffect(() => {
    const id = setInterval(() => {
      setShown((prev) => {
        let changed = false
        const next = { ...prev }
        for (const [pid, target] of Object.entries(targetsRef.current)) {
          const cur = prev[pid]
          if (!cur || cur.track !== target.track) {
            next[pid] = target
            changed = true
          } else if (cur.pos !== target.pos) {
            next[pid] = { track: cur.track, pos: (cur.pos + 1) % BOARD }
            changed = true
          }
        }
        return changed ? next : prev
      })
    }, STEP_MS)
    return () => clearInterval(id)
  }, [signature])

  const moving = players.some((p) => {
    const t = parse(key(p))
    const s = shown[p.id]
    return !s || s.track !== t.track || s.pos !== t.pos
  })
  return { shown, moving }
}

function parse(k: string) {
  const [track, pos] = k.split(':')
  return { track, pos: Number(pos) }
}
