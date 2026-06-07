import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useGameLeaveGuard } from '../../context/LeaveGuardContext'
import { useArmGameOverFlash } from '../../context/GameOverFlashContext'
import { LobbyBackLink } from '../../context/GameOverFlashContext'
import { useSquareGameSize } from '../../hooks/useViewport'
import { useFullscreen } from '../../hooks/useFullscreen'

// ===== Constants =====
const GRID = 20
const ROUND_MS = 120 * 1000 // 2 minute round
const RESPAWN_MS = 1500
const SPEED_FLOOR_MS = 90 // a hair slower than solo so it stays
                          // playable with two simultaneous decisions
const INITIAL_INTERVAL_MS = 180

const UP = { x: 0, y: -1 }
const DOWN = { x: 0, y: 1 }
const LEFT = { x: -1, y: 0 }
const RIGHT = { x: 1, y: 0 }

const DEATH_FLASH_MS = 350
const DEATH_EXPLODE_MS = 350
const DEATH_TOTAL_MS = DEATH_FLASH_MS + DEATH_EXPLODE_MS

// Per-player palette. p1 is the lobby green that everyone learns
// from the solo game; p2 takes the matching pink so the contrast is
// instantly readable on both light and dark squares.
const PALETTE = {
  p1: {
    head: '#00ff88',
    body: ['#00dd77', '#00bb66', '#00bb66', '#009955'],
    tail: '#007744',
    glow: 'rgba(0, 255, 136, 0.45)',
    label: 'P1',
  },
  p2: {
    head: '#ff006e',
    body: ['#ee0066', '#cc0055', '#cc0055', '#aa0044'],
    tail: '#88003a',
    glow: 'rgba(255, 0, 110, 0.45)',
    label: 'P2',
  },
}

function bodySegmentColor(player, idx, total) {
  const pal = PALETTE[player]
  if (idx === 0) return pal.head
  if (idx >= total - 2 && total > 4) return pal.tail
  if (idx - 1 < pal.body.length) return pal.body[idx - 1]
  return pal.body[pal.body.length - 1]
}

function paintRoundedRect(ctx, x, y, w, h, r) {
  if (ctx.roundRect) {
    ctx.beginPath()
    ctx.roundRect(x, y, w, h, r)
    ctx.fill()
  } else {
    ctx.fillRect(x, y, w, h)
  }
}

function eyeOffsets(dir, C, eyeSize) {
  const near = Math.round(C * 0.18)
  const far = C - eyeSize - near
  if (dir.x === 1)
    return [
      { x: far, y: near },
      { x: far, y: far },
    ]
  if (dir.x === -1)
    return [
      { x: near, y: near },
      { x: near, y: far },
    ]
  if (dir.y === -1)
    return [
      { x: near, y: near },
      { x: far, y: near },
    ]
  return [
    { x: near, y: far },
    { x: far, y: far },
  ]
}

function isReverse(a, b) {
  return a.x === -b.x && a.y === -b.y
}

function cellsOverlap(a, b) {
  return a.x === b.x && a.y === b.y
}

function randomEmptyCell(blocked) {
  // blocked is a Set of "x,y" strings
  for (let attempt = 0; attempt < 200; attempt++) {
    const x = Math.floor(Math.random() * GRID)
    const y = Math.floor(Math.random() * GRID)
    if (!blocked.has(`${x},${y}`)) return { x, y }
  }
  // Pathological: just scan for any empty cell
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      if (!blocked.has(`${x},${y}`)) return { x, y }
    }
  }
  return { x: 0, y: 0 }
}

function makeP1Snake() {
  return [
    { x: 4, y: 4 },
    { x: 3, y: 4 },
    { x: 2, y: 4 },
  ]
}

function makeP2Snake() {
  return [
    { x: GRID - 5, y: GRID - 5 },
    { x: GRID - 4, y: GRID - 5 },
    { x: GRID - 3, y: GRID - 5 },
  ]
}

function makeFood(state) {
  const blocked = new Set()
  for (const seg of state.p1.body) blocked.add(`${seg.x},${seg.y}`)
  for (const seg of state.p2.body) blocked.add(`${seg.x},${seg.y}`)
  return randomEmptyCell(blocked)
}

function initialState() {
  const p1 = {
    body: makeP1Snake(),
    dir: RIGHT,
    nextDir: RIGHT,
    score: 0,
    alive: true,
    deathAt: 0,
    deathVecs: [],
    respawnAt: 0,
  }
  const p2 = {
    body: makeP2Snake(),
    dir: LEFT,
    nextDir: LEFT,
    score: 0,
    alive: true,
    deathAt: 0,
    deathVecs: [],
    respawnAt: 0,
  }
  return {
    p1,
    p2,
    food: { x: Math.floor(GRID / 2), y: Math.floor(GRID / 2) },
    lastTick: 0,
    interval: INITIAL_INTERVAL_MS,
    startedAt: 0,
  }
}

function safeSpawnFor(state, who) {
  const other = who === 'p1' ? 'p2' : 'p1'
  const blocked = new Set()
  for (const seg of state[other].body) blocked.add(`${seg.x},${seg.y}`)
  blocked.add(`${state.food.x},${state.food.y}`)
  // Try to keep the spawn away from the other snake's head so the
  // respawning player doesn't instantly die again.
  for (let attempt = 0; attempt < 60; attempt++) {
    const c = randomEmptyCell(blocked)
    const head = state[other].body[0]
    const dx = c.x - head.x
    const dy = c.y - head.y
    if (Math.hypot(dx, dy) >= 4) return c
  }
  return randomEmptyCell(blocked)
}

function respawnSnake(state, who) {
  const head = safeSpawnFor(state, who)
  const dir = head.x < GRID / 2 ? RIGHT : LEFT
  const body = [head]
  for (let i = 1; i < 3; i++) {
    body.push({ x: head.x - dir.x * i, y: head.y - dir.y * i })
  }
  state[who].body = body
  state[who].dir = dir
  state[who].nextDir = dir
  state[who].alive = true
  state[who].respawnAt = 0
}

export default function SnakeDuoGame() {
  const canvasRef = useRef(null)
  const stateRef = useRef(initialState())
  const statusRef = useRef('idle')

  const [p1Score, setP1Score] = useState(0)
  const [p2Score, setP2Score] = useState(0)
  const [remainingMs, setRemainingMs] = useState(ROUND_MS)
  const [status, setStatus] = useState('idle') // idle | playing | gameover
  useArmGameOverFlash(status === 'gameover')

  const leaveModal = useGameLeaveGuard({
    active: status === 'playing',
    kind: 'single',
  })
  const pausedRef = useRef(false)
  pausedRef.current = !!leaveModal && status === 'playing'

  const { isFullscreen } = useFullscreen()
  const canvasSize = useSquareGameSize({
    headerHeight: isFullscreen ? 56 : 72,
    // Reserve room for the score bar + two D-pads stacked or side by
    // side beneath the canvas.
    controlsHeight: isFullscreen ? 220 : 280,
    padding: isFullscreen ? 8 : 16,
    minSize: 240,
    maxSize: isFullscreen ? 640 : 540,
  })
  const cellSize = canvasSize / GRID

  const startGame = useCallback(() => {
    stateRef.current = initialState()
    stateRef.current.startedAt = performance.now()
    setP1Score(0)
    setP2Score(0)
    setRemainingMs(ROUND_MS)
    statusRef.current = 'playing'
    setStatus('playing')
  }, [])

  const queueDir = useCallback((who, nd) => {
    const s = stateRef.current[who]
    if (!s.alive) return
    if (isReverse(s.dir, nd)) return
    s.nextDir = nd
  }, [])

  // Keyboard input — P1 = WASD, P2 = Arrow keys
  useEffect(() => {
    const handler = (e) => {
      const k = e.key
      const lower = typeof k === 'string' ? k.toLowerCase() : ''
      if (k === ' ' || k === 'Enter') {
        e.preventDefault()
        if (statusRef.current !== 'playing') startGame()
        return
      }
      let who = null
      let nd = null
      if (lower === 'w') {
        who = 'p1'
        nd = UP
      } else if (lower === 's') {
        who = 'p1'
        nd = DOWN
      } else if (lower === 'a') {
        who = 'p1'
        nd = LEFT
      } else if (lower === 'd') {
        who = 'p1'
        nd = RIGHT
      } else if (k === 'ArrowUp') {
        who = 'p2'
        nd = UP
      } else if (k === 'ArrowDown') {
        who = 'p2'
        nd = DOWN
      } else if (k === 'ArrowLeft') {
        who = 'p2'
        nd = LEFT
      } else if (k === 'ArrowRight') {
        who = 'p2'
        nd = RIGHT
      }
      if (who && nd) {
        e.preventDefault()
        if (statusRef.current === 'idle') startGame()
        if (statusRef.current === 'playing') queueDir(who, nd)
      }
    }
    window.addEventListener('keydown', handler, { passive: false })
    return () => window.removeEventListener('keydown', handler)
  }, [startGame, queueDir])

  // No-scroll on canvas drag
  useEffect(() => {
    const prevent = (e) => {
      if (e.target && e.target.closest?.('.game-no-scroll')) {
        e.preventDefault()
      }
    }
    document.addEventListener('touchmove', prevent, { passive: false })
    return () => document.removeEventListener('touchmove', prevent)
  }, [])

  // Mirror canvas dims into a ref so the long-lived render loop can
  // grab the latest values cheaply.
  const sizeRef = useRef({ canvas: canvasSize, cell: cellSize })
  useEffect(() => {
    sizeRef.current = { canvas: canvasSize, cell: cellSize }
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = canvasSize * dpr
    canvas.height = canvasSize * dpr
    canvas.style.width = `${canvasSize}px`
    canvas.style.height = `${canvasSize}px`
    const ctx = canvas.getContext('2d')
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.scale(dpr, dpr)
  }, [canvasSize, cellSize])

  // ===== Game loop =====
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let rafId
    // Last-shown second; we only call setRemainingMs when the
    // displayed digit would actually change so we're not re-rendering
    // the score bar 60 times a second.
    let lastShownSec = -1

    const killSnake = (state, who, ts) => {
      if (!state[who].alive) return
      state[who].alive = false
      state[who].deathAt = ts
      state[who].score = 0
      state[who].deathVecs = state[who].body.map(() => {
        const angle = Math.random() * Math.PI * 2
        const speed = 70 + Math.random() * 90
        return { dx: Math.cos(angle) * speed, dy: Math.sin(angle) * speed }
      })
      state[who].respawnAt = ts + DEATH_TOTAL_MS + RESPAWN_MS
      if (who === 'p1') setP1Score(0)
      else setP2Score(0)
    }

    const tick = (ts) => {
      const s = stateRef.current
      // Resolve queued directions for both players first
      for (const who of ['p1', 'p2']) {
        if (s[who].alive) s[who].dir = s[who].nextDir
      }

      // Plan next-head positions for alive snakes
      const planned = {}
      for (const who of ['p1', 'p2']) {
        if (!s[who].alive) continue
        const head = s[who].body[0]
        planned[who] = { x: head.x + s[who].dir.x, y: head.y + s[who].dir.y }
      }

      // Collisions:
      // 1. Wall
      // 2. Own body (use the body MINUS tail if not eating, since tail
      //    will move)
      // 3. Other snake's body / head
      // 4. Head-to-head with the other planned head
      const deaths = new Set()

      const willEat = {}
      for (const who of ['p1', 'p2']) {
        if (!planned[who]) continue
        willEat[who] = cellsOverlap(planned[who], s.food)
      }

      for (const who of ['p1', 'p2']) {
        const head = planned[who]
        if (!head) continue
        if (head.x < 0 || head.x >= GRID || head.y < 0 || head.y >= GRID) {
          deaths.add(who)
          continue
        }
        // Own body (excluding tail if not eating)
        const ownBody = willEat[who]
          ? s[who].body
          : s[who].body.slice(0, -1)
        if (ownBody.some((seg) => cellsOverlap(seg, head))) {
          deaths.add(who)
          continue
        }
        // Other snake's body
        const other = who === 'p1' ? 'p2' : 'p1'
        if (s[other].alive) {
          const otherBody = willEat[other]
            ? s[other].body
            : s[other].body.slice(0, -1)
          if (otherBody.some((seg) => cellsOverlap(seg, head))) {
            deaths.add(who)
          }
        }
      }

      // Head-to-head: both planned heads land on the same cell.
      if (
        planned.p1 &&
        planned.p2 &&
        cellsOverlap(planned.p1, planned.p2)
      ) {
        deaths.add('p1')
        deaths.add('p2')
      }

      // Apply moves for survivors; apply deaths.
      for (const who of ['p1', 'p2']) {
        if (deaths.has(who)) {
          killSnake(s, who, ts)
          continue
        }
        if (!planned[who]) continue
        s[who].body.unshift(planned[who])
        if (willEat[who]) {
          s[who].score += 10
          if (who === 'p1') setP1Score(s[who].score)
          else setP2Score(s[who].score)
        } else {
          s[who].body.pop()
        }
      }

      // If food was eaten, respawn it.
      if (planned.p1 && willEat.p1) s.food = makeFood(s)
      else if (planned.p2 && willEat.p2) s.food = makeFood(s)

      // Speed up gradually but cap at SPEED_FLOOR_MS so we don't
      // become unplayable on long rounds.
      const totalScore = s.p1.score + s.p2.score
      const level = 1 + Math.floor(totalScore / 50)
      s.interval = Math.max(
        SPEED_FLOOR_MS,
        Math.round(INITIAL_INTERVAL_MS * Math.pow(0.93, level - 1)),
      )
    }

    const draw = (ts) => {
      const s = stateRef.current
      const { canvas: CSIZE, cell: C } = sizeRef.current
      ctx.fillStyle = '#0a0a0f'
      ctx.fillRect(0, 0, CSIZE, CSIZE)

      // Grid
      ctx.strokeStyle = 'rgba(255,255,255,0.04)'
      ctx.lineWidth = 1
      for (let i = 1; i < GRID; i++) {
        ctx.beginPath()
        ctx.moveTo(i * C, 0)
        ctx.lineTo(i * C, CSIZE)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(0, i * C)
        ctx.lineTo(CSIZE, i * C)
        ctx.stroke()
      }

      // Food
      const pulse = 1 + Math.sin(ts / 320) * 0.15
      ctx.save()
      ctx.shadowColor = '#ffd700'
      ctx.shadowBlur = 18
      ctx.fillStyle = '#ffd700'
      ctx.beginPath()
      ctx.arc(
        s.food.x * C + C / 2,
        s.food.y * C + C / 2,
        C * 0.3 * pulse,
        0,
        Math.PI * 2,
      )
      ctx.fill()
      ctx.restore()

      for (const who of ['p1', 'p2']) {
        drawSnake(ctx, s[who], who, ts, C)
      }
    }

    const drawSnake = (ctx, snake, who, ts, C) => {
      const pal = PALETTE[who]
      const headInset = (1 - 0.9) / 2
      const bodyInset = (1 - 0.75) / 2
      const dying = !snake.alive && ts - snake.deathAt < DEATH_TOTAL_MS
      const dyingT = dying ? ts - snake.deathAt : 0
      const flashing = dying && dyingT < DEATH_FLASH_MS
      const exploding = dying && dyingT >= DEATH_FLASH_MS
      const flashOn = flashing && Math.floor(dyingT / 120) % 2 === 0
      const explodeProgress = exploding
        ? Math.min(1, (dyingT - DEATH_FLASH_MS) / DEATH_EXPLODE_MS)
        : 0
      // Faded ghost while waiting to respawn.
      const ghost = !snake.alive && !dying

      snake.body.forEach((seg, i) => {
        const baseX = seg.x * C
        const baseY = seg.y * C
        const offX = exploding ? (snake.deathVecs[i]?.dx ?? 0) * explodeProgress : 0
        const offY = exploding ? (snake.deathVecs[i]?.dy ?? 0) * explodeProgress : 0
        let alpha = exploding ? 1 - explodeProgress : 1
        if (ghost) alpha = 0
        if (alpha <= 0) return

        if (i === 0) {
          const inset = C * headInset
          const x = baseX + inset + offX
          const y = baseY + inset + offY
          const w = C - inset * 2
          const h = C - inset * 2
          ctx.save()
          ctx.globalAlpha = alpha
          ctx.fillStyle = flashOn ? '#ffffff' : pal.head
          ctx.shadowColor = flashOn ? '#ffffff' : pal.head
          ctx.shadowBlur = 10
          paintRoundedRect(ctx, x, y, w, h, Math.max(2, C * 0.16))
          ctx.shadowBlur = 0
          if (!exploding) {
            const eyeSize = Math.max(2, Math.round(C * 0.16))
            const eyes = eyeOffsets(snake.dir, w, eyeSize)
            ctx.fillStyle = '#050508'
            eyes.forEach((e) =>
              ctx.fillRect(x + e.x, y + e.y, eyeSize, eyeSize),
            )
          }
          ctx.restore()
        } else {
          const inset = C * bodyInset
          const x = baseX + inset + offX
          const y = baseY + inset + offY
          const w = C - inset * 2
          const h = C - inset * 2
          ctx.save()
          ctx.globalAlpha = alpha
          ctx.fillStyle = flashOn
            ? '#ffffff'
            : bodySegmentColor(who, i, snake.body.length)
          paintRoundedRect(ctx, x, y, w, h, Math.max(2, C * 0.18))
          ctx.restore()
        }
      })
    }

    const loop = (ts) => {
      const s = stateRef.current
      if (statusRef.current === 'playing' && !pausedRef.current) {
        if (s.lastTick === 0) s.lastTick = ts
        // Respawn dead snakes when their cooldown elapses
        for (const who of ['p1', 'p2']) {
          if (!s[who].alive && s[who].respawnAt > 0 && ts >= s[who].respawnAt) {
            respawnSnake(s, who)
          }
        }
        if (ts - s.lastTick >= s.interval) {
          tick(ts)
          s.lastTick = ts
        }
        // Timer
        const elapsed = ts - s.startedAt
        const remaining = Math.max(0, ROUND_MS - elapsed)
        const sec = Math.ceil(remaining / 1000)
        if (sec !== lastShownSec) {
          lastShownSec = sec
          setRemainingMs(remaining)
        }
        if (remaining <= 0 && statusRef.current === 'playing') {
          statusRef.current = 'gameover'
          setStatus('gameover')
        }
      } else if (pausedRef.current) {
        s.lastTick = 0
      }
      draw(ts)
      rafId = requestAnimationFrame(loop)
    }
    rafId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafId)
  }, [])

  // ===== Render =====
  const showOverlay = status === 'idle' || status === 'gameover'
  const winner =
    p1Score === p2Score
      ? 'draw'
      : p1Score > p2Score
        ? 'p1'
        : 'p2'

  return (
    <div className="flex flex-1 flex-col items-center">
      <ScoreBar
        canvasSize={canvasSize}
        p1Score={p1Score}
        p2Score={p2Score}
        remainingMs={remainingMs}
      />

      <div
        className="game-touch relative mt-3"
        style={{ width: canvasSize, height: canvasSize }}
      >
        <div
          className="rounded-xl border-2 border-neon-green/60 bg-arcadia-surface p-1 shadow-neon-green"
          style={{
            width: canvasSize,
            height: canvasSize,
            boxSizing: 'content-box',
          }}
        >
          <canvas
            ref={canvasRef}
            className="game-no-scroll block rounded-md"
            aria-label="Snake duo game canvas"
          />
        </div>

        {pausedRef.current && (
          <div
            className="absolute inset-2 z-10 flex items-center justify-center rounded-md"
            style={{
              background: 'rgba(5, 5, 8, 0.78)',
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)',
            }}
            aria-hidden="true"
          >
            <p className="neon-text font-arcade text-base text-neon-cyan md:text-xl">
              PAUSED
            </p>
          </div>
        )}

        {status === 'idle' && (
          <IdleOverlay onStart={startGame} canvasSize={canvasSize} />
        )}
      </div>

      <div
        className="mt-3 flex w-full max-w-[640px] items-end justify-between gap-3 px-2 pb-4 sm:px-4"
        aria-label="Player controls"
      >
        <PlayerDPad
          who="p1"
          color="green"
          alive={stateRef.current.p1.alive}
          onDirection={(d) => queueDir('p1', d)}
        />
        <p className="font-arcade text-[9px] text-white/35">
          WASD <br />
          vs <br />
          ARROWS
        </p>
        <PlayerDPad
          who="p2"
          color="pink"
          alive={stateRef.current.p2.alive}
          onDirection={(d) => queueDir('p2', d)}
        />
      </div>

      {status === 'gameover' && (
        <DuoResultPanel
          winner={winner}
          p1Score={p1Score}
          p2Score={p2Score}
          onReplay={startGame}
        />
      )}
      {leaveModal}
    </div>
  )
}

function ScoreBar({ canvasSize, p1Score, p2Score, remainingMs }) {
  const sec = Math.ceil(remainingMs / 1000)
  const mm = String(Math.floor(sec / 60)).padStart(1, '0')
  const ss = String(sec % 60).padStart(2, '0')
  const timeColor =
    remainingMs < 15_000
      ? 'text-neon-pink'
      : remainingMs < 30_000
        ? 'text-amber-400'
        : 'text-neon-cyan'
  return (
    <div
      className="grid shrink-0 grid-cols-3 items-center justify-items-center font-arcade text-[9px]"
      style={{
        width: canvasSize,
        padding: '4px 8px',
        borderBottom: '1px solid rgba(0, 255, 136, 0.3)',
        letterSpacing: '0.08em',
      }}
      aria-label="Score and timer"
    >
      <span className="justify-self-start text-neon-green">
        P1 · {String(p1Score).padStart(3, '0')}
      </span>
      <span className={`tabular-nums ${timeColor}`}>
        {mm}:{ss}
      </span>
      <span className="justify-self-end text-neon-pink">
        P2 · {String(p2Score).padStart(3, '0')}
      </span>
    </div>
  )
}

function IdleOverlay({ onStart, canvasSize }) {
  return (
    <div
      className="absolute inset-2 z-10 flex flex-col items-center justify-center gap-3 rounded-md p-4 text-center"
      style={{
        background: 'rgba(5, 5, 8, 0.85)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
      }}
    >
      <p className="font-arcade text-base text-neon-green drop-shadow-[0_0_8px_rgba(0,255,136,0.5)]">
        2-PLAYER · 2:00
      </p>
      <p
        className="text-xs leading-relaxed text-white/65"
        style={{ maxWidth: Math.min(360, canvasSize - 40) }}
      >
        Highest score when the clock hits zero wins. Dying — wall, your
        body, or the other snake — resets your score to <strong>0</strong>
        . Pick your moments.
      </p>
      <div className="mt-1 flex w-full max-w-[280px] justify-between text-[10px]">
        <span className="font-arcade text-neon-green">P1 · WASD</span>
        <span className="font-arcade text-neon-pink">P2 · ARROWS</span>
      </div>
      <button
        type="button"
        onClick={onStart}
        className="mt-2 rounded-md border border-neon-green/70 bg-neon-green/10 px-6 py-2.5 font-arcade text-[11px] text-neon-green transition hover:bg-neon-green/20 hover:shadow-neon-green"
      >
        ▶ START
      </button>
    </div>
  )
}

function PlayerDPad({ who, color, alive, onDirection }) {
  const fire = (e, d) => {
    e.preventDefault()
    onDirection(d)
  }
  const accent =
    color === 'pink'
      ? 'border-neon-pink/55 text-neon-pink active:bg-neon-pink/15 active:shadow-neon-pink'
      : 'border-neon-green/55 text-neon-green active:bg-neon-green/15 active:shadow-neon-green'
  const labelColor = color === 'pink' ? 'text-neon-pink' : 'text-neon-green'
  const btnBase = `grid h-10 w-10 place-items-center rounded-md border bg-arcadia-surface/85 font-arcade text-sm transition sm:h-12 sm:w-12 ${accent} ${
    alive ? '' : 'opacity-40'
  }`
  return (
    <div
      className="grid select-none grid-cols-3 gap-1"
      style={{ touchAction: 'none' }}
      aria-label={`${who} controls`}
    >
      <span className={`col-span-3 text-center font-arcade text-[8px] ${labelColor}`}>
        {who === 'p1' ? 'P1' : 'P2'}
      </span>
      <span />
      <button
        type="button"
        className={btnBase}
        onPointerDown={(e) => fire(e, UP)}
        aria-label="Up"
      >
        ▲
      </button>
      <span />
      <button
        type="button"
        className={btnBase}
        onPointerDown={(e) => fire(e, LEFT)}
        aria-label="Left"
      >
        ◀
      </button>
      <span />
      <button
        type="button"
        className={btnBase}
        onPointerDown={(e) => fire(e, RIGHT)}
        aria-label="Right"
      >
        ▶
      </button>
      <span />
      <button
        type="button"
        className={btnBase}
        onPointerDown={(e) => fire(e, DOWN)}
        aria-label="Down"
      >
        ▼
      </button>
      <span />
    </div>
  )
}

function DuoResultPanel({ winner, p1Score, p2Score, onReplay }) {
  if (typeof document === 'undefined') return null
  const isDraw = winner === 'draw'
  const winnerLabel = isDraw
    ? 'DRAW'
    : winner === 'p1'
      ? 'PLAYER 1 WINS!'
      : 'PLAYER 2 WINS!'
  const winnerColor = isDraw
    ? '#00d4ff'
    : winner === 'p1'
      ? '#00ff88'
      : '#ff006e'
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[500] flex items-center justify-center px-4"
      style={{
        background: 'rgba(5, 5, 8, 0.92)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      <div
        className="go-overlay-in glass-panel pixel-corners relative w-full max-w-[360px] overflow-visible px-6 py-6 text-center"
        style={{
          borderColor: winnerColor + '90',
          borderWidth: 2,
          zIndex: 501,
        }}
      >
        <p
          className="relative font-arcade text-base drop-shadow-[0_0_10px_currentColor] md:text-lg"
          style={{ color: winnerColor }}
        >
          <span className="go-icon-pop">★</span> {winnerLabel}{' '}
          <span className="go-icon-pop">★</span>
        </p>

        <div className="relative mt-5 grid grid-cols-2 gap-3 text-center">
          <div
            className="rounded-md border px-4 py-3"
            style={{
              borderColor:
                winner === 'p1' ? '#00ff8890' : 'rgba(255,255,255,0.1)',
              background: 'rgba(0, 255, 136, 0.04)',
            }}
          >
            <p className="font-arcade text-[9px] text-white/45">P1</p>
            <p className="mt-1 font-arcade text-2xl text-neon-green tabular-nums">
              {String(p1Score).padStart(3, '0')}
            </p>
          </div>
          <div
            className="rounded-md border px-4 py-3"
            style={{
              borderColor:
                winner === 'p2' ? '#ff006e90' : 'rgba(255,255,255,0.1)',
              background: 'rgba(255, 0, 110, 0.04)',
            }}
          >
            <p className="font-arcade text-[9px] text-white/45">P2</p>
            <p className="mt-1 font-arcade text-2xl text-neon-pink tabular-nums">
              {String(p2Score).padStart(3, '0')}
            </p>
          </div>
        </div>

        <div className="relative mt-6 flex flex-col gap-2">
          <button
            type="button"
            onClick={onReplay}
            className="w-full rounded-md border border-neon-green/70 bg-neon-green/10 px-4 py-2 font-arcade text-[10px] text-neon-green transition hover:bg-neon-green/20 hover:shadow-neon-green"
          >
            ▶ REMATCH
          </button>
          <LobbyBackLink className="w-full rounded-md border border-white/20 px-4 py-2 text-center font-arcade text-[10px] text-white/70 transition hover:border-neon-cyan/60 hover:text-neon-cyan">
            ◀ BACK TO LOBBY
          </LobbyBackLink>
        </div>
      </div>
    </div>,
    document.body,
  )
}
