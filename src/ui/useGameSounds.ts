import { useEffect, useRef } from 'react'
import { FREEDOM_BOARD, GRIND_BOARD } from '../game/board'
import { LIFE_BY_ID } from '../game/data/cards'
import { currentPlayer } from '../game/engine'
import type { GameState, LogEntry, Pending } from '../game/types'
import { play, type Sfx } from './sound'

type Shown = Record<string, { track: string; pos: number }>

const pendingSig = (p: Pending | null) => {
  if (!p) return ''
  const id = 'cardId' in p ? p.cardId : 'dreamId' in p ? p.dreamId : 'title' in p ? p.title : ''
  return `${p.type}:${id}`
}

function pendingSound(p: Pending): Sfx | null {
  switch (p.type) {
    case 'chooseDeal': return 'deal'
    case 'deal': case 'venture': case 'dream': return 'card'
    case 'market': return 'market'
    case 'splurge': return 'splurge'
    case 'learn': return 'learn'
    case 'give': return 'give'
    case 'escape': return 'escape'
    case 'setback': return 'bad'
    case 'info': return p.tone === 'bad' ? 'bad' : 'card'
    case 'life': {
      const e = LIFE_BY_ID[p.cardId].effect
      if (e.type === 'raise' || (e.type === 'cash' && e.amount > 0)) return 'good'
      if (e.type === 'cash' && e.amount < 0) return 'bad'
      return 'card'
    }
  }
}

function logSound(e: LogEntry): Sfx | null {
  const t = e.text
  if (/^(Bought|Acquired)/.test(t)) return 'buy'
  if (/^Sold/.test(t)) return 'sell'
  if (/^(Paid off|Paid \$[\d,]+ toward|Repaid)/.test(t)) return 'payoff'
  if (/^Took a course/.test(t)) return 'learn'
  if (/^Donated/.test(t)) return 'give'
  if (/rolled \d, (won|collected)/.test(t)) return 'sell'
  if (/rolled \d, lost/.test(t)) return 'bad'
  return null
}

/** Plays sound effects in step with what the player sees: dice, hops, paydays, cards, trades. */
export function useGameSounds(s: GameState, shown: Shown, moving: boolean) {
  const prev = useRef<{ shown: Shown; sig: string; outcome: string; log: LogEntry[]; roll: string; turnKey: string; over: boolean } | null>(null)

  useEffect(() => {
    const p = prev.current
    const sig = pendingSig(s.pending)
    const outcome = s.pending && 'outcome' in s.pending ? (s.pending.outcome ?? '') : ''
    const roll = `${s.turn}:${s.current}:${s.lastRoll?.join(',') ?? ''}`
    const turnKey = `${s.turn}:${s.current}`
    const snapshot = { shown, sig: moving ? (p?.sig ?? '') : sig, outcome, log: s.log, roll, turnKey, over: s.phase === 'gameover' }
    if (!p) {
      prev.current = snapshot
      return
    }

    // Dice
    if (roll !== p.roll && s.lastRoll && s.lastRoll.length) play('dice')

    // Token hops, with a cash register when a token crosses Payday.
    let hopped = false
    let paid = false
    for (const pl of s.players) {
      const a = p.shown[pl.id]
      const b = shown[pl.id]
      if (!a || !b || a.track !== b.track || a.pos === b.pos) continue
      hopped = true
      const board = b.track === 'grind' ? GRIND_BOARD : FREEDOM_BOARD
      if (board[b.pos] === 'payday') paid = true
    }
    if (paid) play('payday')
    else if (hopped) play('hop')

    // A new card or prompt, once the token has arrived.
    if (!moving && sig && sig !== p.sig) {
      const sfx = pendingSound(s.pending!)
      if (sfx) play(sfx)
    } else if (!moving && outcome && outcome !== p.outcome) {
      play(/\+\$|Jackpot|paid off/i.test(outcome) ? 'sell' : 'bad')
    }

    // Trades and payments.
    if (s.log !== p.log && p.log.length) {
      const last = p.log[p.log.length - 1]
      let idx = s.log.length - 1
      while (idx >= 0 && !(s.log[idx].text === last.text && s.log[idx].turn === last.turn && s.log[idx].playerId === last.playerId)) idx--
      const fresh = s.log.slice(idx + 1)
      const sfx = fresh.map(logSound).find(Boolean)
      if (sfx) play(sfx)
    }

    // Your turn chime (only for humans) and the win fanfare.
    const cur = currentPlayer(s)
    if (turnKey !== p.turnKey && !cur.isBot && s.phase === 'roll' && s.players.length > 1) play('turn')
    if (snapshot.over && !p.over) play('win')

    prev.current = snapshot
  }, [s, shown, moving])
}
