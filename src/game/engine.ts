import { DREAM_SPACES, FREEDOM_BOARD, GRIND_BOARD } from './board'
import {
  DREAM_BY_ID,
  LIFE_BY_ID,
  LIFE_CARDS,
  MARKET_BY_ID,
  MARKET_CARDS,
  SETBACK_BY_ID,
  SETBACK_CARDS,
  SPLURGE_BY_ID,
  SPLURGE_CARDS,
  VENTURE_BY_ID,
  VENTURE_CARDS,
} from './data/cards'
import { BIG_DEALS, DEAL_CARDS, SMALL_DEALS } from './data/deals'
import { professionById } from './data/professions'
import {
  BANK_RATE,
  CARD_RATE,
  canEscape,
  freedomTarget,
  maxBorrow,
  money,
  monthlyCashflow,
  passiveIncome,
  totalExpenses,
  totalIncome,
} from './finance'
import { nextRandom } from './rng'
import { botWantsToSellAsset, botWantsToSellStock, marketPrice } from './strategy'
import type {
  Asset,
  AssetDeal,
  DeckName,
  GameState,
  Liability,
  LogEntry,
  MarketCard,
  Player,
  PlayerSetup,
  Settings,
  StockDeal,
} from './types'

export const GAME_VERSION = 1
export const MAX_CHILDREN = 3
export const LEARN_COST = 1500
export const LEARN_RAISE = 250
export const PLAYER_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4']

export type Action =
  | { type: 'ROLL'; dice: number }
  | { type: 'CHOOSE_DEAL'; size: 'small' | 'big' }
  | { type: 'BUY_STOCK'; qty: number; borrow?: boolean }
  | { type: 'SELL_STOCK'; playerId: string; qty: number }
  | { type: 'BUY_ASSET'; borrow?: boolean }
  | { type: 'MARKET_SELL'; playerId: string; assetId: string }
  | { type: 'PAY_SPLURGE'; method: 'cash' | 'credit' }
  | { type: 'LIFE_GAMBLE' }
  | { type: 'LEARN' }
  | { type: 'GIVE' }
  | { type: 'PICK_DREAM'; dreamId: string }
  | { type: 'BUY_VENTURE' }
  | { type: 'BUY_DREAM' }
  | { type: 'BORROW'; amount: number }
  | { type: 'REPAY'; amount: number }
  | { type: 'PAYOFF'; liabilityId: string }
  | { type: 'PAY_DOWN'; liabilityId: string; amount: number }
  | { type: 'DONE' }
  | { type: 'END_TURN' }

const DECK_SOURCES: Record<DeckName, string[]> = {
  small: SMALL_DEALS.map((c) => c.id),
  big: BIG_DEALS.map((c) => c.id),
  market: MARKET_CARDS.map((c) => c.id),
  splurge: SPLURGE_CARDS.map((c) => c.id),
  life: LIFE_CARDS.map((c) => c.id),
  venture: VENTURE_CARDS.map((c) => c.id),
  setback: SETBACK_CARDS.map((c) => c.id),
}

// ---------- helpers ----------

const rand = (s: GameState) => {
  const [v, next] = nextRandom(s.rngState)
  s.rngState = next
  return v
}
export const rollDie = (s: GameState) => 1 + Math.floor(rand(s) * 6)

function shuffle(s: GameState, arr: string[]) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand(s) * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function draw(s: GameState, deck: DeckName): string {
  const d = s.decks[deck]
  if (d.draw.length === 0) {
    d.draw = shuffle(s, d.discard.length ? d.discard : DECK_SOURCES[deck])
    d.discard = []
  }
  const id = d.draw.pop()!
  d.discard.push(id)
  return id
}

export const currentPlayer = (s: GameState) => s.players[s.current]
const playerById = (s: GameState, id: string) => s.players.find((p) => p.id === id)

function log(s: GameState, text: string, tone: LogEntry['tone'] = 'neutral', playerId = currentPlayer(s).id) {
  s.log.push({ turn: s.turn, playerId, text, tone })
  if (s.log.length > 300) s.log.splice(0, s.log.length - 300)
}

const roundTo = (n: number, step: number) => Math.round(n / step) * step

function addBankLoan(p: Player, amount: number) {
  let loan = p.liabilities.find((l) => l.kind === 'bank')
  if (!loan) {
    loan = { id: 'bank', kind: 'bank', name: 'Bank loan', balance: 0, payment: 0 }
    p.liabilities.push(loan)
  }
  loan.balance += amount
  loan.payment = Math.round(loan.balance * BANK_RATE)
}

function addCardDebt(p: Player, amount: number) {
  let card = p.liabilities.find((l) => l.kind === 'card')
  if (!card) {
    card = { id: 'card-new', kind: 'card', name: 'Credit card', balance: 0, payment: 0 }
    p.liabilities.push(card)
  }
  card.balance += amount
  card.payment += Math.max(10, roundTo(amount * CARD_RATE, 10))
}

/** If cash went negative, the bank covers it. If that emergency loan sinks cash flow below zero, the player goes bankrupt. */
function coverShortfall(s: GameState, p: Player) {
  if (p.cash >= 0) return
  if (p.track === 'freedom') {
    p.cash = 0
    return
  }
  const need = Math.ceil(-p.cash / 1000) * 1000
  addBankLoan(p, need)
  p.cash += need
  log(s, `Short on cash, so the bank lent ${money(need)} (${money(need * BANK_RATE)}/mo payment).`, 'bad', p.id)
  if (monthlyCashflow(p) < 0) restructure(s, p)
}

/**
 * Bankruptcy: the player loses every asset (stocks are dumped at half price), the bank loan is
 * forgiven, consumer debts are cut in half, and they sit out 2 turns. The game goes on.
 */
function restructure(s: GameState, p: Player) {
  let recovered = 0
  for (const a of p.assets) {
    if (a.kind === 'stock') recovered += Math.floor(((a.shares ?? 0) * (a.avgPrice ?? 0)) / 2)
  }
  const lost = p.assets.length
  p.assets = []
  p.liabilities = p.liabilities.filter((l) => l.kind !== 'bank')
  for (const l of p.liabilities) {
    if (l.kind === 'card' || l.kind === 'car') {
      l.balance = Math.round(l.balance / 2)
      l.payment = Math.round(l.payment / 2)
    }
  }
  // Last resort: if it still does not add up, the cards are wiped too.
  if (monthlyCashflow(p) < 0) p.liabilities = p.liabilities.filter((l) => l.kind !== 'card')
  p.cash = Math.max(0, recovered)
  p.skipTurns = Math.max(p.skipTurns, 2)
  p.bankruptcies += 1
  log(s, `${p.name} declared bankruptcy and starts over with ${lost} asset${lost === 1 ? '' : 's'} surrendered.`, 'bad', p.id)
  s.alert = {
    title: 'Bankruptcy',
    text:
      'Your monthly bills outgrew your income, and the bank will not carry you any further. You surrender your assets, ' +
      'your bank loan is forgiven, your car and credit-card debts are cut in half, and you sit out 2 turns. ' +
      'Lesson: keep a cushion. Leverage only works while cash flow stays positive.',
  }
}

export function diceOptions(p: Player): number[] {
  if (p.track === 'grind') return p.boostTurns > 0 ? [1, 2] : [1]
  return p.boostTurns > 0 ? [1, 2, 3] : [2]
}

export function borrowNeeded(p: Player, cost: number) {
  return cost > p.cash ? Math.ceil((cost - p.cash) / 1000) * 1000 : 0
}

// ---------- setup ----------

export function createPlayer(setup: PlayerSetup, index: number): Player {
  const prof = professionById(setup.professionId)
  const liabilities: Liability[] = prof.debts.map((d, i) => ({ id: `${d.kind}-${i}`, ...d }))
  const p: Player = {
    id: `p${index + 1}`,
    name: setup.name.trim() || `Player ${index + 1}`,
    color: PLAYER_COLORS[index % PLAYER_COLORS.length],
    isBot: setup.isBot,
    professionId: prof.id,
    salary: prof.salary,
    taxes: prof.taxes,
    rent: prof.rent ?? 0,
    otherExpenses: prof.otherExpenses,
    perChild: prof.perChild,
    children: 0,
    cash: 0,
    liabilities,
    assets: [],
    position: 0,
    track: 'grind',
    boostTurns: 0,
    skipTurns: 0,
    bankruptcies: 0,
    readyToEscape: false,
    history: [],
  }
  p.cash = prof.savings + monthlyCashflow(p)
  p.history.push({ turn: 0, passive: 0, expenses: totalExpenses(p), cash: p.cash })
  return p
}

export function createGame(setups: PlayerSetup[], settings: Settings, seed: number): GameState {
  const s: GameState = {
    version: GAME_VERSION,
    players: setups.map(createPlayer),
    current: 0,
    turn: 1,
    phase: 'roll',
    pending: null,
    decks: {} as GameState['decks'],
    log: [],
    lastRoll: null,
    settings,
    rngState: seed | 0,
  }
  for (const k of Object.keys(DECK_SOURCES) as DeckName[]) {
    s.decks[k] = { draw: shuffle(s, DECK_SOURCES[k]), discard: [] }
  }
  s.turn = 0
  for (const p of s.players) {
    log(s, `${p.name} starts as a ${professionById(p.professionId).title} with ${money(p.cash)} cash.`, 'neutral', p.id)
  }
  s.turn = 1
  return s
}

// ---------- movement & spaces ----------

function payday(s: GameState, p: Player) {
  if (p.track === 'grind') {
    const cf = monthlyCashflow(p)
    p.cash += cf
    log(s, `Payday: ${money(cf, { sign: true })}.`, cf >= 0 ? 'good' : 'bad', p.id)
    coverShortfall(s, p)
  } else if (p.freedom) {
    p.cash += p.freedom.cashflow
    log(s, `Freedom payday: ${money(p.freedom.cashflow, { sign: true })}.`, 'good', p.id)
  }
}

function move(s: GameState, p: Player, steps: number) {
  const board = p.track === 'grind' ? GRIND_BOARD : FREEDOM_BOARD
  let pos = p.track === 'grind' ? p.position : p.freedom!.position
  for (let i = 0; i < steps; i++) {
    pos = (pos + 1) % board.length
    if (board[pos] === 'payday') payday(s, p)
  }
  if (p.track === 'grind') p.position = pos
  else p.freedom!.position = pos
}

function landOn(s: GameState, p: Player) {
  if (p.track === 'grind') {
    const space = GRIND_BOARD[p.position]
    switch (space) {
      case 'payday':
        return
      case 'opportunity':
        s.pending = { type: 'chooseDeal' }
        return
      case 'market': {
        const cardId = draw(s, 'market')
        s.pending = { type: 'market', cardId, sold: [] }
        applyMarketAuto(s, MARKET_BY_ID[cardId])
        botReactMarket(s)
        return
      }
      case 'splurge':
        s.pending = { type: 'splurge', cardId: draw(s, 'splurge') }
        return
      case 'life':
        resolveLife(s, p, draw(s, 'life'))
        return
      case 'give':
        s.pending = { type: 'give', amount: roundTo(totalIncome(p) * 0.1, 10) }
        return
      case 'layoff': {
        const amt = totalExpenses(p)
        p.cash -= amt
        p.skipTurns = 2
        log(s, `Laid off! Paid one month of expenses (${money(amt)}) and sits out 2 turns.`, 'bad', p.id)
        coverShortfall(s, p)
        s.pending = {
          type: 'info',
          title: 'Laid Off',
          text: `Your company restructured. You pay one month of expenses (${money(amt)}) and sit out your next 2 turns. Passive income keeps working even when you are not.`,
          tone: 'bad',
        }
        return
      }
      case 'learn':
        s.pending = { type: 'learn' }
        return
    }
  } else {
    const f = p.freedom!
    const space = FREEDOM_BOARD[f.position]
    switch (space) {
      case 'payday':
        return
      case 'venture':
        s.pending = { type: 'venture', cardId: draw(s, 'venture') }
        return
      case 'dream':
        s.pending = { type: 'dream', dreamId: DREAM_SPACES[f.position] }
        return
      case 'setback': {
        const cardId = draw(s, 'setback')
        s.pending = { type: 'setback', cardId, outcome: applySetback(s, p, cardId) }
        return
      }
      case 'give':
        s.pending = { type: 'give', amount: roundTo(f.cashflow * 0.5, 1000) }
        return
    }
  }
}

function resolveLife(s: GameState, p: Player, cardId: string) {
  const card = LIFE_BY_ID[cardId]
  const e = card.effect
  let outcome: string | undefined
  switch (e.type) {
    case 'baby':
      if (p.children < MAX_CHILDREN) {
        p.children += 1
        outcome = `Child expenses rise to ${money(p.children * p.perChild)}/mo.`
        log(s, `New baby! Expenses +${money(p.perChild)}/mo.`, 'neutral', p.id)
      } else {
        outcome = 'Your house is full. You become the favorite aunt or uncle instead. No change.'
      }
      break
    case 'cash':
      p.cash += e.amount
      outcome = e.amount >= 0 ? `You receive ${money(e.amount)}.` : `You pay ${money(-e.amount)}.`
      log(s, `${card.title}: ${money(e.amount, { sign: true })}.`, e.amount >= 0 ? 'good' : 'bad', p.id)
      coverShortfall(s, p)
      break
    case 'raise':
      p.salary += e.amount
      outcome = `Salary is now ${money(p.salary)}/mo.`
      log(s, `${card.title}: salary +${money(e.amount)}/mo.`, 'good', p.id)
      break
    case 'gamble':
      outcome = undefined // player decides
      break
  }
  s.pending = { type: 'life', cardId, outcome }
}

function applySetback(s: GameState, p: Player, cardId: string): string {
  const card = SETBACK_BY_ID[cardId]
  const e = card.effect
  const f = p.freedom!
  switch (e.type) {
    case 'halfCash': {
      const loss = Math.floor(p.cash / 2)
      p.cash -= loss
      log(s, `${card.title}: lost ${money(loss)}.`, 'bad', p.id)
      return `You lose ${money(loss)}.`
    }
    case 'pay': {
      const loss = Math.min(p.cash, e.amount)
      p.cash -= loss
      log(s, `${card.title}: paid ${money(loss)}.`, 'bad', p.id)
      return `You pay ${money(loss)}.`
    }
    case 'loseVenture': {
      if (!f.ventures.length) return 'Luckily you have no ventures yet. No loss.'
      const smallest = [...f.ventures].sort((a, b) => a.cashflow - b.cashflow)[0]
      f.ventures = f.ventures.filter((v) => v.id !== smallest.id)
      f.cashflow -= smallest.cashflow
      log(s, `${card.title}: lost ${smallest.name} (${money(-smallest.cashflow)}/mo).`, 'bad', p.id)
      return `You lose ${smallest.name} and its ${money(smallest.cashflow)}/mo cash flow.`
    }
    case 'skip':
      p.skipTurns += e.turns
      log(s, `${card.title}: skips ${e.turns} turn.`, 'bad', p.id)
      return `You sit out your next turn.`
  }
}

function applyMarketAuto(s: GameState, card: MarketCard) {
  const e = card.effect
  const p = currentPlayer(s)
  switch (e.type) {
    case 'split':
      for (const pl of s.players) {
        const st = pl.assets.find((a) => a.kind === 'stock' && a.ticker === e.ticker)
        if (!st || !st.shares) continue
        const before = st.shares
        st.shares = Math.floor(st.shares * e.ratio)
        st.avgPrice = (st.avgPrice ?? 0) / e.ratio
        if (st.shares <= 0) pl.assets = pl.assets.filter((a) => a !== st)
        log(s, `${e.ticker} split: ${before.toLocaleString()} → ${st.shares.toLocaleString()} shares.`, 'neutral', pl.id)
      }
      break
    case 'wipe':
      for (const pl of s.players) {
        const st = pl.assets.find((a) => a.kind === 'stock' && a.ticker === e.ticker)
        if (!st) continue
        pl.assets = pl.assets.filter((a) => a !== st)
        log(s, `Lost all ${e.ticker} (${(st.shares ?? 0).toLocaleString()} units).`, 'bad', pl.id)
      }
      break
    case 'boost':
      for (const pl of s.players) {
        for (const a of pl.assets) {
          if (e.categories.includes(a.category)) {
            a.cashflow += e.amount
            log(s, `${a.name}: cash flow +${money(e.amount)}/mo.`, 'good', pl.id)
          }
        }
      }
      break
    case 'repair':
      if (p.track === 'grind' && p.assets.some((a) => e.kinds.includes(a.kind))) {
        p.cash -= e.amount
        log(s, `${card.title}: paid ${money(e.amount)}.`, 'bad', p.id)
        coverShortfall(s, p)
      }
      break
    case 'refi':
      for (const a of p.assets) {
        if (a.kind === 'realestate' && a.debt > 0) {
          a.cashflow += e.amount
          log(s, `Refinanced ${a.name}: +${money(e.amount)}/mo.`, 'good', p.id)
        }
      }
      break
    case 'buyer':
      break
  }
}

/** Assets of a player that a buyer market card would purchase. */
export function marketEligible(card: MarketCard, p: Player): Asset[] {
  const e = card.effect
  if (e.type !== 'buyer' || p.track !== 'grind') return []
  return p.assets.filter((a) => e.categories.includes(a.category))
}

export function marketOffer(card: MarketCard, a: Asset) {
  if (card.effect.type !== 'buyer') return 0
  return marketPrice(card.effect, a)
}

function sellToMarket(s: GameState, p: Player, card: MarketCard, assetId: string) {
  const a = p.assets.find((x) => x.id === assetId)
  if (!a || !marketEligible(card, p).includes(a)) return 'not eligible'
  const price = marketOffer(card, a)
  const proceeds = price - a.debt
  if (p.cash + proceeds < 0) return 'cannot afford to sell at a loss'
  p.cash += proceeds
  p.assets = p.assets.filter((x) => x !== a)
  log(s, `Sold ${a.name} for ${money(price)} (${money(proceeds, { sign: true })} after paying off debt).`, proceeds >= 0 ? 'good' : 'bad', p.id)
  return undefined
}

function botReactMarket(s: GameState) {
  const pend = s.pending
  if (pend?.type !== 'market') return
  const card = MARKET_BY_ID[pend.cardId]
  s.players.forEach((p, idx) => {
    if (!p.isBot || idx === s.current) return
    for (const a of marketEligible(card, p)) {
      if (botWantsToSellAsset(a, marketOffer(card, a))) {
        sellToMarket(s, p, card, a.id)
        pend.sold.push(a.id)
      }
    }
  })
}

function sellStock(s: GameState, p: Player, card: StockDeal, qty: number) {
  const st = p.assets.find((a) => a.kind === 'stock' && a.ticker === card.ticker)
  if (!st || !st.shares || qty < 1 || qty > st.shares || !Number.isInteger(qty)) return 'invalid quantity'
  st.shares -= qty
  p.cash += qty * card.price
  if (st.dividend) st.cashflow = Math.round(st.shares * st.dividend)
  if (st.shares === 0) p.assets = p.assets.filter((a) => a !== st)
  log(s, `Sold ${qty.toLocaleString()} ${card.ticker} at ${money(card.price)} = ${money(qty * card.price)}.`, 'good', p.id)
  return undefined
}

function botReactStock(s: GameState, card: StockDeal) {
  s.players.forEach((p, idx) => {
    if (!p.isBot || idx === s.current || p.track !== 'grind') return
    const qty = botWantsToSellStock(p, card)
    if (qty > 0) sellStock(s, p, card, qty)
  })
}

function enterFreedom(s: GameState, p: Player, dreamId: string) {
  const passive = passiveIncome(p)
  const cf = Math.max(30000, roundTo(passive * 10, 1000))
  p.freedom = { dreamId, cashflow: cf, startCashflow: cf, ventures: [], position: 0 }
  p.track = 'freedom'
  p.readyToEscape = false
  p.boostTurns = 0
  p.cash += cf
  log(s, `${p.name} escaped the Grind! Freedom cash flow starts at ${money(cf)} per payday.`, 'good', p.id)
}

function setWinner(s: GameState, p: Player, reason: string) {
  s.winnerId = p.id
  s.winReason = reason
  s.phase = 'gameover'
  s.pending = null
  log(s, `🏆 ${p.name} wins: ${reason}`, 'good', p.id)
}

function advance(s: GameState) {
  const n = s.players.length
  let idx = s.current
  for (let guard = 0; guard < 1000; guard++) {
    idx = (idx + 1) % n
    const p = s.players[idx]
    if (p.skipTurns > 0) {
      p.skipTurns -= 1
      log(s, `${p.name} sits out this turn.`, 'neutral', p.id)
      continue
    }
    break
  }
  s.current = idx
  s.turn += 1
  s.phase = 'roll'
  s.pending = null
  s.lastRoll = null
}

function recordHistory(s: GameState, p: Player) {
  p.history.push({ turn: s.turn, passive: passiveIncome(p), expenses: totalExpenses(p), cash: p.cash })
  if (p.history.length > 200) p.history.splice(0, p.history.length - 200)
}

/**
 * Pay part or all of a debt. Partial payments go in $1,000 steps and shrink the monthly payment in
 * proportion (the bank loan always costs 10% of what is left).
 */
function payDown(s: GameState, p: Player, liabilityId: string, amount: number): string | undefined {
  if (p.track !== 'grind') return 'not in the Grind'
  const l = p.liabilities.find((x) => x.id === liabilityId)
  if (!l) return 'invalid liability'
  if (!Number.isInteger(amount) || amount <= 0 || amount > l.balance) return 'invalid amount'
  if (amount < l.balance && amount % 1000 !== 0) return 'partial payments are in $1,000 steps'
  if (amount > p.cash) return 'not enough cash'
  const before = l.payment
  p.cash -= amount
  if (amount === l.balance) {
    p.liabilities = p.liabilities.filter((x) => x !== l)
    log(s, `Paid off ${l.name} (${money(amount)}): expenses −${money(before)}/mo.`, 'good', p.id)
    return undefined
  }
  const left = l.balance - amount
  l.payment = l.kind === 'bank' ? Math.round(left * BANK_RATE) : Math.max(1, Math.round((l.payment * left) / l.balance))
  l.balance = left
  log(s, `Paid ${money(amount)} toward ${l.name}: expenses −${money(before - l.payment)}/mo.`, 'good', p.id)
  return undefined
}

/** Monthly payment saved per $1,000 paid toward a debt: the "return" on paying it down. */
export const payoffValue = (l: Liability) => (l.balance > 0 ? (l.payment / l.balance) * 1000 : 0)

// ---------- reducer ----------

export function applyAction(state: GameState, action: Action): GameState {
  if (state.phase === 'gameover') return state
  const s = structuredClone(state)
  const err = handle(s, action)
  if (err) {
    if (import.meta.env?.DEV) console.warn('Rejected action', action, err)
    return state
  }
  postProcess(s)
  return s
}

/** Returns an error message if the action is not allowed. */
export function canApply(state: GameState, action: Action): boolean {
  if (state.phase === 'gameover') return false
  const s = structuredClone(state)
  return handle(s, action) === undefined
}

function closePending(s: GameState) {
  s.pending = null
  s.phase = 'end'
}

function handle(s: GameState, a: Action): string | undefined {
  const p = currentPlayer(s)
  const pend = s.pending

  switch (a.type) {
    case 'ROLL': {
      if (s.phase !== 'roll' || pend) return 'not time to roll'
      if (!diceOptions(p).includes(a.dice)) return 'invalid dice count'
      if (p.boostTurns > 0) p.boostTurns -= 1
      const roll = Array.from({ length: a.dice }, () => rollDie(s))
      s.lastRoll = roll
      move(s, p, roll.reduce((x, y) => x + y, 0))
      s.phase = 'resolve'
      landOn(s, p)
      if (!s.pending) s.phase = 'end'
      return
    }

    case 'CHOOSE_DEAL': {
      if (pend?.type !== 'chooseDeal') return 'no deal to choose'
      const cardId = draw(s, a.size)
      s.pending = { type: 'deal', deck: a.size, cardId }
      const card = DEAL_CARDS[cardId]
      if (card.kind === 'stock') botReactStock(s, card)
      return
    }

    case 'BUY_STOCK': {
      if (pend?.type !== 'deal') return 'no deal'
      const card = DEAL_CARDS[pend.cardId]
      if (card.kind !== 'stock') return 'not a stock'
      if (!Number.isInteger(a.qty) || a.qty < 1) return 'invalid quantity'
      const cost = a.qty * card.price
      const loan = borrowNeeded(p, cost)
      if (loan > 0) {
        if (!a.borrow) return 'not enough cash'
        if (loan > maxBorrow(p)) return 'bank declined'
        addBankLoan(p, loan)
        p.cash += loan
        log(s, `Borrowed ${money(loan)} from the bank.`, 'neutral', p.id)
      }
      p.cash -= cost
      let st = p.assets.find((x) => x.kind === 'stock' && x.ticker === card.ticker)
      if (!st) {
        st = {
          id: `stk-${card.ticker}`, kind: 'stock', category: 'stock', name: card.title.split(' at ')[0],
          ticker: card.ticker, shares: 0, avgPrice: 0, cost: 0, down: 0, debt: 0, cashflow: 0, dividend: card.dividend,
        }
        p.assets.push(st)
      }
      const prevShares = st.shares ?? 0
      st.avgPrice = ((st.avgPrice ?? 0) * prevShares + cost) / (prevShares + a.qty)
      st.shares = prevShares + a.qty
      st.cost = Math.round(st.avgPrice * st.shares)
      st.down = st.cost
      if (st.dividend) st.cashflow = Math.round(st.shares * st.dividend)
      log(s, `Bought ${a.qty.toLocaleString()} ${card.ticker} at ${money(card.price)} = ${money(cost)}.`, 'neutral', p.id)
      return
    }

    case 'SELL_STOCK': {
      if (pend?.type !== 'deal') return 'no deal'
      const card = DEAL_CARDS[pend.cardId]
      if (card.kind !== 'stock') return 'not a stock'
      const seller = playerById(s, a.playerId)
      if (!seller || seller.track !== 'grind') return 'invalid seller'
      return sellStock(s, seller, card, a.qty)
    }

    case 'BUY_ASSET': {
      if (pend?.type !== 'deal') return 'no deal'
      const card = DEAL_CARDS[pend.cardId] as AssetDeal
      if (card.kind !== 'asset') return 'not an asset'
      const loan = borrowNeeded(p, card.down)
      if (loan > 0) {
        if (!a.borrow) return 'not enough cash'
        if (loan > maxBorrow(p, card.cashflow)) return 'bank declined'
        addBankLoan(p, loan)
        p.cash += loan
        log(s, `Borrowed ${money(loan)} from the bank.`, 'neutral', p.id)
      }
      p.cash -= card.down
      p.assets.push({
        id: `${card.id}-${s.turn}-${p.id}`,
        kind: card.assetKind,
        category: card.category,
        name: card.name,
        cost: card.cost,
        down: card.down,
        debt: card.cost - card.down,
        cashflow: card.cashflow,
        units: card.units,
      })
      log(s, `Bought ${card.name} for ${money(card.down)} down (${money(card.cashflow, { sign: true })}/mo).`, card.cashflow >= 0 ? 'good' : 'bad', p.id)
      closePending(s)
      return
    }

    case 'MARKET_SELL': {
      if (pend?.type !== 'market') return 'no market card'
      const card = MARKET_BY_ID[pend.cardId]
      const seller = playerById(s, a.playerId)
      if (!seller) return 'invalid seller'
      const err = sellToMarket(s, seller, card, a.assetId)
      if (!err) pend.sold.push(a.assetId)
      return err
    }

    case 'PAY_SPLURGE': {
      if (pend?.type !== 'splurge') return 'no splurge'
      const card = SPLURGE_BY_ID[pend.cardId]
      if (a.method === 'cash') {
        if (p.cash < card.cost) return 'not enough cash'
        p.cash -= card.cost
        log(s, `${card.title}: paid ${money(card.cost)} cash.`, 'bad', p.id)
      } else {
        addCardDebt(p, card.cost)
        log(s, `${card.title}: ${money(card.cost)} on the credit card (+${money(Math.max(10, roundTo(card.cost * CARD_RATE, 10)))}/mo).`, 'bad', p.id)
      }
      closePending(s)
      return
    }

    case 'LIFE_GAMBLE': {
      if (pend?.type !== 'life' || pend.outcome) return 'nothing to gamble'
      const card = LIFE_BY_ID[pend.cardId]
      if (card.effect.type !== 'gamble') return 'not a gamble'
      if (p.cash < card.effect.cost) return 'not enough cash'
      p.cash -= card.effect.cost
      const d = rollDie(s)
      s.lastRoll = [d]
      if (d >= card.effect.need) {
        p.cash += card.effect.payout
        pend.outcome = `You rolled a ${d}. It paid off: +${money(card.effect.payout)}!`
        log(s, `${card.title}: rolled ${d}, won ${money(card.effect.payout)}.`, 'good', p.id)
      } else {
        pend.outcome = `You rolled a ${d}. The startup folded and your ${money(card.effect.cost)} is gone.`
        log(s, `${card.title}: rolled ${d}, lost ${money(card.effect.cost)}.`, 'bad', p.id)
      }
      return
    }

    case 'LEARN': {
      if (pend?.type !== 'learn') return 'not on upskill'
      if (p.cash < LEARN_COST) return 'not enough cash'
      p.cash -= LEARN_COST
      p.salary += LEARN_RAISE
      log(s, `Took a course for ${money(LEARN_COST)}: salary +${money(LEARN_RAISE)}/mo.`, 'good', p.id)
      closePending(s)
      return
    }

    case 'GIVE': {
      if (pend?.type !== 'give') return 'not on give back'
      if (p.cash < pend.amount) return 'not enough cash'
      p.cash -= pend.amount
      p.boostTurns = 3
      log(s, `Donated ${money(pend.amount)}. Extra dice for the next 3 turns.`, 'good', p.id)
      closePending(s)
      return
    }

    case 'PICK_DREAM': {
      if (pend?.type !== 'escape') return 'not escaping'
      if (!DREAM_BY_ID[a.dreamId]) return 'unknown dream'
      const resume = pend.resume
      enterFreedom(s, p, a.dreamId)
      s.pending = null
      s.phase = resume
      return
    }

    case 'BUY_VENTURE': {
      if (pend?.type !== 'venture' || pend.outcome) return 'no venture'
      const card = VENTURE_BY_ID[pend.cardId]
      if (p.cash < card.cost) return 'not enough cash'
      p.cash -= card.cost
      if (card.risky) {
        const d = rollDie(s)
        s.lastRoll = [d]
        if (d >= card.risky.need) {
          p.cash += card.risky.payout
          pend.outcome = `You rolled a ${d}. Jackpot: +${money(card.risky.payout)}!`
          log(s, `${card.title}: rolled ${d}, collected ${money(card.risky.payout)}.`, 'good', p.id)
        } else {
          pend.outcome = `You rolled a ${d}. The bet did not pay off. ${money(card.cost)} lost.`
          log(s, `${card.title}: rolled ${d}, lost ${money(card.cost)}.`, 'bad', p.id)
        }
        return
      }
      const f = p.freedom!
      f.ventures.push({ id: `${card.id}-${s.turn}`, name: card.title, cost: card.cost, cashflow: card.cashflow })
      f.cashflow += card.cashflow
      log(s, `Acquired ${card.title}: +${money(card.cashflow)} per payday.`, 'good', p.id)
      closePending(s)
      return
    }

    case 'BUY_DREAM': {
      if (pend?.type !== 'dream') return 'no dream'
      const dream = DREAM_BY_ID[pend.dreamId]
      if (p.freedom?.dreamId !== dream.id) return 'not your dream'
      if (p.cash < dream.cost) return 'not enough cash'
      p.cash -= dream.cost
      setWinner(s, p, `achieved their dream: ${dream.title} ${dream.emoji}`)
      return
    }

    case 'BORROW': {
      if (p.track !== 'grind') return 'cannot borrow'
      if (a.amount <= 0 || a.amount % 1000 !== 0) return 'loans are in $1,000 steps'
      if (a.amount > maxBorrow(p)) return 'bank declined'
      addBankLoan(p, a.amount)
      p.cash += a.amount
      log(s, `Borrowed ${money(a.amount)} (+${money(a.amount * BANK_RATE)}/mo).`, 'neutral', p.id)
      return
    }

    case 'REPAY': {
      const loan = p.liabilities.find((l) => l.kind === 'bank')
      if (!loan) return 'no loan'
      return payDown(s, p, loan.id, a.amount)
    }

    case 'PAYOFF': {
      const l = p.liabilities.find((x) => x.id === a.liabilityId)
      if (!l) return 'invalid liability'
      return payDown(s, p, l.id, l.balance)
    }

    case 'PAY_DOWN':
      return payDown(s, p, a.liabilityId, a.amount)

    case 'DONE': {
      if (!pend) return 'nothing to close'
      if (pend.type === 'splurge' || pend.type === 'escape' || pend.type === 'chooseDeal') return 'must resolve'
      closePending(s)
      return
    }

    case 'END_TURN': {
      if (s.phase !== 'end' || pend) return 'turn not finished'
      recordHistory(s, p)
      advance(s)
      return
    }
  }
}

function postProcess(s: GameState) {
  for (const p of s.players) {
    if (!p.readyToEscape && canEscape(p)) {
      p.readyToEscape = true
      log(s, `${p.name}'s passive income now covers all expenses!`, 'good', p.id)
    }
  }
  if (s.phase === 'gameover') return

  if (s.settings.mode === 'quick') {
    const winner = s.players.find((p) => p.readyToEscape)
    if (winner) return setWinner(s, winner, 'escaped the Grind first!')
  }

  for (const p of s.players) {
    if (p.freedom && p.freedom.cashflow >= freedomTarget(p)) {
      return setWinner(s, p, `grew freedom cash flow by ${money(p.freedom.cashflow - p.freedom.startCashflow)}!`)
    }
  }

  const c = currentPlayer(s)
  if (s.alert && (s.phase === 'end' || s.phase === 'resolve')) {
    if (!s.pending) {
      s.pending = { type: 'info', title: s.alert.title, text: s.alert.text, tone: 'bad' }
      s.phase = 'resolve'
      s.alert = undefined
    } else if (s.pending.type === 'info') {
      s.pending = { ...s.pending, title: `${s.pending.title} → ${s.alert.title}`, text: `${s.pending.text}\n\n${s.alert.text}` }
      s.alert = undefined
    }
  }

  if (c.readyToEscape && c.track === 'grind' && !s.pending && (s.phase === 'roll' || s.phase === 'end')) {
    s.pending = { type: 'escape', resume: s.phase }
    s.phase = 'resolve'
  }
}
