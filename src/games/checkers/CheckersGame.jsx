import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useGameLeaveGuard } from '../../context/LeaveGuardContext'
import { useArmGameOverFlash } from '../../context/GameOverFlashContext'
import { LobbyBackLink } from '../../context/GameOverFlashContext'
import { useViewport } from '../../hooks/useViewport'
import {
  SIZE,
  applyMove,
  chooseAiMove,
  countPieces,
  gameResult,
  initialBoard,
  legalMoves,
  legalMovesFrom,
} from './engine'

const AI_DEPTH = { easy: 1, medium: 3, hard: 5 }
const AI_THINK_MS = { easy: 350, medium: 600, hard: 900 }

// In Pass & Play mode the board is fixed white-at-bottom; in vs-bot
// mode the human is always white and so the board is also white-at-
// bottom. (If we add a "play as black" option later we can flip here.)
function rowDisplayIndex(r) {
  return r
}

export default function CheckersGame({ mode = 'computer', difficulty = 'easy' }) {
  const isLocal = mode === 'local'
  const isBot = mode === 'computer'

  const [board, setBoard] = useState(() => initialBoard())
  const [turn, setTurn] = useState('w') // white moves first
  const [selected, setSelected] = useState(null) // { r, c }
  // While a multi-jump chain is in progress, lock to the chain piece
  // so the player can't switch to a different one mid-jump.
  const [chainFrom, setChainFrom] = useState(null)
  const [result, setResult] = useState(null) // { winner, reason } | null
  const [aiThinking, setAiThinking] = useState(false)
  const [lastMove, setLastMove] = useState(null)
  useArmGameOverFlash(!!result)
  const leaveModal = useGameLeaveGuard({
    active: !result,
    kind: 'single',
  })

  const boardRef = useRef(board)
  const turnRef = useRef(turn)
  boardRef.current = board
  turnRef.current = turn

  // Board sizing — full available width on mobile, capped on desktop.
  const { width: vw, height: vh } = useViewport()
  const isDesktop = vw >= 768
  const layoutPad = isDesktop ? 96 : 40
  const availW = Math.max(0, vw - layoutPad)
  const availH = Math.max(0, vh - 360)
  const boardSize = Math.max(
    260,
    Math.min(availW, availH, isDesktop ? 560 : 460),
  )
  const cellSize = boardSize / SIZE

  // Highlighted destinations for the currently selected piece.
  const destinations = useMemo(() => {
    if (!selected) return []
    return legalMovesFrom(board, turn, selected.r, selected.c)
  }, [board, turn, selected])

  // The human player's colour for vs-bot mode is always white. For
  // local mode either side is the human.
  const humanCanMove = !result && !aiThinking && (isLocal || turn === 'w')

  // ===== Bot move =====
  useEffect(() => {
    if (!isBot) return
    if (result) return
    if (turn !== 'b') return // bot plays black
    setAiThinking(true)
    const depth = AI_DEPTH[difficulty] ?? AI_DEPTH.medium
    const wait = AI_THINK_MS[difficulty] ?? AI_THINK_MS.medium
    const startedAt = Date.now()
    // Run the search synchronously but pad with a "thinking" delay so
    // the move feels like a decision instead of an instant snap.
    const move = chooseAiMove(boardRef.current, 'b', depth)
    if (!move) {
      setAiThinking(false)
      const r = gameResult(boardRef.current, turnRef.current)
      if (r) setResult(r)
      return
    }
    const elapsed = Date.now() - startedAt
    const id = setTimeout(
      () => {
        executeChain(move, 'b')
        setAiThinking(false)
      },
      Math.max(0, wait - elapsed),
    )
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn, isBot, result, difficulty])

  // Execute a single move plus any forced chain jumps for the same
  // side (used by both human chain auto-execution-on-bot and the
  // bot itself).
  const executeChain = useCallback((firstMove, color) => {
    let cur = applyMove(boardRef.current, firstMove)
    let pos = firstMove.to
    while (cur.mustContinue) {
      const next = cur.continuationMoves[0]
      cur = applyMove(cur.board, next)
      pos = next.to
    }
    setBoard(cur.board)
    setLastMove({ from: firstMove.from, to: pos })
    setSelected(null)
    setChainFrom(null)
    const nextTurn = color === 'w' ? 'b' : 'w'
    setTurn(nextTurn)
    // Check for end-of-game
    const r = gameResult(cur.board, nextTurn)
    if (r) setResult(r)
  }, [])

  const handleCellClick = useCallback(
    (r, c) => {
      if (!humanCanMove) return
      const piece = board[r][c]
      // If currently selecting a destination
      if (selected) {
        // Tap own piece (and not in chain) → switch selection
        if (piece?.color === turn) {
          if (chainFrom) return // can't switch mid-chain
          setSelected({ r, c })
          return
        }
        // Otherwise find a matching destination
        const dest = destinations.find(
          (m) => m.to[0] === r && m.to[1] === c,
        )
        if (!dest) {
          // Tap empty / wrong cell: clear selection unless chained
          if (!chainFrom) setSelected(null)
          return
        }
        const stepResult = applyMove(board, dest)
        setBoard(stepResult.board)
        setLastMove({ from: dest.from, to: dest.to })
        if (stepResult.mustContinue) {
          // Stay on the same piece for the next jump
          setSelected({ r: dest.to[0], c: dest.to[1] })
          setChainFrom({ r: dest.to[0], c: dest.to[1] })
        } else {
          setSelected(null)
          setChainFrom(null)
          const nextTurn = turn === 'w' ? 'b' : 'w'
          setTurn(nextTurn)
          const res = gameResult(stepResult.board, nextTurn)
          if (res) setResult(res)
        }
        return
      }
      // Nothing selected yet: only select own piece
      if (piece?.color !== turn) return
      const moves = legalMovesFrom(board, turn, r, c)
      if (moves.length === 0) return
      setSelected({ r, c })
    },
    [board, chainFrom, destinations, humanCanMove, selected, turn],
  )

  const reset = useCallback(() => {
    setBoard(initialBoard())
    setTurn('w')
    setSelected(null)
    setChainFrom(null)
    setResult(null)
    setAiThinking(false)
    setLastMove(null)
  }, [])

  // Resign — single-player only. Local mode also exposes it; the
  // current side simply forfeits.
  const resign = useCallback(() => {
    if (result) return
    const winner = turn === 'w' ? 'b' : 'w'
    setResult({ winner, reason: 'resign' })
  }, [result, turn])

  const wCount = countPieces(board, 'w')
  const bCount = countPieces(board, 'b')

  const turnLabel = result
    ? 'GAME OVER'
    : isLocal
      ? turn === 'w'
        ? "WHITE'S TURN"
        : "BLACK'S TURN"
      : turn === 'w'
        ? 'YOUR TURN'
        : aiThinking
          ? 'BOT THINKING'
          : 'BOT MOVES'

  return (
    <div className="flex flex-1 flex-col items-center gap-3">
      <PlayerStrip
        name={isLocal ? 'PLAYER 2 · BLACK' : `BOT (${difficulty.toUpperCase()})`}
        color="b"
        pieces={bCount}
        active={turn === 'b' && !result}
        thinking={isBot && aiThinking}
      />
      <div className="font-arcade text-[10px] text-white/55 tracking-widest">
        {turnLabel}
      </div>
      <Board
        board={board}
        size={boardSize}
        cellSize={cellSize}
        selected={selected}
        destinations={destinations}
        lastMove={lastMove}
        onClick={handleCellClick}
      />
      <PlayerStrip
        name={isLocal ? 'PLAYER 1 · WHITE' : 'YOU · WHITE'}
        color="w"
        pieces={wCount}
        active={turn === 'w' && !result}
        thinking={false}
      />
      <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={reset}
          className="rounded-md border border-white/15 px-4 py-2 font-arcade text-[10px] text-white/70 transition hover:border-neon-cyan/60 hover:text-neon-cyan"
        >
          ↻ NEW GAME
        </button>
        {!result && (
          <button
            type="button"
            onClick={() => {
              if (window.confirm('Resign the game?')) resign()
            }}
            className="rounded-md border border-neon-pink/60 px-4 py-2 font-arcade text-[10px] text-neon-pink transition hover:bg-neon-pink/15 hover:shadow-neon-pink"
          >
            🏳 RESIGN
          </button>
        )}
      </div>

      {result && (
        <CheckersResultPanel
          result={result}
          isBot={isBot}
          isLocal={isLocal}
          onReplay={reset}
        />
      )}
      {leaveModal}
    </div>
  )
}

function Board({
  board,
  size,
  cellSize,
  selected,
  destinations,
  lastMove,
  onClick,
}) {
  const cells = []
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      cells.push([r, c])
    }
  }
  const destSet = new Set(destinations.map((m) => `${m.to[0]},${m.to[1]}`))
  const captureSet = new Set(
    destinations.filter((m) => m.captured).map((m) => `${m.to[0]},${m.to[1]}`),
  )
  const lastFromKey = lastMove ? `${lastMove.from[0]},${lastMove.from[1]}` : ''
  const lastToKey = lastMove ? `${lastMove.to[0]},${lastMove.to[1]}` : ''
  const selKey = selected ? `${selected.r},${selected.c}` : ''
  return (
    <div
      className="grid overflow-hidden rounded-lg border-2 border-neon-cyan/50 shadow-neon-cyan"
      style={{
        gridTemplateColumns: `repeat(${SIZE}, ${cellSize}px)`,
        gridTemplateRows: `repeat(${SIZE}, ${cellSize}px)`,
        width: size,
        height: size,
      }}
      role="grid"
      aria-label="Checkers board"
    >
      {cells.map(([r, c]) => {
        const dark = (r + c) % 2 === 1
        const key = `${r},${c}`
        const piece = board[r][c]
        const isDest = destSet.has(key)
        const isCapture = captureSet.has(key)
        const isLast = key === lastFromKey || key === lastToKey
        const isSelected = key === selKey
        const baseBg = dark ? '#3b4159' : '#cbd0dc'
        let overlay = null
        if (isSelected) {
          overlay = (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-none ring-2 ring-inset ring-neon-green"
            />
          )
        } else if (isLast) {
          overlay = (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 ring-2 ring-inset ring-neon-cyan/55"
            />
          )
        }
        return (
          <button
            key={key}
            type="button"
            onClick={() => onClick(r, c)}
            className="relative flex select-none items-center justify-center"
            style={{
              background: baseBg,
              cursor: piece || isDest ? 'pointer' : 'default',
            }}
            aria-label={`Row ${rowDisplayIndex(r) + 1} column ${c + 1}`}
          >
            {piece && <CheckersPiece piece={piece} size={cellSize} />}
            {isDest && (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute"
                style={{
                  width: cellSize * 0.32,
                  height: cellSize * 0.32,
                  borderRadius: '50%',
                  background: isCapture
                    ? 'rgba(255, 0, 110, 0.5)'
                    : 'rgba(0, 255, 136, 0.45)',
                  boxShadow: isCapture
                    ? '0 0 10px rgba(255, 0, 110, 0.55)'
                    : '0 0 10px rgba(0, 255, 136, 0.45)',
                }}
              />
            )}
            {overlay}
          </button>
        )
      })}
    </div>
  )
}

function CheckersPiece({ piece, size }) {
  const isW = piece.color === 'w'
  const fill = isW ? '#f0f3ff' : '#1a1a26'
  const ring = isW ? '#9aa3c0' : '#5a5a76'
  const accent = isW ? '#00ff88' : '#ff006e'
  const d = size * 0.72
  return (
    <span
      className="relative grid place-items-center rounded-full"
      style={{
        width: d,
        height: d,
        background: fill,
        border: `2px solid ${ring}`,
        boxShadow: `0 2px 6px rgba(0, 0, 0, 0.5), inset 0 -3px 6px rgba(0, 0, 0, 0.25), inset 0 3px 6px rgba(255, 255, 255, 0.18)`,
      }}
    >
      <span
        className="absolute rounded-full"
        style={{
          width: d * 0.7,
          height: d * 0.7,
          border: `1px dashed ${ring}80`,
        }}
        aria-hidden="true"
      />
      {piece.king && (
        <span
          className="font-arcade"
          style={{
            color: accent,
            fontSize: d * 0.42,
            textShadow: `0 0 6px ${accent}`,
            lineHeight: 1,
          }}
          aria-label="King"
        >
          ★
        </span>
      )}
    </span>
  )
}

function PlayerStrip({ name, color, pieces, active, thinking }) {
  const accent = color === 'w' ? 'text-neon-green' : 'text-neon-pink'
  const indicator = color === 'w' ? '#f0f3ff' : '#1a1a26'
  const indicatorRing = color === 'w' ? '#9aa3c0' : '#5a5a76'
  return (
    <div
      className={`flex w-full max-w-md items-center gap-3 rounded-md border bg-arcadia-surface/70 px-3 py-2 ${
        active
          ? color === 'w'
            ? 'border-neon-green/60 shadow-neon-green'
            : 'border-neon-pink/60 shadow-neon-pink'
          : 'border-white/10'
      }`}
    >
      <span
        className="grid h-7 w-7 shrink-0 place-items-center rounded-full"
        style={{
          background: indicator,
          border: `2px solid ${indicatorRing}`,
        }}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate font-arcade text-[10px] text-white">{name}</p>
        <p className={`font-arcade text-[8px] ${accent}`}>
          {pieces.total} PIECES · {pieces.kings} KING
          {pieces.kings === 1 ? '' : 'S'}
        </p>
      </div>
      {thinking && (
        <span className="font-arcade text-[9px] text-neon-cyan">THINKING…</span>
      )}
      {active && !thinking && (
        <span className="font-arcade text-[9px] text-neon-green">TURN</span>
      )}
    </div>
  )
}

function CheckersResultPanel({ result, isBot, isLocal, onReplay }) {
  if (typeof document === 'undefined') return null
  const isDraw = result.winner === 'draw'
  const reason = result.reason ?? 'GAME OVER'
  const reasonLabel =
    reason === 'no_pieces'
      ? 'NO PIECES LEFT'
      : reason === 'no_moves'
        ? 'NO LEGAL MOVES'
        : reason === 'resign'
          ? 'RESIGNED'
          : String(reason).toUpperCase().replace(/_/g, ' ')
  // For VS BOT, "you" is always white.
  const title = isDraw
    ? 'DRAW'
    : isLocal
      ? result.winner === 'w'
        ? 'WHITE WINS!'
        : 'BLACK WINS!'
      : isBot
        ? result.winner === 'w'
          ? 'YOU BEAT THE BOT!'
          : 'BOT WINS'
        : result.winner === 'w'
          ? 'YOU WIN!'
          : 'YOU LOST'
  const color = isDraw
    ? '#00d4ff'
    : result.winner === 'w'
      ? '#00ff88'
      : '#ff006e'
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[500] flex items-center justify-center px-4"
      style={{
        background: 'rgba(5, 5, 8, 0.88)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
      }}
    >
      <div
        className="go-overlay-in glass-panel pixel-corners relative w-full max-w-[340px] px-6 py-6 text-center"
        style={{ borderColor: color + '90', borderWidth: 2 }}
      >
        <p
          className="font-arcade text-base drop-shadow-[0_0_10px_currentColor] md:text-lg"
          style={{ color }}
        >
          <span className="go-icon-pop">★</span> {title}{' '}
          <span className="go-icon-pop">★</span>
        </p>
        <p className="mt-2 text-xs text-white/60">{reasonLabel}</p>
        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={onReplay}
            className="w-full rounded-md border border-neon-green/70 bg-neon-green/10 px-4 py-2 font-arcade text-[10px] text-neon-green transition hover:bg-neon-green/20 hover:shadow-neon-green"
          >
            ▶ PLAY AGAIN
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
