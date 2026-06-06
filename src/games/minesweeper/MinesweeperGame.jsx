import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

import { useAuth } from '../../context/AuthContext'
import { useGameLeaveGuard } from '../../context/LeaveGuardContext'
import { useToast } from '../../context/ToastContext'
import { useArmGameOverFlash } from '../../context/GameOverFlashContext'
import { useViewport } from '../../hooks/useViewport'
import LandscapeHint from '../../components/LandscapeHint'
import { postScore } from '../../lib/api'
import GameOverPanel from '../../components/GameOverPanel'

const DIFFICULTIES = {
  easy: { rows: 9, cols: 9, mines: 10, label: 'EASY' },
  medium: { rows: 16, cols: 16, mines: 40, label: 'MEDIUM' },
  hard: { rows: 16, cols: 30, mines: 99, label: 'HARD' },
}

const CELL_MIN = 16
const CELL_MAX = 36
// Breathing room below the board so the "left click / right click"
// hint and result panel never push the bottom of the grid off-screen.
const BOARD_BOTTOM_RESERVE = 90

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
  const toast = useToast()
  const diff = difficulty
  const cfg = DIFFICULTIES[diff] ?? DIFFICULTIES.easy

  const [board, setBoard] = useState(() => makeBoard(cfg.rows, cfg.cols))
  const [status, setStatus] = useState('idle')
  useArmGameOverFlash(status === 'won' || status === 'lost')

  const leaveModal = useGameLeaveGuard({
    active: status === 'playing',
    kind: 'single',
  })
  const [flagsLeft, setFlagsLeft] = useState(cfg.mines)
  const [time, setTime] = useState(0)
  const [flagMode, setFlagMode] = useState(false)
  const startTimeRef = useRef(null)

  // Dynamic cell sizing — fits the board to the visible viewport so
  // hard mode in particular doesn't need horizontal scrolling. We
  // measure the outer flex container's width (which spans the main
  // content area) instead of the board wrapper itself, since the
  // wrapper's width is derived from cellSize and would create a
  // measurement feedback loop.
  const outerRef = useRef(null)
  const panelRef = useRef(null)
  const { width: vw, height: vh } = useViewport()
  const [cellSize, setCellSize] = useState(28)

  useLayoutEffect(() => {
    const outer = outerRef.current
    const panel = panelRef.current
    if (!outer || !panel) return
    // Reserve panel border (2px) + padding (12px each side) so the
    // board interior gets the remaining width.
    const PANEL_PAD = 28
    const availW = Math.max(0, outer.clientWidth - PANEL_PAD)
    const panelRect = panel.getBoundingClientRect()
    // Counter row sits inside the panel above the board. Estimate its
    // height conservatively (44px counters + margin) so the board can
    // fit below it.
    const COUNTERS_H = 60
    const availH = Math.max(
      0,
      vh - panelRect.top - PANEL_PAD - COUNTERS_H - BOARD_BOTTOM_RESERVE,
    )
    const fromW = Math.floor(availW / cfg.cols)
    const fromH = Math.floor(availH / cfg.rows)
    const raw = Math.min(fromW, fromH)
    const clamped = Math.max(CELL_MIN, Math.min(CELL_MAX, raw))
    if (Number.isFinite(clamped) && clamped > 0) setCellSize(clamped)
  }, [vw, vh, cfg.rows, cfg.cols])

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
        })
          .then(() => toast.success(`TIME SAVED · ${seconds}s`))
          .catch(() => toast.error('Could not save score. Check connection.'))
      }
    },
    [user, diff, toast],
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

  return (
    <div ref={outerRef} className="flex w-full flex-col items-center gap-6">
      {diff === 'hard' && (
        <LandscapeHint
          keyName="minesweeper-hard"
          message="Hard board fits better in landscape"
        />
      )}
      <div
        ref={panelRef}
        className="rounded-lg border-2 border-neon-green/60 bg-arcadia-surface p-3 shadow-neon-green"
      >
        <div className="mb-3 flex items-center justify-between gap-4">
          <Counter
            value={Math.max(-99, flagsLeft).toString().padStart(3, '0')}
            color="text-neon-pink"
            label="MINES"
          />
          <div className="flex items-center gap-2">
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

        <div
          className="flex justify-center"
          style={{
            width: cfg.cols * cellSize,
            height: cfg.rows * cellSize,
            overflow: 'hidden',
            touchAction: 'none',
          }}
        >
          <Board
            board={board}
            cfg={cfg}
            cellSize={cellSize}
            onCellClick={handleCellClick}
            onCellContext={handleCellContext}
          />
        </div>
      </div>

      <p className="text-center text-[10px] text-white/40">
        Left click: reveal · Right click or flag mode: toggle flag
      </p>

      {(status === 'won' || status === 'lost') && (
        <MinesweeperResultPanel
          status={status}
          time={time}
          difficulty={diff}
          signedIn={!!user}
          onReset={() => newGame()}
        />
      )}
      {leaveModal}
    </div>
  )
}

function Counter({ value, color, label }) {
  return (
    <div className="glass-panel pixel-corners pixel-corners-pink px-3 py-1.5 text-center">
      <p className="font-arcade text-[8px] text-white/40">{label}</p>
      <p className={`neon-text font-arcade text-base tracking-wider ${color}`}>
        {value}
      </p>
    </div>
  )
}

function Board({ board, cfg, cellSize, onCellClick, onCellContext }) {
  return (
    <div
      className="grid select-none bg-white/10"
      style={{
        gridTemplateColumns: `repeat(${cfg.cols}, ${cellSize}px)`,
        gridTemplateRows: `repeat(${cfg.rows}, ${cellSize}px)`,
        touchAction: 'none',
      }}
      role="grid"
      aria-label="Minesweeper board"
    >
      {board.map((row, r) =>
        row.map((cell, c) => (
          <Cell
            key={`${r},${c}`}
            cell={cell}
            size={cellSize}
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
  const fontSize =
    size <= 18
      ? 'text-[9px]'
      : size <= 22
        ? 'text-[11px]'
        : size <= 26
          ? 'text-xs'
          : 'text-sm'
  // Subtle inset right+bottom gridline so cells don't visually merge
  // when several reveal at once — keeps the grid container at the exact
  // cols*cellSize so overflow:hidden never clips a column.
  const gridLine = 'inset -1px -1px 0 rgba(255,255,255,0.06)'

  if (cell.revealed) {
    if (cell.isMine) {
      return (
        <div
          className={`${base} ${
            cell.triggered ? 'bg-neon-pink/40' : 'bg-arcadia-bg'
          }`}
          style={{ boxShadow: gridLine }}
        >
          💣
        </div>
      )
    }
    return (
      <div
        className={`${base} bg-arcadia-bg ${fontSize} ${NUM_COLORS[cell.adjacent] ?? ''}`}
        style={{ boxShadow: gridLine }}
      >
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
      style={{ boxShadow: gridLine, touchAction: 'none' }}
      aria-label={cell.flagged ? 'Flagged' : 'Hidden cell'}
    >
      {cell.flagged ? '🚩' : ''}
    </button>
  )
}

function MinesweeperResultPanel({
  status,
  time,
  difficulty,
  signedIn,
  onReset,
}) {
  const won = status === 'won'
  const best = Number(
    localStorage.getItem(`arcadia:bestTime:minesweeper:${difficulty}`) || 0,
  )
  const isNewBest = won && best > 0 && time <= best
  if (!won) {
    return (
      <GameOverPanel
        variant="lose"
        title="BUSTED"
        signedIn={signedIn}
        onPrimary={onReset}
        primaryLabel="▶ PLAY AGAIN"
      />
    )
  }
  return (
    <GameOverPanel
      variant={isNewBest ? 'new-high' : 'win'}
      title={isNewBest ? 'NEW BEST TIME!' : 'CLEARED!'}
      mainValue={`${time}s`}
      mainLabel="YOUR TIME"
      secondaryValue={best ? `${best}s` : '—'}
      secondaryLabel="PERSONAL BEST"
      signedIn={signedIn}
      onPrimary={onReset}
      primaryLabel="▶ PLAY AGAIN"
    />
  )
}
