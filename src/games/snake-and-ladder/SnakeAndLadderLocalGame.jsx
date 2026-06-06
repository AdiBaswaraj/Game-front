import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Avatar from '../../components/Avatar'
import { RobotIcon } from '../../assets/icons/index.jsx'
import { WinParticles } from '../../components/GameOverFX'
import { useGameLeaveGuard } from '../../context/LeaveGuardContext'
import {
  LobbyBackLink,
  useArmGameOverFlash,
} from '../../context/GameOverFlashContext'
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
const TOKEN_COLORS = ['#00ff88', '#ff006e', '#00d4ff', '#ffaa00']
const STEP_MS = 150
const SNAKE_SLIDE_MS = 800
const LADDER_CLIMB_MS = 600
const CPU_THINK_MS = 700

export default function SnakeAndLadderLocalGame({
  playerNames,
  cpuIndices = new Set(),
}) {
  const players = playerNames
  const [positions, setPositions] = useState(() => players.map(() => 1))
  const [slides, setSlides] = useState(() => players.map(() => null))
  const [turnIdx, setTurnIdx] = useState(0)
  const [diceFace, setDiceFace] = useState(null)
  const [rolling, setRolling] = useState(false)
  const [animating, setAnimating] = useState(false)
  const [winner, setWinner] = useState(null)
  useArmGameOverFlash(winner != null)
  const leaveModal = useGameLeaveGuard({
    active: winner == null,
    kind: 'single',
  })
  const [log, setLog] = useState([])
  const [flash, setFlash] = useState(null)
  const [rollHistory, setRollHistory] = useState([])
  const [showDiceDebug, setShowDiceDebug] = useState(false)
  const spinRef = useRef(null)
  const flashTimerRef = useRef(null)

  useEffect(() => {
    const handler = (e) => {
      const tag = e.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key === 'd' || e.key === 'D') setShowDiceDebug((v) => !v)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

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

  // Bezier slide along a snake or ladder via CSS offset-path. Mirror
  // of slideAlong in the multiplayer game.
  const slideAlong = useCallback(async (idx, fromSq, toSq, kind) => {
    const duration = kind === 'snake' ? SNAKE_SLIDE_MS : LADDER_CLIMB_MS
    const easing = kind === 'snake' ? 'ease-in' : 'ease-out'
    const key = `${kind}-${idx}-${Date.now()}`
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
      return next
    })
    setSlides((prev) => {
      const next = [...prev]
      next[idx] = null
      return next
    })
    setAnimating(false)
  }, [])

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
    // Local rollHistory: same shape as the backend (player, roll, from,
    // final). CPU + local rolls don't go server-side, so we maintain
    // this purely client-side for the D-key debug overlay.
    const finalLanding =
      stages.length === 0 ? cur : stages[stages.length - 1].at
    setRollHistory((prev) =>
      [...prev, { player: idx, roll, from: cur, final: finalLanding }].slice(-30),
    )

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
          await new Promise((res) => setTimeout(res, 300))
        }
      } else {
        triggerFlash(stage.from, stage.kind)
        // eslint-disable-next-line no-await-in-loop
        await new Promise((res) => setTimeout(res, 380))
        // eslint-disable-next-line no-await-in-loop
        await slideAlong(idx, stage.from, stage.at, stage.kind)
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
    slideAlong,
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
    setSlides(players.map(() => null))
    setTurnIdx(0)
    setDiceFace(null)
    setRolling(false)
    setAnimating(false)
    setWinner(null)
    setLog([])
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
        slides={slides}
        winner={winner}
        players={players}
        cpuIndices={cpuIndices}
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
      {leaveModal}
    </div>
  )
}

function Board({ positions, slides = [], winner, players, cpuIndices, flash }) {
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

  // Track the rendered board pixel size so the Token slide animation
  // can compute its offset-path in real pixel coordinates.
  const boardRef = useRef(null)
  const [boardPx, setBoardPx] = useState(560)
  useEffect(() => {
    const el = boardRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (rect && rect.width > 0) setBoardPx(rect.width)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div
      ref={boardRef}
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

      {players.map((_, i) => (
        <Token
          key={i}
          position={positions[i]}
          color={TOKEN_COLORS[i % TOKEN_COLORS.length]}
          offset={i}
          slide={slides[i]}
          boardSize={boardPx}
        />
      ))}

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
          <WinParticles />
          <p
            className="relative font-arcade text-2xl drop-shadow-[0_0_18px_currentColor]"
            style={{ color: TOKEN_COLORS[winner % TOKEN_COLORS.length] }}
          >
            <span className="go-icon-pop">★</span>{' '}
            {winner === 0
              ? 'YOU BEAT THE BOT!'
              : cpuIndices.has(winner)
                ? `${players[winner]?.toUpperCase()} WINS!`
                : `${players[winner]?.toUpperCase()} WINS`}{' '}
            <span className="go-icon-pop">★</span>
          </p>
        </div>
      )}
    </div>
  )
}

function Token({ position, color, offset, slide, boardSize = 560 }) {
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
            left: `${sp.sx + o.dx}px`,
            top: `${sp.sy + o.dy}px`,
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
                <p className="flex items-center gap-1.5 truncate font-arcade text-[10px] text-white">
                  <span>{name}</span>
                  {cpuIndices.has(i) && (
                    <span
                      className="inline-flex items-center gap-1 text-neon-cyan/80"
                      title="Bot"
                    >
                      <RobotIcon size={12} />
                      <span className="text-[9px]">BOT</span>
                    </span>
                  )}
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
                ? 'BOT THINKING…'
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
          <LobbyBackLink className="rounded-md border border-white/15 px-3 py-2 text-center font-arcade text-[10px] text-white/55 hover:border-neon-cyan/60 hover:text-neon-cyan">
            BACK TO LOBBY
          </LobbyBackLink>
        </div>
      )}
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
