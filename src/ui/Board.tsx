import type { ReactNode } from 'react'
import { DREAM_SPACES, FREEDOM_BOARD, GRIND_BOARD, SPACE_INFO } from '../game/board'
import { DREAM_BY_ID } from '../game/data/cards'
import type { Player, Track } from '../game/types'

const SHORT: Record<string, string> = {
  payday: 'Payday', opportunity: 'Deal', market: 'Market', splurge: 'Splurge', life: 'Life',
  give: 'Give', layoff: 'Laid off', learn: 'Upskill', venture: 'Venture', dream: 'Dream', setback: 'Setback',
}

/** Perimeter index (0..23) -> [row, col] on a 7x7 grid, clockwise from the top-left corner. */
function cell(i: number): [number, number] {
  if (i <= 6) return [0, i]
  if (i <= 12) return [i - 6, 6]
  if (i <= 18) return [6, 6 - (i - 12)]
  return [6 - (i - 18), 0]
}

interface Props {
  track: Track
  players: Player[]
  shown: Record<string, { track: string; pos: number }>
  currentId: string
  myDreamId?: string
  children?: ReactNode
}

export function Board({ track, players, shown, currentId, myDreamId, children }: Props) {
  const spaces = track === 'grind' ? GRIND_BOARD : FREEDOM_BOARD
  const here = players.filter((p) => shown[p.id]?.track === track)
  const currentPos = shown[currentId]?.track === track ? shown[currentId].pos : -1

  return (
    <div className={`board board-${track}`}>
      {spaces.map((sp, i) => {
        const [r, c] = cell(i)
        const info = SPACE_INFO[sp]
        const dream = sp === 'dream' ? DREAM_BY_ID[DREAM_SPACES[i]] : undefined
        const tokens = here.filter((p) => shown[p.id].pos === i)
        const corner = (r === 0 || r === 6) && (c === 0 || c === 6)
        return (
          <div
            key={i}
            className={`tile tile-${sp}${corner ? ' corner' : ''}${i === currentPos ? ' active' : ''}${dream && dream.id === myDreamId ? ' my-dream' : ''}`}
            style={{ gridRow: r + 1, gridColumn: c + 1 }}
            title={dream ? `${dream.title}: $${dream.cost.toLocaleString()}` : `${info.label}: ${info.hint}`}
          >
            <span className="tile-icon" aria-hidden>{dream ? dream.emoji : info.icon}</span>
            <span className="tile-label">{dream ? dream.title.split(' ').slice(-1)[0] : SHORT[sp]}</span>
            {tokens.length > 0 && (
              <div className="tokens">
                {tokens.map((p) => (
                  <span
                    key={p.id}
                    className={`token${p.id === currentId ? ' token-current' : ''}`}
                    style={{ background: p.color }}
                    aria-label={p.name}
                  >
                    {p.name.slice(0, 1).toUpperCase()}
                  </span>
                ))}
              </div>
            )}
          </div>
        )
      })}
      <div className="board-center">{children}</div>
    </div>
  )
}
