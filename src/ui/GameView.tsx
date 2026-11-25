import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import { SPACE_INFO, FREEDOM_BOARD, GRIND_BOARD } from '../game/board'
import { botAction } from '../game/bot'
import { DREAM_BY_ID, MARKET_BY_ID } from '../game/data/cards'
import { DEAL_CARDS } from '../game/data/deals'
import { professionById } from '../game/data/professions'
import { applyAction, currentPlayer, diceOptions, marketEligible, type Action } from '../game/engine'
import { FREEDOM_GOAL, compactMoney, freedomProgress, money, monthlyCashflow, netWorth, passiveIncome, totalExpenses } from '../game/finance'
import type { GameState, Player } from '../game/types'
import { ActionPanel } from './ActionPanel'
import { Board } from './Board'
import { Dice, Meter } from './bits'
import { Statement } from './Statement'
import { useAnimatedPositions } from './useAnimatedPositions'

type Tab = 'play' | 'money' | 'players' | 'log'

interface Props {
  game: GameState
  setGame: Dispatch<SetStateAction<GameState | null>>
  onMenu: () => void
  onHowTo: () => void
}

const BOT_DELAY = 750

function botStep(g: GameState): GameState {
  const a = botAction(g)
  let next = applyAction(g, a)
  if (next === g) next = applyAction(g, g.pending ? { type: 'DONE' } : { type: 'END_TURN' })
  if (next === g && g.pending?.type === 'splurge') next = applyAction(g, { type: 'PAY_SPLURGE', method: 'credit' })
  return next
}

/** True when a bot drew a card that a human (not on turn) could sell into. */
function humansCanReact(s: GameState) {
  const pend = s.pending
  const others = s.players.filter((p, i) => !p.isBot && i !== s.current && p.track === 'grind')
  if (!others.length || !pend) return false
  if (pend.type === 'deal') {
    const card = DEAL_CARDS[pend.cardId]
    return card.kind === 'stock' && others.some((p) => p.assets.some((a) => a.ticker === card.ticker))
  }
  if (pend.type === 'market') {
    const card = MARKET_BY_ID[pend.cardId]
    return others.some((p) => marketEligible(card, p).length > 0)
  }
  return false
}

export function GameView({ game: s, setGame, onMenu, onHowTo }: Props) {
  const dispatch = (a: Action) => setGame((g) => (g ? applyAction(g, a) : g))
  const cur = currentPlayer(s)
  const { shown, moving } = useAnimatedPositions(s.players)
  const wide = useMediaQuery('(min-width: 1180px)')
  const [tab, setTab] = useState<Tab>('play')
  const [sideTab, setSideTab] = useState<Exclude<Tab, 'play'>>('money')
  const [viewId, setViewId] = useState<string | null>(null)
  const [ackKey, setAckKey] = useState<string | null>(null)
  const pendingKey = `${s.turn}:${s.current}:${JSON.stringify(s.pending)}`
  const waitingForHumans = cur.isBot && humansCanReact(s) && ackKey !== pendingKey

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  // Follow the current player's statement unless the user picked someone else this turn.
  useEffect(() => {
    setViewId(null)
  }, [s.current])
  const viewed = s.players.find((p) => p.id === viewId) ?? (cur.isBot ? s.players.find((p) => !p.isBot) ?? cur : cur)

  // Drive computer players.
  useEffect(() => {
    if (!cur.isBot || s.phase === 'gameover' || moving || waitingForHumans) return
    const t = setTimeout(() => setGame((g) => (g ? botStep(g) : g)), BOT_DELAY)
    return () => clearTimeout(t)
  }, [s, cur.isBot, moving, waitingForHumans, setGame])

  // Keyboard shortcuts for desktop: Space rolls / ends the turn, S and B pick a deal size.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (cur.isBot || moving || s.phase === 'gameover') return
      const k = e.key.toLowerCase()
      let a: Action | null = null
      if ((k === ' ' || k === 'enter') && !s.pending) {
        if (s.phase === 'roll') {
          const opts = diceOptions(cur)
          a = { type: 'ROLL', dice: opts[opts.length - 1] }
        } else if (s.phase === 'end') a = { type: 'END_TURN' }
      } else if (s.pending?.type === 'chooseDeal' && (k === 's' || k === 'b')) {
        a = { type: 'CHOOSE_DEAL', size: k === 's' ? 'small' : 'big' }
      } else if (s.phase === 'roll' && !s.pending && ['1', '2', '3'].includes(k) && diceOptions(cur).includes(Number(k))) {
        a = { type: 'ROLL', dice: Number(k) }
      }
      if (a) {
        e.preventDefault()
        dispatch(a)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // A little haptic tick on mobile when dice land.
  const rollKey = `${s.turn}:${s.current}:${s.lastRoll?.join(',') ?? ''}`
  useEffect(() => {
    if (s.lastRoll && !cur.isBot) navigator.vibrate?.(15)
  }, [rollKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const track = cur.track
  const pos = track === 'grind' ? cur.position : (cur.freedom?.position ?? 0)
  const space = track === 'grind' ? GRIND_BOARD[pos] : FREEDOM_BOARD[pos]
  const canAct = !cur.isBot && viewed.id === cur.id && s.phase !== 'gameover'

  const center = (
    <div className="center">
      <div className="center-track">{track === 'grind' ? 'The Grind' : 'Freedom Lane'}</div>
      <div className="center-player">
        <span className="dot" style={{ background: cur.color }} /> {cur.name}
        {cur.isBot && <span className="tag">bot</span>}
      </div>
      <Dice values={s.lastRoll ?? []} rollKey={rollKey} />
      {!moving && s.phase !== 'roll' && (
        <div className="center-space">
          {SPACE_INFO[space].icon} {SPACE_INFO[space].label}
        </div>
      )}
      <div className="center-meter">
        {cur.track === 'grind' ? (
          <>
            <Meter value={freedomProgress(cur)} label="Freedom meter" />
            <span className="small muted">{compactMoney(passiveIncome(cur))} of {compactMoney(totalExpenses(cur))} · {Math.round(freedomProgress(cur) * 100)}% free</span>
          </>
        ) : (
          <>
            <Meter value={(cur.freedom!.cashflow - cur.freedom!.startCashflow) / FREEDOM_GOAL} tone="purple" label="Freedom goal" />
            <span className="small muted">{DREAM_BY_ID[cur.freedom!.dreamId].emoji} {compactMoney(cur.cash)} cash</span>
          </>
        )}
      </div>
    </div>
  )

  const panel = (
    <ActionPanel
      state={s}
      dispatch={dispatch}
      moving={moving}
      waitingForHumans={waitingForHumans}
      onContinueBot={() => setAckKey(pendingKey)}
    />
  )

  // On wide screens the statement gets its own column, so the right column only switches Log / Players.
  const deskTab = wide && sideTab === 'money' ? 'log' : sideTab

  const sideContent = (t: Exclude<Tab, 'play'>) =>
    t === 'money' ? (
      <>
        <PlayerSwitch players={s.players} viewed={viewed} onPick={setViewId} />
        <Statement player={viewed} canAct={canAct} dispatch={dispatch} />
      </>
    ) : t === 'players' ? (
      <PlayersPanel s={s} onPick={(id) => { setViewId(id); setSideTab('money'); setTab('money') }} />
    ) : (
      <LogPanel s={s} />
    )

  return (
    <div className="game">
      <header className="topbar">
        <button className="brand" onClick={onMenu} title="Menu">
          <span className="logo sm" aria-hidden><img src="./favicon.svg" alt="" /></span>
          <span className="brand-name">Exit the Grind</span>
        </button>
        <div className="chips-row">
          {s.players.map((p) => (
            <button key={p.id} className={`pchip${p.id === cur.id ? ' on' : ''}`} onClick={() => { setViewId(p.id); setSideTab('money'); setTab('money') }}>
              <span className="dot" style={{ background: p.color }} />
              <span className="pchip-name">{p.name}</span>
              <span className="pchip-cash">{compactMoney(p.cash)}</span>
              <span className="pchip-meter">
                <Meter value={p.track === 'grind' ? freedomProgress(p) : 1} tone={p.track === 'grind' ? 'green' : 'purple'} />
              </span>
            </button>
          ))}
        </div>
        <div className="top-actions">
          <button className="icon-btn" onClick={onHowTo} aria-label="How to play">?</button>
          <button className="icon-btn" onClick={onMenu} aria-label="Menu">☰</button>
        </div>
      </header>

      <main className={`layout tab-${tab}${wide ? ' wide' : ''}`}>
        {wide && (
          <aside className="statement-col" aria-label="Financial statement">
            <PlayerSwitch players={s.players} viewed={viewed} onPick={setViewId} />
            <Statement player={viewed} canAct={canAct} dispatch={dispatch} />
          </aside>
        )}
        <section className="board-col">
          <Board track={track} players={s.players} shown={shown} currentId={cur.id} myDreamId={cur.freedom?.dreamId}>
            {center}
          </Board>
          <div className="panel-mobile">{panel}</div>
        </section>
        <aside className="side-col">
          <div className="panel-desktop">{panel}</div>
          <nav className="side-tabs" role="tablist">
            {(wide ? (['log', 'players'] as const) : (['money', 'players', 'log'] as const)).map((t) => (
              <button key={t} role="tab" aria-selected={deskTab === t} className={deskTab === t ? 'on' : ''} onClick={() => setSideTab(t)}>
                {t === 'money' ? 'Statement' : t === 'players' ? 'Players' : 'Log'}
              </button>
            ))}
          </nav>
          <div className="side-body side-desktop">{sideContent(deskTab)}</div>
          <div className="side-body side-mobile">{tab !== 'play' && sideContent(tab)}</div>
        </aside>
      </main>

      <nav className="tabbar" role="tablist">
        {([
          ['play', '🎲', 'Play'],
          ['money', '📊', 'Statement'],
          ['players', '👥', 'Players'],
          ['log', '📜', 'Log'],
        ] as const).map(([t, icon, label]) => (
          <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
            <span aria-hidden>{icon}</span>
            <span>{label}</span>
          </button>
        ))}
      </nav>

      {s.phase === 'gameover' && <GameOver s={s} onMenu={onMenu} />}
    </div>
  )
}

function PlayerSwitch({ players, viewed, onPick }: { players: Player[]; viewed: Player; onPick: (id: string) => void }) {
  if (players.length < 2) return null
  return (
    <div className="pswitch">
      {players.map((p) => (
        <button key={p.id} className={`chip${p.id === viewed.id ? ' chip-on' : ''}`} onClick={() => onPick(p.id)}>
          <span className="dot" style={{ background: p.color }} /> {p.name}
        </button>
      ))}
    </div>
  )
}

function PlayersPanel({ s, onPick }: { s: GameState; onPick: (id: string) => void }) {
  return (
    <div className="players-list">
      {s.players.map((p, i) => {
        const prof = professionById(p.professionId)
        return (
          <button key={p.id} className={`player-row${i === s.current ? ' on' : ''}`} onClick={() => onPick(p.id)}>
            <div className="row">
              <span><span className="dot" style={{ background: p.color }} /> <b>{p.name}</b> {p.isBot && <span className="tag">bot</span>}</span>
              <span className="small muted">{prof.emoji} {prof.title}</span>
            </div>
            {p.track === 'grind' ? (
              <>
                <Meter value={freedomProgress(p)} />
                <div className="row small muted">
                  <span>Cash {money(p.cash)}</span>
                  <span>Payday {money(monthlyCashflow(p), { sign: true })}</span>
                  <span>{Math.round(freedomProgress(p) * 100)}% free</span>
                </div>
              </>
            ) : (
              <>
                <Meter value={(p.freedom!.cashflow - p.freedom!.startCashflow) / FREEDOM_GOAL} tone="purple" />
                <div className="row small muted">
                  <span>Cash {money(p.cash)}</span>
                  <span>Freedom payday {money(p.freedom!.cashflow)}</span>
                  <span>{DREAM_BY_ID[p.freedom!.dreamId].emoji}</span>
                </div>
              </>
            )}
            {p.skipTurns > 0 && <div className="small neg">Sitting out {p.skipTurns} turn{p.skipTurns > 1 ? 's' : ''}</div>}
          </button>
        )
      })}
    </div>
  )
}

function LogPanel({ s }: { s: GameState }) {
  const byId = useMemo(() => Object.fromEntries(s.players.map((p) => [p.id, p])), [s.players])
  const entries = [...s.log].reverse().slice(0, 120)
  return (
    <ul className="log">
      {entries.map((e, i) => (
        <li key={i} className={e.tone}>
          <span className="dot" style={{ background: byId[e.playerId]?.color }} />
          <span className="log-turn">T{e.turn}</span>
          <span>{e.text}</span>
        </li>
      ))}
    </ul>
  )
}

function GameOver({ s, onMenu }: { s: GameState; onMenu: () => void }) {
  const winner = s.players.find((p) => p.id === s.winnerId)
  const [hidden, setHidden] = useState(false)
  if (hidden) {
    return (
      <button className="btn btn-primary gameover-pill" onClick={() => setHidden(false)}>🏆 Results</button>
    )
  }
  return (
    <div className="modal-backdrop">
      <div className="modal gameover" role="dialog" aria-modal="true">
        <div className="confetti" aria-hidden>🎉</div>
        <h2>{winner ? `${winner.name} wins!` : 'Game over'}</h2>
        {winner && <p>{winner.name} {s.winReason}</p>}
        <p className="muted small">Finished in {s.turn} turns.</p>
        <table className="results">
          <thead>
            <tr><th>Player</th><th>Status</th><th>Passive</th><th>Net worth</th></tr>
          </thead>
          <tbody>
            {s.players.map((p) => (
              <tr key={p.id}>
                <td><span className="dot" style={{ background: p.color }} /> {p.name}</td>
                <td>{p.track === 'freedom' ? 'Free' : `${Math.round(freedomProgress(p) * 100)}%`}</td>
                <td>{p.track === 'freedom' ? `${compactMoney(p.freedom!.cashflow)}/pd` : `${compactMoney(passiveIncome(p))}/mo`}</td>
                <td>{compactMoney(netWorth(p))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="actions">
          <button className="btn btn-primary" onClick={onMenu}>New game</button>
          <button className="btn" onClick={() => setHidden(true)}>Look at the board</button>
        </div>
      </div>
    </div>
  )
}

function useMediaQuery(query: string) {
  const [match, setMatch] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const on = () => setMatch(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [query])
  return match
}
