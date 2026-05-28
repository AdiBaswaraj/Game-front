import { lazy } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import GameLayout from '../components/GameLayout'
import DifficultySelect from '../components/DifficultySelect'
import GameErrorBoundary from '../components/GameErrorBoundary'
import ModeSelect from '../components/ModeSelect'
import MatchmakingScreen from './MatchmakingScreen'
import PrivateRoomScreen from './PrivateRoomScreen'
import WordPuzzleModeSelect from '../games/word-puzzle/WordPuzzleModeSelect'
import WordPuzzleLengthSelect from '../games/word-puzzle/WordPuzzleLengthSelect'
import SnakeAndLadderLocalSelect from '../games/snake-and-ladder/SnakeAndLadderLocalSelect'
import ChessDifficultySelect from '../games/chess/ChessDifficultySelect'
import { games } from '../data/games'

const SnakeGame = lazy(() => import('../games/snake/SnakeGame'))
const SudokuGame = lazy(() => import('../games/sudoku/SudokuGame'))
const MinesweeperGame = lazy(() =>
  import('../games/minesweeper/MinesweeperGame'),
)
const WordPuzzleGame = lazy(() =>
  import('../games/word-puzzle/WordPuzzleGame'),
)
const WordPuzzleBattle = lazy(() =>
  import('../games/word-puzzle/WordPuzzleBattle'),
)
const SnakeAndLadderGame = lazy(() =>
  import('../games/snake-and-ladder/SnakeAndLadderGame'),
)
const SnakeAndLadderLocalGame = lazy(() =>
  import('../games/snake-and-ladder/SnakeAndLadderLocalGame'),
)
const ChessGame = lazy(() => import('../games/chess/ChessGame'))

const SIMPLE_GAMES = {
  snake: SnakeGame,
}

const DIFFICULTY_GAMES = {
  sudoku: SudokuGame,
  minesweeper: MinesweeperGame,
}

const VALID_DIFFICULTIES = new Set(['easy', 'medium', 'hard'])
const VALID_WP_LENGTHS = new Set(['4', '5', '6'])

const CHESS_CARDS = [
  {
    id: 'computer',
    to: '/game/chess/computer',
    label: 'VS COMPUTER',
    icon: '🤖',
    accent: 'cyan',
    tag: 'Play against Stockfish AI',
    subItems: ['Easy', 'Medium', 'Hard'],
  },
  {
    id: 'matchmaking',
    to: '/game/chess/matchmaking',
    label: 'QUICK MATCH',
    icon: '⚡',
    accent: 'green',
    tag: 'Auto-match with a random opponent',
  },
  {
    id: 'room',
    to: '/game/chess/room',
    label: 'PRIVATE ROOM',
    icon: '🚪',
    accent: 'pink',
    tag: 'Play with a friend using a room code',
  },
]

const SL_CARDS = [
  {
    id: 'computer',
    to: '/game/snake-and-ladder/computer',
    label: 'VS COMPUTER',
    icon: '🤖',
    accent: 'cyan',
    tag: 'Pick 2–4 players · CPU fills the rest',
  },
  {
    id: 'matchmaking',
    to: '/game/snake-and-ladder/matchmaking',
    label: 'QUICK MATCH',
    icon: '⚡',
    accent: 'green',
    tag: 'Auto-match with a random opponent',
  },
  {
    id: 'room',
    to: '/game/snake-and-ladder/room',
    label: 'PRIVATE ROOM',
    icon: '🚪',
    accent: 'pink',
    tag: 'Play with a friend using a room code',
  },
]

const WP_BATTLE_CARDS = [
  {
    id: 'matchmaking',
    to: '/game/word-puzzle/matchmaking',
    label: 'QUICK MATCH',
    icon: '⚡',
    accent: 'green',
    tag: 'Auto-match with a random opponent',
  },
  {
    id: 'room',
    to: '/game/word-puzzle/room',
    label: 'PRIVATE ROOM',
    icon: '🚪',
    accent: 'pink',
    tag: 'Play with a friend using a room code',
  },
]

function GamePageBody() {
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
          loadingVariant="chess"
        >
          <ChessGame mode="multiplayer" roomCode={room} />
        </GameLayout>
      )
    }
    if (!difficulty || difficulty === 'mode') {
      return <ModeSelect title={title} icon={icon} cards={CHESS_CARDS} />
    }
    if (difficulty === 'computer') {
      if (!variant) return <ChessDifficultySelect />
      if (!VALID_DIFFICULTIES.has(variant)) return <ChessDifficultySelect />
      return (
        <GameLayout
          title={`${title} · CPU · ${variant.toUpperCase()}`}
          icon={icon}
          backTo="/game/chess/computer"
          backLabel="DIFFICULTY"
          loadingVariant="chess"
        >
          <ChessGame mode="computer" difficulty={variant} />
        </GameLayout>
      )
    }
    if (difficulty === 'matchmaking') return <MatchmakingScreen />
    if (difficulty === 'room') return <PrivateRoomScreen />
    return <ModeSelect title={title} icon={icon} cards={CHESS_CARDS} />
  }

  // ===== Snake & Ladder =====
  if (gameId === 'snake-and-ladder') {
    if (room) {
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
    if (!difficulty || difficulty === 'mode') {
      return <ModeSelect title={title} icon={icon} cards={SL_CARDS} />
    }
    if (difficulty === 'computer') {
      if (!variant) {
        return (
          <SnakeAndLadderLocalSelect
            title={`${title} · VS CPU`}
            basePath="/game/snake-and-ladder/computer"
            backTo="/game/snake-and-ladder/mode"
          />
        )
      }
      const count = Number(variant)
      if (![2, 3, 4].includes(count)) {
        return (
          <SnakeAndLadderLocalSelect
            title={`${title} · VS CPU`}
            basePath="/game/snake-and-ladder/computer"
            backTo="/game/snake-and-ladder/mode"
          />
        )
      }
      const names = ['You']
      for (let i = 1; i < count; i++) names.push(`CPU ${i}`)
      const cpuIndices = new Set(
        Array.from({ length: count - 1 }, (_, i) => i + 1),
      )
      return (
        <GameLayout
          title={`${title} · CPU ${count}P`}
          icon={icon}
          backTo="/game/snake-and-ladder/computer"
          backLabel="PLAYERS"
        >
          <SnakeAndLadderLocalGame
            playerNames={names}
            cpuIndices={cpuIndices}
          />
        </GameLayout>
      )
    }
    if (difficulty === 'matchmaking') return <MatchmakingScreen />
    if (difficulty === 'room') return <PrivateRoomScreen />
    return <ModeSelect title={title} icon={icon} cards={SL_CARDS} />
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
    if (difficulty === 'mode') {
      return (
        <ModeSelect
          title={`${title} BATTLE`}
          icon={icon}
          cards={WP_BATTLE_CARDS}
          backTo="/game/word-puzzle"
          backLabel="MODE"
        />
      )
    }
    if (difficulty === 'matchmaking') return <MatchmakingScreen />
    if (difficulty === 'room') return <PrivateRoomScreen />
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

export default function GamePage() {
  const { gameId, difficulty, variant } = useParams()
  const [searchParams] = useSearchParams()
  const resetKey = `${gameId ?? ''}-${difficulty ?? ''}-${variant ?? ''}-${searchParams.get('room') ?? ''}`
  return (
    <GameErrorBoundary resetKey={resetKey}>
      <GamePageBody />
    </GameErrorBoundary>
  )
}
