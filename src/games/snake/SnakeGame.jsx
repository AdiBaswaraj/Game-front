import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { getLeaderboard, postScore } from '../../lib/api'
import { profileNameFor } from '../../lib/profile'
import Leaderboard from '../../components/Leaderboard'

const GRID = 20
const CELL = 24
const CANVAS_SIZE = GRID * CELL
const HS_KEY = 'arcadia:highscore:snake'

const UP = { x: 0, y: -1 }
const DOWN = { x: 0, y: 1 }
const LEFT = { x: -1, y: 0 }
const RIGHT = { x: 1, y: 0 }

const speedInterval = (level) =>
  Math.max(60, Math.round(200 * Math.pow(0.85, level - 1)))

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

export default function SnakeGame() {
  const { user } = useAuth()
  const canvasRef = useRef(null)
  const stateRef = useRef(initialState())
  const statusRef = useRef('idle')

  const [score, setScore] = useState(0)
  const [level, setLevel] = useState(1)
  const [highScore, setHighScore] = useState(readHighScore)
  const [status, setStatus] = useState('idle')

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

  const startGame = useCallback(() => {
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

      if (k === ' ' || k === 'Enter') {
        e.preventDefault()
        if (statusRef.current !== 'playing') startGame()
        return
      }

      let nd = null
      if (k === 'ArrowUp' || lower === 'w') nd = UP
      else if (k === 'ArrowDown' || lower === 's') nd = DOWN
      else if (k === 'ArrowLeft' || lower === 'a') nd = LEFT
      else if (k === 'ArrowRight' || lower === 'd') nd = RIGHT

      if (nd) {
        e.preventDefault()
        if (statusRef.current === 'idle') startGame()
        if (statusRef.current === 'playing') queueDir(nd)
      }
    }
    window.addEventListener('keydown', handler, { passive: false })
    return () => window.removeEventListener('keydown', handler)
  }, [startGame, queueDir])

  // Touch swipe input
  useEffect(() => {
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
        if (statusRef.current !== 'playing') startGame()
        return
      }
      let nd
      if (ax > ay) nd = dx > 0 ? RIGHT : LEFT
      else nd = dy > 0 ? DOWN : UP
      if (statusRef.current === 'idle') startGame()
      if (statusRef.current === 'playing') queueDir(nd)
    }
    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchend', onEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchend', onEnd)
    }
  }, [startGame, queueDir])

  // Render + tick loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    canvas.width = CANVAS_SIZE * dpr
    canvas.height = CANVAS_SIZE * dpr
    canvas.style.width = `${CANVAS_SIZE}px`
    canvas.style.height = `${CANVAS_SIZE}px`
    ctx.scale(dpr, dpr)

    let rafId

    const finishGame = () => {
      const s = stateRef.current
      const finalScore = s.score
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
        }).catch(() => {})
      }
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
      ctx.fillStyle = '#0a0a0f'
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)

      ctx.strokeStyle = 'rgba(255,255,255,0.04)'
      ctx.lineWidth = 1
      for (let i = 1; i < GRID; i++) {
        ctx.beginPath()
        ctx.moveTo(i * CELL, 0)
        ctx.lineTo(i * CELL, CANVAS_SIZE)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(0, i * CELL)
        ctx.lineTo(CANVAS_SIZE, i * CELL)
        ctx.stroke()
      }

      const pulse = 1 + Math.sin(ts / 220) * 0.18
      ctx.save()
      ctx.shadowColor = '#ff006e'
      ctx.shadowBlur = 18
      ctx.fillStyle = '#ff006e'
      ctx.beginPath()
      ctx.arc(
        s.food.x * CELL + CELL / 2,
        s.food.y * CELL + CELL / 2,
        CELL * 0.32 * pulse,
        0,
        Math.PI * 2,
      )
      ctx.fill()
      ctx.restore()

      s.snake.forEach((seg, i) => {
        if (i === 0) {
          ctx.save()
          ctx.shadowColor = '#00ff88'
          ctx.shadowBlur = 10
          ctx.fillStyle = '#00ff88'
          ctx.fillRect(seg.x * CELL + 1, seg.y * CELL + 1, CELL - 2, CELL - 2)
          ctx.restore()
        } else {
          ctx.fillStyle = '#00cc6e'
          ctx.fillRect(seg.x * CELL + 2, seg.y * CELL + 2, CELL - 4, CELL - 4)
        }
      })
    }

    const loop = (ts) => {
      const s = stateRef.current
      if (statusRef.current === 'playing') {
        if (s.lastTick === 0) s.lastTick = ts
        if (ts - s.lastTick >= s.interval) {
          tick()
          s.lastTick = ts
        }
      }
      draw(ts)
      rafId = requestAnimationFrame(loop)
    }
    rafId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafId)
  }, [user])

  return (
    <div className="flex flex-col items-center gap-8">
    <div className="flex flex-col items-center gap-6 lg:flex-row lg:items-start lg:justify-center">
      <div className="relative">
        <div className="rounded-xl border-2 border-neon-green/60 bg-arcadia-surface p-2 shadow-neon-green">
          <canvas
            ref={canvasRef}
            className="block touch-none rounded-md"
            style={{ maxWidth: '95vw', height: 'auto' }}
            aria-label="Snake game canvas"
          />
        </div>

        {status === 'idle' && (
          <Overlay>
            <p className="font-arcade text-sm text-neon-green md:text-base">
              READY?
            </p>
            <p className="mt-3 text-xs text-white/60">
              Arrow keys, WASD, or swipe.
            </p>
            <button
              type="button"
              onClick={startGame}
              className="mt-6 rounded-md border border-neon-green/70 bg-neon-green/10 px-5 py-2.5 font-arcade text-[11px] text-neon-green transition hover:bg-neon-green/20 hover:shadow-neon-green"
            >
              ▶ INSERT COIN
            </button>
          </Overlay>
        )}

        {status === 'gameover' && (
          <Overlay>
            <p className="font-arcade text-base text-neon-pink md:text-lg">
              GAME OVER
            </p>
            <div className="mt-4 grid grid-cols-2 gap-4 text-center">
              <div>
                <p className="font-arcade text-[9px] text-white/45">SCORE</p>
                <p className="mt-1 font-arcade text-lg text-neon-green">
                  {score}
                </p>
              </div>
              <div>
                <p className="font-arcade text-[9px] text-white/45">BEST</p>
                <p className="mt-1 font-arcade text-lg text-neon-cyan">
                  {Math.max(highScore, score)}
                </p>
              </div>
            </div>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={startGame}
                className="rounded-md border border-neon-green/70 bg-neon-green/10 px-4 py-2 font-arcade text-[10px] text-neon-green transition hover:bg-neon-green/20 hover:shadow-neon-green"
              >
                ▶ PLAY AGAIN
              </button>
              <Link
                to="/"
                className="rounded-md border border-white/20 px-4 py-2 text-center font-arcade text-[10px] text-white/70 transition hover:border-neon-cyan/60 hover:text-neon-cyan"
              >
                BACK TO LOBBY
              </Link>
            </div>
          </Overlay>
        )}
      </div>

      <Hud
        score={score}
        highScore={Math.max(highScore, score)}
        level={level}
        signedIn={!!user}
      />
    </div>

      {status === 'gameover' && (
        <div className="lb-slide-in w-full max-w-md">
          <Leaderboard gameId="snake" scoreFormat="points" />
        </div>
      )}
    </div>
  )
}

function Overlay({ children }) {
  return (
    <div className="absolute inset-2 flex flex-col items-center justify-center rounded-md bg-arcadia-bg/85 px-6 text-center backdrop-blur-sm">
      {children}
    </div>
  )
}

function Hud({ score, highScore, level, signedIn }) {
  return (
    <aside className="flex w-full flex-col gap-3 lg:w-56">
      <Stat label="SCORE" value={score} accent="text-neon-green" />
      <Stat label="HIGH" value={highScore} accent="text-neon-cyan" />
      <Stat label="SPEED" value={`LV ${level}`} accent="text-neon-pink" />
      <div className="mt-2 rounded-md border border-white/10 bg-arcadia-surface/60 p-3">
        <p className="font-arcade text-[9px] text-white/45">CONTROLS</p>
        <ul className="mt-2 space-y-1 text-xs text-white/70">
          <li>↑ ↓ ← → / WASD</li>
          <li>Swipe on mobile</li>
          <li>Space — start</li>
        </ul>
      </div>
      {!signedIn && (
        <p className="text-[10px] leading-snug text-white/40">
          Log in to save scores to the global leaderboard.
        </p>
      )}
    </aside>
  )
}

function Stat({ label, value, accent }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-white/10 bg-arcadia-surface/60 px-4 py-3">
      <span className="font-arcade text-[9px] text-white/45">{label}</span>
      <span className={`font-arcade text-base ${accent}`}>{value}</span>
    </div>
  )
}
