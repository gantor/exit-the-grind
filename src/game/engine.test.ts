import { describe, expect, it } from 'vitest'
import { botAction } from './bot'
import { DEAL_CARDS } from './data/deals'
import { applyAction, createGame, type Action } from './engine'
import { canEscape, maxBorrow, monthlyCashflow, passiveIncome, totalExpenses } from './finance'
import { PROFESSIONS } from './data/professions'
import type { GameState } from './types'

const solo = (professionId = 'teacher', seed = 42) =>
  createGame([{ name: 'Tester', professionId, isBot: false }], { mode: 'full' }, seed)

const act = (s: GameState, a: Action) => applyAction(s, a)

describe('setup', () => {
  it('every profession starts with positive cash flow', () => {
    for (const prof of PROFESSIONS) {
      const s = solo(prof.id)
      const p = s.players[0]
      expect(monthlyCashflow(p), prof.id).toBeGreaterThan(0)
      expect(p.cash).toBe(prof.savings + monthlyCashflow(p))
    }
  })
})

describe('deals and loans', () => {
  it('buying an asset with a loan adds the bank payment and the cash flow', () => {
    let s = solo('teacher')
    s = { ...s, pending: { type: 'deal', deck: 'big', cardId: Object.values(DEAL_CARDS).find((c) => c.kind === 'asset' && c.title === 'Taco Food Truck')!.id }, phase: 'resolve' }
    const before = s.players[0]
    const cfBefore = monthlyCashflow(before)
    // 8k down with ~$1.9k cash: needs a $7k loan, which teacher cash flow can carry.
    const rejected = act(s, { type: 'BUY_ASSET' })
    expect(rejected).toBe(s) // not enough cash without borrowing
    s = act(s, { type: 'BUY_ASSET', borrow: true })
    const p = s.players[0]
    const loan = p.liabilities.find((l) => l.kind === 'bank')!
    expect(loan.balance % 1000).toBe(0)
    expect(loan.payment).toBe(loan.balance * 0.1)
    expect(monthlyCashflow(p)).toBe(cfBefore + 400 - loan.payment)
    expect(p.cash).toBeGreaterThanOrEqual(0)
    expect(s.pending).toBeNull()
    expect(s.phase).toBe('end')
  })

  it('bank will not lend past zero cash flow', () => {
    const s = solo('barista')
    const p = s.players[0]
    const max = maxBorrow(p)
    expect(act(s, { type: 'BORROW', amount: max + 1000 })).toBe(s)
    const s2 = act(s, { type: 'BORROW', amount: max })
    expect(monthlyCashflow(s2.players[0])).toBeGreaterThanOrEqual(0)
  })

  it('paying off a liability removes its payment', () => {
    let s = solo('barista')
    s.players[0].cash = 10000
    const exp = totalExpenses(s.players[0])
    s = act(s, { type: 'PAYOFF', liabilityId: 'car-0' })
    expect(totalExpenses(s.players[0])).toBe(exp - 150)
    expect(s.players[0].cash).toBe(5000)
  })

  it('paying down part of a debt shrinks its payment in proportion', () => {
    let s = solo('engineer')
    s.players[0].cash = 10000
    const card = s.players[0].liabilities.find((l) => l.kind === 'card')!
    expect(card.balance).toBe(7000)
    const exp = totalExpenses(s.players[0])
    expect(act(s, { type: 'PAY_DOWN', liabilityId: card.id, amount: 1500 })).toBe(s) // not a $1,000 step
    s = act(s, { type: 'PAY_DOWN', liabilityId: card.id, amount: 3000 })
    const after = s.players[0].liabilities.find((l) => l.id === card.id)!
    expect(after.balance).toBe(4000)
    expect(after.payment).toBe(Math.round((250 * 4000) / 7000))
    expect(totalExpenses(s.players[0])).toBe(exp - (250 - after.payment))
    s = act(s, { type: 'PAY_DOWN', liabilityId: card.id, amount: 4000 })
    expect(s.players[0].liabilities.some((l) => l.id === card.id)).toBe(false)
    expect(s.players[0].cash).toBe(3000)
  })

  it('stock buy and sell by another player at the card price', () => {
    let s = createGame(
      [
        { name: 'A', professionId: 'nurse', isBot: false },
        { name: 'B', professionId: 'nurse', isBot: false },
      ],
      { mode: 'full' },
      1,
    )
    const novaLow = Object.values(DEAL_CARDS).find((c) => c.kind === 'stock' && c.ticker === 'NOVA' && c.price === 5)!
    const novaHigh = Object.values(DEAL_CARDS).find((c) => c.kind === 'stock' && c.ticker === 'NOVA' && c.price === 40)!
    s = { ...s, pending: { type: 'deal', deck: 'small', cardId: novaLow.id }, phase: 'resolve', current: 1 }
    s = act(s, { type: 'BUY_STOCK', qty: 200 })
    expect(s.players[1].assets[0].shares).toBe(200)
    s = { ...s, pending: { type: 'deal', deck: 'small', cardId: novaHigh.id }, current: 0 }
    const cash = s.players[1].cash
    s = act(s, { type: 'SELL_STOCK', playerId: 'p2', qty: 200 })
    expect(s.players[1].cash).toBe(cash + 8000)
    expect(s.players[1].assets).toHaveLength(0)
  })
})

describe('escape', () => {
  it('escaping prompts for a dream and moves the player to Freedom Lane', () => {
    let s = solo('barista')
    const p = s.players[0]
    p.assets.push({ id: 'x', kind: 'business', category: 'digital', name: 'Big app', cost: 1, down: 1, debt: 0, cashflow: 5000 })
    s = { ...s, phase: 'end' }
    expect(canEscape(p)).toBe(true)
    s = act(s, { type: 'BORROW', amount: 1000 }) // any action triggers post-processing
    expect(s.pending?.type).toBe('escape')
    s = act(s, { type: 'PICK_DREAM', dreamId: 'd-sail' })
    const q = s.players[0]
    expect(q.track).toBe('freedom')
    expect(q.freedom!.cashflow).toBe(Math.max(30000, Math.round((passiveIncome(q) * 10) / 1000) * 1000))
    expect(s.phase).toBe('end')
  })

  it('quick mode ends when someone escapes', () => {
    let s = createGame([{ name: 'Q', professionId: 'barista', isBot: false }], { mode: 'quick' }, 3)
    s.players[0].assets.push({ id: 'x', kind: 'business', category: 'digital', name: 'Big app', cost: 1, down: 1, debt: 0, cashflow: 5000 })
    s = act(s, { type: 'ROLL', dice: 1 })
    expect(s.phase).toBe('gameover')
    expect(s.winnerId).toBe('p1')
  })
})

function playBots(professions: string[], seed: number, maxTurns = 1500) {
  let s = createGame(
    professions.map((id, i) => ({ name: `Bot ${i + 1}`, professionId: id, isBot: true })),
    { mode: 'full' },
    seed,
  )
  let stuck = 0
  while (s.phase !== 'gameover' && s.turn < maxTurns) {
    const a = botAction(s)
    let next = applyAction(s, a)
    if (next === s) {
      // Rejected action: fall back to closing the card / ending the turn.
      next = applyAction(s, s.pending ? { type: 'DONE' } : { type: 'END_TURN' })
      if (next === s && s.pending?.type === 'splurge') next = applyAction(s, { type: 'PAY_SPLURGE', method: 'credit' })
      if (next === s) stuck++
      if (stuck > 5) throw new Error(`Stuck on ${JSON.stringify(s.pending)} phase=${s.phase} action=${JSON.stringify(a)}`)
    } else stuck = 0
    s = next
  }
  return s
}

describe('bot simulation', () => {
  it('bots can finish full games without getting stuck', () => {
    const results: { prof: string; turns: number; escapeTurn: number | null; won: boolean; bankrupt: number }[] = []
    PROFESSIONS.forEach((prof, i) => {
      for (let seed = 0; seed < 6; seed++) {
        const s = playBots([prof.id], seed * 97 + i)
        const p = s.players[0]
        const esc = s.log.find((l) => l.text.includes('escaped the Grind'))
        results.push({ prof: prof.id, turns: s.turn, escapeTurn: esc?.turn ?? null, won: !!s.winnerId, bankrupt: p.bankruptcies })
      }
    })
    const byProf: Record<string, string> = {}
    for (const prof of PROFESSIONS) {
      const r = results.filter((x) => x.prof === prof.id)
      const esc = r.filter((x) => x.escapeTurn !== null).map((x) => x.escapeTurn!)
      byProf[prof.id] =
        `escape avg ${esc.length ? Math.round(esc.reduce((a, b) => a + b, 0) / esc.length) : '-'} (${esc.length}/${r.length}), ` +
        `finish avg ${Math.round(r.reduce((a, b) => a + b.turns, 0) / r.length)}, wins ${r.filter((x) => x.won).length}, bankruptcies ${r.reduce((a, b) => a + b.bankrupt, 0)}`
    }
    console.table(byProf)
    expect(results.filter((r) => r.won).length).toBeGreaterThan(results.length * 0.6)
  })

  it('multiplayer bot game completes', () => {
    const s = playBots(['nurse', 'barista', 'engineer', 'doctor'], 11)
    expect(s.phase).toBe('gameover')
  })
})
