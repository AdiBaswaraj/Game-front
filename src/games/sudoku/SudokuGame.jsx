import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useGameLeaveGuard } from '../../context/LeaveGuardContext'
import { useToast } from '../../context/ToastContext'
import { useSquareGameSize } from '../../hooks/useViewport'
import { postScore } from '../../lib/api'
import Leaderboard from '../../components/Leaderboard'
import { HallOfFameButton, WinParticles } from '../../components/GameOverFX'
import {
  findConflicts,
  generatePuzzle,
  isComplete,
  matchesSolution,
} from './generator'

const N = 9

function makeBoard(difficulty) {
  const { puzzle, solution } = generatePuzzle(difficulty)
  return {
    puzzle,
    solution,
    grid: puzzle.map((row) => [...row]),
  }
}

function fmtTime(s) {
  const m = Math.floor(s / 60)
    .toString()
    .padStart(2, '0')
  const sec = (s % 60).toString().padStart(2, '0')
  return `${m}:${sec}`
}

export default function SudokuGame({ difficulty = 'easy' }) {
  const { user } = useAuth()
  const toast = useToast()
  const [board, setBoard] = useState(() => makeBoard(difficulty))
  const [selected, setSelected] = useState(null)
  const [time, setTime] = useState(0)
  const [status, setStatus] = useState('playing')

  const leaveModal = useGameLeaveGuard({
    active: status === 'playing',
    kind: 'single',
  })

  // Reserve room for: control row (~56), number pad (~64), gaps.
  const boardSize = useSquareGameSize({
    headerHeight: 72,
    controlsHeight: 220,
    padding: 16,
    minSize: 280,
    maxSize: 520,
  })
  const [showErrors, setShowErrors] = useState(false)
  const startTimeRef = useRef(Date.now())

  // If difficulty changes (route param), reset the game
  useEffect(() => {
    setBoard(makeBoard(difficulty))
    setSelected(null)
    setTime(0)
    setShowErrors(false)
    setStatus('playing')
    startTimeRef.current = Date.now()
  }, [difficulty])

  const conflicts = useMemo(() => findConflicts(board.grid), [board.grid])
  const errors = useMemo(() => {
    if (!showErrors) return new Set()
    const s = new Set()
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        if (
          board.grid[r][c] !== 0 &&
          board.grid[r][c] !== board.solution[r][c]
        ) {
          s.add(`${r},${c}`)
        }
      }
    }
    return s
  }, [showErrors, board])

  // Timer
  useEffect(() => {
    if (status !== 'playing') return
    const id = setInterval(() => {
      setTime(Math.floor((Date.now() - startTimeRef.current) / 1000))
    }, 250)
    return () => clearInterval(id)
  }, [status])

  const newGame = useCallback(() => {
    setBoard(makeBoard(difficulty))
    setSelected(null)
    setTime(0)
    setShowErrors(false)
    setStatus('playing')
    startTimeRef.current = Date.now()
  }, [difficulty])

  const handleInput = useCallback(
    (value) => {
      if (!selected || status !== 'playing') return
      const { r, c } = selected
      if (board.puzzle[r][c] !== 0) return
      setBoard((b) => {
        const next = b.grid.map((row) => [...row])
        next[r][c] = value
        return { ...b, grid: next }
      })
      setShowErrors(false)
    },
    [selected, status, board.puzzle],
  )

  // Auto-win detection
  useEffect(() => {
    if (status !== 'playing') return
    if (!isComplete(board.grid)) return
    if (conflicts.size > 0) return
    if (!matchesSolution(board.grid, board.solution)) return
    const finalTime = Math.floor((Date.now() - startTimeRef.current) / 1000)
    setTime(finalTime)
    setStatus('won')
    const key = `arcadia:bestTime:sudoku:${difficulty}`
    const prev = Number(localStorage.getItem(key) || 0)
    if (prev === 0 || finalTime < prev) {
      localStorage.setItem(key, String(finalTime))
    }
    if (user && finalTime > 0) {
      postScore({
        userId: user.id,
        gameId: `sudoku-${difficulty}`,
        score: finalTime,
      })
        .then(() => toast.success(`TIME SAVED · ${fmtTime(finalTime)}`))
        .catch(() => toast.error('Could not save score. Check connection.'))
    }
  }, [board, conflicts, status, user, difficulty, toast])

  // Keyboard input
  useEffect(() => {
    const handler = (e) => {
      const tag = e.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key >= '1' && e.key <= '9') {
        e.preventDefault()
        handleInput(Number(e.key))
        return
      }
      if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') {
        e.preventDefault()
        handleInput(0)
        return
      }
      if (!selected) return
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelected({ r: Math.max(0, selected.r - 1), c: selected.c })
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelected({ r: Math.min(8, selected.r + 1), c: selected.c })
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setSelected({ r: selected.r, c: Math.max(0, selected.c - 1) })
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        setSelected({ r: selected.r, c: Math.min(8, selected.c + 1) })
      }
    }
    window.addEventListener('keydown', handler, { passive: false })
    return () => window.removeEventListener('keydown', handler)
  }, [handleInput, selected])

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Stat label="TIME" value={fmtTime(time)} accent="text-neon-cyan" />
        <button
          type="button"
          onClick={() => setShowErrors(true)}
          className="rounded-md border border-neon-green/60 px-4 py-2 font-arcade text-[10px] text-neon-green transition hover:bg-neon-green/15 hover:shadow-neon-green"
        >
          CHECK
        </button>
        <button
          type="button"
          onClick={() => newGame()}
          className="rounded-md border border-neon-pink/60 px-4 py-2 font-arcade text-[10px] text-neon-pink transition hover:bg-neon-pink/15 hover:shadow-neon-pink"
        >
          NEW PUZZLE
        </button>
      </div>

      <div className="relative">
        <SudokuGrid
          board={board}
          selected={selected}
          conflicts={conflicts}
          errors={errors}
          size={boardSize}
          onSelect={setSelected}
        />
        {status === 'won' && (
          <WinOverlay
            time={time}
            difficulty={difficulty}
            signedIn={!!user}
            onPlayAgain={() => newGame()}
          />
        )}
      </div>

      <NumberPad onInput={handleInput} />

      {status === 'won' && (
        <div className="lb-slide-in w-full max-w-md">
          <Leaderboard
            gameId={`sudoku-${difficulty}`}
            scoreFormat="time"
            lowerIsBetter
            title={`SUDOKU · ${difficulty.toUpperCase()}`}
          />
        </div>
      )}

      {!user && (
        <p className="text-center text-[10px] text-white/40">
          Log in to save completion times to the global leaderboard.
        </p>
      )}
      {leaveModal}
    </div>
  )
}

function Stat({ label, value, accent }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-white/10 bg-arcadia-surface/60 px-4 py-2">
      <span className="font-arcade text-[9px] text-white/45">{label}</span>
      <span className={`font-arcade text-sm ${accent}`}>{value}</span>
    </div>
  )
}

function SudokuGrid({ board, selected, conflicts, errors, onSelect, size }) {
  return (
    <div
      className="grid grid-cols-9 grid-rows-9 overflow-hidden rounded-md border-2 border-neon-cyan/60 bg-arcadia-bg shadow-neon-cyan"
      style={{ width: size, height: size }}
      role="grid"
      aria-label="Sudoku board"
    >
      {board.puzzle.map((row, r) =>
        row.map((givenVal, c) => {
          const key = `${r},${c}`
          const given = givenVal !== 0
          const value = board.grid[r][c]
          const isSelected = selected?.r === r && selected?.c === c
          const isConflict = conflicts.has(key)
          const isError = errors.has(key)
          const isLastBoxX = (c + 1) % 3 === 0 && c !== 8
          const isLastBoxY = (r + 1) % 3 === 0 && r !== 8

          const inSameRowCol =
            selected && (selected.r === r || selected.c === c) && !isSelected
          const inSameBox =
            selected &&
            Math.floor(selected.r / 3) === Math.floor(r / 3) &&
            Math.floor(selected.c / 3) === Math.floor(c / 3) &&
            !isSelected

          let bg = 'bg-arcadia-bg'
          if (isConflict || isError) bg = 'bg-neon-pink/20'
          else if (isSelected) bg = 'bg-neon-green/15'
          else if (inSameRowCol || inSameBox) bg = 'bg-white/[0.04]'

          let textColor = 'text-white'
          if (isError) textColor = 'text-neon-pink'
          else if (!given) textColor = 'text-neon-cyan'

          const borderR =
            c === 8
              ? ''
              : isLastBoxX
                ? 'border-r-[3px] border-r-neon-cyan/70'
                : 'border-r border-r-white/10'
          const borderB =
            r === 8
              ? ''
              : isLastBoxY
                ? 'border-b-[3px] border-b-neon-cyan/70'
                : 'border-b border-b-white/10'

          return (
            <button
              type="button"
              key={key}
              onClick={() => onSelect({ r, c })}
              className={`relative flex select-none items-center justify-center font-arcade text-sm transition sm:text-base ${bg} ${textColor} ${borderR} ${borderB} ${
                isSelected ? 'z-10 ring-2 ring-inset ring-neon-green' : ''
              }`}
              aria-label={`Cell ${r + 1},${c + 1}${given ? ' (given)' : ''}`}
            >
              {value === 0 ? '' : value}
            </button>
          )
        }),
      )}
    </div>
  )
}

function NumberPad({ onInput }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onInput(n)}
          className="h-11 w-11 rounded-md border border-white/15 bg-arcadia-surface/60 font-arcade text-base text-neon-cyan transition hover:border-neon-cyan/60 hover:bg-neon-cyan/10 hover:shadow-neon-cyan"
        >
          {n}
        </button>
      ))}
      <button
        type="button"
        onClick={() => onInput(0)}
        className="h-11 rounded-md border border-white/15 bg-arcadia-surface/60 px-4 font-arcade text-[10px] text-white/70 transition hover:border-neon-pink/60 hover:text-neon-pink"
      >
        ERASE
      </button>
    </div>
  )
}

function WinOverlay({ time, difficulty, signedIn, onPlayAgain }) {
  const best = Number(
    localStorage.getItem(`arcadia:bestTime:sudoku:${difficulty}`) || 0,
  )
  return (
    <div className="go-overlay-in absolute inset-2 flex flex-col items-center justify-center overflow-hidden rounded-md bg-arcadia-bg/92 px-6 text-center backdrop-blur-sm">
      <WinParticles />
      <p className="relative font-arcade text-base text-neon-green drop-shadow-[0_0_12px_rgba(0,255,136,0.5)] md:text-xl">
        <span className="go-icon-pop">★</span> COMPLETE{' '}
        <span className="go-icon-pop">★</span>
      </p>
      <div className="relative mt-5 grid grid-cols-2 gap-4">
        <div>
          <p className="font-arcade text-[9px] text-white/45">TIME</p>
          <p className="mt-1 font-arcade text-base text-neon-cyan">
            {fmtTime(time)}
          </p>
        </div>
        <div>
          <p className="font-arcade text-[9px] text-white/45">BEST</p>
          <p className="mt-1 font-arcade text-base text-neon-pink">
            {best ? fmtTime(best) : '—'}
          </p>
        </div>
      </div>
      <div className="relative mt-5 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={onPlayAgain}
          className="rounded-md border border-neon-green/70 bg-neon-green/10 px-4 py-2 font-arcade text-[10px] text-neon-green transition hover:bg-neon-green/20 hover:shadow-neon-green"
        >
          ▶ NEW PUZZLE
        </button>
        <HallOfFameButton signedIn={signedIn} />
        <Link
          to="/"
          className="rounded-md border border-white/20 px-4 py-2 text-center font-arcade text-[10px] text-white/70 transition hover:border-neon-cyan/60 hover:text-neon-cyan"
        >
          BACK TO LOBBY
        </Link>
      </div>
    </div>
  )
}
