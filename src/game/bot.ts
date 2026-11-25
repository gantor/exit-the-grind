// A simple, reasonable computer opponent. It returns one action at a time.
import { DREAM_BY_ID, DREAMS, LIFE_BY_ID, VENTURE_BY_ID } from './data/cards'
import { DEAL_CARDS } from './data/deals'
import { borrowNeeded, currentPlayer, diceOptions, LEARN_COST, marketEligible, marketOffer, type Action } from './engine'
import { maxBorrow, monthlyCashflow, totalExpenses } from './finance'
import { botWantsToSellAsset, botWantsToSellStock } from './strategy'
import { MARKET_BY_ID } from './data/cards'
import type { GameState } from './types'

export function botAction(s: GameState): Action {
  const p = currentPlayer(s)
  const pend = s.pending
  const reserve = Math.max(1000, Math.round(totalExpenses(p) * 0.5))

  if (!pend) {
    if (s.phase === 'roll') {
      const opts = diceOptions(p)
      return { type: 'ROLL', dice: opts[opts.length - 1] }
    }
    // Housekeeping before ending the turn: pay down expensive debt.
    if (p.track === 'grind') {
      const loan = p.liabilities.find((l) => l.kind === 'bank')
      if (loan && p.cash - 1000 >= reserve + 15000) {
        const amt = Math.min(loan.balance, Math.floor((p.cash - reserve - 15000) / 1000) * 1000)
        if (amt >= 1000) return { type: 'REPAY', amount: amt }
      }
      const card = p.liabilities.find((l) => l.kind === 'card' && l.balance <= p.cash - reserve - 20000)
      if (card) return { type: 'PAYOFF', liabilityId: card.id }
    }
    return { type: 'END_TURN' }
  }

  switch (pend.type) {
    case 'chooseDeal': {
      const power = p.cash + maxBorrow(p) * 0.6
      return { type: 'CHOOSE_DEAL', size: power >= 15000 ? 'big' : 'small' }
    }
    case 'deal': {
      const card = DEAL_CARDS[pend.cardId]
      if (card.kind === 'stock') {
        const sell = botWantsToSellStock(p, card)
        if (sell > 0) return { type: 'SELL_STOCK', playerId: p.id, qty: sell }
        const [low, high] = card.range
        const cheap = card.price <= low + (high - low) * 0.2
        const held = p.assets.some((a) => a.ticker === card.ticker)
        if (!held && (cheap || card.ticker === 'YELD')) {
          const share = card.ticker === 'YELD' ? 0.3 : card.ticker === 'MOON' ? 0.2 : 0.5
          const budget = (p.cash - reserve) * share
          const qty = Math.floor(budget / card.price)
          if (qty >= 10) return { type: 'BUY_STOCK', qty }
        }
        return { type: 'DONE' }
      }
      const good =
        card.cashflow > 0 && (card.cashflow * 12) / card.down >= 0.2
      const spec = card.cashflow === 0 && card.down <= (p.cash - reserve) * 0.25
      if (good || spec) {
        const loan = borrowNeeded(p, card.down)
        if (loan === 0 && p.cash - card.down >= 0) return { type: 'BUY_ASSET' }
        const margin = Math.max(400, totalExpenses(p) * 0.15)
        const paysForLoan = card.cashflow >= loan * 0.1 || loan <= 3000
        if (good && paysForLoan && loan <= maxBorrow(p, card.cashflow) && monthlyCashflow(p) + card.cashflow - loan * 0.1 >= margin) {
          return { type: 'BUY_ASSET', borrow: true }
        }
      }
      return { type: 'DONE' }
    }
    case 'market': {
      const card = MARKET_BY_ID[pend.cardId]
      for (const a of marketEligible(card, p)) {
        if (botWantsToSellAsset(a, marketOffer(card, a))) return { type: 'MARKET_SELL', playerId: p.id, assetId: a.id }
      }
      return { type: 'DONE' }
    }
    case 'splurge':
      return { type: 'PAY_SPLURGE', method: p.cash >= 3000 + reserve ? 'cash' : 'credit' }
    case 'life': {
      const card = LIFE_BY_ID[pend.cardId]
      if (!pend.outcome && card.effect.type === 'gamble' && p.cash >= card.effect.cost * 4) return { type: 'LIFE_GAMBLE' }
      return { type: 'DONE' }
    }
    case 'learn':
      return p.cash >= LEARN_COST + reserve * 2 ? { type: 'LEARN' } : { type: 'DONE' }
    case 'give':
      return p.cash >= pend.amount * 3 + reserve ? { type: 'GIVE' } : { type: 'DONE' }
    case 'escape': {
      const sorted = [...DREAMS].sort((a, b) => a.cost - b.cost)
      return { type: 'PICK_DREAM', dreamId: sorted[s.turn % 3].id }
    }
    case 'venture': {
      if (pend.outcome) return { type: 'DONE' }
      const card = VENTURE_BY_ID[pend.cardId]
      if (card.risky) return p.cash >= card.cost * 5 ? { type: 'BUY_VENTURE' } : { type: 'DONE' }
      const dream = p.freedom ? DREAM_BY_ID[p.freedom.dreamId] : undefined
      // Keep a cushion if we are close to affording the dream.
      const cushion = dream && p.cash >= dream.cost * 0.8 ? dream.cost : 0
      return p.cash - card.cost >= cushion ? { type: 'BUY_VENTURE' } : { type: 'DONE' }
    }
    case 'dream': {
      if (p.freedom?.dreamId === pend.dreamId && p.cash >= DREAM_BY_ID[pend.dreamId].cost) return { type: 'BUY_DREAM' }
      return { type: 'DONE' }
    }
    case 'setback':
    case 'info':
      return { type: 'DONE' }
  }
}
