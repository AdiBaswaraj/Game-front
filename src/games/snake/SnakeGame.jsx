import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useGameLeaveGuard } from '../../context/LeaveGuardContext'
import { useToast } from '../../context/ToastContext'
import { useArmGameOverFlash } from '../../context/GameOverFlashContext'
import { getLeaderboard, postScore } from '../../lib/api'
import { profileNameFor } from '../../lib/profile'
import GameOverPanel from '../../components/GameOverPanel'
import { useSquareGameSize } from '../../hooks/useViewport'
import { useFullscreen } from '../../hooks/useFullscreen'

const GRID = 20
const HS_KEY = 'arcadia:highscore:snake'
const CONTROL_KEY = 'arcadia:snake:controls'

const UP = { x: 0, y: -1 }
const DOWN = { x: 0, y: 1 }
const LEFT = { x: -1, y: 0 }
const RIGHT = { x: 1, y: 0 }

// Speed ramp: still climbs sharply through the early game (the dopamine
// hit of "getting faster") then flattens to a floor that a human can
// actually sustain for long runs. The old curve hit a 60ms tick by
// level ~10 and stayed there forever, which made anything past the
// 200-300 score range feel punishing on touch screens.
const SPEED_FLOOR_MS = 85
const speedInterval = (level) =>
  Math.max(SPEED_FLOOR_MS, Math.round(200 * Math.pow(0.88, level - 1)))

const DEATH_FLASH_MS = 450
const DEATH_EXPLODE_MS = 400
const DEATH_TOTAL_MS = DEATH_FLASH_MS + DEATH_EXPLODE_MS

const BODY_GRADIENT = ['#00dd77', '#00bb66', '#00bb66', '#009955']
const TAIL_DARK = '#007744'

function bodySegmentColor(idx, total) {
  if (idx === 0) return '#00ff88'
  // Last two segments use the darkest shade.
  if (idx >= total - 2 && total > 4) return TAIL_DARK
  if (idx - 1 < BODY_GRADIENT.length) return BODY_GRADIENT[idx - 1]
  return '#009955'
}

// Returns [{x, y}, {x, y}] eye top-left offsets inside the head cell
// based on which direction the snake is moving.
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

function paintRoundedRect(ctx, x, y, w, h, r) {
  if (ctx.roundRect) {
    ctx.beginPath()
    ctx.roundRect(x, y, w, h, r)
    ctx.fill()
  } else {
    ctx.fillRect(x, y, w, h)
  }
}

function makeFood(snake) {
  while (true) {
    const x = Math.floor(Math.random() * GRID)
    const y = Math.floor(Math.random() * GRID)
    if (!snake.some((s) => s.x === x && s.y === y)) return { x, y }
  }
}

function initialState() {
  const snake = [
    { x: 9, y: 10 },
    { x: 8, y: 10 },
    { x: 7, y: 10 },
  ]
  return {
    snake,
    dir: RIGHT,
    nextDir: RIGHT,
    food: { x: 14, y: 10 },
    lastTick: 0,
    interval: speedInterval(1),
    level: 1,
    eaten: 0,
    score: 0,
  }
}

function readHighScore() {
  const v = Number(localStorage.getItem(HS_KEY))
  return Number.isFinite(v) ? v : 0
}

function readControl() {
  try {
    const v = localStorage.getItem(CONTROL_KEY)
    return v === 'joystick' || v === 'touch' ? v : null
  } catch {
    return null
  }
}

function writeControl(v) {
  try {
    localStorage.setItem(CONTROL_KEY, v)
  } catch {
    // private mode — ignore
  }
}

export default function SnakeGame() {
  const { user } = useAuth()
  const toast = useToast()
  const canvasRef = useRef(null)
  const stateRef = useRef(initialState())
  const statusRef = useRef('idle')

  const [score, setScore] = useState(0)
  const [level, setLevel] = useState(1)
  const [highScore, setHighScore] = useState(readHighScore)
  // Status machine: 'idle' → 'playing' → 'dying' → 'gameover'.
  // 'dying' lasts long enough for the death animation to play before
  // the GAME OVER panel takes over.
  const [status, setStatus] = useState('idle')
  useArmGameOverFlash(status === 'gameover')
  // 'touch' (swipes on the canvas) | 'joystick' (on-screen D-pad).
  // null means the picker is still showing.
  const [controlMode, setControlMode] = useState(readControl)

  // Single-player active = a game is in progress. Leaving now would
  // throw away the run.
  const leaveModal = useGameLeaveGuard({
    active: status === 'playing',
    kind: 'single',
  })
  // The RAF loop reads this ref every frame; flipping it freezes ticks
  // but keeps the snake / score drawn so the canvas doesn't go blank.
  const pausedRef = useRef(false)
  pausedRef.current = !!leaveModal && status === 'playing'

  const dyingStartRef = useRef(0)
  const explosionVecsRef = useRef([])
  const wasNewHighRef = useRef(false)

  const { isFullscreen } = useFullscreen()
  // Reserve room for the slim score bar above the canvas (28px) plus
  // a single line of control hints below it (~24px). No HUD column.
  const canvasSize = useSquareGameSize({
    headerHeight: isFullscreen ? 56 : 72,
    controlsHeight: isFullscreen ? 32 : 96,
    padding: isFullscreen ? 8 : 16,
    minSize: 260,
    maxSize: isFullscreen ? 760 : 620,
  })
  const cellSize = canvasSize / GRID

  // Pull personal best from backend leaderboard if logged in
  useEffect(() => {
    if (!user) return
    let cancelled = false
    getLeaderboard('snake')
      .then((list) => {
        if (cancelled) return
        const myName = profileNameFor(user)
        const mine = list
          .filter((e) => e.username === myName)
          .reduce((best, e) => (e.score > (best?.score ?? -1) ? e : best), null)
        const remote = mine?.score ?? 0
        setHighScore((prev) => {
          const next = Math.max(prev, remote)
          if (next > prev) localStorage.setItem(HS_KEY, String(next))
          return next
        })
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [user])

  const startGame = useCallback((mode) => {
    if (mode === 'touch' || mode === 'joystick') {
      writeControl(mode)
      setControlMode(mode)
    }
    stateRef.current = initialState()
    setScore(0)
    setLevel(1)
    statusRef.current = 'playing'
    setStatus('playing')
  }, [])

  const queueDir = useCallback((nd) => {
    const s = stateRef.current
    if (s.dir.x === -nd.x && s.dir.y === -nd.y) return // can't reverse
    s.nextDir = nd
  }, [])

  // Keyboard input — prevent default scroll on arrow keys
  useEffect(() => {
    const handler = (e) => {
      const k = e.key
      const lower = typeof k === 'string' ? k.toLowerCase() : ''

      // A keyboard player can skip the on-screen control picker — we
      // assume "touch" as the saved default since their swipe area is
      // still the canvas. They can change it later from the GAME OVER
      // screen if they want the joystick instead.
      const fallback = controlMode ?? 'touch'

      if (k === ' ' || k === 'Enter') {
        e.preventDefault()
        if (statusRef.current !== 'playing') startGame(fallback)
        return
      }

      let nd = null
      if (k === 'ArrowUp' || lower === 'w') nd = UP
      else if (k === 'ArrowDown' || lower === 's') nd = DOWN
      else if (k === 'ArrowLeft' || lower === 'a') nd = LEFT
      else if (k === 'ArrowRight' || lower === 'd') nd = RIGHT

      if (nd) {
        e.preventDefault()
        if (statusRef.current === 'idle') startGame(fallback)
        if (statusRef.current === 'playing') queueDir(nd)
      }
    }
    window.addEventListener('keydown', handler, { passive: false })
    return () => window.removeEventListener('keydown', handler)
  }, [startGame, queueDir, controlMode])

  // Prevent the document from scrolling while playing — Snake uses
  // swipes for input and any vertical scroll feels broken on phones.
  // Listener is global but the cleanup runs on unmount.
  useEffect(() => {
    const prevent = (e) => {
      if (e.target && e.target.closest?.('.game-no-scroll')) {
        e.preventDefault()
      }
    }
    document.addEventListener('touchmove', prevent, { passive: false })
    return () => document.removeEventListener('touchmove', prevent)
  }, [])

  // Touch swipe input — only wired up in touch mode. In joystick mode
  // the canvas should ignore swipes so a stray drag while reaching for
  // the on-screen pad doesn't fire a direction.
  useEffect(() => {
    if (controlMode !== 'touch') return
    const el = canvasRef.current
    if (!el) return
    let startX = 0
    let startY = 0
    const onStart = (e) => {
      const t = e.touches[0]
      startX = t.clientX
      startY = t.clientY
    }
    const onEnd = (e) => {
      const t = e.changedTouches[0]
      const dx = t.clientX - startX
      const dy = t.clientY - startY
      const ax = Math.abs(dx)
      const ay = Math.abs(dy)
      if (ax < 20 && ay < 20) {
        if (statusRef.current !== 'playing') startGame('touch')
        return
      }
      let nd
      if (ax > ay) nd = dx > 0 ? RIGHT : LEFT
      else nd = dy > 0 ? DOWN : UP
      if (statusRef.current === 'idle') startGame('touch')
      if (statusRef.current === 'playing') queueDir(nd)
    }
    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchend', onEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchend', onEnd)
    }
  }, [startGame, queueDir, controlMode])

  // Mirror canvas dimensions into refs so the long-lived render loop
  // can read the latest values without a re-bind.
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
    // The transform was applied once during the initial setup, so reset
    // it then re-apply the new DPR scale on every resize.
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.scale(dpr, dpr)
  }, [canvasSize, cellSize])

  // Render + tick loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    let rafId

    const finishGame = () => {
      if (statusRef.current !== 'playing') return
      const s = stateRef.current
      const finalScore = s.score
      // Capture whether this run set a new personal best so the
      // game-over panel can show the gold "NEW HIGH SCORE" variant.
      wasNewHighRef.current =
        finalScore > 0 && finalScore > readHighScore()
      // Generate per-segment explosion vectors once, before the
      // animation starts.
      explosionVecsRef.current = s.snake.map(() => {
        const angle = Math.random() * Math.PI * 2
        const speed = 70 + Math.random() * 90
        return { dx: Math.cos(angle) * speed, dy: Math.sin(angle) * speed }
      })
      dyingStartRef.current = performance.now()
      statusRef.current = 'dying'
      setStatus('dying')

      window.setTimeout(() => {
        statusRef.current = 'gameover'
        setStatus('gameover')
        setHighScore((prev) => {
          if (finalScore > prev) {
            localStorage.setItem(HS_KEY, String(finalScore))
            return finalScore
          }
          return prev
        })
        if (user && finalScore > 0) {
          postScore({
            userId: user.id,
            gameId: 'snake',
            score: finalScore,
          })
            .then(() => toast.success(`SCORE SAVED · ${finalScore}`))
            .catch(() =>
              toast.error('Could not save score. Check connection.'),
            )
        }
      }, DEATH_TOTAL_MS)
    }

    const tick = () => {
      const s = stateRef.current
      s.dir = s.nextDir
      const head = s.snake[0]
      const next = { x: head.x + s.dir.x, y: head.y + s.dir.y }

      if (next.x < 0 || next.x >= GRID || next.y < 0 || next.y >= GRID) {
        finishGame()
        return
      }

      const willEat = next.x === s.food.x && next.y === s.food.y
      const body = willEat ? s.snake : s.snake.slice(0, -1)
      if (body.some((seg) => seg.x === next.x && seg.y === next.y)) {
        finishGame()
        return
      }

      s.snake.unshift(next)
      if (willEat) {
        s.eaten += 1
        s.score += 10
        setScore(s.score)
        if (s.eaten % 5 === 0) {
          s.level += 1
          s.interval = speedInterval(s.level)
          setLevel(s.level)
        }
        s.food = makeFood(s.snake)
      } else {
        s.snake.pop()
      }
    }

    const draw = (ts) => {
      const s = stateRef.current
      const { canvas: CSIZE, cell: C } = sizeRef.current
      ctx.fillStyle = '#0a0a0f'
      ctx.fillRect(0, 0, CSIZE, CSIZE)

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

      // Glowing pulsing pink food — radius cellSize * 0.3
      // (= diameter 0.6 per spec).
      const pulse = 1 + Math.sin(ts / 320) * 0.15
      ctx.save()
      ctx.shadowColor = '#ff006e'
      ctx.shadowBlur = 18
      ctx.fillStyle = '#ff006e'
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

      // Snake rendering — pixel-art head + gradient body + tongue.
      const dying = statusRef.current === 'dying'
      const dyingT = dying ? Math.max(0, ts - dyingStartRef.current) : 0
      const flashing = dying && dyingT < DEATH_FLASH_MS
      const exploding = dying && dyingT >= DEATH_FLASH_MS
      const flashOn = flashing && Math.floor(dyingT / 150) % 2 === 0
      const explodeProgress = exploding
        ? Math.min(1, (dyingT - DEATH_FLASH_MS) / DEATH_EXPLODE_MS)
        : 0
      const vecs = explosionVecsRef.current

      const headInset = (1 - 0.9) / 2 // 5% inset → head 90% of cell
      const bodyInset = (1 - 0.75) / 2 // 12.5% inset → body 75% of cell

      s.snake.forEach((seg, i) => {
        const baseX = seg.x * C
        const baseY = seg.y * C
        const offX = exploding ? (vecs[i]?.dx ?? 0) * explodeProgress : 0
        const offY = exploding ? (vecs[i]?.dy ?? 0) * explodeProgress : 0
        const alpha = exploding ? 1 - explodeProgress : 1

        if (i === 0) {
          const inset = C * headInset
          const x = baseX + inset + offX
          const y = baseY + inset + offY
          const w = C - inset * 2
          const h = C - inset * 2
          ctx.save()
          ctx.globalAlpha = alpha
          ctx.fillStyle = flashOn ? '#ff006e' : '#00ff88'
          ctx.shadowColor = flashOn ? '#ff006e' : '#00ff88'
          ctx.shadowBlur = 10
          paintRoundedRect(ctx, x, y, w, h, Math.max(2, C * 0.16))
          ctx.shadowBlur = 0

          // Eyes
          if (!exploding) {
            const eyeSize = Math.max(2, Math.round(C * 0.16))
            const eyes = eyeOffsets(s.dir, w, eyeSize)
            ctx.fillStyle = '#ffffff'
            eyes.forEach((e) => ctx.fillRect(x + e.x, y + e.y, eyeSize, eyeSize))
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
            ? '#ff006e'
            : bodySegmentColor(i, s.snake.length)
          paintRoundedRect(ctx, x, y, w, h, Math.max(2, C * 0.18))
          ctx.restore()
        }
      })
    }

    const loop = (ts) => {
      const s = stateRef.current
      if (statusRef.current === 'playing' && !pausedRef.current) {
        if (s.lastTick === 0) s.lastTick = ts
        if (ts - s.lastTick >= s.interval) {
          tick()
          s.lastTick = ts
        }
      } else if (pausedRef.current) {
        // Reset lastTick so the snake doesn't catch up on resume.
        s.lastTick = 0
      }
      draw(ts)
      rafId = requestAnimationFrame(loop)
    }
    rafId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafId)
  }, [user])

  const personalBest = Math.max(highScore, score)

  return (
    <div className="flex flex-1 flex-col items-center">
      {/* Slim transparent score bar — sits ABOVE the canvas, separate
          from its border. */}
      <div
        className="flex shrink-0 items-center justify-center font-arcade text-[9px] text-neon-green"
        style={{
          width: canvasSize,
          padding: '4px 8px',
          borderBottom: '1px solid rgba(0, 255, 136, 0.3)',
          letterSpacing: '0.08em',
        }}
        aria-label="Score, best, level"
      >
        SCORE {score} · BEST {personalBest} · LV {level}
      </div>

      {/* Canvas wrapper — overlays (paused) render as siblings inside
          this relative container so they stack predictably above the
          canvas element. */}
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
            aria-label="Snake game canvas"
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
      </div>

      {/* Bottom section — sits 8px below the canvas. Houses either the
          control picker, the on-screen joystick, or the hint line. */}
      <div
        className={`mt-2 flex w-full flex-col items-center gap-3 px-4 pb-4 text-center ${
          status === 'idle' ? 'mt-6' : ''
        }`}
      >
        {status === 'idle' && (
          <ControlPicker
            controlMode={controlMode}
            onStart={(mode) => startGame(mode)}
          />
        )}

        {status === 'playing' && controlMode === 'joystick' && (
          <DPad onDirection={queueDir} />
        )}

        {status === 'playing' && controlMode !== 'joystick' && (
          <p className="text-[10px] text-white/50">
            ↑ ↓ ← → / WASD · Swipe on the board
          </p>
        )}

        {!user && status !== 'idle' && (
          <p className="text-[10px] text-white/35">
            Log in to save scores to the global leaderboard.
          </p>
        )}
      </div>

      {status === 'gameover' &&
        (wasNewHighRef.current ? (
          <GameOverPanel
            variant="new-high"
            title="NEW HIGH SCORE!"
            mainValue={String(score).padStart(3, '0')}
            mainLabel="YOUR SCORE"
            secondaryValue={personalBest}
            secondaryLabel="PERSONAL BEST"
            signedIn={!!user}
            onPrimary={startGame}
            primaryLabel="▶ PLAY AGAIN"
          />
        ) : (
          <GameOverPanel
            variant="lose"
            title="GAME OVER"
            mainValue={String(score).padStart(3, '0')}
            mainLabel="YOUR SCORE"
            secondaryValue={personalBest}
            secondaryLabel="PERSONAL BEST"
            signedIn={!!user}
            onPrimary={startGame}
            primaryLabel="▶ PLAY AGAIN"
          />
        ))}

      {leaveModal}
    </div>
  )
}

// Pre-game prompt. If the player has never picked a control scheme on
// this device we show both options as equal-weight cards so the choice
// reads as a real fork. Once they've picked once we collapse to a
// single CTA + a small "switch" link so PLAY AGAIN is one tap, not
// three.
function ControlPicker({ controlMode, onStart }) {
  if (!controlMode) {
    return (
      <>
        <p className="font-arcade text-sm text-neon-green md:text-base">
          READY?
        </p>
        <p className="text-xs text-white/60">Pick your controls</p>
        <div className="mt-2 grid w-full max-w-xs grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onStart('touch')}
            className="flex flex-col items-center gap-2 rounded-md border border-neon-cyan/60 bg-neon-cyan/10 px-4 py-3 font-arcade text-[10px] text-neon-cyan transition hover:bg-neon-cyan/20 hover:shadow-neon-cyan"
          >
            <span aria-hidden="true" className="text-xl">↗</span>
            <span>TOUCH / SWIPE</span>
          </button>
          <button
            type="button"
            onClick={() => onStart('joystick')}
            className="flex flex-col items-center gap-2 rounded-md border border-neon-pink/60 bg-neon-pink/10 px-4 py-3 font-arcade text-[10px] text-neon-pink transition hover:bg-neon-pink/20 hover:shadow-neon-pink"
          >
            <span aria-hidden="true" className="text-xl">✛</span>
            <span>JOYSTICK</span>
          </button>
        </div>
        <p className="text-[10px] text-white/35">
          Arrow keys / WASD always work too.
        </p>
      </>
    )
  }
  const other = controlMode === 'touch' ? 'joystick' : 'touch'
  const otherLabel =
    other === 'joystick' ? 'Use joystick instead' : 'Use swipe instead'
  return (
    <>
      <p className="font-arcade text-sm text-neon-green md:text-base">
        READY?
      </p>
      <p className="text-xs text-white/60">
        {controlMode === 'joystick'
          ? 'On-screen joystick below'
          : 'Swipe on the board to move'}
      </p>
      <button
        type="button"
        onClick={() => onStart(controlMode)}
        className="rounded-md border border-neon-green/70 bg-neon-green/10 px-6 py-2.5 font-arcade text-[11px] text-neon-green transition hover:bg-neon-green/20 hover:shadow-neon-green"
      >
        ▶ START
      </button>
      <button
        type="button"
        onClick={() => onStart(other)}
        className="font-arcade text-[9px] text-white/50 underline-offset-2 hover:text-neon-cyan hover:underline"
      >
        {otherLabel}
      </button>
    </>
  )
}

// Pixel-arcade D-pad. Uses pointerdown so taps register immediately
// and don't get blocked by the 300ms touch-action: manipulation delay.
// touch-action: none keeps the browser from interpreting the press as
// the start of a scroll.
function DPad({ onDirection }) {
  const fire = (e, d) => {
    e.preventDefault()
    onDirection(d)
  }
  const btnBase =
    'grid h-12 w-12 place-items-center rounded-md border border-neon-green/50 bg-arcadia-surface/85 font-arcade text-base text-neon-green transition active:bg-neon-green/20 active:shadow-neon-green sm:h-14 sm:w-14'
  return (
    <div
      className="grid select-none grid-cols-3 gap-1.5"
      style={{ touchAction: 'none' }}
      aria-label="On-screen controls"
    >
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
