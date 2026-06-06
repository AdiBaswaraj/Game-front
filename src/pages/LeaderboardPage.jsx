import { useState } from 'react'
import Leaderboard from '../components/Leaderboard'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import {
  MinesweeperIcon,
  SnakeIcon,
  SudokuIcon,
  WordPuzzleIcon,
} from '../assets/icons/index.jsx'

const GAMES = [
  {
    id: 'snake',
    name: 'Snake',
    Icon: SnakeIcon,
    scoreFormat: 'points',
    lowerIsBetter: false,
  },
  {
    id: 'sudoku',
    name: 'Sudoku',
    Icon: SudokuIcon,
    scoreFormat: 'time',
    lowerIsBetter: true,
    difficulties: ['easy', 'medium', 'hard'],
  },
  {
    id: 'word-puzzle',
    name: 'Word Puzzle',
    Icon: WordPuzzleIcon,
    scoreFormat: 'guesses',
    lowerIsBetter: true,
  },
  {
    id: 'minesweeper',
    name: 'Minesweeper',
    Icon: MinesweeperIcon,
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
    <div className="relative min-h-screen text-white" style={{ paddingTop: 60 }}>
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
                className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 font-arcade text-[10px] transition ${
                  active
                    ? 'border-neon-cyan/70 bg-neon-cyan/10 text-neon-cyan shadow-neon-cyan'
                    : 'border-white/15 text-white/60 hover:text-neon-cyan'
                }`}
              >
                <g.Icon size={16} aria-hidden="true" />
                <span>{g.name.toUpperCase()}</span>
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
