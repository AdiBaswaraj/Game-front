import { useParams } from 'react-router-dom'
import GameLayout from '../components/GameLayout'
import SnakeGame from '../games/snake/SnakeGame'
import SudokuGame from '../games/sudoku/SudokuGame'
import MinesweeperGame from '../games/minesweeper/MinesweeperGame'
import { games } from '../data/games'

const GAME_COMPONENTS = {
  snake: SnakeGame,
  sudoku: SudokuGame,
  minesweeper: MinesweeperGame,
}

export default function GamePage() {
  const { gameId } = useParams()
  const game = games.find((g) => g.id === gameId)
  const Component = GAME_COMPONENTS[gameId]

  const title = game?.name?.toUpperCase() ?? gameId?.toUpperCase() ?? 'GAME'
  const icon = game?.icon

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
