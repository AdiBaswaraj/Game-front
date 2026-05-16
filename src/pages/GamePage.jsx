import { useParams, useSearchParams } from 'react-router-dom'
import GameLayout from '../components/GameLayout'
import DifficultySelect from '../components/DifficultySelect'
import SnakeGame from '../games/snake/SnakeGame'
import SudokuGame from '../games/sudoku/SudokuGame'
import MinesweeperGame from '../games/minesweeper/MinesweeperGame'
import WordPuzzleGame from '../games/word-puzzle/WordPuzzleGame'
import WordPuzzleModeSelect from '../games/word-puzzle/WordPuzzleModeSelect'
import WordPuzzleLengthSelect from '../games/word-puzzle/WordPuzzleLengthSelect'
import WordPuzzleBattle from '../games/word-puzzle/WordPuzzleBattle'
import SnakeAndLadderGame from '../games/snake-and-ladder/SnakeAndLadderGame'
import ChessModeSelect from '../games/chess/ChessModeSelect'
import ChessDifficultySelect from '../games/chess/ChessDifficultySelect'
import ChessGame from '../games/chess/ChessGame'
import { games } from '../data/games'

const SIMPLE_GAMES = {
  snake: SnakeGame,
}

const DIFFICULTY_GAMES = {
  sudoku: SudokuGame,
  minesweeper: MinesweeperGame,
}

const VALID_DIFFICULTIES = new Set(['easy', 'medium', 'hard'])
const VALID_WP_LENGTHS = new Set(['4', '5', '6'])

export default function GamePage() {
  const { gameId, difficulty, variant } = useParams()
  const [searchParams] = useSearchParams()
  const room = searchParams.get('room')

  const game = games.find((g) => g.id === gameId)
  const title = game?.name?.toUpperCase() ?? gameId?.toUpperCase() ?? 'GAME'
  const icon = game?.icon

  // ===== Chess =====
  if (gameId === 'chess') {
    if (room) {
      return (
        <GameLayout
          title={`${title} · BATTLE`}
          icon={icon}
          backTo="/"
          backLabel="LOBBY"
        >
          <ChessGame mode="multiplayer" roomCode={room} />
        </GameLayout>
      )
    }
    if (!difficulty) return <ChessModeSelect />
    if (difficulty === 'computer') {
      if (!variant) return <ChessDifficultySelect />
      if (!VALID_DIFFICULTIES.has(variant)) return <ChessDifficultySelect />
      return (
        <GameLayout
          title={`${title} · CPU · ${variant.toUpperCase()}`}
          icon={icon}
          backTo="/game/chess/computer"
          backLabel="DIFFICULTY"
        >
          <ChessGame mode="computer" difficulty={variant} />
        </GameLayout>
      )
    }
    return <ChessModeSelect />
  }

  // ===== Snake & Ladder =====
  if (gameId === 'snake-and-ladder') {
    if (!room) {
      return (
        <GameLayout title={title} icon={icon}>
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <p className="font-arcade text-sm text-neon-pink">
              No room joined.
            </p>
            <p className="text-xs text-white/50">
              Create or join a Snake &amp; Ladder room from the lobby.
            </p>
          </div>
        </GameLayout>
      )
    }
    return (
      <GameLayout
        title={`${title} · BATTLE`}
        icon={icon}
        backTo="/"
        backLabel="LOBBY"
      >
        <SnakeAndLadderGame roomCode={room} />
      </GameLayout>
    )
  }

  // ===== Word Puzzle =====
  if (gameId === 'word-puzzle') {
    if (room) {
      return (
        <GameLayout
          title={`${title} · BATTLE`}
          icon={icon}
          backTo="/"
          backLabel="LOBBY"
        >
          <WordPuzzleBattle roomCode={room} />
        </GameLayout>
      )
    }
    if (!difficulty) return <WordPuzzleModeSelect />
    if (difficulty === 'daily') {
      return (
        <GameLayout
          title={`${title} · DAILY`}
          icon={icon}
          backTo="/game/word-puzzle"
          backLabel="MODE"
        >
          <WordPuzzleGame mode="daily" length={5} />
        </GameLayout>
      )
    }
    if (difficulty === 'free') {
      if (!variant) return <WordPuzzleLengthSelect />
      if (!VALID_WP_LENGTHS.has(variant)) return <WordPuzzleLengthSelect />
      const len = Number(variant)
      return (
        <GameLayout
          title={`${title} · FREE ${len}`}
          icon={icon}
          backTo="/game/word-puzzle/free"
          backLabel="LENGTH"
        >
          <WordPuzzleGame mode="free" length={len} />
        </GameLayout>
      )
    }
    return <WordPuzzleModeSelect />
  }

  // ===== Sudoku / Minesweeper (difficulty games) =====
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

  // ===== Simple single-player =====
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
