import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Avatar from '../../components/Avatar'
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
const TOKEN_COLORS = ['#00ff88', '#ff006e', '#00d4ff', '#ffaa00']
const STEP_MS = 200
const CPU_THINK_MS = 700

export default function SnakeAndLadderLocalGame({
  playerNames,
  cpuIndices = new Set(),
}) {
  const players = playerNames
  const [positions, setPositions] = useState(() => players.map(() => 1))
  const [turnIdx, setTurnIdx] = useState(0)
  const [diceFace, setDiceFace] = useState(null)
  const [rolling, setRolling] = useState(false)
  const [animating, setAnimating] = useState(false)
  const [winner, setWinner] = useState(null)
  const [log, setLog] = useState([])
  const [flash, setFlash] = useState(null)
  const spinRef = useRef(null)
  const flashTimerRef = useRef(null)

  const triggerFlash = useCallback((square, kind) => {
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
    setFlash(null)
    setTimeout(() => {
      setFlash({ square, kind, key: Date.now() })
      flashTimerRef.current = setTimeout(() => setFlash(null), 650)
    }, 16)
  }, [])

  const pushLog = useCallback((entry) => {
    setLog((prev) => [...prev, entry].slice(-5))
  }, [])

  const isCpuTurn = cpuIndices.has(turnIdx) && winner == null && !animating

  const animateMove = useCallback(
    async (idx, fromSquare, finalSquare) => {
      setAnimating(true)
      // Walk to the dice-landed square first
      const path = pathBetween(fromSquare, finalSquare)
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
    },
    [],
  )

  const performRoll = useCallback(async () => {
    if (winner != null || animating) return
    setRolling(true)
    if (spinRef.current) clearInterval(spinRef.current)
    spinRef.current = setInterval(() => {
      setDiceFace(1 + Math.floor(Math.random() * 6))
    }, 70)

    await new Promise((res) => setTimeout(res, 600))
    if (spinRef.current) {
      clearInterval(spinRef.current)
      spinRef.current = null
    }
    const roll = 1 + Math.floor(Math.random() * 6)
    setDiceFace(roll)
    setRolling(false)

    const idx = turnIdx
    const cur = positions[idx]
    const stages = computeStages({ start: cur, roll })

    if (stages.length === 0) {
      pushLog({
        playerIdx: idx,
        name: players[idx],
        text: `rolled a ${roll} — overshoot, stays on ${cur}`,
      })
      setTurnIdx((idx + 1) % players.length)
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
    pushLog({ playerIdx: idx, name: players[idx], text: parts.join(' → ') })

    let curSquare = cur
    for (let i = 0; i < stages.length; i++) {
      const stage = stages[i]
      if (i === 0) {
        // eslint-disable-next-line no-await-in-loop
        await animateMove(idx, curSquare, stage.at)
        if (stages.length > 1) {
          // eslint-disable-next-line no-await-in-loop
          await new Promise((res) => setTimeout(res, 280))
        }
      } else {
        triggerFlash(stage.from, stage.kind)
        const dropSize = Math.abs(stage.from - stage.at)
        const pauseMs =
          stage.kind === 'snake'
            ? 450 + Math.min(550, dropSize * 4)
            : 450
        // eslint-disable-next-line no-await-in-loop
        await new Promise((res) => setTimeout(res, pauseMs))
        // eslint-disable-next-line no-await-in-loop
        await animateMove(idx, curSquare, stage.at)
      }
      curSquare = stage.at
    }

    if (curSquare === GOAL) {
      setWinner(idx)
      return
    }
    setTurnIdx((idx + 1) % players.length)
  }, [
    animating,
    animateMove,
    players,
    positions,
    pushLog,
    triggerFlash,
    turnIdx,
    winner,
  ])

  // Auto-roll for CPU
  useEffect(() => {
    if (!isCpuTurn) return
    const t = setTimeout(() => {
      performRoll()
    }, CPU_THINK_MS)
    return () => clearTimeout(t)
  }, [isCpuTurn, performRoll])

  const reset = () => {
    setPositions(players.map(() => 1))
    setTurnIdx(0)
    setDiceFace(null)
    setRolling(false)
    setAnimating(false)
    setWinner(null)
    setLog([])
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[auto_18rem]">
      <Board
        positions={positions}
        winner={winner}
        players={players}
        flash={flash}
      />
      <Sidebar
        players={players}
        cpuIndices={cpuIndices}
        positions={positions}
        turnIdx={turnIdx}
        diceFace={diceFace}
        rolling={rolling}
        animating={animating}
        winner={winner}
        log={log}
        onRoll={performRoll}
        onReset={reset}
      />
    </div>
  )
}

function Board({ positions, winner, players, flash }) {
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
              className={`relative flex items-end justify-end p-1 font-arcade text-[9px] text-white/45 sm:text-[10px] ${bg} ${flashCls}`}
            >
              <span>{n}</span>
              {LADDERS[n] != null && (
                <span className="absolute left-1 top-1 text-[9px] text-neon-green">
                  ↑
                </span>
              )}
              {SNAKES[n] != null && (
                <span className="absolute left-1 top-1 text-[9px] text-neon-pink">
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
          <marker id="ladderArrowL" viewBox="0 0 6 6" refX="3" refY="3" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M0 0 L6 3 L0 6 z" fill="#00ff88" />
          </marker>
          <marker id="snakeArrowL" viewBox="0 0 6 6" refX="3" refY="3" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M0 0 L6 3 L0 6 z" fill="#ff006e" />
          </marker>
        </defs>
        {Object.entries(LADDERS).map(([from, to]) => {
          const a = squareCenter(Number(from), VIRTUAL / SIZE)
          const b = squareCenter(Number(to), VIRTUAL / SIZE)
          if (!a || !b) return null
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
              markerEnd="url(#ladderArrowL)"
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
              markerEnd="url(#snakeArrowL)"
            />
          )
        })}
      </svg>

      {players.map((_, i) => (
        <Token
          key={i}
          position={positions[i]}
          color={TOKEN_COLORS[i % TOKEN_COLORS.length]}
          offset={i}
        />
      ))}

      {winner != null && (
        <div className="absolute inset-2 flex flex-col items-center justify-center rounded-md bg-arcadia-bg/85 backdrop-blur-sm">
          <p
            className="font-arcade text-2xl drop-shadow-[0_0_18px_currentColor]"
            style={{ color: TOKEN_COLORS[winner % TOKEN_COLORS.length] }}
          >
            ★ {players[winner]?.toUpperCase()} WINS ★
          </p>
        </div>
      )}
    </div>
  )
}

function Token({ position, color, offset }) {
  const cell = squareToCell(position)
  if (!cell) return null
  // Spread up to four tokens around a square
  const corners = [
    { dx: -10, dy: -8 },
    { dx: 10, dy: -8 },
    { dx: -10, dy: 8 },
    { dx: 10, dy: 8 },
  ]
  const o = corners[offset % corners.length]
  return (
    <span
      className="absolute z-10 grid h-5 w-5 place-items-center rounded-full transition-all duration-200 sm:h-6 sm:w-6"
      style={{
        backgroundColor: color,
        boxShadow: `0 0 14px ${color}80, inset 0 0 4px rgba(0,0,0,0.45)`,
        left: `calc(${(cell.col + 0.5) * (100 / SIZE)}% + ${o.dx}px)`,
        top: `calc(${(cell.row + 0.5) * (100 / SIZE)}% + ${o.dy}px)`,
        transform: 'translate(-50%, -50%)',
      }}
    />
  )
}

function Sidebar({
  players,
  cpuIndices,
  positions,
  turnIdx,
  diceFace,
  rolling,
  animating,
  winner,
  log,
  onRoll,
  onReset,
}) {
  const canRoll = winner == null && !rolling && !animating
  const cpu = cpuIndices.has(turnIdx)
  return (
    <aside className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        {players.map((name, i) => {
          const onTurn = i === turnIdx && winner == null
          return (
            <div
              key={i}
              className={`flex items-center gap-3 rounded-lg border bg-arcadia-surface/70 px-3 py-2 ${
                onTurn ? 'border-neon-green/50 shadow-neon-green' : 'border-white/10'
              }`}
            >
              <Avatar name={name} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-arcade text-[10px] text-white">
                  {name} {cpuIndices.has(i) && '· CPU'}
                </p>
                <p
                  className="font-arcade text-[9px]"
                  style={{ color: TOKEN_COLORS[i % TOKEN_COLORS.length] }}
                >
                  SQUARE {positions[i]}
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
          disabled={!canRoll || cpu}
          className={`mt-2 w-full rounded-md border-2 py-2.5 font-arcade text-[11px] transition ${
            canRoll && !cpu
              ? 'border-neon-green/70 bg-neon-green/10 text-neon-green hover:bg-neon-green/20 hover:shadow-neon-green'
              : 'cursor-not-allowed border-white/15 text-white/35'
          }`}
        >
          {winner != null
            ? 'GAME OVER'
            : rolling || animating
              ? 'ROLLING…'
              : cpu
                ? 'CPU THINKING…'
                : `🎲 ROLL — ${players[turnIdx]}`}
        </button>
      </div>

      <div className="rounded-md border border-white/10 bg-arcadia-bg/60 p-2">
        <p className="font-arcade text-[9px] text-white/45">LOG</p>
        <div className="mt-1 max-h-32 space-y-0.5 overflow-y-auto font-mono text-[10px] leading-relaxed">
          {log.length === 0 ? (
            <p className="text-white/30">First roll up to {players[turnIdx]}.</p>
          ) : (
            log.map((e, i) => (
              <div key={i} className="flex items-start gap-1.5">
                <span
                  style={{
                    color: TOKEN_COLORS[e.playerIdx % TOKEN_COLORS.length],
                  }}
                >
                  ●
                </span>
                <span className="text-white">{e.name}</span>
                <span className="text-white/70">{e.text}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {winner != null && (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onReset}
            className="rounded-md border border-neon-green/70 bg-neon-green/10 px-3 py-2 font-arcade text-[10px] text-neon-green hover:bg-neon-green/20 hover:shadow-neon-green"
          >
            ▶ PLAY AGAIN
          </button>
          <Link
            to="/"
            className="rounded-md border border-white/15 px-3 py-2 text-center font-arcade text-[10px] text-white/55 hover:border-neon-cyan/60 hover:text-neon-cyan"
          >
            BACK TO LOBBY
          </Link>
        </div>
      )}
    </aside>
  )
}
