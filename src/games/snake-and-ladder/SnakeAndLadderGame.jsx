import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useGameLeaveGuard } from '../../context/LeaveGuardContext'
import { useToast } from '../../context/ToastContext'
import { getRoom } from '../../lib/api'
import { socket } from '../../lib/socket'
import Avatar from '../../components/Avatar'
import { HallOfFameButton, WinParticles } from '../../components/GameOverFX'
import {
  LobbyBackLink,
  useArmGameOverFlash,
} from '../../context/GameOverFlashContext'
import { useOpponentDisconnect } from '../../hooks/useOpponentDisconnect'
import { useViewport } from '../../hooks/useViewport'
import { useFullscreen } from '../../hooks/useFullscreen'
import {
  GOAL,
  LADDERS,
  SIZE,
  SNAKES,
  computeStages,
  pathBetween,
  squareToCell,
} from './board'
import { LadderShape, SnakeShape, computeSlidePath } from './shapes'

const DICE_FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅']
const TOKEN_COLORS = ['#00ff88', '#ff006e']
const STEP_MS = 150
const SNAKE_SLIDE_MS = 800
const LADDER_CLIMB_MS = 600

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
  useArmGameOverFlash(winner != null)
  const [reconnecting, setReconnecting] = useState(false)
  const [flash, setFlash] = useState(null) // { square, kind, key }
  const [slides, setSlides] = useState([null, null]) // per token
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
  const wasDcRef = useRef(false)
  useEffect(() => {
    if (opponentDc.disconnected && !wasDcRef.current) {
      wasDcRef.current = true
      toast.warning(
        `${opponentDc.username ?? 'Opponent'} disconnected. Waiting for reconnect…`,
      )
    } else if (!opponentDc.disconnected && wasDcRef.current) {
      wasDcRef.current = false
      toast.success('Opponent reconnected.')
    }
  }, [opponentDc.disconnected, opponentDc.username, toast])

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

  // Bezier slide along a snake or ladder. Sets a per-token slide
  // descriptor that the Token reads to set its CSS offset-path; once
  // the animation duration elapses we update positions to the final
  // square and clear the slide.
  const slideAlong = useCallback(async (idx, fromSq, toSq, kind) => {
    const duration = kind === 'snake' ? SNAKE_SLIDE_MS : LADDER_CLIMB_MS
    const easing = kind === 'snake' ? 'ease-in' : 'ease-out'
    const key = `${kind}-${idx}-${Date.now()}`
    animatingRef.current = true
    setAnimating(true)
    setSlides((prev) => {
      const next = [...prev]
      next[idx] = { fromSq, toSq, kind, key, duration, easing }
      return next
    })
    await new Promise((res) => setTimeout(res, duration + 20))
    setPositions((prev) => {
      const next = [...prev]
      next[idx] = toSq
      positionsRef.current = next
      return next
    })
    setSlides((prev) => {
      const next = [...prev]
      next[idx] = null
      return next
    })
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

  // Play one chain (dice roll + any ladder/snake triggers) for a player.
  const playStages = useCallback(
    async (playerIdx, roll, finalAt) => {
      const start = positionsRef.current[playerIdx]
      const stages = computeStages({ start, roll, finalAt })
      if (stages.length === 0) return

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
          // Flash the square the token sits on (the trigger), brief
          // pause for legibility, then slide along the snake/ladder
          // bezier to the destination via CSS offset-path.
          triggerFlash(stage.from, stage.kind)
          // eslint-disable-next-line no-await-in-loop
          await new Promise((res) => setTimeout(res, 380))
          // eslint-disable-next-line no-await-in-loop
          await slideAlong(playerIdx, stage.from, stage.at, stage.kind)
        }
      }
    },
    [animateMove, slideAlong, triggerFlash],
  )

  // Socket handlers — depend only on stable identities so they don't
  // need to re-register on every state change.
  //
  // Every event that mutates the visible game (dice_result + state_sync)
  // runs inside a serial promise chain. Without this, two events
  // arriving in quick succession kick off two animations in parallel,
  // animatingRef and positions get scrambled, and the player ends up
  // seeing nothing happen until a manual refresh resyncs from the
  // server. With the queue, events apply in arrival order and the
  // winner overlay can't fire until the final move's animation has
  // played out.
  const queueRef = useRef(Promise.resolve())
  const enqueue = useCallback((work) => {
    queueRef.current = queueRef.current.then(work).catch((err) => {
      console.error('[sl] queue error', err)
    })
    return queueRef.current
  }, [])

  useEffect(() => {
    const onDiceResult = (data) => {
      const roll = pick(data, 'roll', 'value')
      const newPosition = pick(data, 'newPosition', 'position', 'landedOn')
      const nextTurn = pick(
        data,
        'nextTurn',
        'currentTurn',
        'currentTurnUserId',
        'turn',
      )
      const w = pick(data, 'winner', 'winnerId')
      const movingIdent = pick(
        data,
        'playerIndex',
        'player',
        'userId',
        'playerId',
      )

      // Dice face + history are fine to update synchronously — they
      // don't fight the animation queue.
      if (typeof roll === 'number') setDiceFace(roll)
      const rollNum = typeof roll === 'number' ? roll : null

      enqueue(async () => {
        const room = roomRef.current
        const playerIndex =
          typeof movingIdent === 'number'
            ? movingIdent
            : (turnUserIdToIndex(room, movingIdent) ?? turnIdxRef.current)

        if (rollNum != null) {
          const fromSquare = positionsRef.current[playerIndex] ?? 1
          const player =
            room?.players?.[playerIndex]?.userId ??
            room?.players?.[playerIndex]?.user_id ??
            room?.players?.[playerIndex]?.username ??
            playerIndex
          setRollHistory((prev) =>
            [
              ...prev,
              { player, roll: rollNum, from: fromSquare, final: newPosition },
            ].slice(-30),
          )
          await playStages(playerIndex, rollNum, newPosition)
        } else if (newPosition != null) {
          await animateMove(playerIndex, newPosition)
        }

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
          if (winnerIdx != null && winnerIdx >= 0) {
            // Hold the final board state visible for ~1.2s before
            // dropping the winner overlay, so the player actually sees
            // the winning move land on 100.
            await new Promise((res) => setTimeout(res, 1200))
            setWinner(winnerIdx)
          }
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
      // State_sync joins the same queue as dice_result so it can never
      // snap positions out from under an in-flight animation. The
      // snapshot only writes through when it actually disagrees with
      // the local state, so a no-op sync (e.g. server confirming a
      // turn we already played) doesn't visibly twitch the board.
      enqueue(async () => {
        const newPositions = pick(data, 'positions')
        if (Array.isArray(newPositions) && newPositions.length >= 1) {
          const arr = newPositions.slice(0, 2)
          const same =
            positionsRef.current.length === arr.length &&
            positionsRef.current.every((v, i) => v === arr[i])
          if (!same) {
            positionsRef.current = arr
            setPositions(arr)
          }
        }
        const gs = pick(data, 'gameState', 'game_state')
        const currentTurn =
          pick(data, 'currentTurn', 'current_turn') ??
          pick(gs, 'currentTurn', 'current_turn')
        const idx = turnUserIdToIndex(roomRef.current, currentTurn)
        if (idx != null && idx !== turnIdxRef.current) {
          turnIdxRef.current = idx
          setTurnIdx(idx)
        }
        const dice = pick(data, 'diceResult', 'dice_result')
        if (typeof dice === 'number') setDiceFace(dice)
        const w = pick(data, 'winner', 'winnerId')
        if (w != null) {
          const winnerIdx =
            typeof w === 'number'
              ? w
              : turnUserIdToIndex(roomRef.current, w)
          if (winnerIdx != null && winnerIdx >= 0) setWinner(winnerIdx)
        }

        const history = pick(data, 'rollHistory', 'roll_history')
        if (Array.isArray(history)) {
          setRollHistory(history)
        }

        setReconnecting(false)
      })
    }

    const onOpponentLeft = () => {
      toast.warning('Opponent left the game.')
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
  }, [animateMove, enqueue, playStages, toast])

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

  // Viewport-aware board size. On desktop the sidebar lives in its own
  // column so we only subtract the header; on mobile we subtract a
  // fixed controls strip (players + log + dice). In fullscreen we
  // give the board more room.
  const { width: vw, height: vh } = useViewport()
  const { isFullscreen } = useFullscreen()
  const isDesktop = vw >= 1024
  const sidebarWidth = isDesktop ? 304 : 0
  const headerH = isFullscreen ? 56 : 72
  const controlsH = isDesktop ? 24 : isFullscreen ? 200 : 280
  const pad = isFullscreen ? 8 : 16
  const availW = Math.max(0, vw - sidebarWidth - pad * 2)
  const availH = Math.max(0, vh - headerH - controlsH - pad * 2)
  const boardSize = Math.max(
    260,
    Math.min(availW, availH, isFullscreen ? 760 : 600),
  )
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
    <div className="flex h-full flex-col gap-3 lg:grid lg:grid-cols-[auto_18rem] lg:gap-5">
      {showDiceDebug && (
        <DiceDistribution
          rollHistory={rollHistory}
          onClose={() => setShowDiceDebug(false)}
        />
      )}
      <div className="flex shrink-0 flex-col items-center gap-2 lg:row-span-1">
        <TurnBanner
          room={room}
          myIdx={myIdx}
          turnIdx={turnIdx}
          myTurn={myTurn}
          winner={winner}
          animating={animating}
        />
        <Board
          positions={positions}
          slides={slides}
          winner={winner}
          myIdx={myIdx}
          signedIn={!!user}
          room={room}
          flash={flash}
          size={boardSize}
        />
      </div>
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

function TurnBanner({ room, myIdx, turnIdx, myTurn, winner, animating }) {
  if (winner != null) return null
  const opponent =
    myIdx >= 0 && room?.players
      ? room.players.find((_, i) => i !== myIdx)
      : null
  const turnPlayer = room?.players?.[turnIdx]
  let label
  let tone
  if (animating) {
    label = 'MOVING…'
    tone = 'cyan'
  } else if (myTurn) {
    label = 'YOUR TURN'
    tone = 'green'
  } else {
    const name = (opponent?.username ?? turnPlayer?.username ?? 'OPPONENT').toUpperCase()
    label = `WAITING FOR ${name}`
    tone = 'dim'
  }
  const cls =
    tone === 'green'
      ? 'border-neon-green/70 bg-neon-green/10 text-neon-green shadow-neon-green'
      : tone === 'cyan'
        ? 'border-neon-cyan/60 bg-neon-cyan/10 text-neon-cyan'
        : 'border-white/10 bg-arcadia-surface/60 text-white/55'
  return (
    <div
      className={`inline-flex items-center justify-center rounded-md border px-3 py-1.5 font-arcade text-[10px] tracking-wider transition ${cls}`}
    >
      {label}
    </div>
  )
}

function Board({ positions, slides = [null, null], winner, myIdx, signedIn, room, flash, size = 560 }) {
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
      className="relative shrink-0 self-start rounded-xl border-2 border-neon-cyan/50 bg-arcadia-surface p-2 shadow-neon-cyan"
      style={{ width: size, height: size }}
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
        {Object.entries(LADDERS).map(([from, to]) => (
          <LadderShape
            key={`L${from}`}
            from={Number(from)}
            to={Number(to)}
            unit={VIRTUAL / SIZE}
          />
        ))}
        {Object.entries(SNAKES).map(([from, to]) => (
          <SnakeShape
            key={`S${from}`}
            from={Number(from)}
            to={Number(to)}
            unit={VIRTUAL / SIZE}
          />
        ))}
      </svg>

      {[0, 1].map((i) =>
        positions[i] != null && room.players[i] ? (
          <Token
            key={i}
            position={positions[i]}
            color={TOKEN_COLORS[i]}
            offset={i}
            slide={slides[i]}
            boardSize={size}
          />
        ) : null,
      )}

      {winner != null && (
        <div
          className="go-overlay-in pixel-corners pixel-corners-amber absolute inset-2 flex flex-col items-center justify-center overflow-hidden"
          style={{
            background: 'rgba(5, 5, 8, 0.85)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            border: '1px solid rgba(255, 215, 0, 0.4)',
            borderRadius: 12,
          }}
        >
          {winner === myIdx && <WinParticles />}
          <p
            className={`relative font-arcade text-2xl drop-shadow-[0_0_18px_currentColor] ${
              winner !== myIdx && myIdx != null ? 'go-shake' : ''
            }`}
            style={{ color: TOKEN_COLORS[winner] }}
          >
            <span className="go-icon-pop">★</span>{' '}
            {room.players[winner]?.username?.toUpperCase()} WINS{' '}
            <span className="go-icon-pop">★</span>
          </p>
          <div className="relative mt-5 flex flex-col gap-2 sm:flex-row">
            <HallOfFameButton signedIn={signedIn} />
            <LobbyBackLink className="rounded-md border border-neon-cyan/60 bg-neon-cyan/10 px-4 py-2 text-center font-arcade text-[10px] text-neon-cyan hover:bg-neon-cyan/20 hover:shadow-neon-cyan">
              BACK TO LOBBY
            </LobbyBackLink>
          </div>
        </div>
      )}
    </div>
  )
}

function Token({ position, color, offset, slide, boardSize = 560 }) {
  const cell = squareToCell(position)
  if (!cell) return null
  const dx = offset === 0 ? -12 : 12
  const dy = offset === 0 ? -8 : 8

  if (slide) {
    const sp = computeSlidePath({
      fromSq: slide.fromSq,
      toSq: slide.toSq,
      boardSize,
      kind: slide.kind,
    })
    if (sp) {
      return (
        <span
          key={slide.key}
          className="absolute z-10 grid h-5 w-5 place-items-center rounded-full sm:h-6 sm:w-6"
          style={{
            backgroundColor: color,
            boxShadow: `0 0 14px ${color}80, inset 0 0 4px rgba(0,0,0,0.45)`,
            left: `${sp.sx + dx}px`,
            top: `${sp.sy + dy}px`,
            transform: 'translate(-50%, -50%)',
            offsetPath: sp.path,
            offsetDistance: '0%',
            animation: `sl-slide-along ${slide.duration}ms ${slide.easing} forwards`,
          }}
        />
      )
    }
  }

  return (
    <span
      className="absolute z-10 grid h-5 w-5 place-items-center rounded-full transition-all duration-150 sm:h-6 sm:w-6"
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
  onSync,
  reconnecting,
  opponentDisconnected,
  opponentDcUsername,
  opponentDcSeconds,
}) {
  return (
    <aside className="flex shrink-0 flex-col gap-2 lg:gap-3">
      {/* Player row — horizontal on mobile, vertical on desktop */}
      <div className="flex flex-row gap-2 lg:flex-col">
        {[0, 1].map((i) => {
          const p = room.players[i]
          const me = i === myIdx
          const onTurn = i === turnIdx && winner == null
          return (
            <div
              key={i}
              className={`flex flex-1 items-center gap-2 rounded-lg border bg-arcadia-surface/70 px-2 py-1.5 lg:gap-3 lg:px-3 lg:py-2 ${
                onTurn
                  ? 'border-neon-green/60 shadow-neon-green'
                  : 'border-white/10'
              }`}
            >
              <span
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-full lg:hidden"
                style={{ backgroundColor: TOKEN_COLORS[i] }}
              />
              <span className="hidden lg:inline-flex">
                <Avatar name={p?.username ?? '—'} size="md" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-arcade text-[9px] leading-tight text-white lg:text-[10px]">
                  {p?.username ?? 'Waiting…'} {me && '· YOU'}
                </p>
                <p
                  className="font-arcade text-[8px] leading-tight lg:text-[9px]"
                  style={{ color: TOKEN_COLORS[i] }}
                >
                  SQ {positions[i] ?? 1}
                </p>
              </div>
              {onTurn && (
                <span className="font-arcade text-[8px] text-neon-green lg:text-[9px]">
                  TURN
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* Dice row — horizontal on mobile, vertical on desktop */}
      <div className="flex shrink-0 items-stretch gap-2 rounded-lg border border-white/10 bg-arcadia-surface/70 p-2 lg:flex-col lg:p-4 lg:text-center">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-md bg-arcadia-bg text-4xl text-neon-green drop-shadow-[0_0_10px_rgba(0,255,136,0.45)] lg:my-2 lg:h-auto lg:w-auto lg:bg-transparent lg:text-6xl">
          {diceFace ? DICE_FACES[diceFace - 1] : '·'}
        </div>
        <button
          type="button"
          onClick={onRoll}
          disabled={!myTurn || rolling || animating || winner != null}
          className={`flex-1 rounded-md border-2 px-3 py-2 font-arcade text-[11px] transition ${
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
        className="hidden rounded-md border border-white/15 px-3 py-2 font-arcade text-[9px] text-white/55 hover:border-neon-cyan/60 hover:text-neon-cyan disabled:opacity-50 lg:block"
      >
        {reconnecting ? 'SYNCING…' : '↻ SYNC'}
      </button>

      <p className="hidden text-center text-[10px] text-white/35 lg:block">
        ↑ Ladders climb · ↓ Snakes slide
      </p>
    </aside>
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
