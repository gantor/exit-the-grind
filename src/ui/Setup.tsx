import { useState } from 'react'
import { PROFESSIONS } from '../game/data/professions'
import { PLAYER_COLORS, createPlayer } from '../game/engine'
import { money, monthlyCashflow, totalExpenses } from '../game/finance'
import type { PlayerSetup, Settings } from '../game/types'

interface Props {
  hasSave: boolean
  onResume: () => void
  onStart: (players: PlayerSetup[], settings: Settings) => void
  onHowTo: () => void
}

const BOT_NAMES = ['Ava', 'Marcus', 'Priya', 'Diego', 'Kenji']
const randomProf = () => PROFESSIONS[Math.floor(Math.random() * PROFESSIONS.length)].id

export function Setup({ hasSave, onResume, onStart, onHowTo }: Props) {
  const [players, setPlayers] = useState<PlayerSetup[]>([{ name: '', professionId: randomProf(), isBot: false }])
  const [mode, setMode] = useState<Settings['mode']>('full')
  const [picking, setPicking] = useState<number | null>(0)

  const update = (i: number, patch: Partial<PlayerSetup>) =>
    setPlayers((ps) => ps.map((p, j) => (j === i ? { ...p, ...patch } : p)))

  const add = (isBot: boolean) =>
    setPlayers((ps) =>
      ps.length >= 6
        ? ps
        : [...ps, { name: isBot ? BOT_NAMES[ps.filter((p) => p.isBot).length % BOT_NAMES.length] : '', professionId: randomProf(), isBot }],
    )

  return (
    <div className="setup">
      <header className="hero">
        <div className="logo" aria-hidden><img src="./favicon.svg" alt="" /></div>
        <h1>Exit the Grind</h1>
        <p className="tagline">A game about making money work for you. Build passive income, escape the paycheck loop, and chase your dream.</p>
        <div className="hero-actions">
          {hasSave && <button className="btn btn-primary btn-lg" onClick={onResume}>Resume game</button>}
          <button className="btn btn-ghost" onClick={onHowTo}>How to play</button>
        </div>
      </header>

      <section className="how">
        <div className="how-step"><span>1</span><div><b>Start in the Grind.</b> A job, bills, and a little cash.</div></div>
        <div className="how-step"><span>2</span><div><b>Buy assets.</b> Stocks, rentals and businesses that pay you monthly.</div></div>
        <div className="how-step"><span>3</span><div><b>Escape.</b> When passive income beats expenses, you are free.</div></div>
      </section>

      <section className="panel">
        <h2>Players</h2>
        <div className="players-setup">
          {players.map((pl, i) => {
            const preview = createPlayer(pl, i)
            const prof = PROFESSIONS.find((x) => x.id === pl.professionId)!
            return (
              <div key={i} className="setup-player">
                <div className="setup-row">
                  <span className="dot lg" style={{ background: PLAYER_COLORS[i] }} />
                  <input
                    className="name-input"
                    placeholder={pl.isBot ? 'Computer name' : `Player ${i + 1} name`}
                    value={pl.name}
                    maxLength={16}
                    onChange={(e) => update(i, { name: e.target.value })}
                  />
                  <button className={`chip${pl.isBot ? ' chip-on' : ''}`} onClick={() => update(i, { isBot: !pl.isBot })} title="Toggle computer player">
                    {pl.isBot ? '🤖 Computer' : '🙂 Human'}
                  </button>
                  {players.length > 1 && (
                    <button className="icon-btn" aria-label="Remove player" onClick={() => setPlayers((ps) => ps.filter((_, j) => j !== i))}>✕</button>
                  )}
                </div>
                <button className="prof-summary" onClick={() => setPicking(picking === i ? null : i)}>
                  <span className="prof-emoji">{prof.emoji}</span>
                  <span>
                    <b>{prof.title}</b>
                    <span className="small muted"> · salary {money(prof.salary)} · expenses {money(totalExpenses(preview))} · payday {money(monthlyCashflow(preview), { sign: true })}</span>
                  </span>
                  <span className="muted small">{picking === i ? 'Close' : 'Change'}</span>
                </button>
                {picking === i && (
                  <div className="prof-grid">
                    {PROFESSIONS.map((pr) => {
                      const pp = createPlayer({ ...pl, professionId: pr.id }, i)
                      return (
                        <button
                          key={pr.id}
                          className={`prof-card${pr.id === pl.professionId ? ' selected' : ''}`}
                          onClick={() => { update(i, { professionId: pr.id }); setPicking(null) }}
                        >
                          <span className="prof-emoji">{pr.emoji}</span>
                          <b>{pr.title}</b>
                          <span className="small muted">{pr.blurb}</span>
                          <span className="small">Salary {money(pr.salary)}</span>
                          <span className="small">Expenses {money(totalExpenses(pp))}</span>
                          <span className="small pos">Payday {money(monthlyCashflow(pp), { sign: true })}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        {players.length < 6 && (
          <div className="actions">
            <button className="btn" onClick={() => add(false)}>+ Human player</button>
            <button className="btn" onClick={() => add(true)}>+ Computer player</button>
          </div>
        )}
      </section>

      <section className="panel">
        <h2>Game length</h2>
        <div className="modes">
          <button className={`mode${mode === 'full' ? ' selected' : ''}`} onClick={() => setMode('full')}>
            <b>Full game</b>
            <span className="small muted">Escape the Grind, then win on Freedom Lane by reaching your dream or adding $50k to your payday.</span>
          </button>
          <button className={`mode${mode === 'quick' ? ' selected' : ''}`} onClick={() => setMode('quick')}>
            <b>Quick game</b>
            <span className="small muted">First player to escape the Grind wins.</span>
          </button>
        </div>
      </section>

      <div className="start-bar">
        <button className="btn btn-primary btn-lg" onClick={() => onStart(players, { mode })}>
          {hasSave ? 'Start new game' : 'Start game'}
        </button>
        {hasSave && <p className="small muted">Starting a new game replaces your saved game.</p>}
      </div>

      <footer className="credit small muted">
        An original learning game about money: assets, liabilities and passive income. Made for fun and education, not financial advice.
      </footer>
    </div>
  )
}
