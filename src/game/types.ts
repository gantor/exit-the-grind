// Core data model for Exit the Grind.

export type Track = 'grind' | 'freedom'

export interface Profession {
  id: string
  title: string
  emoji: string
  blurb: string
  salary: number
  taxes: number
  /** Monthly rent. Only for renters (owners carry a home mortgage liability instead). */
  rent?: number
  otherExpenses: number
  perChild: number
  savings: number
  /** Personal debts with their monthly payments. */
  debts: { kind: LiabilityKind; name: string; balance: number; payment: number }[]
}

export type LiabilityKind = 'home' | 'car' | 'student' | 'card' | 'bank'

export interface Liability {
  id: string
  kind: LiabilityKind
  name: string
  balance: number
  payment: number
}

export type AssetKind = 'stock' | 'realestate' | 'business' | 'land' | 'collectible' | 'savings'

export interface Asset {
  id: string
  kind: AssetKind
  /** Used by market cards to target buyers, e.g. 'condo', 'house', 'plex', 'apartment'. */
  category: string
  name: string
  /** Total price paid (for real estate/business the full purchase price). */
  cost: number
  /** Cash put in. */
  down: number
  /** Debt attached to this asset (mortgage / business loan). */
  debt: number
  /** Monthly net cash flow (after the asset's own debt service). */
  cashflow: number
  units?: number
  // stocks only
  ticker?: string
  shares?: number
  avgPrice?: number
  /** Monthly dividend per share (dividend funds). */
  dividend?: number
}

export interface Venture {
  id: string
  name: string
  cost: number
  cashflow: number
}

export interface FreedomState {
  dreamId: string
  cashflow: number
  startCashflow: number
  ventures: Venture[]
  position: number
}

export interface HistoryPoint {
  turn: number
  passive: number
  expenses: number
  cash: number
}

export interface Player {
  id: string
  name: string
  color: string
  isBot: boolean
  professionId: string
  salary: number
  taxes: number
  rent: number
  otherExpenses: number
  perChild: number
  children: number
  cash: number
  liabilities: Liability[]
  assets: Asset[]
  position: number
  track: Track
  freedom?: FreedomState
  /** Turns remaining where the player can choose extra dice. */
  boostTurns: number
  /** Turns the player must sit out. */
  skipTurns: number
  /** Times this player went through bankruptcy restructuring. */
  bankruptcies: number
  /** Passive income now exceeds expenses; escape on the player's next chance. */
  readyToEscape: boolean
  history: HistoryPoint[]
}

// ---------- Cards ----------

export interface CardBase {
  id: string
  title: string
  text: string
  lesson?: string
}

export interface StockDeal extends CardBase {
  kind: 'stock'
  ticker: string
  price: number
  /** Monthly dividend per share, if any. */
  dividend?: number
  /** Historical trading range, shown to help players judge the price. */
  range: [number, number]
}

export interface AssetDeal extends CardBase {
  kind: 'asset'
  assetKind: Exclude<AssetKind, 'stock'>
  category: string
  name: string
  cost: number
  down: number
  cashflow: number
  units?: number
}

export type DealCard = StockDeal | AssetDeal

export type MarketEffect =
  | { type: 'buyer'; categories: string[]; price?: number; perUnit?: number; prices?: Record<string, number>; multiple?: number }
  | { type: 'split'; ticker: string; ratio: number }
  | { type: 'wipe'; ticker: string }
  | { type: 'boost'; categories: string[]; amount: number }
  | { type: 'repair'; kinds: AssetKind[]; amount: number }
  | { type: 'refi'; amount: number }

export interface MarketCard extends CardBase {
  effect: MarketEffect
}

export interface SplurgeCard extends CardBase {
  cost: number
}

export type LifeEffect =
  | { type: 'baby' }
  | { type: 'cash'; amount: number }
  | { type: 'raise'; amount: number }
  | { type: 'gamble'; cost: number; need: number; payout: number }

export interface LifeCard extends CardBase {
  effect: LifeEffect
}

export interface VentureCard extends CardBase {
  cost: number
  cashflow: number
  /** Risky ventures pay once instead: roll >= need on one die to collect payout. */
  risky?: { need: number; payout: number }
}

export type SetbackEffect =
  | { type: 'halfCash' }
  | { type: 'pay'; amount: number }
  | { type: 'loseVenture' }
  | { type: 'skip'; turns: number }

export interface SetbackCard extends CardBase {
  effect: SetbackEffect
}

export interface Dream {
  id: string
  title: string
  emoji: string
  cost: number
  text: string
}

export type DeckName = 'small' | 'big' | 'market' | 'splurge' | 'life' | 'venture' | 'setback'

export interface Deck {
  draw: string[]
  discard: string[]
}

// ---------- Board ----------

export type GrindSpace =
  | 'payday'
  | 'opportunity'
  | 'market'
  | 'splurge'
  | 'life'
  | 'give'
  | 'layoff'
  | 'learn'

export type FreedomSpace = 'payday' | 'venture' | 'dream' | 'setback' | 'give'

// ---------- Turn flow ----------

export type Pending =
  | { type: 'chooseDeal' }
  | { type: 'deal'; deck: 'small' | 'big'; cardId: string }
  | { type: 'market'; cardId: string; sold: string[] }
  | { type: 'splurge'; cardId: string }
  | { type: 'life'; cardId: string; outcome?: string }
  | { type: 'learn' }
  | { type: 'give'; amount: number }
  | { type: 'info'; title: string; text: string; tone?: 'good' | 'bad' | 'neutral' }
  | { type: 'escape'; resume: 'roll' | 'end' }
  | { type: 'venture'; cardId: string; outcome?: string }
  | { type: 'setback'; cardId: string; outcome: string }
  | { type: 'dream'; dreamId: string }

export type Phase = 'roll' | 'resolve' | 'end' | 'gameover'

export interface LogEntry {
  turn: number
  playerId: string
  text: string
  tone?: 'good' | 'bad' | 'neutral'
}

export interface Settings {
  /** 'full' = escape then reach your dream; 'quick' = first to escape wins. */
  mode: 'full' | 'quick'
}

export interface GameState {
  version: number
  players: Player[]
  current: number
  turn: number
  phase: Phase
  pending: Pending | null
  decks: Record<DeckName, Deck>
  log: LogEntry[]
  lastRoll: number[] | null
  settings: Settings
  winnerId?: string
  winReason?: string
  /** A notice to show the current player once their open card is resolved. */
  alert?: { title: string; text: string }
  /** Seeded RNG state, saved with the game. */
  rngState: number
}

export interface PlayerSetup {
  name: string
  professionId: string
  isBot: boolean
}
