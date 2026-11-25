import type { FreedomSpace, GrindSpace } from './types'
import { DREAMS } from './data/cards'

export const GRIND_BOARD: GrindSpace[] = [
  'payday', 'opportunity', 'splurge', 'opportunity', 'market', 'opportunity',
  'payday', 'opportunity', 'give', 'opportunity', 'life', 'opportunity',
  'payday', 'opportunity', 'splurge', 'opportunity', 'market', 'opportunity',
  'payday', 'opportunity', 'layoff', 'opportunity', 'learn', 'market',
]

export const FREEDOM_BOARD: FreedomSpace[] = [
  'payday', 'venture', 'dream', 'setback', 'venture', 'dream',
  'payday', 'venture', 'venture', 'dream', 'venture', 'dream',
  'payday', 'venture', 'dream', 'give', 'venture', 'dream',
  'payday', 'venture', 'setback', 'dream', 'venture', 'dream',
]

/** Map freedom board index -> dream id. */
export const DREAM_SPACES: Record<number, string> = (() => {
  const out: Record<number, string> = {}
  let i = 0
  FREEDOM_BOARD.forEach((sp, idx) => {
    if (sp === 'dream') out[idx] = DREAMS[i++].id
  })
  return out
})()

export const SPACE_INFO: Record<GrindSpace | FreedomSpace, { label: string; icon: string; hint: string }> = {
  payday: { label: 'Payday', icon: '💵', hint: 'Collect your monthly cash flow whenever you land on or pass this space.' },
  opportunity: { label: 'Opportunity', icon: '🔑', hint: 'Draw a Small Deal or a Big Deal: stocks, rentals, businesses.' },
  market: { label: 'Market', icon: '📈', hint: 'Market news. Buyers may want your assets, prices move.' },
  splurge: { label: 'Splurge', icon: '🛍️', hint: 'Lifestyle spending you cannot avoid. Pay cash or put it on the card.' },
  life: { label: 'Life', icon: '🎲', hint: 'Life happens: babies, bonuses, bills.' },
  give: { label: 'Give Back', icon: '🤝', hint: 'Donate 10% of your income to roll extra dice for 3 turns.' },
  layoff: { label: 'Laid Off', icon: '📦', hint: 'Pay one month of expenses and sit out 2 turns.' },
  learn: { label: 'Upskill', icon: '🎓', hint: 'Invest in yourself to boost your salary.' },
  venture: { label: 'Venture', icon: '🚀', hint: 'Large businesses and moonshots, paid in cash.' },
  dream: { label: 'Dream', icon: '✨', hint: 'Land on your own Dream with enough cash to win.' },
  setback: { label: 'Setback', icon: '⚠️', hint: 'Lawsuits, audits and bad partners.' },
}
