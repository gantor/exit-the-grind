import { useEffect, useState } from 'react'
import { createGame } from './game/engine'
import { newSeed } from './game/rng'
import type { GameState } from './game/types'
import { GameView } from './ui/GameView'
import { HowToPlay } from './ui/HowToPlay'
import { Setup } from './ui/Setup'
import { loadGame, saveGame } from './ui/storage'

export default function App() {
  const [saved] = useState(() => loadGame())
  const [game, setGame] = useState<GameState | null>(null)
  const [hasSave, setHasSave] = useState(!!saved && saved.phase !== 'gameover')
  const [howTo, setHowTo] = useState(false)

  useEffect(() => {
    if (game) {
      saveGame(game.phase === 'gameover' ? null : game)
      setHasSave(game.phase !== 'gameover')
    }
  }, [game])

  return (
    <>
      {game ? (
        <GameView game={game} setGame={setGame} onMenu={() => setGame(null)} onHowTo={() => setHowTo(true)} />
      ) : (
        <Setup
          hasSave={hasSave}
          onResume={() => setGame(loadGame())}
          onStart={(players, settings) => setGame(createGame(players, settings, newSeed()))}
          onHowTo={() => setHowTo(true)}
        />
      )}
      {howTo && <HowToPlay onClose={() => setHowTo(false)} />}
    </>
  )
}
