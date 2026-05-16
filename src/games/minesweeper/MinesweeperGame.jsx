import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { postScore } from '../../lib/api'
import Leaderboard from '../../components/Leaderboard'

const DIFFICULTIES = {
  easy: { rows: 9, cols: 9, mines: 10, label: 'EASY', cell: 32 },
  medium: { rows: 16, cols: 16, mines: 40, label: 'MEDIUM', cell: 26 },
  hard: { rows: 16, cols: 30, mines: 99, label: 'HARD', cell: 22 },
}

const NUM_COLORS = [
  '',
  'text-neon-cyan',
  'text-neon-green',
  'text-neon-pink',
  'text-purple-400',
  'text-yellow-400',
  'text-orange-400',
  'text-white',
  'text-rose-300',
]

function makeBoard(rows, cols) {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({
      isMine: false,
      revealed: false,
      flagged: false,
      adjacent: 0,
      triggered: false,
    })),
  )
}

function placeMines(board, rows, cols, mineCount, avoidR, avoidC) {
  const avoid = new Set()
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const r = avoidR + dr
      const c = avoidC + dc
      if (r >= 0 && r < rows && c >= 0 && c < cols) avoid.add(`${r},${c}`)
    }
  }
  let placed = 0
  while (placed < mineCount) {
    const r = Math.floor(Math.random() * rows)
    const c = Math.floor(Math.random() * cols)
    if (avoid.has(`${r},${c}`) || board[r][c].isMine) continue
    board[r][c].isMine = true
    placed++
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (board[r][c].isMine) continue
      let count = 0
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue
          const nr = r + dr
          const nc = c + dc
          if (
            nr >= 0 &&
            nr < rows &&
            nc >= 0 &&
            nc < cols &&
            board[nr][nc].isMine
          ) {
            count++
          }
        }
      }
      board[r][c].adjacent = count
    }
  }
}

function floodReveal(board, rows, cols, startR, startC) {
  const stack = [[startR, startC]]
  while (stack.length > 0) {
    const [r, c] = stack.pop()
    if (r < 0 || r >= rows || c < 0 || c >= cols) continue
    const cell = board[r][c]
    if (cell.revealed || cell.flagged || cell.isMine) continue
    cell.revealed = true
    if (cell.adjacent === 0) {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue
          stack.push([r + dr, c + dc])
        }
      }
    }
  }
}

function cloneBoard(b) {
  return b.map((row) => row.map((cell) => ({ ...cell })))
}

export default function MinesweeperGame({ difficulty = 'easy' }) {
  const { user } = useAuth()
  const diff = difficulty
  const cfg = DIFFICULTIES[diff] ?? DIFFICULTIES.easy

  const [board, setBoard] = useState(() => makeBoard(cfg.rows, cfg.cols))
  const [status, setStatus] = useState('idle')
  const [flagsLeft, setFlagsLeft] = useState(cfg.mines)
  const [time, setTime] = useState(0)
  const [flagMode, setFlagMode] = useState(false)
  const startTimeRef = useRef(null)

  const newGame = useCallback(() => {
    setBoard(makeBoard(cfg.rows, cfg.cols))
    setStatus('idle')
    setFlagsLeft(cfg.mines)
    setTime(0)
    setFlagMode(false)
    startTimeRef.current = null
  }, [cfg.rows, cfg.cols, cfg.mines])

  // Reset when difficulty changes (route param)
  useEffect(() => {
    newGame()
  }, [difficulty, newGame])

  // Timer
  useEffect(() => {
    if (status !== 'playing') return
    const id = setInterval(() => {
      if (startTimeRef.current != null) {
        setTime(Math.floor((Date.now() - startTimeRef.current) / 1000))
      }
    }, 250)
    return () => clearInterval(id)
  }, [status])

  const saveBest = useCallback(
    (seconds) => {
      const key = `arcadia:bestTime:minesweeper:${diff}`
      const prev = Number(localStorage.getItem(key) || 0)
      if (prev === 0 || seconds < prev) {
        localStorage.setItem(key, String(seconds))
      }
      if (user && seconds > 0) {
        postScore({
          userId: user.id,
          gameId: `minesweeper-${diff}`,
          score: seconds,
        }).catch(() => {})
      }
    },
    [user, diff],
  )

  const handleReveal = useCallback(
    (r, c) => {
      if (status === 'won' || status === 'lost') return
      const next = cloneBoard(board)
      const cell = next[r][c]
      if (cell.flagged || cell.revealed) return

      let newStatus = status
      if (status === 'idle') {
        placeMines(next, cfg.rows, cfg.cols, cfg.mines, r, c)
        startTimeRef.current = Date.now()
        newStatus = 'playing'
      }

      if (next[r][c].isMine) {
        for (let i = 0; i < cfg.rows; i++) {
          for (let j = 0; j < cfg.cols; j++) {
            if (next[i][j].isMine) next[i][j].revealed = true
          }
        }
        next[r][c].triggered = true
        setBoard(next)
        setStatus('lost')
        return
      }

      floodReveal(next, cfg.rows, cfg.cols, r, c)

      let unrevealed = 0
      for (let i = 0; i < cfg.rows; i++) {
        for (let j = 0; j < cfg.cols; j++) {
          if (!next[i][j].revealed && !next[i][j].isMine) unrevealed++
        }
      }
      if (unrevealed === 0) {
        for (let i = 0; i < cfg.rows; i++) {
          for (let j = 0; j < cfg.cols; j++) {
            if (next[i][j].isMine) next[i][j].flagged = true
          }
        }
        const finalTime = Math.floor(
          (Date.now() - startTimeRef.current) / 1000,
        )
        setTime(finalTime)
        setFlagsLeft(0)
        setBoard(next)
        setStatus('won')
        saveBest(finalTime)
        return
      }

      setBoard(next)
      if (newStatus !== status) setStatus(newStatus)
    },
    [board, cfg, status, saveBest],
  )

  const handleFlag = useCallback(
    (r, c) => {
      if (status === 'won' || status === 'lost') return
      const next = cloneBoard(board)
      const cell = next[r][c]
      if (cell.revealed) return

      if (status === 'idle') {
        startTimeRef.current = Date.now()
        setStatus('playing')
      }

      cell.flagged = !cell.flagged
      setBoard(next)
      setFlagsLeft((f) => f + (cell.flagged ? -1 : 1))
    },
    [board, status],
  )

  const handleCellClick = (r, c) => {
    if (flagMode) handleFlag(r, c)
    else handleReveal(r, c)
  }

  const handleCellContext = (e, r, c) => {
    e.preventDefault()
    handleFlag(r, c)
  }

  const smiley = status === 'lost' ? '😵' : status === 'won' ? '😎' : '🙂'

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="rounded-lg border-2 border-neon-green/60 bg-arcadia-surface p-3 shadow-neon-green">
        <div className="mb-3 flex items-center justify-between gap-4">
          <Counter
            value={Math.max(-99, flagsLeft).toString().padStart(3, '0')}
            color="text-neon-pink"
            label="MINES"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => newGame()}
              className="grid h-10 w-10 place-items-center rounded-md border border-white/15 bg-arcadia-bg text-2xl transition hover:border-neon-cyan/60"
              aria-label="Reset game"
            >
              {smiley}
            </button>
            <button
              type="button"
              onClick={() => setFlagMode((f) => !f)}
              className={`grid h-10 w-10 place-items-center rounded-md border text-lg transition ${
                flagMode
                  ? 'border-neon-pink bg-neon-pink/20 text-neon-pink shadow-neon-pink'
                  : 'border-white/15 bg-arcadia-bg text-white/70 hover:border-neon-pink/40'
              }`}
              aria-pressed={flagMode}
              aria-label="Toggle flag mode"
              title="Flag mode (tap to flag instead of reveal)"
            >
              🚩
            </button>
          </div>
          <Counter
            value={Math.min(999, time).toString().padStart(3, '0')}
            color="text-neon-cyan"
            label="TIME"
          />
        </div>

        <div className="overflow-x-auto">
          <Board
            board={board}
            cfg={cfg}
            onCellClick={handleCellClick}
            onCellContext={handleCellContext}
          />
        </div>
      </div>

      <p className="text-center text-[10px] text-white/40">
        Left click: reveal · Right click or flag mode: toggle flag
      </p>

      {(status === 'won' || status === 'lost') && (
        <Result
          status={status}
          time={time}
          difficulty={diff}
          onReset={() => newGame()}
        />
      )}

      {status === 'won' && (
        <div className="lb-slide-in w-full max-w-md">
          <Leaderboard
            gameId={`minesweeper-${diff}`}
            scoreFormat="time"
            lowerIsBetter
            title={`MINESWEEPER · ${diff.toUpperCase()}`}
          />
        </div>
      )}
    </div>
  )
}

function Counter({ value, color, label }) {
  return (
    <div className="rounded-md border border-white/10 bg-arcadia-bg px-3 py-1.5 text-center">
      <p className="font-arcade text-[8px] text-white/40">{label}</p>
      <p className={`font-arcade text-base tracking-wider ${color}`}>{value}</p>
    </div>
  )
}

function Board({ board, cfg, onCellClick, onCellContext }) {
  return (
    <div
      className="grid select-none gap-px bg-white/10"
      style={{
        gridTemplateColumns: `repeat(${cfg.cols}, ${cfg.cell}px)`,
        gridTemplateRows: `repeat(${cfg.rows}, ${cfg.cell}px)`,
      }}
      role="grid"
      aria-label="Minesweeper board"
    >
      {board.map((row, r) =>
        row.map((cell, c) => (
          <Cell
            key={`${r},${c}`}
            cell={cell}
            size={cfg.cell}
            onClick={() => onCellClick(r, c)}
            onContextMenu={(e) => onCellContext(e, r, c)}
          />
        )),
      )}
    </div>
  )
}

function Cell({ cell, size, onClick, onContextMenu }) {
  const base = 'flex items-center justify-center font-arcade transition'
  const fontSize = size <= 22 ? 'text-[11px]' : size <= 26 ? 'text-xs' : 'text-sm'

  if (cell.revealed) {
    if (cell.isMine) {
      return (
        <div
          className={`${base} ${
            cell.triggered ? 'bg-neon-pink/40' : 'bg-arcadia-bg'
          }`}
        >
          💣
        </div>
      )
    }
    return (
      <div className={`${base} bg-arcadia-bg ${fontSize} ${NUM_COLORS[cell.adjacent] ?? ''}`}>
        {cell.adjacent || ''}
      </div>
    )
  }
  return (
    <button
      type="button"
      onClick={onClick}
      onContextMenu={onContextMenu}
      className={`${base} ${fontSize} cursor-pointer bg-arcadia-surface text-neon-pink transition hover:bg-white/5`}
      aria-label={cell.flagged ? 'Flagged' : 'Hidden cell'}
    >
      {cell.flagged ? '🚩' : ''}
    </button>
  )
}

function Result({ status, time, difficulty, onReset }) {
  const won = status === 'won'
  const best = Number(
    localStorage.getItem(`arcadia:bestTime:minesweeper:${difficulty}`) || 0,
  )
  return (
    <div
      className={`flex flex-col items-center gap-3 rounded-lg border bg-arcadia-surface/80 px-6 py-5 text-center shadow-lg backdrop-blur ${
        won ? 'border-neon-green/60 shadow-neon-green' : 'border-neon-pink/60 shadow-neon-pink'
      }`}
    >
      <p
        className={`font-arcade text-base ${
          won ? 'text-neon-green' : 'text-neon-pink'
        }`}
      >
        {won ? '★ CLEARED ★' : '💥 BUSTED'}
      </p>
      {won && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="font-arcade text-[9px] text-white/45">TIME</p>
            <p className="mt-1 font-arcade text-sm text-neon-cyan">{time}s</p>
          </div>
          <div>
            <p className="font-arcade text-[9px] text-white/45">BEST</p>
            <p className="mt-1 font-arcade text-sm text-neon-green">
              {best ? `${best}s` : '—'}
            </p>
          </div>
        </div>
      )}
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={onReset}
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
    </div>
  )
}
