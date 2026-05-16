import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { getRoom } from '../../lib/api'
import { socket } from '../../lib/socket'
import Avatar from '../../components/Avatar'
import {
  GOAL,
  LADDERS,
  SIZE,
  SNAKES,
  pathBetween,
  squareCenter,
  squareToCell,
} from './board'

const DICE_FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅']
const TOKEN_COLORS = ['#00ff88', '#ff006e']
const STEP_MS = 220

function pick(o, ...keys) {
  for (const k of keys) {
    if (o && o[k] != null) return o[k]
  }
  return undefined
}

function normalizePlayer(p, fallbackPositions, idx) {
  if (!p) return null
  return {
    userId: pick(p, 'userId', 'user_id', 'id'),
    username: pick(p, 'username', 'name') ?? 'Player',
    position:
      pick(p, 'position', 'square', 'pos') ?? fallbackPositions?.[idx] ?? 1,
  }
}

function deriveTurnIndex(room) {
  // Server may emit nextTurn as either an index, a userId, or a username.
  const t = pick(room, 'currentTurn', 'turn', 'turnIndex', 'currentPlayer')
  if (typeof t === 'number') return t
  if (typeof t === 'string') {
    const i = room.players.findIndex(
      (p) => p.userId === t || p.username === t,
    )
    return i >= 0 ? i : 0
  }
  return 0
}

export default function SnakeAndLadderGame({ roomCode }) {
  const { user, displayName } = useAuth()
  const toast = useToast()

  const [room, setRoom] = useState(null)
  const [error, setError] = useState(null)
  const [positions, setPositions] = useState([1, 1]) // [p0, p1]
  const [turnIdx, setTurnIdx] = useState(0)
  const [diceFace, setDiceFace] = useState(null)
  const [rolling, setRolling] = useState(false)
  const [animating, setAnimating] = useState(false)
  const [winner, setWinner] = useState(null) // 0 or 1
  const rollTimerRef = useRef(null)

  // Initial REST fetch to seed the game from room.gameState
  useEffect(() => {
    let cancelled = false
    getRoom(roomCode)
      .then((data) => {
        if (cancelled) return
        const players = (data?.players ?? []).map((p, i) =>
          normalizePlayer(p, [1, 1], i),
        )
        if (players.length === 0) {
          setError('Room is empty.')
          return
        }
        const gs = data?.gameState ?? data?.game_state ?? {}
        const initPositions = [
          pick(gs, 'p0', 'position0') ?? players[0]?.position ?? 1,
          pick(gs, 'p1', 'position1') ?? players[1]?.position ?? 1,
        ]
        setRoom({ ...data, players })
        setPositions(initPositions)
        setTurnIdx(deriveTurnIndex({ ...data, players }))
      })
      .catch(() => {
        if (cancelled) return
        setError('Could not load room.')
      })
    return () => {
      cancelled = true
    }
  }, [roomCode])

  // Wire up socket events
  useEffect(() => {
    if (!room) return

    const handleDiceResult = (data) => {
      const roll = pick(data, 'roll', 'value')
      const newPosition = pick(data, 'newPosition', 'position')
      const nextTurn = pick(data, 'nextTurn', 'turn')
      const w = pick(data, 'winner', 'winnerId')
      const movingIdx = pick(data, 'playerIndex', 'player')

      const playerIndex =
        typeof movingIdx === 'number'
          ? movingIdx
          : room.players.findIndex(
              (p) => p.userId === movingIdx || p.username === movingIdx,
            )
      const idx = playerIndex >= 0 ? playerIndex : turnIdx

      if (typeof roll === 'number') setDiceFace(roll)
      animateMove(idx, newPosition).then(() => {
        if (typeof nextTurn === 'number') setTurnIdx(nextTurn)
        else if (typeof nextTurn === 'string') {
          const i = room.players.findIndex(
            (p) => p.userId === nextTurn || p.username === nextTurn,
          )
          if (i >= 0) setTurnIdx(i)
        }
        if (w != null) {
          const wi =
            typeof w === 'number'
              ? w
              : room.players.findIndex(
                  (p) => p.userId === w || p.username === w,
                )
          if (wi >= 0) setWinner(wi)
        }
      })
    }

    const handleRoomUpdate = (data) => {
      const r = pick(data, 'players')
      if (!r) return
      const players = r.map((p, i) => normalizePlayer(p, positions, i))
      setRoom((prev) => ({ ...prev, players }))
    }

    const handleOpponentLeft = () => {
      toast.show({ message: 'Opponent left the game.', duration: 4000 })
    }

    socket.on('dice_result', handleDiceResult)
    socket.on('room_update', handleRoomUpdate)
    socket.on('opponent_left', handleOpponentLeft)
    return () => {
      socket.off('dice_result', handleDiceResult)
      socket.off('room_update', handleRoomUpdate)
      socket.off('opponent_left', handleOpponentLeft)
    }
    // We intentionally do not depend on positions to avoid resubscribing
    // on every animation step.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, turnIdx, toast])

  const animateMove = useCallback(async (idx, target) => {
    if (target == null) return
    setAnimating(true)
    const start = positions[idx]
    const path = pathBetween(start, target)
    for (const square of path) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((res) => setTimeout(res, STEP_MS))
      setPositions((prev) => {
        const next = [...prev]
        next[idx] = square
        return next
      })
    }
    setAnimating(false)
  }, [positions])

  const myIdx = useMemo(() => {
    if (!room) return -1
    return room.players.findIndex(
      (p) =>
        (user?.id && p.userId === user.id) ||
        p.username?.toLowerCase() === displayName?.toLowerCase(),
    )
  }, [room, user?.id, displayName])

  const myTurn = myIdx === turnIdx && !winner

  const handleRoll = useCallback(() => {
    if (!myTurn || rolling || animating || winner != null) return
    setRolling(true)
    // Local dice spin while we wait
    if (rollTimerRef.current) clearInterval(rollTimerRef.current)
    rollTimerRef.current = setInterval(() => {
      setDiceFace(1 + Math.floor(Math.random() * 6))
    }, 80)
    socket.emit('roll_dice', { roomCode, playerId: user?.id, playerIndex: myIdx })
    // Stop the spin after a short timeout; dice_result handler shows the real face
    setTimeout(() => {
      if (rollTimerRef.current) clearInterval(rollTimerRef.current)
      rollTimerRef.current = null
      setRolling(false)
    }, 600)
  }, [animating, myIdx, myTurn, roomCode, rolling, user?.id, winner])

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <p className="font-arcade text-sm text-neon-pink">{error}</p>
        <Link
          to="/"
          className="rounded-md border border-white/20 px-4 py-2 font-arcade text-[10px] text-white/70 hover:border-neon-cyan/60 hover:text-neon-cyan"
        >
          BACK TO LOBBY
        </Link>
      </div>
    )
  }
  if (!room) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <p className="font-arcade text-[11px] text-white/55">LOADING…</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[auto_18rem]">
      <Board positions={positions} winner={winner} room={room} />
      <Sidebar
        room={room}
        myIdx={myIdx}
        turnIdx={turnIdx}
        positions={positions}
        diceFace={diceFace}
        rolling={rolling}
        animating={animating}
        winner={winner}
        myTurn={myTurn}
        onRoll={handleRoll}
      />
    </div>
  )
}

function Board({ positions, winner, room }) {
  const cells = []
  for (let row = 0; row < SIZE; row++) {
    for (let col = 0; col < SIZE; col++) {
      cells.push({ row, col })
    }
  }
  const squareOf = (row, col) => {
    const fromBottom = SIZE - 1 - row
    const inRow = fromBottom % 2 === 0 ? col : SIZE - 1 - col
    return fromBottom * SIZE + inRow + 1
  }
  // Render at a fixed virtual viewport so the SVG overlay aligns.
  // Cells are auto-sized via CSS; SVG uses preserveAspectRatio.
  const VIRTUAL = SIZE * 60

  return (
    <div
      className="relative w-full max-w-[640px] self-start rounded-xl border-2 border-neon-cyan/50 bg-arcadia-surface p-2 shadow-neon-cyan"
      style={{ aspectRatio: '1/1' }}
    >
      <div
        className="grid h-full w-full overflow-hidden rounded-md"
        style={{
          gridTemplateColumns: `repeat(${SIZE}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${SIZE}, minmax(0, 1fr))`,
        }}
      >
        {cells.map(({ row, col }) => {
          const n = squareOf(row, col)
          const isLadderStart = LADDERS[n] != null
          const isSnakeStart = SNAKES[n] != null
          const checker = (row + col) % 2 === 0
          let bg = checker ? 'bg-arcadia-bg' : 'bg-white/[0.025]'
          if (n === GOAL) bg = 'bg-neon-green/20'
          if (n === 1) bg = 'bg-white/5'
          return (
            <div
              key={n}
              className={`relative flex items-end justify-end p-1 font-arcade text-[9px] text-white/45 sm:text-[10px] ${bg}`}
            >
              <span>{n}</span>
              {isLadderStart && (
                <span
                  className="absolute left-1 top-1 text-[9px] text-neon-green"
                  title={`Ladder → ${LADDERS[n]}`}
                >
                  ↑
                </span>
              )}
              {isSnakeStart && (
                <span
                  className="absolute left-1 top-1 text-[9px] text-neon-pink"
                  title={`Snake → ${SNAKES[n]}`}
                >
                  ↓
                </span>
              )}
            </div>
          )
        })}
      </div>

      <svg
        viewBox={`0 0 ${VIRTUAL} ${VIRTUAL}`}
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-2"
        aria-hidden="true"
      >
        <defs>
          <marker id="ladderArrow" viewBox="0 0 6 6" refX="3" refY="3" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M0 0 L6 3 L0 6 z" fill="#00ff88" />
          </marker>
          <marker id="snakeArrow" viewBox="0 0 6 6" refX="3" refY="3" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M0 0 L6 3 L0 6 z" fill="#ff006e" />
          </marker>
        </defs>
        {Object.entries(LADDERS).map(([from, to]) => {
          const a = squareCenter(Number(from), VIRTUAL / SIZE)
          const b = squareCenter(Number(to), VIRTUAL / SIZE)
          if (!a || !b) return null
          return (
            <line
              key={`L${from}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="#00ff88"
              strokeWidth="6"
              strokeOpacity="0.7"
              markerEnd="url(#ladderArrow)"
            />
          )
        })}
        {Object.entries(SNAKES).map(([from, to]) => {
          const a = squareCenter(Number(from), VIRTUAL / SIZE)
          const b = squareCenter(Number(to), VIRTUAL / SIZE)
          if (!a || !b) return null
          // Curve the snake line slightly with a quadratic bezier
          const mx = (a.x + b.x) / 2 + 20
          const my = (a.y + b.y) / 2 + 20
          return (
            <path
              key={`S${from}`}
              d={`M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`}
              stroke="#ff006e"
              strokeWidth="6"
              strokeOpacity="0.7"
              fill="none"
              markerEnd="url(#snakeArrow)"
            />
          )
        })}
      </svg>

      {[0, 1].map((i) =>
        positions[i] != null && room.players[i] ? (
          <Token
            key={i}
            position={positions[i]}
            color={TOKEN_COLORS[i]}
            offset={i}
          />
        ) : null,
      )}

      {winner != null && (
        <div className="absolute inset-2 flex flex-col items-center justify-center rounded-md bg-arcadia-bg/85 backdrop-blur-sm">
          <p
            className="font-arcade text-2xl drop-shadow-[0_0_18px_currentColor]"
            style={{ color: TOKEN_COLORS[winner] }}
          >
            ★ {room.players[winner]?.username?.toUpperCase()} WINS ★
          </p>
          <Link
            to="/"
            className="mt-5 rounded-md border border-neon-cyan/60 bg-neon-cyan/10 px-4 py-2 font-arcade text-[10px] text-neon-cyan hover:bg-neon-cyan/20 hover:shadow-neon-cyan"
          >
            BACK TO LOBBY
          </Link>
        </div>
      )}
    </div>
  )
}

function Token({ position, color, offset }) {
  const cell = squareToCell(position)
  if (!cell) return null
  // Two tokens, lightly offset so they don't fully overlap
  const dx = offset === 0 ? -12 : 12
  const dy = offset === 0 ? -8 : 8
  return (
    <span
      className="absolute z-10 grid h-5 w-5 place-items-center rounded-full transition-all duration-200 sm:h-6 sm:w-6"
      style={{
        backgroundColor: color,
        boxShadow: `0 0 14px ${color}80, inset 0 0 4px rgba(0,0,0,0.45)`,
        left: `calc(${(cell.col + 0.5) * (100 / SIZE)}% + ${dx}px)`,
        top: `calc(${(cell.row + 0.5) * (100 / SIZE)}% + ${dy}px)`,
        transform: 'translate(-50%, -50%)',
      }}
    />
  )
}

function Sidebar({
  room,
  myIdx,
  turnIdx,
  positions,
  diceFace,
  rolling,
  animating,
  winner,
  myTurn,
  onRoll,
}) {
  return (
    <aside className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        {[0, 1].map((i) => {
          const p = room.players[i]
          const me = i === myIdx
          const onTurn = i === turnIdx && winner == null
          return (
            <div
              key={i}
              className={`flex items-center gap-3 rounded-lg border bg-arcadia-surface/70 px-3 py-2 ${
                onTurn ? 'border-neon-green/50 shadow-neon-green' : 'border-white/10'
              }`}
            >
              <Avatar name={p?.username ?? '—'} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-arcade text-[10px] text-white">
                  {p?.username ?? 'Waiting…'} {me && '· YOU'}
                </p>
                <p className="font-arcade text-[9px]" style={{ color: TOKEN_COLORS[i] }}>
                  SQUARE {positions[i] ?? 1}
                </p>
              </div>
              {onTurn && (
                <span className="font-arcade text-[9px] text-neon-green">
                  TURN
                </span>
              )}
            </div>
          )
        })}
      </div>

      <div className="rounded-lg border border-white/10 bg-arcadia-surface/70 p-4 text-center">
        <p className="font-arcade text-[9px] text-white/45">DICE</p>
        <p className="my-2 text-6xl text-neon-green drop-shadow-[0_0_12px_rgba(0,255,136,0.45)]">
          {diceFace ? DICE_FACES[diceFace - 1] : '·'}
        </p>
        <button
          type="button"
          onClick={onRoll}
          disabled={!myTurn || rolling || animating || winner != null}
          className={`mt-2 w-full rounded-md border-2 py-2.5 font-arcade text-[11px] transition ${
            myTurn && !rolling && !animating && winner == null
              ? 'border-neon-green/70 bg-neon-green/10 text-neon-green hover:bg-neon-green/20 hover:shadow-neon-green'
              : 'cursor-not-allowed border-white/15 text-white/35'
          }`}
        >
          {winner != null
            ? 'GAME OVER'
            : rolling || animating
              ? 'ROLLING…'
              : myTurn
                ? '🎲 ROLL DICE'
                : 'WAITING FOR OPPONENT'}
        </button>
      </div>

      <p className="text-center text-[10px] text-white/35">
        ↑ Ladders climb · ↓ Snakes slide
      </p>
    </aside>
  )
}
