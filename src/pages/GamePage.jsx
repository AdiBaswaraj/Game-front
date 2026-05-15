import { useParams } from 'react-router-dom'
import GameLayout from '../components/GameLayout'
import DifficultySelect from '../components/DifficultySelect'
import SnakeGame from '../games/snake/SnakeGame'
import SudokuGame from '../games/sudoku/SudokuGame'
import MinesweeperGame from '../games/minesweeper/MinesweeperGame'
import WordPuzzleGame from '../games/word-puzzle/WordPuzzleGame'
import { games } from '../data/games'

const SIMPLE_GAMES = {
  snake: SnakeGame,
  'word-puzzle': WordPuzzleGame,
}

const DIFFICULTY_GAMES = {
  sudoku: SudokuGame,
  minesweeper: MinesweeperGame,
}

const VALID_DIFFICULTIES = new Set(['easy', 'medium', 'hard'])

export default function GamePage() {
  const { gameId, difficulty } = useParams()
  const game = games.find((g) => g.id === gameId)
  const title = game?.name?.toUpperCase() ?? gameId?.toUpperCase() ?? 'GAME'
  const icon = game?.icon

  if (gameId in DIFFICULTY_GAMES) {
    if (!difficulty || !VALID_DIFFICULTIES.has(difficulty)) {
      return <DifficultySelect title={title} icon={icon} gameId={gameId} />
    }
    const Component = DIFFICULTY_GAMES[gameId]
    return (
      <GameLayout
        title={`${title} · ${difficulty.toUpperCase()}`}
        icon={icon}
        backTo={`/game/${gameId}/difficulty`}
        backLabel="DIFFICULTY"
      >
        <Component difficulty={difficulty} />
      </GameLayout>
    )
  }

  const Component = SIMPLE_GAMES[gameId]
  return (
    <GameLayout title={title} icon={icon}>
      {Component ? (
        <Component />
      ) : (
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <p className="font-arcade text-sm text-neon-pink">COMING SOON</p>
          <p className="text-sm text-white/50">
            This cabinet hasn't been wired up yet.
          </p>
        </div>
      )}
    </GameLayout>
  )
}
