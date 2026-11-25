import type { Player } from './types'

export const BANK_RATE = 0.1 // monthly payment = 10% of bank loan balance
export const CARD_RATE = 0.03 // monthly payment = 3% of new card balance
export const FREEDOM_GOAL = 50000

export const passiveIncome = (p: Player) => p.assets.reduce((sum, a) => sum + a.cashflow, 0)

export const totalIncome = (p: Player) => p.salary + passiveIncome(p)

export const childExpense = (p: Player) => p.children * p.perChild

export const liabilityPayments = (p: Player) => p.liabilities.reduce((sum, l) => sum + l.payment, 0)

export const totalExpenses = (p: Player) =>
  p.taxes + p.rent + p.otherExpenses + childExpense(p) + liabilityPayments(p)

export const monthlyCashflow = (p: Player) => totalIncome(p) - totalExpenses(p)

/** Progress toward escaping the Grind, 0..1. */
export const freedomProgress = (p: Player) => {
  const exp = totalExpenses(p)
  return exp <= 0 ? 1 : Math.max(0, Math.min(1, passiveIncome(p) / exp))
}

export const canEscape = (p: Player) => p.track === 'grind' && passiveIncome(p) > totalExpenses(p)

export const netWorth = (p: Player) => {
  const assets = p.assets.reduce(
    (s, a) => s + (a.kind === 'stock' ? (a.shares ?? 0) * (a.avgPrice ?? 0) : a.cost),
    0,
  )
  const debts = p.assets.reduce((s, a) => s + a.debt, 0) + p.liabilities.reduce((s, l) => s + l.balance, 0)
  const ventures = p.freedom ? p.freedom.ventures.reduce((s, v) => s + v.cost, 0) : 0
  return p.cash + assets + ventures - debts
}

/** Largest bank loan (in $1,000s) that keeps monthly cash flow >= 0. */
export const maxBorrow = (p: Player, extraCashflow = 0) => {
  if (p.track !== 'grind') return 0
  const cf = monthlyCashflow(p) + extraCashflow
  return Math.max(0, Math.floor(cf / (1000 * BANK_RATE)) * 1000)
}

export const bankLoan = (p: Player) => p.liabilities.find((l) => l.kind === 'bank')

export const freedomTarget = (p: Player) => (p.freedom ? p.freedom.startCashflow + FREEDOM_GOAL : 0)

export const money = (n: number, opts: { sign?: boolean } = {}) => {
  const abs = Math.abs(Math.round(n)).toLocaleString('en-US')
  const s = n < 0 ? `-$${abs}` : `$${abs}`
  return opts.sign && n > 0 ? `+${s}` : s
}

export const compactMoney = (n: number) => {
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`
  if (abs >= 10_000) return `${sign}$${Math.round(abs / 1000)}k`
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1)}k`
  return `${sign}$${Math.round(abs)}`
}
