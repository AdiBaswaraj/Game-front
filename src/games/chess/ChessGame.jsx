import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Chess } from 'chess.js'
import { Chessboard } from 'react-chessboard'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { getRoom } from '../../lib/api'
import { socket } from '../../lib/socket'
import Avatar from '../../components/Avatar'
import {
  DIFFICULTY_DEPTH,
  getBestMove,
  preloadEngine,
  subscribeEngineState,
} from './engine'

const PIECE_VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 }

function pick(o, ...keys) {
  for (const k of keys) {
    if (o && o[k] != null) return o[k]
  }
  return undefined
}

function fenTurn(fen) {
  if (!fen) return 'w'
  return fen.split(' ')[1] === 'b' ? 'b' : 'w'
}

function pgnSan(history) {
  return history.map((m) => m.san)
}

function capturedFromHistory(history) {
  // chess.js verbose history records `captured` (piece letter) on capture moves
  const captured = { w: [], b: [] }
  for (const m of history) {
    if (m.captured) {
      // The capturing color is m.color; the captured piece was the opposite color
      const capturedColor = m.color === 'w' ? 'b' : 'w'
      captured[capturedColor].push(m.captured)
    }
  }
  return captured
}

export default function ChessGame({ mode, roomCode, difficulty = 'easy' }) {
  const { user, displayName } = useAuth()
  const toast = useToast()
  const chessRef = useRef(new Chess())
  const [fen, setFen] = useState(() => chessRef.current.fen())
  const [history, setHistory] = useState([]) // verbose move objects
  const [room, setRoom] = useState(null)
  const [myColor, setMyColor] = useState(mode === 'computer' ? 'w' : null)
  const [result, setResult] = useState(null) // {winner: 'w'|'b'|'draw', reason}
  const [error, setError] = useState(null)
  const [boardSize, setBoardSize] = useState(420)
  const containerRef = useRef(null)
  const aiThinkingRef = useRef(false)
  const [aiThinking, setAiThinking] = useState(false)
  const [engineState, setEngineStateLocal] = useState('idle')

  const isMP = mode === 'multiplayer'

  // Subscribe to Stockfish loading state — only matters for vs CPU
  useEffect(() => {
    if (isMP) return
    preloadEngine()
    const unsubscribe = subscribeEngineState(setEngineStateLocal)
    return unsubscribe
  }, [isMP])

  // Responsive board size — pick the smaller of container width / 480
  useEffect(() => {
    const update = () => {
      const w = containerRef.current?.clientWidth ?? 420
      setBoardSize(Math.min(480, w))
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  // MP: load room to determine color and rehydrate state
  useEffect(() => {
    if (!isMP) return
    let cancelled = false
    getRoom(roomCode)
      .then((data) => {
        if (cancelled) return
        const players = data?.players ?? []
        setRoom({ ...data, players })

        // First player in the list is white
        const idx = players.findIndex(
          (p) =>
            (user?.id && (p.userId ?? p.user_id ?? p.id) === user.id) ||
            (p.username ?? p.name)?.toLowerCase() ===
              displayName?.toLowerCase(),
        )
        setMyColor(idx === 0 ? 'w' : 'b')

        const gs = data?.gameState ?? data?.game_state
        const startingFen = pick(gs, 'fen', 'position')
        if (startingFen) {
          try {
            const c = new Chess(startingFen)
            chessRef.current = c
            setFen(c.fen())
          } catch {}
        }
      })
      .catch(() => {
        if (!cancelled) setError('Could not load room.')
      })
    return () => {
      cancelled = true
    }
  }, [isMP, roomCode, user?.id, displayName])

  // MP: socket events
  useEffect(() => {
    if (!isMP) return

    const onMoveAccepted = (data) => {
      const moveData = pick(data, 'move')
      const nextFen = pick(data, 'fen')
      const isCheckmate = pick(data, 'isCheckmate', 'is_checkmate', 'checkmate')
      const isCheck = pick(data, 'isCheck', 'is_check', 'check')

      if (nextFen) {
        try {
          const c = new Chess(nextFen)
          chessRef.current = c
          setFen(c.fen())
          setHistory(c.history({ verbose: true }))
        } catch (err) {
          console.warn('[chess] invalid fen from server', nextFen, err)
        }
      } else if (moveData) {
        // Fallback: apply move locally if no FEN given
        try {
          const mv = chessRef.current.move(moveData)
          if (mv) {
            setFen(chessRef.current.fen())
            setHistory(chessRef.current.history({ verbose: true }))
          }
        } catch {}
      }
      if (isCheckmate) {
        setResult({
          winner: fenTurn(chessRef.current.fen()) === 'w' ? 'b' : 'w',
          reason: 'CHECKMATE',
        })
      } else if (isCheck) {
        toast.show({ message: 'CHECK!', duration: 1500 })
      }
    }
    const onError = (data) => {
      toast.show({
        message: pick(data, 'message') ?? 'Invalid move.',
        duration: 2000,
      })
    }
    const onGameOver = (data) => {
      const winnerId = pick(data, 'winnerId', 'winner_id', 'winner')
      const players = room?.players ?? []
      const myId = user?.id
      const winnerColor =
        winnerId == null
          ? null
          : players.findIndex(
              (p) =>
                (p.userId ?? p.user_id ?? p.id) === winnerId ||
                p.username === winnerId,
            ) === 0
            ? 'w'
            : 'b'
      const reason =
        winnerId === myId
          ? 'OPPONENT RESIGNED'
          : pick(data, 'reason') ?? 'GAME OVER'
      setResult({ winner: winnerColor, reason })
    }
    const onOpponentLeft = () => {
      toast.show({ message: 'Opponent left the game.', duration: 4000 })
    }

    socket.on('move_accepted', onMoveAccepted)
    socket.on('error', onError)
    socket.on('game_over', onGameOver)
    socket.on('opponent_left', onOpponentLeft)
    return () => {
      socket.off('move_accepted', onMoveAccepted)
      socket.off('error', onError)
      socket.off('game_over', onGameOver)
      socket.off('opponent_left', onOpponentLeft)
    }
  }, [isMP, room, user?.id, toast])

  // Computer mode: trigger Stockfish whenever it's black's turn (assuming I'm white)
  useEffect(() => {
    if (isMP) return
    if (result) return
    if (chessRef.current.isGameOver()) {
      finalizeLocalResult()
      return
    }
    const turn = fenTurn(chessRef.current.fen())
    if (turn === myColor) return // my turn — wait for player input
    if (aiThinkingRef.current) return

    aiThinkingRef.current = true
    setAiThinking(true)
    const depth = DIFFICULTY_DEPTH[difficulty] ?? 2
    getBestMove(chessRef.current.fen(), depth)
      .then((uci) => {
        if (!uci) return
        const from = uci.slice(0, 2)
        const to = uci.slice(2, 4)
        const promotion = uci.length === 5 ? uci[4] : undefined
        const moved = chessRef.current.move({ from, to, promotion: promotion ?? 'q' })
        if (moved) {
          setFen(chessRef.current.fen())
          setHistory(chessRef.current.history({ verbose: true }))
          if (chessRef.current.inCheck() && !chessRef.current.isCheckmate()) {
            toast.show({ message: 'CHECK!', duration: 1500 })
          }
          if (chessRef.current.isGameOver()) {
            finalizeLocalResult()
          }
        }
      })
      .finally(() => {
        aiThinkingRef.current = false
        setAiThinking(false)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fen, isMP, difficulty, myColor, result])

  const finalizeLocalResult = useCallback(() => {
    const c = chessRef.current
    if (c.isCheckmate()) {
      const loserToMove = fenTurn(c.fen())
      setResult({
        winner: loserToMove === 'w' ? 'b' : 'w',
        reason: 'CHECKMATE',
      })
    } else if (c.isStalemate()) {
      setResult({ winner: 'draw', reason: 'STALEMATE' })
    } else if (c.isDraw()) {
      setResult({ winner: 'draw', reason: 'DRAW' })
    }
  }, [])

  const onPieceDrop = useCallback(
    ({ sourceSquare, targetSquare }) => {
      if (result || aiThinking) return false
      if (!sourceSquare || !targetSquare) return false

      const turn = fenTurn(chessRef.current.fen())
      if (myColor && turn !== myColor) return false

      const move = { from: sourceSquare, to: targetSquare, promotion: 'q' }

      if (isMP) {
        // Validate locally first to avoid socket round-trips on bad moves
        const trial = new Chess(chessRef.current.fen())
        const accepted = trial.move(move)
        if (!accepted) return false
        // Don't mutate local chessRef yet — wait for move_accepted broadcast
        // so both clients converge on the server-validated FEN.
        socket.emit('chess_move', { roomCode, move })
        return true
      }

      // Computer mode: apply locally, AI responds via useEffect
      const m = chessRef.current.move(move)
      if (!m) return false
      setFen(chessRef.current.fen())
      setHistory(chessRef.current.history({ verbose: true }))
      if (chessRef.current.isCheckmate()) {
        setResult({
          winner: m.color,
          reason: 'CHECKMATE',
        })
      } else if (chessRef.current.inCheck()) {
        toast.show({ message: 'CHECK!', duration: 1500 })
      }
      return true
    },
    [aiThinking, isMP, myColor, result, roomCode, toast],
  )

  const handleResign = useCallback(() => {
    if (!isMP) {
      setResult({ winner: myColor === 'w' ? 'b' : 'w', reason: 'YOU RESIGNED' })
      return
    }
    if (!window.confirm('Resign this game?')) return
    const opponent = room?.players?.find(
      (p) =>
        (p.userId ?? p.user_id ?? p.id) !== user?.id &&
        (p.username ?? p.name)?.toLowerCase() !==
          displayName?.toLowerCase(),
    )
    socket.emit('game_over', {
      roomCode,
      winnerId: opponent?.userId ?? opponent?.user_id ?? opponent?.id,
      loserId: user?.id,
      score: 0,
    })
  }, [displayName, isMP, myColor, room, roomCode, user?.id])

  const turn = fenTurn(fen)
  const myTurn = !result && (myColor ? turn === myColor : true)
  const captured = useMemo(() => capturedFromHistory(history), [history])
  const sanHistory = useMemo(() => pgnSan(history), [history])

  const opponent =
    isMP && room?.players
      ? room.players.find(
          (p) =>
            (p.userId ?? p.user_id ?? p.id) !== user?.id &&
            (p.username ?? p.name)?.toLowerCase() !==
              displayName?.toLowerCase(),
        )
      : null

  const opponentLabel = isMP
    ? opponent?.username ?? 'Opponent'
    : `STOCKFISH · ${difficulty.toUpperCase()}`

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

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_18rem]">
      <div ref={containerRef} className="relative mx-auto w-full max-w-[480px]">
        <CapturedRow pieces={captured[myColor === 'w' ? 'b' : 'w']} accent="green" label="CAPTURED" />
        <div className="my-2 overflow-hidden rounded-lg border-2 border-neon-cyan/50 bg-arcadia-surface p-1 shadow-neon-cyan">
          <Chessboard
            options={{
              position: fen,
              boardOrientation: myColor === 'b' ? 'black' : 'white',
              onPieceDrop,
              allowDragging: myTurn,
              boardStyle: {
                borderRadius: 4,
                width: boardSize,
                height: boardSize,
              },
              darkSquareStyle: { backgroundColor: '#5e6b86' },
              lightSquareStyle: { backgroundColor: '#d8d8e8' },
            }}
          />
        </div>
        <CapturedRow pieces={captured[myColor === 'w' ? 'w' : 'b']} accent="pink" label="LOST" />

        {result && (
          <div className="lb-slide-in mt-4 rounded-xl border-2 border-neon-green/60 bg-arcadia-surface/85 px-5 py-4 text-center shadow-neon-green backdrop-blur">
            <p className="font-arcade text-base text-neon-green drop-shadow-[0_0_10px_rgba(0,255,136,0.6)]">
              ★{' '}
              {result.winner === 'draw'
                ? 'DRAW'
                : result.winner === myColor
                  ? 'YOU WIN!'
                  : 'YOU LOST'}{' '}
              ★
            </p>
            <p className="mt-1 text-xs text-white/60">{result.reason}</p>
            <div className="mt-4 flex justify-center gap-2">
              <Link
                to="/"
                className="rounded-md border border-neon-cyan/60 bg-neon-cyan/10 px-4 py-2 font-arcade text-[10px] text-neon-cyan hover:bg-neon-cyan/20 hover:shadow-neon-cyan"
              >
                BACK TO LOBBY
              </Link>
            </div>
          </div>
        )}
      </div>

      <aside className="flex flex-col gap-3">
        {!isMP && engineState === 'loading' && (
          <div className="flex items-center gap-2 rounded-lg border border-neon-cyan/40 bg-neon-cyan/10 px-3 py-2 text-[10px] text-neon-cyan">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-neon-cyan shadow-neon-cyan" />
            <span className="font-arcade">LOADING ENGINE…</span>
          </div>
        )}
        {!isMP && engineState === 'fallback' && (
          <div className="rounded-lg border border-neon-pink/40 bg-neon-pink/10 px-3 py-2 text-[10px]">
            <p className="font-arcade text-neon-pink">AI: BASIC MODE</p>
            <p className="mt-1 text-[9px] text-white/55">
              Stockfish failed to load. Falling back to random legal moves.
            </p>
          </div>
        )}
        <PlayerStrip
          name={opponentLabel}
          subtitle={isMP ? 'OPPONENT' : 'COMPUTER'}
          color={myColor === 'w' ? 'b' : 'w'}
          active={turn === (myColor === 'w' ? 'b' : 'w') && !result}
          thinking={!isMP && aiThinking}
        />
        <PlayerStrip
          name={displayName ?? 'You'}
          subtitle="YOU"
          color={myColor ?? 'w'}
          active={myTurn && !result}
        />

        <div className="rounded-lg border border-white/10 bg-arcadia-surface/60 p-3">
          <p className="font-arcade text-[9px] text-white/45">MOVES</p>
          <div className="mt-2 max-h-44 overflow-y-auto font-mono text-xs leading-relaxed text-white/75">
            {sanHistory.length === 0 ? (
              <p className="text-white/30">No moves yet.</p>
            ) : (
              <ol className="grid grid-cols-[auto_1fr_1fr] gap-x-2">
                {Array.from({ length: Math.ceil(sanHistory.length / 2) }).map(
                  (_, i) => (
                    <li
                      key={i}
                      className="contents"
                    >
                      <span className="font-arcade text-[8px] text-white/35">
                        {i + 1}.
                      </span>
                      <span>{sanHistory[i * 2]}</span>
                      <span>{sanHistory[i * 2 + 1] ?? ''}</span>
                    </li>
                  ),
                )}
              </ol>
            )}
          </div>
        </div>

        {!result && (
          <button
            type="button"
            onClick={handleResign}
            className="rounded-md border border-neon-pink/60 px-3 py-2 font-arcade text-[10px] text-neon-pink hover:bg-neon-pink/10 hover:shadow-neon-pink"
          >
            🏳 RESIGN
          </button>
        )}
      </aside>
    </div>
  )
}

function PlayerStrip({ name, subtitle, color, active, thinking }) {
  return (
    <div
      className={`flex items-center gap-3 rounded-lg border bg-arcadia-surface/70 px-3 py-2 ${
        active ? 'border-neon-green/60 shadow-neon-green' : 'border-white/10'
      }`}
    >
      <Avatar name={name} size="md" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-arcade text-[10px] text-white">{name}</p>
        <p className="font-arcade text-[8px] text-white/40">
          {subtitle} · {color === 'w' ? 'WHITE' : 'BLACK'}
        </p>
      </div>
      {active && !thinking && (
        <span className="font-arcade text-[9px] text-neon-green">TURN</span>
      )}
      {thinking && (
        <span className="font-arcade text-[9px] text-neon-cyan">…</span>
      )}
    </div>
  )
}

function CapturedRow({ pieces, accent, label }) {
  if (!pieces || pieces.length === 0) {
    return (
      <p className="font-arcade text-[8px] text-white/30">{label}: —</p>
    )
  }
  const total = pieces.reduce((s, p) => s + (PIECE_VALUE[p] ?? 0), 0)
  const tone = accent === 'green' ? 'text-neon-green' : 'text-neon-pink'
  return (
    <p className="font-arcade text-[9px] text-white/60">
      <span className={`${tone} mr-2`}>{label}</span>
      {pieces
        .map((p) => PIECE_ICON[p] ?? '?')
        .join(' ')}{' '}
      <span className="text-white/40">+{total}</span>
    </p>
  )
}

const PIECE_ICON = {
  p: '♟',
  n: '♞',
  b: '♝',
  r: '♜',
  q: '♛',
  k: '♚',
}
