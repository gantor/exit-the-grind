import { useEffect, useState } from 'react'
import { FREEDOM_BOARD, GRIND_BOARD, SPACE_INFO } from '../game/board'
import { DREAMS, DREAM_BY_ID, LIFE_BY_ID, MARKET_BY_ID, SETBACK_BY_ID, SPLURGE_BY_ID, VENTURE_BY_ID } from '../game/data/cards'
import { DEAL_CARDS, TICKERS } from '../game/data/deals'
import {
  LEARN_COST,
  LEARN_RAISE,
  borrowNeeded,
  currentPlayer,
  diceOptions,
  marketEligible,
  marketOffer,
  type Action,
} from '../game/engine'
import { BANK_RATE, CARD_RATE, maxBorrow, money, monthlyCashflow, totalExpenses } from '../game/finance'
import { DebtList } from './Debts'
import type { AssetDeal, GameState, Player, StockDeal } from '../game/types'

interface Props {
  state: GameState
  dispatch: (a: Action) => void
  moving: boolean
  waitingForHumans: boolean
  onContinueBot: () => void
}

export function ActionPanel({ state: s, dispatch, moving, waitingForHumans, onContinueBot }: Props) {
  const p = currentPlayer(s)
  const bot = p.isBot
  const pend = s.pending

  if (s.phase === 'gameover') return null

  if (moving) {
    return (
      <Card tone="neutral" kicker={p.name} title="Moving…">
        <p className="muted">Counting squares.</p>
      </Card>
    )
  }

  const footer = bot ? (
    waitingForHumans ? (
      <div className="actions">
        <p className="small muted">Other players can sell to this offer. Tap continue when done.</p>
        <button className="btn btn-primary" onClick={onContinueBot}>Continue</button>
      </div>
    ) : (
      <p className="small muted thinking">{p.name} is thinking…</p>
    )
  ) : null

  if (!pend) {
    if (s.phase === 'roll') {
      const opts = diceOptions(p)
      return (
        <Card tone="neutral" kicker={`Turn ${s.turn}`} title={bot ? `${p.name}'s turn` : `Your move, ${p.name}`}>
          <p className="muted">
            {p.track === 'grind'
              ? 'Roll to move around the Grind. Passing a Payday pays your monthly cash flow.'
              : 'You are on Freedom Lane. Buy ventures or reach your dream.'}
          </p>
          {!bot && s.players.length > 1 && <Recap s={s} me={p} />}
          {p.boostTurns > 0 && <p className="small pos">Give Back bonus: {p.boostTurns} turn{p.boostTurns > 1 ? 's' : ''} left with extra dice.</p>}
          {!bot && (
            <div className="actions">
              {opts.map((n) => (
                <button key={n} className={`btn ${n === opts[opts.length - 1] ? 'btn-primary' : ''}`} onClick={() => dispatch({ type: 'ROLL', dice: n })}>
                  🎲 Roll {n} {n === 1 ? 'die' : 'dice'}
                  {n === opts[opts.length - 1] && <kbd>Space</kbd>}
                </button>
              ))}
            </div>
          )}
          {footer}
        </Card>
      )
    }
    // phase end
    const events = s.log.filter((l) => l.turn === s.turn && l.playerId === p.id).slice(-5)
    const space = p.track === 'grind' ? GRIND_BOARD[p.position] : FREEDOM_BOARD[p.freedom!.position]
    return (
      <Card tone="neutral" kicker={`Landed on ${SPACE_INFO[space].label}`} title={bot ? `${p.name}'s turn` : 'Turn complete'}>
        {events.length > 0 ? (
          <ul className="events">
            {events.map((e, i) => (
              <li key={i} className={e.tone}>{e.text}</li>
            ))}
          </ul>
        ) : (
          <p className="muted">{SPACE_INFO[space].hint}</p>
        )}
        {!bot && (
          <>
            {p.track === 'grind' && p.liabilities.length > 0 && p.cash >= 1000 && (
              <div className="spare">
                <div className="row">
                  <b>💳 Spare cash? Shrink your expenses</b>
                  <span className="small muted">Cash {money(p.cash)}</span>
                </div>
                <DebtList player={p} canAct dispatch={dispatch} limit={2} />
                <p className="small muted">
                  Keep a cushion for layoffs: one month of expenses is {money(totalExpenses(p))}. All debts are in your statement.
                </p>
              </div>
            )}
            <div className="actions">
              <button className="btn btn-primary" onClick={() => dispatch({ type: 'END_TURN' })}>Next turn → <kbd>Space</kbd></button>
            </div>
          </>
        )}
        {footer}
      </Card>
    )
  }

  const done = (label = 'Pass') =>
    !bot && (
      <button className="btn" onClick={() => dispatch({ type: 'DONE' })}>
        {label}
      </button>
    )

  switch (pend.type) {
    case 'chooseDeal':
      return (
        <Card tone="opportunity" kicker="Opportunity" title="Small deal or big deal?">
          <p className="muted">
            Small deals cost up to $5,000: stocks, starter rentals, side businesses. Big deals need $6,000 or more down,
            often with a loan.
          </p>
          <p className="small">
            Cash <b>{money(p.cash)}</b> · bank will lend <b>{money(maxBorrow(p))}</b>
          </p>
          {!bot && (
            <div className="actions">
              <button className="btn btn-primary" onClick={() => dispatch({ type: 'CHOOSE_DEAL', size: 'small' })}>Small deal <kbd>S</kbd></button>
              <button className="btn btn-primary" onClick={() => dispatch({ type: 'CHOOSE_DEAL', size: 'big' })}>Big deal <kbd>B</kbd></button>
            </div>
          )}
          {footer}
        </Card>
      )

    case 'deal': {
      const card = DEAL_CARDS[pend.cardId]
      return card.kind === 'stock' ? (
        <StockCard card={card} s={s} p={p} dispatch={dispatch} footer={footer} />
      ) : (
        <AssetCard card={card} p={p} dispatch={dispatch} footer={footer} deck={pend.deck} />
      )
    }

    case 'market': {
      const card = MARKET_BY_ID[pend.cardId]
      const offers = s.players.flatMap((pl) =>
        pl.isBot && pl.id !== p.id ? [] : marketEligible(card, pl).map((a) => ({ pl, a, price: marketOffer(card, a) })),
      )
      return (
        <Card tone="market" kicker="Market" title={card.title} lesson={card.lesson}>
          <p>{card.text}</p>
          {card.effect.type === 'buyer' && (
            <div className="offers">
              {offers.length === 0 && <p className="small muted">Nobody owns a matching asset this time.</p>}
              {offers.map(({ pl, a, price }) => {
                const net = price - a.debt
                return (
                  <div key={a.id} className="offer">
                    <div>
                      <div><span className="dot" style={{ background: pl.color }} /> {pl.name}: {a.name}</div>
                      <div className="small muted">
                        Offer {money(price)} − debt {money(a.debt)} = <b className={net >= 0 ? 'pos' : 'neg'}>{money(net)}</b> · loses {money(a.cashflow)}/mo
                      </div>
                    </div>
                    {(!pl.isBot) && (
                      <button className="btn btn-sm btn-primary" disabled={pl.cash + net < 0}
                        onClick={() => dispatch({ type: 'MARKET_SELL', playerId: pl.id, assetId: a.id })}>
                        Sell
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
          <div className="actions">{done(card.effect.type === 'buyer' ? 'Done' : 'OK')}</div>
          {footer}
        </Card>
      )
    }

    case 'splurge': {
      const card = SPLURGE_BY_ID[pend.cardId]
      const pay = Math.max(10, Math.round((card.cost * CARD_RATE) / 10) * 10)
      return (
        <Card tone="splurge" kicker="Splurge" title={card.title} lesson={card.lesson ?? 'Liabilities take money out of your pocket.'}>
          <p>{card.text}</p>
          <p className="price">{money(card.cost)}</p>
          {!bot && (
            <div className="actions">
              <button className="btn btn-primary" disabled={p.cash < card.cost} onClick={() => dispatch({ type: 'PAY_SPLURGE', method: 'cash' })}>
                Pay cash
              </button>
              <button className="btn" onClick={() => dispatch({ type: 'PAY_SPLURGE', method: 'credit' })}>
                Put on card (+{money(pay)}/mo)
              </button>
            </div>
          )}
          {footer}
        </Card>
      )
    }

    case 'life': {
      const card = LIFE_BY_ID[pend.cardId]
      const e = card.effect
      const tone = e.type === 'cash' ? (e.amount >= 0 ? 'good' : 'bad') : e.type === 'raise' ? 'good' : 'neutral'
      return (
        <Card tone={`life ${tone}`} kicker="Life" title={card.title} lesson={card.lesson}>
          <p>{card.text}</p>
          {pend.outcome && <p className="outcome">{pend.outcome}</p>}
          {!bot && e.type === 'gamble' && !pend.outcome ? (
            <div className="actions">
              <button className="btn btn-primary" disabled={p.cash < e.cost} onClick={() => dispatch({ type: 'LIFE_GAMBLE' })}>
                Invest {money(e.cost)} &amp; roll
              </button>
              {done('No thanks')}
            </div>
          ) : (
            <div className="actions">{done('OK')}</div>
          )}
          {footer}
        </Card>
      )
    }

    case 'learn':
      return (
        <Card tone="learn" kicker="Upskill" title="Invest in yourself" lesson="Your skills are an asset no market can take away.">
          <p>Take a certification course for {money(LEARN_COST)}. Your salary rises by {money(LEARN_RAISE)}/mo for good.</p>
          {!bot && (
            <div className="actions">
              <button className="btn btn-primary" disabled={p.cash < LEARN_COST} onClick={() => dispatch({ type: 'LEARN' })}>
                Take the course
              </button>
              {done('Skip')}
            </div>
          )}
          {footer}
        </Card>
      )

    case 'give':
      return (
        <Card tone="give" kicker="Give Back" title="Share your success" lesson="Generous people tend to attract opportunity.">
          <p>
            Donate {money(pend.amount)} to a cause you care about. For your next 3 turns you may roll{' '}
            {p.track === 'grind' ? '1 or 2 dice' : '1, 2 or 3 dice'}, so you can steer toward the spaces you want.
          </p>
          {!bot && (
            <div className="actions">
              <button className="btn btn-primary" disabled={p.cash < pend.amount} onClick={() => dispatch({ type: 'GIVE' })}>
                Donate {money(pend.amount)}
              </button>
              {done('Not now')}
            </div>
          )}
          {footer}
        </Card>
      )

    case 'info':
      return (
        <Card tone={pend.tone ?? 'neutral'} kicker="Heads up" title={pend.title}>
          {pend.text.split('\n\n').map((t, i) => <p key={i}>{t}</p>)}
          <div className="actions">{done('OK')}</div>
          {footer}
        </Card>
      )

    case 'escape':
      return <EscapeCard bot={bot} dispatch={dispatch} footer={footer} />

    case 'venture': {
      const card = VENTURE_BY_ID[pend.cardId]
      return (
        <Card tone="venture" kicker="Venture" title={card.title} lesson={card.lesson}>
          <p>{card.text}</p>
          <div className="figures">
            <Fig label="Cost" value={money(card.cost)} />
            {card.risky ? <Fig label="Payout" value={money(card.risky.payout)} tone="pos" /> : <Fig label="Cash flow" value={`+${money(card.cashflow)}`} tone="pos" />}
          </div>
          {pend.outcome && <p className="outcome">{pend.outcome}</p>}
          {!bot && !pend.outcome && (
            <div className="actions">
              <button className="btn btn-primary" disabled={p.cash < card.cost} onClick={() => dispatch({ type: 'BUY_VENTURE' })}>
                {card.risky ? `Take the bet (${money(card.cost)})` : `Buy for ${money(card.cost)}`}
              </button>
              {done('Pass')}
            </div>
          )}
          {pend.outcome && <div className="actions">{done('OK')}</div>}
          {footer}
        </Card>
      )
    }

    case 'setback': {
      const card = SETBACK_BY_ID[pend.cardId]
      return (
        <Card tone="bad" kicker="Setback" title={card.title} lesson={card.lesson}>
          <p>{card.text}</p>
          <p className="outcome">{pend.outcome}</p>
          <div className="actions">{done('OK')}</div>
          {footer}
        </Card>
      )
    }

    case 'dream': {
      const dream = DREAM_BY_ID[pend.dreamId]
      const mine = p.freedom?.dreamId === dream.id
      return (
        <Card tone="dream" kicker={mine ? 'Your dream!' : 'A dream'} title={`${dream.emoji} ${dream.title}`}>
          <p>{dream.text}</p>
          <p className="price">{money(dream.cost)}</p>
          {mine ? (
            !bot && (
              <div className="actions">
                <button className="btn btn-primary" disabled={p.cash < dream.cost} onClick={() => dispatch({ type: 'BUY_DREAM' })}>
                  Make it happen
                </button>
                {done('Not yet')}
              </div>
            )
          ) : (
            <>
              <p className="small muted">This is not your dream. Enjoy the view and keep building.</p>
              <div className="actions">{done('OK')}</div>
            </>
          )}
          {footer}
        </Card>
      )
    }
  }
}

/** What the other players did since this player's last turn. */
function Recap({ s, me }: { s: GameState; me: Player }) {
  const since = s.turn - (s.players.length - 1)
  const names = Object.fromEntries(s.players.map((x) => [x.id, x]))
  const items = s.log.filter((l) => l.turn >= since && l.turn < s.turn && l.turn > 0 && l.playerId !== me.id).slice(-4)
  if (!items.length) return null
  return (
    <ul className="events recap">
      {items.map((e, i) => (
        <li key={i} className={e.tone}>
          <span className="dot" style={{ background: names[e.playerId]?.color }} /> <b>{names[e.playerId]?.name}</b>: {e.text}
        </li>
      ))}
    </ul>
  )
}

function Card({ tone, kicker, title, lesson, children }: { tone: string; kicker: string; title: string; lesson?: string; children: React.ReactNode }) {
  return (
    <article className={`card card-${tone.split(' ')[0]} ${tone.split(' ')[1] ?? ''}`} aria-live="polite">
      <div className="card-kicker">{kicker}</div>
      <h2 className="card-title">{title}</h2>
      <div className="card-body">{children}</div>
      {lesson && <p className="lesson">💡 {lesson}</p>}
    </article>
  )
}

function Fig({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="fig">
      <span className="muted small">{label}</span>
      <b className={tone}>{value}</b>
    </div>
  )
}

function AssetCard({ card, p, dispatch, footer, deck }: { card: AssetDeal; p: Player; dispatch: (a: Action) => void; footer: React.ReactNode; deck: string }) {
  const loan = borrowNeeded(p, card.down)
  const canBorrow = loan > 0 && loan <= maxBorrow(p, card.cashflow)
  const roi = card.down > 0 ? (card.cashflow * 12) / card.down : 0
  const cfAfter = monthlyCashflow(p) + card.cashflow - loan * BANK_RATE
  return (
    <Card tone="opportunity" kicker={deck === 'big' ? 'Big deal' : 'Small deal'} title={card.title} lesson={card.lesson}>
      <p>{card.text}</p>
      <div className="figures">
        <Fig label="Price" value={money(card.cost)} />
        <Fig label="Down payment" value={money(card.down)} />
        {card.cost > card.down && <Fig label="Mortgage" value={money(card.cost - card.down)} />}
        <Fig label="Cash flow" value={`${money(card.cashflow, { sign: true })}/mo`} tone={card.cashflow > 0 ? 'pos' : card.cashflow < 0 ? 'neg' : undefined} />
        {card.cashflow !== 0 && <Fig label="Return on cash" value={`${Math.round(roi * 100)}%/yr`} tone={roi >= 0.2 ? 'pos' : roi < 0 ? 'neg' : undefined} />}
      </div>
      {!p.isBot && (
        <>
          {loan > 0 && (
            <p className="small muted">
              {canBorrow
                ? `You are ${money(card.down - p.cash)} short. Borrowing ${money(loan)} costs ${money(loan * BANK_RATE)}/mo, leaving a payday of ${money(cfAfter, { sign: true })}.`
                : `You are ${money(card.down - p.cash)} short, and the bank will not lend that much. Your cash flow is too low.`}
            </p>
          )}
          <div className="actions">
            {loan === 0 ? (
              <button className="btn btn-primary" onClick={() => dispatch({ type: 'BUY_ASSET' })}>Buy for {money(card.down)}</button>
            ) : (
              <button className="btn btn-primary" disabled={!canBorrow} onClick={() => dispatch({ type: 'BUY_ASSET', borrow: true })}>
                Borrow {money(loan)} &amp; buy
              </button>
            )}
            <button className="btn" onClick={() => dispatch({ type: 'DONE' })}>Pass</button>
          </div>
        </>
      )}
      {footer}
    </Card>
  )
}

function StockCard({ card, s, p, dispatch, footer }: { card: StockDeal; s: GameState; p: Player; dispatch: (a: Action) => void; footer: React.ReactNode }) {
  const [qty, setQty] = useState(100)
  useEffect(() => {
    setQty(100)
  }, [card.id])
  const t = TICKERS[card.ticker]
  const maxCash = Math.floor(p.cash / card.price)
  const cost = qty * card.price
  const loan = borrowNeeded(p, cost)
  const canBorrow = loan > 0 && loan <= maxBorrow(p)
  const holders = s.players.filter((pl) => !pl.isBot || pl.id === p.id).filter((pl) => pl.track === 'grind')
    .map((pl) => ({ pl, st: pl.assets.find((a) => a.kind === 'stock' && a.ticker === card.ticker) }))
    .filter((x) => x.st && x.st.shares)
  const [low, high] = card.range
  const pos = (card.price - low) / (high - low)
  return (
    <Card tone="opportunity" kicker={`Small deal · ${t.sector}`} title={card.title} lesson={card.lesson}>
      <p>{card.text}</p>
      <div className="range" aria-label={`Price within trading range ${money(low)} to ${money(high)}`}>
        <div className="range-bar"><span className="range-dot" style={{ left: `${Math.max(0, Math.min(1, pos)) * 100}%` }} /></div>
        <div className="range-labels small muted"><span>{money(low)} low</span><span>{money(card.price)} now</span><span>{money(high)} high</span></div>
      </div>
      {card.dividend && <p className="small">Pays {money(card.dividend * 100)} a month per 100 shares.</p>}
      {!p.isBot && (
        <div className="buybox">
          <label className="qty">
            <span className="small muted">Shares</span>
            <input type="number" inputMode="numeric" min={1} step={1} value={qty}
              onChange={(e) => setQty(Math.max(1, Math.floor(Number(e.target.value) || 1)))} />
          </label>
          <div className="chips">
            {[100, 500, 1000].map((n) => <button key={n} className="chip" onClick={() => setQty(n)}>{n.toLocaleString()}</button>)}
            {maxCash > 0 && <button className="chip" onClick={() => setQty(maxCash)}>Max {maxCash.toLocaleString()}</button>}
          </div>
          <div className="actions">
            {loan === 0 ? (
              <button className="btn btn-primary" onClick={() => dispatch({ type: 'BUY_STOCK', qty })}>Buy for {money(cost)}</button>
            ) : (
              <button className="btn btn-primary" disabled={!canBorrow} onClick={() => dispatch({ type: 'BUY_STOCK', qty, borrow: true })}
                title={canBorrow ? '' : 'The bank will not lend that much'}>
                Borrow {money(loan)} &amp; buy
              </button>
            )}
          </div>
        </div>
      )}
      {holders.length > 0 && (
        <div className="offers">
          <div className="small muted">Anyone holding {card.ticker} can sell at {money(card.price)}:</div>
          {holders.map(({ pl, st }) => {
            const gain = (card.price - (st!.avgPrice ?? 0)) * st!.shares!
            return (
              <div key={pl.id} className="offer">
                <div>
                  <div><span className="dot" style={{ background: pl.color }} /> {pl.name}: {st!.shares!.toLocaleString()} shares</div>
                  <div className="small muted">
                    Bought at {money(st!.avgPrice ?? 0)} · sell for {money(st!.shares! * card.price)} (
                    <span className={gain >= 0 ? 'pos' : 'neg'}>{money(gain, { sign: true })}</span>)
                  </div>
                </div>
                {!pl.isBot && (
                  <button className="btn btn-sm btn-primary" onClick={() => dispatch({ type: 'SELL_STOCK', playerId: pl.id, qty: st!.shares! })}>
                    Sell all
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
      {!p.isBot && (
        <div className="actions">
          <button className="btn" onClick={() => dispatch({ type: 'DONE' })}>Done</button>
        </div>
      )}
      {footer}
    </Card>
  )
}

function EscapeCard({ bot, dispatch, footer }: { bot: boolean; dispatch: (a: Action) => void; footer: React.ReactNode }) {
  return (
    <Card tone="dream" kicker="🎉 You escaped the Grind!" title="Choose your dream" lesson="Financial freedom: your money works so you do not have to.">
      <p>
        Your passive income now pays for your whole lifestyle. Welcome to Freedom Lane. Pick the dream you will chase. Win by
        landing on it with enough cash, or by growing your freedom payday by $50,000.
      </p>
      {!bot && (
        <div className="dreams">
          {DREAMS.map((d) => (
            <button key={d.id} className="dream-btn" onClick={() => dispatch({ type: 'PICK_DREAM', dreamId: d.id })}>
              <span className="dream-emoji">{d.emoji}</span>
              <span>
                <b>{d.title}</b>
                <span className="small muted"> {money(d.cost)}</span>
              </span>
            </button>
          ))}
        </div>
      )}
      {footer}
    </Card>
  )
}
