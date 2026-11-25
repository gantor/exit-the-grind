import { useState } from 'react'
import { DREAM_BY_ID } from '../game/data/cards'
import { professionById } from '../game/data/professions'
import type { Action } from '../game/engine'
import {
  BANK_RATE,
  FREEDOM_GOAL,
  childExpense,
  freedomProgress,
  maxBorrow,
  money,
  monthlyCashflow,
  netWorth,
  passiveIncome,
  totalExpenses,
  totalIncome,
} from '../game/finance'
import type { Asset, Player } from '../game/types'
import { CashTicker, Meter, Sparkline } from './bits'
import { DebtList } from './Debts'

interface Props {
  player: Player
  canAct: boolean
  dispatch: (a: Action) => void
}

const assetLine = (a: Asset) => {
  if (a.kind === 'stock') return `${(a.shares ?? 0).toLocaleString()} sh @ ${money(a.avgPrice ?? 0)}`
  if (a.debt > 0) return `${money(a.down)} down · ${money(a.debt)} debt`
  return `${money(a.down)} paid`
}

export function Statement({ player: p, canAct, dispatch }: Props) {
  const prof = professionById(p.professionId)
  if (p.track === 'freedom' && p.freedom) return <FreedomStatement player={p} />

  const passive = passiveIncome(p)
  const expenses = totalExpenses(p)
  const cf = monthlyCashflow(p)
  const progress = freedomProgress(p)
  const incomeAssets = p.assets.filter((a) => a.cashflow !== 0)

  return (
    <div className="statement">
      <header className="st-head">
        <div>
          <div className="st-name">
            <span className="dot" style={{ background: p.color }} /> {p.name}
          </div>
          <div className="muted small">{prof.emoji} {prof.title}{p.children ? ` · ${p.children} kid${p.children > 1 ? 's' : ''}` : ''}</div>
        </div>
        <div className="st-cash">
          <div className="muted small">Cash</div>
          <div className="big"><CashTicker value={p.cash} /></div>
        </div>
      </header>

      <section className="st-meter">
        <div className="row">
          <strong>Freedom meter</strong>
          <span className="muted small">{Math.round(progress * 100)}%</span>
        </div>
        <Meter value={progress} label="Passive income as a share of expenses" />
        <p className="small muted">
          Passive income <b className="pos">{money(passive)}</b> of <b>{money(expenses)}</b> expenses. Escape when passive
          income is higher than expenses.
        </p>
      </section>

      <section className="st-grid">
        <div className="kpi">
          <span className="muted small">Payday</span>
          <b className={cf >= 0 ? 'pos' : 'neg'}>{money(cf, { sign: true })}</b>
        </div>
        <div className="kpi">
          <span className="muted small">Income</span>
          <b>{money(totalIncome(p))}</b>
        </div>
        <div className="kpi" title="Your own home is not counted as an asset: it takes money out of your pocket every month.">
          <span className="muted small">Net worth</span>
          <b>{money(netWorth(p))}</b>
        </div>
      </section>

      <details open className="st-sec">
        <summary>Income <span>{money(totalIncome(p))}</span></summary>
        <Row label="Salary" value={p.salary} />
        {incomeAssets.map((a) => (
          <Row key={a.id} label={a.name} value={a.cashflow} tone={a.cashflow >= 0 ? 'pos' : 'neg'} tag="passive" />
        ))}
        {!incomeAssets.length && <p className="small muted">No passive income yet. Buy assets that pay you every month.</p>}
      </details>

      <details open className="st-sec">
        <summary>Expenses <span>{money(expenses)}</span></summary>
        <Row label="Taxes" value={p.taxes} />
        {p.rent > 0 && <Row label="Rent" value={p.rent} />}
        <Row label="Living costs" value={p.otherExpenses} />
        {p.children > 0 && <Row label={`Children (${p.children} × ${money(p.perChild)})`} value={childExpense(p)} />}
        {p.liabilities.map((l) => (
          <Row key={l.id} label={`${l.name} payment`} value={l.payment} />
        ))}
      </details>

      <details open className="st-sec">
        <summary>Assets <span>{p.assets.length}</span></summary>
        {!p.assets.length && <p className="small muted">Assets put money in your pocket. You have none yet.</p>}
        {p.assets.map((a) => (
          <div key={a.id} className="line">
            <div>
              <div>{a.kind === 'stock' ? `${a.ticker} · ${a.name}` : a.name}</div>
              <div className="small muted">{assetLine(a)}</div>
            </div>
            <span className={a.cashflow > 0 ? 'pos' : a.cashflow < 0 ? 'neg' : 'muted'}>
              {a.cashflow ? `${money(a.cashflow, { sign: true })}/mo` : 'no income'}
            </span>
          </div>
        ))}
      </details>

      <details open className="st-sec">
        <summary>Liabilities <span>{money(p.liabilities.reduce((t, l) => t + l.balance, 0))}</span></summary>
        <DebtList player={p} canAct={canAct} dispatch={dispatch} />
        <BankLoan player={p} canAct={canAct} dispatch={dispatch} />
      </details>

      <section className="st-sec">
        <div className="row">
          <strong>Progress</strong>
        </div>
        <Sparkline history={[...p.history, { turn: -1, passive, expenses, cash: p.cash }]} />
      </section>
    </div>
  )
}

function Row({ label, value, tone, tag }: { label: string; value: number; tone?: string; tag?: string }) {
  return (
    <div className="line">
      <span>
        {label} {tag && <em className="tag">{tag}</em>}
      </span>
      <span className={tone}>{money(value)}</span>
    </div>
  )
}

function BankLoan({ player: p, canAct, dispatch }: Props) {
  const max = maxBorrow(p)
  const [amt, setAmt] = useState(1000)
  if (!canAct) return null
  return (
    <div className="loan">
      <div className="row">
        <span>
          <b>Borrow from the bank</b>
          <span className="small muted"> · costs 10%/mo of the balance</span>
        </span>
      </div>
      <div className="loan-ctl">
        <div className="stepper">
          <button className="btn btn-sm" onClick={() => setAmt((a) => Math.max(1000, a - 1000))} aria-label="Less">−</button>
          <span>{money(amt)}</span>
          <button className="btn btn-sm" onClick={() => setAmt((a) => a + 1000)} aria-label="More">+</button>
        </div>
        <button className="btn btn-sm" disabled={amt > max} onClick={() => dispatch({ type: 'BORROW', amount: amt })}>
          Borrow (+{money(amt * BANK_RATE)}/mo)
        </button>
      </div>
      <p className="small muted">The bank will lend up to {money(max)} right now.</p>
    </div>
  )
}

function FreedomStatement({ player: p }: { player: Player }) {
  const f = p.freedom!
  const dream = DREAM_BY_ID[f.dreamId]
  const gained = f.cashflow - f.startCashflow
  return (
    <div className="statement">
      <header className="st-head">
        <div>
          <div className="st-name">
            <span className="dot" style={{ background: p.color }} /> {p.name}
          </div>
          <div className="muted small">On Freedom Lane</div>
        </div>
        <div className="st-cash">
          <div className="muted small">Cash</div>
          <div className="big">{money(p.cash)}</div>
        </div>
      </header>
      <section className="st-meter">
        <div className="row">
          <strong>{dream.emoji} Your dream: {dream.title}</strong>
          <span className="muted small">{money(dream.cost)}</span>
        </div>
        <Meter value={p.cash / dream.cost} tone="purple" label="Cash toward your dream" />
        <p className="small muted">Land on your dream's space with {money(dream.cost)} cash to win.</p>
      </section>
      <section className="st-meter">
        <div className="row">
          <strong>Cash flow goal</strong>
          <span className="muted small">{money(gained)} of {money(FREEDOM_GOAL)}</span>
        </div>
        <Meter value={gained / FREEDOM_GOAL} tone="purple" label="Cash flow growth toward the goal" />
        <p className="small muted">Or win by growing your freedom payday by {money(FREEDOM_GOAL)}.</p>
      </section>
      <section className="st-grid">
        <div className="kpi"><span className="muted small">Freedom payday</span><b className="pos">{money(f.cashflow)}</b></div>
        <div className="kpi"><span className="muted small">Started at</span><b>{money(f.startCashflow)}</b></div>
        <div className="kpi"><span className="muted small">Ventures</span><b>{f.ventures.length}</b></div>
      </section>
      <details open className="st-sec">
        <summary>Ventures <span>{money(gained, { sign: true })}</span></summary>
        {!f.ventures.length && <p className="small muted">Buy ventures with cash to grow your payday.</p>}
        {f.ventures.map((v) => (
          <div key={v.id} className="line">
            <div>
              <div>{v.name}</div>
              <div className="small muted">{money(v.cost)} invested</div>
            </div>
            <span className="pos">{money(v.cashflow, { sign: true })}</span>
          </div>
        ))}
      </details>
    </div>
  )
}
