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
import {
  DoorIcon,
  FriendsIcon,
  LightningIcon,
  ModeRobotIcon,
} from '../assets/icons/index.jsx'
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
    label: 'VS BOT',
    Icon: ModeRobotIcon,
    accent: 'cyan',
    tag: 'Play against the bot',
    subItems: ['Easy', 'Medium', 'Hard'],
  },
  {
    id: 'local',
    to: '/game/chess/local',
    label: 'PASS & PLAY',
    Icon: FriendsIcon,
    accent: 'amber',
    tag: 'Two players sharing one device',
  },
  {
    id: 'matchmaking',
    to: '/game/chess/matchmaking',
    label: 'QUICK MATCH',
    Icon: LightningIcon,
    accent: 'green',
    tag: 'Auto-match with a random opponent',
  },
  {
    id: 'room',
    to: '/game/chess/room',
    label: 'PRIVATE ROOM',
    Icon: DoorIcon,
    accent: 'pink',
    tag: 'Play with a friend using a room code',
  },
]

const SL_CARDS = [
  {
    id: 'computer',
    to: '/game/snake-and-ladder/computer',
    label: 'VS BOT',
    Icon: ModeRobotIcon,
    accent: 'cyan',
    tag: 'Pick 2–4 players · Bots fill the rest',
  },
  {
    id: 'local',
    to: '/game/snake-and-ladder/local',
    label: 'PASS & PLAY',
    Icon: FriendsIcon,
    accent: 'amber',
    tag: '2–4 humans on one device',
  },
  {
    id: 'matchmaking',
    to: '/game/snake-and-ladder/matchmaking',
    label: 'QUICK MATCH',
    Icon: LightningIcon,
    accent: 'green',
    tag: 'Auto-match with a random opponent',
  },
  {
    id: 'room',
    to: '/game/snake-and-ladder/room',
    label: 'PRIVATE ROOM',
    Icon: DoorIcon,
    accent: 'pink',
    tag: 'Play with a friend using a room code',
  },
]

const SNAKE_CARDS = [
  {
    id: 'solo',
    to: '/game/snake/solo',
    label: 'SOLO',
    Icon: ModeRobotIcon,
    accent: 'cyan',
    tag: 'Single player · classic Snake',
  },
  {
    id: 'matchmaking',
    to: '/game/snake/matchmaking',
    label: 'QUICK MATCH',
    Icon: LightningIcon,
    accent: 'green',
    tag: 'Auto-match with a random opponent',
  },
  {
    id: 'room',
    to: '/game/snake/room',
    label: 'PRIVATE ROOM',
    Icon: DoorIcon,
    accent: 'pink',
    tag: 'Play with a friend using a room code',
  },
]

const WP_BATTLE_CARDS = [
  {
    id: 'matchmaking',
    to: '/game/word-puzzle/matchmaking',
    label: 'QUICK MATCH',
    Icon: LightningIcon,
    accent: 'green',
    tag: 'Auto-match with a random opponent',
  },
  {
    id: 'room',
    to: '/game/word-puzzle/room',
    label: 'PRIVATE ROOM',
    Icon: DoorIcon,
    accent: 'pink',
    tag: 'Play with a friend using a room code',
  },
]

const GAME_ACCENTS = {
  snake: 'green',
  sudoku: 'cyan',
  minesweeper: 'pink',
  chess: 'purple',
  'snake-and-ladder': 'amber',
  'word-puzzle': 'cyan',
}

function GamePageBody() {
  const { gameId, difficulty, variant } = useParams()
  const [searchParams] = useSearchParams()
  const room = searchParams.get('room')

  const game = games.find((g) => g.id === gameId)
  const title = game?.name?.toUpperCase() ?? gameId?.toUpperCase() ?? 'GAME'
  const icon = game?.icon
  const Icon = game?.Icon
  const accent = GAME_ACCENTS[gameId] ?? 'green'

  // ===== Chess =====
  if (gameId === 'chess') {
    if (room) {
      return (
        <GameLayout
          title={`${title} · BATTLE`}
          icon={icon}
          Icon={Icon}
          backTo="/"
          backLabel="LOBBY"
          accent={accent}
          loadingVariant="chess"
        >
          <ChessGame mode="multiplayer" roomCode={room} />
        </GameLayout>
      )
    }
    if (!difficulty || difficulty === 'mode') {
      return <ModeSelect title={title} icon={icon}
          Icon={Icon} cards={CHESS_CARDS} />
    }
    if (difficulty === 'computer') {
      if (!variant) return <ChessDifficultySelect />
      if (!VALID_DIFFICULTIES.has(variant)) return <ChessDifficultySelect />
      return (
        <GameLayout
          title={`${title} · BOT · ${variant.toUpperCase()}`}
          icon={icon}
          Icon={Icon}
          backTo="/game/chess/computer"
          backLabel="DIFFICULTY"
          accent={accent}
          loadingVariant="chess"
        >
          <ChessGame mode="computer" difficulty={variant} />
        </GameLayout>
      )
    }
    if (difficulty === 'local') {
      return (
        <GameLayout
          title={`${title} · PASS & PLAY`}
          icon={icon}
          Icon={Icon}
          backTo="/game/chess/mode"
          backLabel="MODE"
          accent={accent}
          loadingVariant="chess"
        >
          <ChessGame mode="local" />
        </GameLayout>
      )
    }
    if (difficulty === 'matchmaking') return <MatchmakingScreen />
    if (difficulty === 'room') return <PrivateRoomScreen />
    return <ModeSelect title={title} icon={icon}
          Icon={Icon} cards={CHESS_CARDS} />
  }

  // ===== Snake & Ladder =====
  if (gameId === 'snake-and-ladder') {
    if (room) {
      return (
        <GameLayout
          title={`${title} · BATTLE`}
          icon={icon}
          Icon={Icon}
          backTo="/"
          backLabel="LOBBY"
          accent={accent}
        >
          <SnakeAndLadderGame roomCode={room} />
        </GameLayout>
      )
    }
    if (!difficulty || difficulty === 'mode') {
      return <ModeSelect title={title} icon={icon}
          Icon={Icon} cards={SL_CARDS} />
    }
    if (difficulty === 'computer') {
      if (!variant) {
        return (
          <SnakeAndLadderLocalSelect
            title={`${title} · VS BOT`}
            Icon={Icon}
            basePath="/game/snake-and-ladder/computer"
            backTo="/game/snake-and-ladder/mode"
          />
        )
      }
      const count = Number(variant)
      if (![2, 3, 4].includes(count)) {
        return (
          <SnakeAndLadderLocalSelect
            title={`${title} · VS BOT`}
            Icon={Icon}
            basePath="/game/snake-and-ladder/computer"
            backTo="/game/snake-and-ladder/mode"
          />
        )
      }
      const names = ['You']
      for (let i = 1; i < count; i++) names.push(`Bot ${i}`)
      const cpuIndices = new Set(
        Array.from({ length: count - 1 }, (_, i) => i + 1),
      )
      return (
        <GameLayout
          title={`${title} · BOT ${count}P`}
          icon={icon}
          Icon={Icon}
          backTo="/game/snake-and-ladder/computer"
          backLabel="PLAYERS"
          accent={accent}
        >
          <SnakeAndLadderLocalGame
            playerNames={names}
            cpuIndices={cpuIndices}
          />
        </GameLayout>
      )
    }
    if (difficulty === 'local') {
      if (!variant) {
        return (
          <SnakeAndLadderLocalSelect
            title={`${title} · PASS & PLAY`}
            Icon={Icon}
            basePath="/game/snake-and-ladder/local"
            backTo="/game/snake-and-ladder/mode"
            prompt="HOW MANY PLAYERS?"
            hint="All humans · same device"
          />
        )
      }
      const count = Number(variant)
      if (![2, 3, 4].includes(count)) {
        return (
          <SnakeAndLadderLocalSelect
            title={`${title} · PASS & PLAY`}
            Icon={Icon}
            basePath="/game/snake-and-ladder/local"
            backTo="/game/snake-and-ladder/mode"
            prompt="HOW MANY PLAYERS?"
            hint="All humans · same device"
          />
        )
      }
      const names = []
      for (let i = 1; i <= count; i++) names.push(`Player ${i}`)
      return (
        <GameLayout
          title={`${title} · LOCAL ${count}P`}
          icon={icon}
          Icon={Icon}
          backTo="/game/snake-and-ladder/local"
          backLabel="PLAYERS"
          accent={accent}
        >
          <SnakeAndLadderLocalGame
            playerNames={names}
            cpuIndices={new Set()}
          />
        </GameLayout>
      )
    }
    if (difficulty === 'matchmaking') return <MatchmakingScreen />
    if (difficulty === 'room') return <PrivateRoomScreen />
    return <ModeSelect title={title} icon={icon}
          Icon={Icon} cards={SL_CARDS} />
  }

  // ===== Word Puzzle =====
  if (gameId === 'word-puzzle') {
    if (room) {
      return (
        <GameLayout
          title={`${title} · BATTLE`}
          icon={icon}
          Icon={Icon}
          backTo="/"
          backLabel="LOBBY"
          accent={accent}
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
          Icon={Icon}
          backTo="/game/word-puzzle"
          backLabel="MODE"
          accent={accent}
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
          Icon={Icon}
          backTo="/game/word-puzzle/free"
          backLabel="LENGTH"
          accent={accent}
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
          Icon={Icon}
          cards={WP_BATTLE_CARDS}
          backTo="/game/word-puzzle"
          backLabel="MODE"
          accent={accent}
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
      return <DifficultySelect title={title} icon={icon}
          Icon={Icon} gameId={gameId} />
    }
    const Component = DIFFICULTY_GAMES[gameId]
    return (
      <GameLayout
        title={`${title} · ${difficulty.toUpperCase()}`}
        icon={icon}
          Icon={Icon}
        backTo={`/game/${gameId}/difficulty`}
        backLabel="DIFFICULTY"
          accent={accent}
      >
        <Component difficulty={difficulty} />
      </GameLayout>
    )
  }

  // ===== Snake (has its own mode select for solo vs pass & play) =====
  if (gameId === 'snake') {
    if (!difficulty || difficulty === 'mode') {
      return (
        <ModeSelect
          title={title}
          icon={icon}
          Icon={Icon}
          cards={SNAKE_CARDS}
        />
      )
    }
    if (difficulty === 'solo') {
      return (
        <GameLayout
          title={`${title} · SOLO`}
          icon={icon}
          Icon={Icon}
          backTo="/game/snake/mode"
          backLabel="MODE"
          accent={accent}
        >
          <SnakeGame />
        </GameLayout>
      )
    }
    if (difficulty === 'matchmaking') return <MatchmakingScreen />
    if (difficulty === 'room') return <PrivateRoomScreen />
    // Unknown sub-route → fall back to mode select.
    return (
      <ModeSelect
        title={title}
        icon={icon}
        Icon={Icon}
        cards={SNAKE_CARDS}
      />
    )
  }

  // ===== Simple single-player =====
  const Component = SIMPLE_GAMES[gameId]
  return (
    <GameLayout title={title} icon={icon}
          Icon={Icon} accent={accent}>
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
