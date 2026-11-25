import { payoffValue, type Action } from '../game/engine'
import { money } from '../game/finance'
import type { Liability, Player } from '../game/types'

interface Props {
  player: Player
  canAct: boolean
  dispatch: (a: Action) => void
  /** Show only the N most valuable debts to pay down. */
  limit?: number
}

/** Debts ranked by how much monthly expense each $1,000 of payment removes. */
export function rankedDebts(p: Player): Liability[] {
  return [...p.liabilities].sort((a, b) => payoffValue(b) - payoffValue(a))
}

export function DebtList({ player: p, canAct, dispatch, limit }: Props) {
  const debts = rankedDebts(p).slice(0, limit ?? Infinity)
  if (!debts.length) return <p className="small muted">Debt-free. Every dollar of income is yours.</p>
  return (
    <div className="debts">
      {debts.map((l, i) => {
        const step = Math.min(1000, l.balance)
        const maxStep = Math.floor(p.cash / 1000) * 1000
        const big = p.cash >= l.balance ? l.balance : maxStep >= 2000 ? maxStep : 0
        const saves = Math.round(payoffValue(l))
        return (
          <div key={l.id} className="debt">
            <div className="debt-info">
              <div className="debt-name">
                {l.name}
                {i === 0 && debts.length > 1 && <em className="tag tag-amber">best payoff</em>}
              </div>
              <div className="small muted">
                {money(l.balance)} owed · <b className="text">{money(l.payment)}/mo</b> · each $1k paid saves {money(saves)}/mo
              </div>
            </div>
            {canAct && (
              <div className="debt-btns">
                <button
                  className="btn btn-sm"
                  disabled={p.cash < step}
                  onClick={() => dispatch({ type: 'PAY_DOWN', liabilityId: l.id, amount: step })}
                  title={`Pay ${money(step)} toward ${l.name}`}
                >
                  Pay {step === l.balance ? money(step) : '$1k'}
                </button>
                {big > step && (
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={() => dispatch({ type: 'PAY_DOWN', liabilityId: l.id, amount: big })}
                    title={big === l.balance ? `Clear it and drop ${money(l.payment)}/mo` : `Pay ${money(big)} now`}
                  >
                    {big === l.balance ? `Pay off ${money(big)}` : `Pay ${money(big)}`}
                  </button>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
