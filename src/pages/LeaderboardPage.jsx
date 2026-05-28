import { useState } from 'react'
import { Link } from 'react-router-dom'
import Leaderboard from '../components/Leaderboard'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

const GAMES = [
  {
    id: 'snake',
    name: 'Snake',
    icon: '🐍',
    scoreFormat: 'points',
    lowerIsBetter: false,
  },
  {
    id: 'sudoku',
    name: 'Sudoku',
    icon: '🔢',
    scoreFormat: 'time',
    lowerIsBetter: true,
    difficulties: ['easy', 'medium', 'hard'],
  },
  {
    id: 'word-puzzle',
    name: 'Word Puzzle',
    icon: '🔤',
    scoreFormat: 'guesses',
    lowerIsBetter: true,
  },
  {
    id: 'minesweeper',
    name: 'Minesweeper',
    icon: '💣',
    scoreFormat: 'time',
    lowerIsBetter: true,
    difficulties: ['easy', 'medium', 'hard'],
  },
]

export default function LeaderboardPage() {
  const [game, setGame] = useState(GAMES[0])
  const [diff, setDiff] = useState('easy')
  useDocumentTitle('Hall of Fame')

  const boardGameId = game.difficulties ? `${game.id}-${diff}` : game.id
  const title = game.difficulties
    ? `${game.name.toUpperCase()} · ${diff.toUpperCase()}`
    : game.name.toUpperCase()

  return (
    <div className="scanlines route-fade-in relative min-h-screen bg-arcadia-bg text-white">
      <header className="sticky top-0 z-30 border-b border-neon-green/30 bg-arcadia-bg/85 shadow-[0_1px_0_0_rgba(0,255,136,0.2)] backdrop-blur-md">
        <div className="mx-auto grid max-w-7xl grid-cols-[1fr_auto_1fr] items-center px-4 py-4 md:px-8">
          <Link
            to="/"
            className="flex items-center gap-2 justify-self-start font-arcade text-[10px] text-neon-cyan transition hover:text-neon-green md:text-xs"
          >
            <span aria-hidden="true">◀</span>
            LOBBY
          </Link>
          <h1 className="justify-self-center font-arcade text-sm text-neon-green drop-shadow-[0_0_8px_rgba(0,255,136,0.4)] md:text-lg">
            <span className="mr-2">🏆</span>
            HALL OF FAME
          </h1>
          <span className="justify-self-end" />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 md:px-8 md:py-12">
        <div className="flex flex-wrap items-center justify-center gap-2">
          {GAMES.map((g) => {
            const active = g.id === game.id
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => {
                  setGame(g)
                  setDiff('easy')
                }}
                className={`rounded-md border px-3 py-1.5 font-arcade text-[10px] transition ${
                  active
                    ? 'border-neon-cyan/70 bg-neon-cyan/10 text-neon-cyan shadow-neon-cyan'
                    : 'border-white/15 text-white/60 hover:text-neon-cyan'
                }`}
              >
                <span className="mr-1.5">{g.icon}</span>
                {g.name.toUpperCase()}
              </button>
            )
          })}
        </div>

        {game.difficulties && (
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            {game.difficulties.map((d) => {
              const active = d === diff
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDiff(d)}
                  className={`rounded-md border px-3 py-1 font-arcade text-[9px] transition ${
                    active
                      ? 'border-neon-green/70 bg-neon-green/10 text-neon-green'
                      : 'border-white/10 text-white/45 hover:text-white'
                  }`}
                >
                  {d.toUpperCase()}
                </button>
              )
            })}
          </div>
        )}

        <div className="mt-8 lb-slide-in" key={boardGameId}>
          <Leaderboard
            gameId={boardGameId}
            scoreFormat={game.scoreFormat}
            lowerIsBetter={game.lowerIsBetter}
            title={title}
            max={10}
          />
        </div>
      </main>
    </div>
  )
}
