import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useGameLeaveGuard } from '../../context/LeaveGuardContext'
import { useToast } from '../../context/ToastContext'
import { getRoom } from '../../lib/api'
import { socket } from '../../lib/socket'
import Avatar from '../../components/Avatar'
import { useOpponentDisconnect } from '../../hooks/useOpponentDisconnect'
import {
  GOAL,
  LADDERS,
  SIZE,
  SNAKES,
  computeStages,
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

function historyEntryToLog(entry, room) {
  if (!entry || typeof entry.roll !== 'number') return null
  const playerIdent = entry.player
  const players = room?.players ?? []
  const playerIdx =
    typeof playerIdent === 'number'
      ? playerIdent
      : players.findIndex(
          (p) =>
            (p.userId ?? p.user_id ?? p.id) === playerIdent ||
            p.username === playerIdent,
        )
  const name =
    (playerIdx >= 0 && players[playerIdx]?.username) ||
    (typeof playerIdent === 'string' ? playerIdent : 'Player')
  const start = entry.from ?? 1
  const final = entry.final ?? start
  const stages = computeStages({ start, roll: entry.roll, finalAt: final })
  if (stages.length === 0) {
    return {
      playerIdx: Math.max(playerIdx, 0),
      name,
      text: `rolled a ${entry.roll} — overshoot, stayed on ${start}`,
    }
  }
  const parts = [`rolled a ${entry.roll}`]
  for (const stage of stages) {
    if (stage.kind === 'ladder') {
      parts.push(`LADDER! ${stage.from}→${stage.at}`)
    } else if (stage.kind === 'snake') {
      const drop = stage.from - stage.at
      const drama = drop >= 50 ? ' 😱' : ''
      parts.push(`SNAKE! ${stage.from}→${stage.at}${drama}`)
    }
  }
  return {
    playerIdx: Math.max(playerIdx, 0),
    name,
    text: parts.join(' → '),
  }
}

function turnUserIdToIndex(room, currentTurn) {
  if (currentTurn == null || !room?.players) return null
  if (typeof currentTurn === 'number') return currentTurn
  const idx = room.players.findIndex(
    (p) =>
      (p.userId ?? p.user_id ?? p.id) === currentTurn ||
      p.username === currentTurn,
  )
  return idx >= 0 ? idx : null
}

export default function SnakeAndLadderGame({ roomCode }) {
  const { user, displayName } = useAuth()
  const toast = useToast()

  const [room, setRoom] = useState(null)
  const [error, setError] = useState(null)
  const [positions, setPositions] = useState([1, 1])
  const [turnIdx, setTurnIdx] = useState(0)
  const [diceFace, setDiceFace] = useState(null)
  const [rolling, setRolling] = useState(false)
  const [animating, setAnimating] = useState(false)
  const [winner, setWinner] = useState(null)
  const [reconnecting, setReconnecting] = useState(false)
  const [flash, setFlash] = useState(null) // { square, kind, key }
  const [log, setLog] = useState([])
  const [rollHistory, setRollHistory] = useState([])
  const [showDiceDebug, setShowDiceDebug] = useState(false)
  const flashTimerRef = useRef(null)

  // Refs mirror state so stable socket handlers can read current values
  // without going stale through closures.
  const positionsRef = useRef([1, 1])
  const turnIdxRef = useRef(0)
  const roomRef = useRef(null)
  const animatingRef = useRef(false)
  const spinRef = useRef(null)

  useEffect(() => {
    positionsRef.current = positions
  }, [positions])
  useEffect(() => {
    turnIdxRef.current = turnIdx
  }, [turnIdx])
  useEffect(() => {
    roomRef.current = room
  }, [room])

  const opponentDc = useOpponentDisconnect(roomCode)

  // Initial REST fetch + reconnect_to_room
  useEffect(() => {
    let cancelled = false
    setReconnecting(true)
    getRoom(roomCode)
      .then((data) => {
        if (cancelled) return
        const players = (data?.players ?? []).map((p, i) =>
          normalizePlayer(p, [1, 1], i),
        )
        if (players.length === 0) {
          setError('Room is empty.')
          setReconnecting(false)
          return
        }
        const gs = data?.gameState ?? data?.game_state ?? {}
        const positionsFromState = pick(gs, 'positions')
        const initPositions = Array.isArray(positionsFromState)
          ? positionsFromState.slice(0, 2)
          : [
              pick(gs, 'p0', 'position0') ?? players[0]?.position ?? 1,
              pick(gs, 'p1', 'position1') ?? players[1]?.position ?? 1,
            ]
        const roomData = { ...data, players }
        setRoom(roomData)
        setPositions(initPositions)
        positionsRef.current = initPositions

        const currentTurn = pick(gs, 'currentTurn', 'current_turn')
        const initialTurnIdx =
          turnUserIdToIndex(roomData, currentTurn) ??
          pick(gs, 'turnIndex', 'turn') ??
          0
        setTurnIdx(initialTurnIdx)
        turnIdxRef.current = initialTurnIdx

        if (socket.connected && user?.id) {
          socket.emit('reconnect_to_room', { roomCode, username: displayName })
        }
        setReconnecting(false)
      })
      .catch(() => {
        if (cancelled) return
        setError('Could not load room.')
        setReconnecting(false)
      })
    return () => {
      cancelled = true
    }
  }, [roomCode, user?.id, displayName])

  // Stable animation function — reads positions/room via refs
  const animateMove = useCallback(async (idx, target) => {
    if (target == null) return
    animatingRef.current = true
    setAnimating(true)
    const start = positionsRef.current[idx]
    const path = pathBetween(start, target)
    for (const square of path) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((res) => setTimeout(res, STEP_MS))
      setPositions((prev) => {
        const next = [...prev]
        next[idx] = square
        positionsRef.current = next
        return next
      })
    }
    animatingRef.current = false
    setAnimating(false)
  }, [])

  const triggerFlash = useCallback((square, kind) => {
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
    // Clear first so re-flashing the same square re-runs the animation
    setFlash(null)
    setTimeout(() => {
      setFlash({ square, kind, key: Date.now() })
      flashTimerRef.current = setTimeout(() => setFlash(null), 650)
    }, 16)
  }, [])

  const pushLog = useCallback((entry) => {
    setLog((prev) => [...prev, entry].slice(-5))
  }, [])

  // Play one chain (dice roll + any ladder/snake triggers) for a player.
  const playStages = useCallback(
    async (playerIdx, roll, finalAt) => {
      const room = roomRef.current
      const playerName = room?.players?.[playerIdx]?.username ?? 'Player'
      const start = positionsRef.current[playerIdx]
      const stages = computeStages({ start, roll, finalAt })

      if (stages.length === 0) {
        pushLog({
          playerIdx,
          name: playerName,
          text: `rolled a ${roll} — overshoot, stays on ${start}`,
        })
        return
      }

      const parts = [`rolled a ${roll}`]
      for (const stage of stages) {
        if (stage.kind === 'ladder') {
          parts.push(`LADDER! ${stage.from}→${stage.at}`)
        } else if (stage.kind === 'snake') {
          const drop = stage.from - stage.at
          const drama = drop >= 50 ? ' 😱' : ''
          parts.push(`SNAKE! ${stage.from}→${stage.at}${drama}`)
        }
      }
      pushLog({
        playerIdx,
        name: playerName,
        text: parts.join(' → '),
      })

      for (let i = 0; i < stages.length; i++) {
        const stage = stages[i]
        if (i === 0) {
          // eslint-disable-next-line no-await-in-loop
          await animateMove(playerIdx, stage.at)
          if (stages.length > 1) {
            // eslint-disable-next-line no-await-in-loop
            await new Promise((res) => setTimeout(res, 300))
          }
        } else {
          // Flash the square the token currently sits on (the source of
          // this snake/ladder), pause, then slide to the destination.
          triggerFlash(stage.from, stage.kind)
          const dropSize = Math.abs(stage.from - stage.at)
          const pauseMs =
            stage.kind === 'snake'
              ? 450 + Math.min(550, dropSize * 4)
              : 450
          // eslint-disable-next-line no-await-in-loop
          await new Promise((res) => setTimeout(res, pauseMs))
          // eslint-disable-next-line no-await-in-loop
          await animateMove(playerIdx, stage.at)
        }
      }
    },
    [animateMove, pushLog, triggerFlash],
  )

  // Socket handlers — depend only on stable identities so they don't
  // need to re-register on every state change.
  useEffect(() => {
    const onDiceResult = (data) => {
      const roll = pick(data, 'roll', 'value')
      const newPosition = pick(data, 'newPosition', 'position', 'landedOn')
      const nextTurn = pick(data, 'nextTurn', 'currentTurn', 'turn')
      const w = pick(data, 'winner', 'winnerId')
      const movingIdent = pick(
        data,
        'playerIndex',
        'player',
        'userId',
        'playerId',
      )

      const room = roomRef.current
      const playerIndex =
        typeof movingIdent === 'number'
          ? movingIdent
          : (turnUserIdToIndex(room, movingIdent) ?? turnIdxRef.current)

      if (typeof roll === 'number') setDiceFace(roll)
      const rollNum = typeof roll === 'number' ? roll : null
      if (rollNum != null) {
        const fromSquare = positionsRef.current[playerIndex] ?? 1
        const player =
          room?.players?.[playerIndex]?.userId ??
          room?.players?.[playerIndex]?.user_id ??
          room?.players?.[playerIndex]?.username ??
          playerIndex
        setRollHistory((prev) =>
          [...prev, {
            player,
            roll: rollNum,
            from: fromSquare,
            final: newPosition,
          }].slice(-30),
        )
      }
      const playOut =
        rollNum != null
          ? playStages(playerIndex, rollNum, newPosition)
          : animateMove(playerIndex, newPosition)
      playOut.then(() => {
        const nextIdx = turnUserIdToIndex(room, nextTurn)
        if (nextIdx != null) {
          turnIdxRef.current = nextIdx
          setTurnIdx(nextIdx)
        } else if (typeof nextTurn === 'number') {
          turnIdxRef.current = nextTurn
          setTurnIdx(nextTurn)
        }
        if (w != null) {
          const winnerIdx =
            typeof w === 'number' ? w : turnUserIdToIndex(room, w)
          if (winnerIdx != null && winnerIdx >= 0) setWinner(winnerIdx)
        }
      })
    }

    const onRoomUpdate = (data) => {
      const incoming = pick(data, 'players')
      if (!incoming) return
      setRoom((prev) => {
        const players = incoming.map((p, i) =>
          normalizePlayer(p, positionsRef.current, i),
        )
        const next = { ...(prev ?? {}), ...data, players }
        roomRef.current = next
        return next
      })
    }

    const onStateSync = (data) => {
      console.log('[sl] state_sync', data)
      const newPositions = pick(data, 'positions')
      if (Array.isArray(newPositions) && newPositions.length >= 1) {
        const arr = newPositions.slice(0, 2)
        positionsRef.current = arr
        setPositions(arr)
      }
      const currentTurn = pick(data, 'currentTurn', 'current_turn')
      const idx = turnUserIdToIndex(roomRef.current, currentTurn)
      if (idx != null) {
        turnIdxRef.current = idx
        setTurnIdx(idx)
      }
      const dice = pick(data, 'diceResult', 'dice_result')
      if (typeof dice === 'number') setDiceFace(dice)
      const w = pick(data, 'winner', 'winnerId')
      if (w != null) {
        const winnerIdx =
          typeof w === 'number' ? w : turnUserIdToIndex(roomRef.current, w)
        if (winnerIdx != null && winnerIdx >= 0) setWinner(winnerIdx)
      }

      // Pre-populate event log + dice debug from server's rollHistory if
      // present. Empty array on game start is normal.
      const history = pick(data, 'rollHistory', 'roll_history')
      if (Array.isArray(history)) {
        setRollHistory(history)
        const entries = history
          .map((h) => historyEntryToLog(h, roomRef.current))
          .filter(Boolean)
          .slice(-5)
        if (entries.length > 0) setLog(entries)
      }

      setReconnecting(false)
    }

    const onOpponentLeft = () => {
      toast.show({ message: 'Opponent left the game.', duration: 4000 })
    }

    socket.on('dice_result', onDiceResult)
    socket.on('room_update', onRoomUpdate)
    socket.on('state_sync', onStateSync)
    socket.on('opponent_left', onOpponentLeft)
    return () => {
      socket.off('dice_result', onDiceResult)
      socket.off('room_update', onRoomUpdate)
      socket.off('state_sync', onStateSync)
      socket.off('opponent_left', onOpponentLeft)
    }
  }, [animateMove, playStages, toast])

  // D key toggles a debug dice distribution overlay
  useEffect(() => {
    const handler = (e) => {
      const tag = e.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key === 'd' || e.key === 'D') setShowDiceDebug((v) => !v)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Derive my identity + whose turn from refs / state
  const myIdx = useMemo(() => {
    if (!room) return -1
    return room.players.findIndex(
      (p) =>
        (user?.id && p.userId === user.id) ||
        p.username?.toLowerCase() === displayName?.toLowerCase(),
    )
  }, [room, user?.id, displayName])

  const opponentForGuard =
    myIdx >= 0 && room?.players
      ? room.players.find((_, i) => i !== myIdx)
      : null
  const leaveModal = useGameLeaveGuard({
    active: winner == null && !!room,
    kind: 'multi',
    onForfeit: () => {
      const oppId =
        opponentForGuard?.userId ??
        opponentForGuard?.user_id ??
        opponentForGuard?.id ??
        null
      socket.emit('game_over', {
        roomCode,
        winnerId: oppId,
        loserId: user?.id,
        score: 0,
        reason: 'resign',
      })
    },
  })

  // Use server-provided currentTurn (userId) if available — otherwise
  // fall back to comparing player indices.
  const currentTurnUserId =
    room?.players?.[turnIdx]?.userId ??
    room?.players?.[turnIdx]?.user_id ??
    null
  const myTurn =
    winner == null &&
    !animating &&
    (currentTurnUserId
      ? currentTurnUserId === user?.id
      : myIdx === turnIdx)

  const handleRoll = useCallback(() => {
    if (!myTurn || rolling || animating || winner != null) return
    setRolling(true)
    if (spinRef.current) clearInterval(spinRef.current)
    spinRef.current = setInterval(() => {
      setDiceFace(1 + Math.floor(Math.random() * 6))
    }, 80)
    socket.emit('roll_dice', {
      roomCode,
      playerId: user?.id,
      playerIndex: myIdx,
    })
    setTimeout(() => {
      if (spinRef.current) clearInterval(spinRef.current)
      spinRef.current = null
      setRolling(false)
    }, 600)
  }, [animating, myIdx, myTurn, roomCode, rolling, user?.id, winner])

  const handleSync = useCallback(() => {
    if (reconnecting) return
    setReconnecting(true)
    if (socket.connected && user?.id) {
      socket.emit('reconnect_to_room', { roomCode, username: displayName })
    }
    // Auto-clear if state_sync doesn't arrive in 5s
    setTimeout(() => setReconnecting(false), 5000)
  }, [reconnecting, roomCode, user?.id, displayName])

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
      {showDiceDebug && (
        <DiceDistribution
          rollHistory={rollHistory}
          onClose={() => setShowDiceDebug(false)}
        />
      )}
      <Board
        positions={positions}
        winner={winner}
        room={room}
        flash={flash}
      />
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
        log={log}
        onRoll={handleRoll}
        onSync={handleSync}
        reconnecting={reconnecting}
        opponentDisconnected={opponentDc.disconnected}
        opponentDcUsername={opponentDc.username}
        opponentDcSeconds={opponentDc.secondsRemaining}
      />
      {leaveModal}
    </div>
  )
}

function Board({ positions, winner, room, flash }) {
  const cells = []
  for (let row = 0; row < SIZE; row++) {
    for (let col = 0; col < SIZE; col++) {
      cells.push({ row, col })
    }
  }
  // Inverse of squareToCell — used to label the rendered squares.
  const squareOf = (row, col) => {
    const fromBottom = SIZE - 1 - row
    const inRow = fromBottom % 2 === 0 ? col : SIZE - 1 - col
    return fromBottom * SIZE + inRow + 1
  }
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
          const flashCls =
            flash && flash.square === n
              ? flash.kind === 'snake'
                ? 'sl-flash-snake'
                : 'sl-flash-ladder'
              : ''
          return (
            <div
              key={n}
              data-square={n}
              className={`relative flex items-end justify-end p-1 font-arcade text-[9px] text-white/45 sm:text-[10px] ${bg} ${flashCls}`}
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
              {flashCls && (
                <span className="pointer-events-none absolute inset-0 flex items-center justify-center font-arcade text-sm text-white drop-shadow-[0_0_6px_currentColor] sm:text-base">
                  {flash.kind === 'snake' ? '🐍' : '🪜'}
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
          <marker
            id="ladderArrow"
            viewBox="0 0 6 6"
            refX="3"
            refY="3"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M0 0 L6 3 L0 6 z" fill="#00ff88" />
          </marker>
          <marker
            id="snakeArrow"
            viewBox="0 0 6 6"
            refX="3"
            refY="3"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M0 0 L6 3 L0 6 z" fill="#ff006e" />
          </marker>
        </defs>
        {Object.entries(LADDERS).map(([from, to]) => {
          const a = squareCenter(Number(from), VIRTUAL / SIZE)
          const b = squareCenter(Number(to), VIRTUAL / SIZE)
          if (!a || !b) return null
          // Bend toward the side opposite to the slope so multiple
          // ladders/snakes don't overlap at shared endpoints (eg. 63).
          const cx = (a.x + b.x) / 2 - 18
          const cy = (a.y + b.y) / 2 - 8
          return (
            <path
              key={`L${from}`}
              d={`M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`}
              stroke="#00ff88"
              strokeWidth="3.5"
              strokeOpacity="0.75"
              fill="none"
              markerEnd="url(#ladderArrow)"
            />
          )
        })}
        {Object.entries(SNAKES).map(([from, to]) => {
          const a = squareCenter(Number(from), VIRTUAL / SIZE)
          const b = squareCenter(Number(to), VIRTUAL / SIZE)
          if (!a || !b) return null
          const cx = (a.x + b.x) / 2 + 22
          const cy = (a.y + b.y) / 2 + 8
          return (
            <path
              key={`S${from}`}
              d={`M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`}
              stroke="#ff006e"
              strokeWidth="3.5"
              strokeOpacity="0.75"
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
  log,
  onRoll,
  onSync,
  reconnecting,
  opponentDisconnected,
  opponentDcUsername,
  opponentDcSeconds,
}) {
  const logRef = useRef(null)
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [log?.length])
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
                onTurn
                  ? 'border-neon-green/50 shadow-neon-green'
                  : 'border-white/10'
              }`}
            >
              <Avatar name={p?.username ?? '—'} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-arcade text-[10px] text-white">
                  {p?.username ?? 'Waiting…'} {me && '· YOU'}
                </p>
                <p
                  className="font-arcade text-[9px]"
                  style={{ color: TOKEN_COLORS[i] }}
                >
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

      <EventLog log={log} room={room} scrollRef={logRef} />

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

      {opponentDisconnected && (
        <div className="rounded-md border border-neon-pink/60 bg-arcadia-surface/85 px-3 py-2 shadow-neon-pink">
          <p className="font-arcade text-[10px] text-neon-pink">
            {opponentDcUsername ?? 'OPPONENT'} DISCONNECTED · {opponentDcSeconds}s
          </p>
          <p className="mt-1 text-[10px] text-white/55">Waiting for reconnect.</p>
        </div>
      )}

      <button
        type="button"
        onClick={onSync}
        disabled={reconnecting}
        className="rounded-md border border-white/15 px-3 py-2 font-arcade text-[9px] text-white/55 hover:border-neon-cyan/60 hover:text-neon-cyan disabled:opacity-50"
      >
        {reconnecting ? 'SYNCING…' : '↻ SYNC'}
      </button>

      <p className="text-center text-[10px] text-white/35">
        ↑ Ladders climb · ↓ Snakes slide
      </p>
    </aside>
  )
}

function EventLog({ log, room, scrollRef }) {
  return (
    <div className="rounded-md border border-white/10 bg-arcadia-bg/60 p-2">
      <p className="font-arcade text-[9px] text-white/45">LOG</p>
      <div
        ref={scrollRef}
        className="mt-1 max-h-32 space-y-0.5 overflow-y-auto font-mono text-[10px] leading-relaxed"
      >
        {!log || log.length === 0 ? (
          <p className="text-white/30">Waiting on first roll…</p>
        ) : (
          log.map((e, i) => {
            const me = e.playerIdx === 0
            const dotColor = TOKEN_COLORS[e.playerIdx % TOKEN_COLORS.length]
            const name =
              e.name ?? room?.players?.[e.playerIdx]?.username ?? 'Player'
            return (
              <div key={i} className="flex items-start gap-1.5">
                <span style={{ color: dotColor }}>●</span>
                <span className="text-white">{name}</span>
                <span className="text-white/70">{e.text}</span>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

function DiceDistribution({ rollHistory, onClose }) {
  const counts = [0, 0, 0, 0, 0, 0]
  for (const h of rollHistory ?? []) {
    const r = h?.roll
    if (typeof r === 'number' && r >= 1 && r <= 6) counts[r - 1] += 1
  }
  const max = Math.max(1, ...counts)
  return (
    <div className="fixed bottom-4 right-4 z-[1100] w-64 rounded-md border border-neon-cyan/50 bg-arcadia-bg/95 p-3 font-mono text-[10px] text-white/80 shadow-neon-cyan">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-arcade text-[9px] text-neon-cyan">
          DICE DEBUG · n={rollHistory?.length ?? 0}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="font-arcade text-[9px] text-white/40 hover:text-neon-pink"
          aria-label="Hide dice debug"
        >
          ✕
        </button>
      </div>
      {counts.map((c, i) => {
        const width = `${Math.round((c / max) * 100)}%`
        return (
          <div key={i} className="flex items-center gap-2">
            <span className="w-3 text-white/60">{i + 1}</span>
            <span
              className="inline-block h-2 rounded-sm bg-neon-green/70"
              style={{ width }}
            />
            <span className="text-white/70">{c}</span>
          </div>
        )
      })}
    </div>
  )
}
