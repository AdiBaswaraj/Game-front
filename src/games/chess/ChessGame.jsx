import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Chess } from 'chess.js'
import { Chessboard } from 'react-chessboard'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { getRoom } from '../../lib/api'
import { socket } from '../../lib/socket'
import Avatar from '../../components/Avatar'
import { useOpponentDisconnect } from '../../hooks/useOpponentDisconnect'
import { useLeaveGuard } from '../../hooks/useLeaveGuard'
import { useRegisterLeaveGuard } from '../../context/LeaveGuardContext'
import {
  DIFFICULTY_DEPTH,
  getBestMove,
  preloadEngine,
  subscribeEngineState,
} from './engine'

const PIECE_VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 }
const PIECE_ICON = { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚' }
const DEFAULT_CLOCK_MS = 10 * 60 * 1000
const SP_SAVE_KEY = 'arcadia:chess:sp'
const SP_MAX_AGE_MS = 24 * 60 * 60 * 1000

function readSPSave() {
  try {
    const raw = localStorage.getItem(SP_SAVE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (!data || typeof data.savedAt !== 'number') return null
    if (Date.now() - data.savedAt > SP_MAX_AGE_MS) return null
    return data
  } catch {
    return null
  }
}

function clearSPSave() {
  try {
    localStorage.removeItem(SP_SAVE_KEY)
  } catch {}
}

function formatElapsed(ms) {
  const sec = Math.max(0, Math.floor(ms / 1000))
  if (sec < 60) return `${sec} second${sec === 1 ? '' : 's'} ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} minute${min === 1 ? '' : 's'} ago`
  const hr = Math.floor(min / 60)
  return `${hr} hour${hr === 1 ? '' : 's'} ago`
}

function pick(o, ...keys) {
  for (const k of keys) if (o && o[k] != null) return o[k]
  return undefined
}

function fenTurn(fen) {
  if (!fen) return 'w'
  return fen.split(' ')[1] === 'b' ? 'b' : 'w'
}

function fmtClock(ms) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function readClocks(source) {
  console.log('[clock] readClocks input:', source)
  if (!source || typeof source !== 'object') {
    console.log('[clock] readClocks output: null (no input)')
    return null
  }
  // Accept many shapes the backend may have used over its lifetime.
  const w = pick(
    source,
    'white',
    'w',
    'whiteMs',
    'white_ms',
    'whiteTime',
    'white_time',
    'whiteClock',
    'white_clock',
    'whiteRemaining',
    'white_remaining',
  )
  const b = pick(
    source,
    'black',
    'b',
    'blackMs',
    'black_ms',
    'blackTime',
    'black_time',
    'blackClock',
    'black_clock',
    'blackRemaining',
    'black_remaining',
  )
  if (typeof w !== 'number' || typeof b !== 'number') {
    console.log(
      '[clock] readClocks FAILED — keys:',
      Object.keys(source || {}),
    )
    return null
  }
  const parsed = { w, b }
  console.log('[clock] readClocks output:', parsed)
  return parsed
}

function capturedFromMoves(history) {
  const captured = { w: [], b: [] }
  for (const m of history) {
    if (m.captured) {
      const capturedColor = m.color === 'w' ? 'b' : 'w'
      captured[capturedColor].push(m.captured)
    }
  }
  return captured
}

function materialScore(pieces) {
  return (pieces ?? []).reduce((s, p) => s + (PIECE_VALUE[p] ?? 0), 0)
}

export default function ChessGame({ mode, roomCode, difficulty = 'easy' }) {
  const { user, displayName } = useAuth()
  const toast = useToast()
  const chessRef = useRef(new Chess())
  const [fen, setFen] = useState(() => chessRef.current.fen())
  const [history, setHistory] = useState([]) // {san, color, captured}[]
  const [room, setRoom] = useState(null)
  const [myColor, setMyColor] = useState(mode === 'computer' ? 'w' : null)
  const [result, setResult] = useState(null) // {winner: 'w'|'b'|'draw', reason}
  const [error, setError] = useState(null)
  const [boardSize, setBoardSize] = useState(420)
  const containerRef = useRef(null)
  const aiThinkingRef = useRef(false)
  const [aiThinking, setAiThinking] = useState(false)
  const [engineState, setEngineStateLocal] = useState('idle')
  const [reconnecting, setReconnecting] = useState(false)
  const [pendingLeave, setPendingLeave] = useState(null)
  const [selectedSquare, setSelectedSquare] = useState(null)
  const [legalMoves, setLegalMoves] = useState([]) // verbose moves
  const [pendingPromotion, setPendingPromotion] = useState(null) // {from,to}
  const [undosLeft, setUndosLeft] = useState(5)
  const [resumeOffer, setResumeOffer] = useState(null) // saved snapshot offered for resume
  const spLoadHandledRef = useRef(false)

  // Authoritative clock baseline from the server. We compute the live
  // display by subtracting elapsed wall-time since the baseline for the
  // active color.
  const [clockBase, setClockBase] = useState(() => ({
    w: DEFAULT_CLOCK_MS,
    b: DEFAULT_CLOCK_MS,
    activeColor: 'w',
    baseTime: Date.now(),
  }))
  const [liveClocks, setLiveClocks] = useState({
    w: DEFAULT_CLOCK_MS,
    b: DEFAULT_CLOCK_MS,
  })
  const [flagged, setFlagged] = useState(null) // 'w' | 'b' | null

  const isMP = mode === 'multiplayer'
  const moveListRef = useRef(null)

  const opponentDc = useOpponentDisconnect(isMP ? roomCode : null)

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

  // ===== Computer mode: subscribe to Stockfish state =====
  useEffect(() => {
    if (isMP) return
    preloadEngine()
    const unsubscribe = subscribeEngineState(setEngineStateLocal)
    return unsubscribe
  }, [isMP])

  // ===== Computer mode: offer resume if a recent save exists =====
  useEffect(() => {
    if (isMP) return
    if (spLoadHandledRef.current) return
    spLoadHandledRef.current = true
    const saved = readSPSave()
    if (!saved) return
    // Different difficulty than the URL → don't prompt, treat as fresh.
    if (saved.difficulty && saved.difficulty !== difficulty) {
      clearSPSave()
      return
    }
    setResumeOffer(saved)
  }, [isMP, difficulty])

  // ===== Computer mode: persist board state on every change =====
  useEffect(() => {
    if (isMP) return
    if (resumeOffer) return // wait for user choice before saving
    if (result) {
      clearSPSave()
      return
    }
    // Skip the initial empty position — no point saving "1. " with no moves.
    if (history.length === 0) return
    try {
      const captured = capturedFromMoves(history)
      localStorage.setItem(
        SP_SAVE_KEY,
        JSON.stringify({
          fen: chessRef.current.fen(),
          pgn: chessRef.current.pgn(),
          playerColor: myColor,
          difficulty,
          capturedByWhite: captured.w,
          capturedByBlack: captured.b,
          undosLeft,
          savedAt: Date.now(),
        }),
      )
    } catch {
      // private mode / quota — drop silently
    }
  }, [
    isMP,
    result,
    resumeOffer,
    fen,
    history,
    myColor,
    difficulty,
    undosLeft,
  ])

  const handleResumeSPGame = useCallback(() => {
    const saved = resumeOffer
    if (!saved) return
    try {
      const c = new Chess()
      c.loadPgn(saved.pgn)
      chessRef.current = c
      setFen(c.fen())
      const moves = c.history({ verbose: true })
      setHistory(
        moves.map((m) => ({
          san: m.san,
          color: m.color,
          captured: m.captured,
        })),
      )
      if (saved.playerColor === 'w' || saved.playerColor === 'b') {
        setMyColor(saved.playerColor)
      }
      if (typeof saved.undosLeft === 'number') {
        setUndosLeft(saved.undosLeft)
      }
      setSelectedSquare(null)
      setLegalMoves([])
      setPendingPromotion(null)
    } catch (err) {
      console.error('[chess SP] resume failed', err)
      clearSPSave()
    } finally {
      setResumeOffer(null)
    }
  }, [resumeOffer])

  const handleStartFreshSPGame = useCallback(() => {
    clearSPSave()
    chessRef.current = new Chess()
    setFen(chessRef.current.fen())
    setHistory([])
    setUndosLeft(5)
    setSelectedSquare(null)
    setLegalMoves([])
    setPendingPromotion(null)
    setResult(null)
    setResumeOffer(null)
  }, [])

  // Clear save on game over (chess SP only — MP uses socket reconnect)
  useEffect(() => {
    if (isMP) return
    if (result) clearSPSave()
  }, [isMP, result])

  // ===== Multiplayer: initial REST fetch + reconnect_to_room =====
  useEffect(() => {
    if (!isMP) return
    let cancelled = false
    setReconnecting(true)
    getRoom(roomCode)
      .then((data) => {
        if (cancelled) return
        const players = data?.players ?? []
        setRoom({ ...data, players })

        // Note: players[0] = white, players[1] = black (backend contract)
        const idx = players.findIndex(
          (p) =>
            (user?.id && (p.userId ?? p.user_id ?? p.id) === user.id) ||
            (p.username ?? p.name)?.toLowerCase() ===
              displayName?.toLowerCase(),
        )
        const myDerivedColor = idx === 0 ? 'w' : idx === 1 ? 'b' : null
        console.log('[chess MP] mount state:', {
          roomCode,
          myUserId: user?.id,
          players: players.map((p) => ({
            id: p.userId ?? p.user_id ?? p.id,
            username: p.username ?? p.name,
          })),
          myIndex: idx,
          myColor: myDerivedColor,
          gameState: data?.gameState ?? data?.game_state ?? null,
        })
        console.log('[clock] initial raw:', data?.clock)
        console.log(
          '[clock] initial raw gameState:',
          (data?.gameState ?? data?.game_state)?.clock,
        )
        setMyColor(myDerivedColor)

        const gs = data?.gameState ?? data?.game_state
        const startingFen = pick(gs, 'fen', 'position')
        if (startingFen) {
          try {
            const c = new Chess(startingFen)
            chessRef.current = c
            setFen(c.fen())
            // Rebuild history from pgn if backend supplies it
            const pgn = pick(gs, 'pgn')
            if (pgn) {
              try {
                const tmp = new Chess()
                tmp.loadPgn(pgn)
                const moves = tmp.history({ verbose: true })
                setHistory(
                  moves.map((m) => ({
                    san: m.san,
                    color: m.color,
                    captured: m.captured,
                  })),
                )
              } catch {}
            }
          } catch {}
        }
        const rawClock = pick(gs, 'clocks', 'clock')
        const clocks = readClocks(rawClock)
        console.log('[clock] initial', {
          raw: rawClock,
          parsed: clocks,
          fen: startingFen,
        })
        if (clocks) {
          const activeColor = fenTurn(startingFen ?? chessRef.current.fen())
          setClockBase({
            w: clocks.w,
            b: clocks.b,
            activeColor,
            baseTime: Date.now(),
          })
          setLiveClocks({ w: clocks.w, b: clocks.b })
          console.log('[clock] activeColor', activeColor)
        }

        // Tell the backend we are (re)entering the room so it pushes
        // state_sync if there's mid-game state we don't have.
        if (socket.connected && user?.id) {
          socket.emit('reconnect_to_room', {
            roomCode,
            username: displayName,
          })
        }
        setReconnecting(false)
      })
      .catch(() => {
        if (!cancelled) {
          setError('Could not load room.')
          setReconnecting(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [isMP, roomCode, user?.id, displayName])

  // ===== Multiplayer: socket events =====
  useEffect(() => {
    if (!isMP) return

    const ingestMove = (data) => {
      const moveData = pick(data, 'move')
      const nextFen = pick(data, 'fen')
      const isCheckmate = pick(
        data,
        'isCheckmate',
        'is_checkmate',
        'checkmate',
      )
      const isCheck = pick(data, 'isCheck', 'is_check', 'check')
      const rawClock = pick(data, 'clocks', 'clock')
      const clocks = readClocks(rawClock)
      console.log('[clock] move_accepted', { raw: rawClock, parsed: clocks })

      // Apply locally to keep our chess instance in sync and grab san
      let moved = null
      if (moveData && chessRef.current) {
        try {
          moved = chessRef.current.move(moveData)
        } catch {}
      }

      if (moved) {
        setHistory((prev) => [
          ...prev,
          {
            san: moved.san,
            color: moved.color,
            captured: moved.captured,
          },
        ])
      }

      if (nextFen) {
        try {
          const c = new Chess(nextFen)
          if (chessRef.current.fen() !== c.fen()) {
            // Diverged — adopt server state. History may be slightly off
            // until the next state_sync but board stays correct.
            chessRef.current = c
          }
          setFen(c.fen())
        } catch {}
      } else if (moved) {
        setFen(chessRef.current.fen())
      }

      if (clocks) {
        setClockBase({
          w: clocks.w,
          b: clocks.b,
          activeColor: fenTurn(nextFen ?? chessRef.current.fen()),
          baseTime: Date.now(),
        })
        setLiveClocks({ w: clocks.w, b: clocks.b })
        setFlagged(null)
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

    const onMoveAccepted = (data) => ingestMove(data)

    const onError = (data) => {
      toast.show({
        message: pick(data, 'message') ?? 'Invalid move.',
        duration: 2000,
      })
    }

    const finalizeResult = (data) => {
      const winnerId = pick(data, 'winnerId', 'winner_id', 'winner')
      const reason = pick(data, 'reason') ?? 'GAME OVER'
      const players = room?.players ?? []
      const winnerIdx = players.findIndex(
        (p) =>
          (p.userId ?? p.user_id ?? p.id) === winnerId ||
          p.username === winnerId,
      )
      let winnerColor =
        winnerIdx >= 0
          ? winnerIdx === 0
            ? 'w'
            : 'b'
          : winnerId === user?.id
            ? myColor
            : myColor === 'w'
              ? 'b'
              : 'w'
      if (reason === 'draw') winnerColor = 'draw'
      const youResigned =
        reason === 'resign' &&
        winnerId !== user?.id &&
        myColor &&
        myColor !== winnerColor
      const opponentResigned =
        reason === 'resign' && winnerId === user?.id
      let displayReason = reason
      if (reason === 'resign') {
        displayReason = youResigned ? 'YOU RESIGNED' : 'OPPONENT RESIGNED'
      } else if (reason === 'disconnect_timeout') {
        displayReason = 'OPPONENT FAILED TO RECONNECT'
      } else if (reason === 'timeout') {
        displayReason = 'TIME OUT'
      } else if (reason === 'checkmate') {
        displayReason = 'CHECKMATE'
      } else {
        displayReason = String(reason).toUpperCase().replace(/_/g, ' ')
      }
      setResult({ winner: winnerColor, reason: displayReason })
    }

    const onMatchResult = (data) => finalizeResult(data)
    const onGameOver = (data) => finalizeResult(data)

    const onOpponentLeft = () => {
      toast.show({ message: 'Opponent left the game.', duration: 4000 })
    }

    const onStateSync = (data) => {
      // Mid-game reconnect: rehydrate board, clocks, and (if available)
      // move history from a PGN string.
      const stateFen = pick(data, 'fen', 'position')
      if (stateFen) {
        try {
          const c = new Chess(stateFen)
          chessRef.current = c
          setFen(c.fen())
        } catch {}
      }
      const pgn = pick(data, 'pgn')
      if (pgn) {
        try {
          const tmp = new Chess()
          tmp.loadPgn(pgn)
          const moves = tmp.history({ verbose: true })
          setHistory(
            moves.map((m) => ({
              san: m.san,
              color: m.color,
              captured: m.captured,
            })),
          )
        } catch {}
      }
      const rawClock = pick(data, 'clocks', 'clock')
      const clocks = readClocks(rawClock)
      console.log('[clock] state_sync', { raw: rawClock, parsed: clocks })
      if (clocks) {
        setClockBase({
          w: clocks.w,
          b: clocks.b,
          activeColor: fenTurn(stateFen ?? chessRef.current.fen()),
          baseTime: Date.now(),
        })
        setLiveClocks({ w: clocks.w, b: clocks.b })
        setFlagged(null)
      }
      setReconnecting(false)
    }

    socket.on('move_accepted', onMoveAccepted)
    socket.on('error', onError)
    socket.on('match_result', onMatchResult)
    socket.on('game_over', onGameOver)
    socket.on('opponent_left', onOpponentLeft)
    socket.on('state_sync', onStateSync)
    return () => {
      socket.off('move_accepted', onMoveAccepted)
      socket.off('error', onError)
      socket.off('match_result', onMatchResult)
      socket.off('game_over', onGameOver)
      socket.off('opponent_left', onOpponentLeft)
      socket.off('state_sync', onStateSync)
    }
  }, [isMP, room, user?.id, myColor, toast])

  // ===== Local clock countdown (MP only, runs whether or not opponent
  //       has disconnected — per Note 1) =====
  useEffect(() => {
    if (!isMP || result || flagged) return
    let lastDebugLog = 0
    const id = setInterval(() => {
      const now = Date.now()
      const elapsed = now - clockBase.baseTime
      const wRem = clockBase.activeColor === 'w'
        ? Math.max(0, clockBase.w - elapsed)
        : clockBase.w
      const bRem = clockBase.activeColor === 'b'
        ? Math.max(0, clockBase.b - elapsed)
        : clockBase.b
      setLiveClocks({ w: wRem, b: bRem })
      if (now - lastDebugLog >= 5000) {
        lastDebugLog = now
        console.log('[clock] tick:', {
          white: wRem,
          black: bRem,
          activeColor: clockBase.activeColor,
          isMyTurn:
            !!myColor && fenTurn(chessRef.current.fen()) === myColor,
          myColor,
        })
      }
      if (wRem === 0 && clockBase.activeColor === 'w') {
        setFlagged('w')
        clearInterval(id)
      }
      if (bRem === 0 && clockBase.activeColor === 'b') {
        setFlagged('b')
        clearInterval(id)
      }
    }, 100)
    return () => clearInterval(id)
  }, [isMP, clockBase, result, flagged, myColor])

  // ===== Computer mode AI loop =====
  useEffect(() => {
    if (isMP) return
    if (result) return
    if (chessRef.current.isGameOver()) {
      finalizeLocalResult()
      return
    }
    const turn = fenTurn(chessRef.current.fen())
    if (turn === myColor) return
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
        const moved = chessRef.current.move({
          from,
          to,
          promotion: promotion ?? 'q',
        })
        if (moved) {
          setFen(chessRef.current.fen())
          setHistory((prev) => [
            ...prev,
            {
              san: moved.san,
              color: moved.color,
              captured: moved.captured,
            },
          ])
          if (
            chessRef.current.inCheck() &&
            !chessRef.current.isCheckmate()
          ) {
            toast.show({ message: 'CHECK!', duration: 1500 })
          }
          if (chessRef.current.isGameOver()) finalizeLocalResult()
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

  // Returns true if move was accepted (locally or sent to server).
  const trySubmit = useCallback(
    (from, to, promotion = 'q') => {
      if (result || aiThinking) return false
      if (isMP && opponentDc.disconnected) return false
      const turn = fenTurn(chessRef.current.fen())
      if (myColor && turn !== myColor) return false

      const move = { from, to, promotion }
      if (isMP) {
        const trial = new Chess(chessRef.current.fen())
        const accepted = trial.move(move)
        if (!accepted) return false
        socket.emit('chess_move', { roomCode, move })
        return true
      }
      const m = chessRef.current.move(move)
      if (!m) return false
      setFen(chessRef.current.fen())
      setHistory((prev) => [
        ...prev,
        { san: m.san, color: m.color, captured: m.captured },
      ])
      if (chessRef.current.isCheckmate()) {
        setResult({ winner: m.color, reason: 'CHECKMATE' })
      } else if (chessRef.current.inCheck()) {
        toast.show({ message: 'CHECK!', duration: 1500 })
      }
      return true
    },
    [
      aiThinking,
      isMP,
      myColor,
      opponentDc.disconnected,
      result,
      roomCode,
      toast,
    ],
  )

  // Drag-and-drop and click-to-move both route through trySubmit. They
  // share the same promotion-detection logic: if any legal move from
  // `from` → `to` requires a promotion, pop the picker; otherwise
  // submit directly.
  const attemptMove = useCallback(
    (from, to) => {
      if (!from || !to) return false
      const legal = chessRef.current
        .moves({ square: from, verbose: true })
        .filter((m) => m.to === to)
      if (legal.length === 0) return false
      const needsPromotion = legal.some(
        (m) => m.flags && m.flags.includes('p'),
      )
      if (needsPromotion) {
        setPendingPromotion({ from, to })
        return true
      }
      const ok = trySubmit(from, to, 'q')
      if (ok) {
        setSelectedSquare(null)
        setLegalMoves([])
      }
      return ok
    },
    [trySubmit],
  )

  const onPieceDrop = useCallback(
    ({ sourceSquare, targetSquare }) => {
      if (!targetSquare) {
        setSelectedSquare(null)
        setLegalMoves([])
        return false
      }
      return attemptMove(sourceSquare, targetSquare)
    },
    [attemptMove],
  )

  const onSquareClick = useCallback(
    ({ piece, square }) => {
      if (result || aiThinking) return
      if (isMP && opponentDc.disconnected) return
      const turn = fenTurn(chessRef.current.fen())
      const myTurnNow = myColor ? turn === myColor : true

      // Tap a destination square that was highlighted as legal
      if (selectedSquare && legalMoves.some((m) => m.to === square)) {
        attemptMove(selectedSquare, square)
        return
      }

      // Tap one of my own pieces — start (or switch) selection
      const pieceData = chessRef.current.get(square)
      if (myTurnNow && pieceData && pieceData.color === (myColor ?? turn)) {
        setSelectedSquare(square)
        try {
          const moves = chessRef.current.moves({ square, verbose: true })
          setLegalMoves(moves)
        } catch {
          setLegalMoves([])
        }
        return
      }

      // Anything else — deselect
      setSelectedSquare(null)
      setLegalMoves([])
    },
    [
      aiThinking,
      attemptMove,
      isMP,
      legalMoves,
      myColor,
      opponentDc.disconnected,
      result,
      selectedSquare,
    ],
  )

  const handlePromotionPick = useCallback(
    (piece) => {
      if (!pendingPromotion) return
      const { from, to } = pendingPromotion
      setPendingPromotion(null)
      const ok = trySubmit(from, to, piece)
      if (ok) {
        setSelectedSquare(null)
        setLegalMoves([])
      }
    },
    [pendingPromotion, trySubmit],
  )

  // Single-player undo: undo last two plies (player + computer reply).
  const handleUndo = useCallback(() => {
    if (isMP) return
    if (result) return
    if (undosLeft <= 0) return
    const c = chessRef.current
    if (c.history().length < 2) return
    c.undo()
    c.undo()
    setFen(c.fen())
    setHistory((prev) => prev.slice(0, -2))
    setSelectedSquare(null)
    setLegalMoves([])
    setUndosLeft((n) => n - 1)
  }, [isMP, result, undosLeft])

  const handleResign = useCallback(() => {
    console.log('[chess] resign clicked', {
      isMP,
      socketConnected: socket.connected,
      roomCode,
      userId: user?.id,
    })
    if (!isMP) {
      if (!window.confirm('Are you sure you want to resign?')) return
      setResult({
        winner: myColor === 'w' ? 'b' : 'w',
        reason: 'YOU RESIGNED',
      })
      return
    }
    if (!window.confirm('Are you sure you want to resign?')) return
    const opponent = room?.players?.find(
      (p) =>
        (p.userId ?? p.user_id ?? p.id) !== user?.id &&
        (p.username ?? p.name)?.toLowerCase() !==
          displayName?.toLowerCase(),
    )
    if (!socket.connected) {
      console.warn('[chess] resign emit failed — socket disconnected')
      toast.show({ message: 'Connection lost — try again.', duration: 3000 })
      return
    }
    socket.emit('game_over', {
      roomCode,
      winnerId: opponent?.userId ?? opponent?.user_id ?? opponent?.id,
      loserId: user?.id,
      score: 0,
      reason: 'resign',
    })
  }, [displayName, isMP, myColor, room, roomCode, toast, user?.id])

  const handleSync = useCallback(() => {
    if (!isMP) return
    if (reconnecting) return
    setReconnecting(true)
    if (socket.connected && user?.id) {
      socket.emit('reconnect_to_room', { roomCode, username: displayName })
    }
    setTimeout(() => setReconnecting(false), 5000)
  }, [displayName, isMP, reconnecting, roomCode, user?.id])

  // ===== Click-to-move highlight styles =====
  const squareStyles = useMemo(() => {
    const styles = {}
    if (selectedSquare) {
      styles[selectedSquare] = {
        background: 'rgba(0, 212, 255, 0.28)',
      }
    }
    for (const m of legalMoves) {
      if (m.captured) {
        styles[m.to] = {
          boxShadow: 'inset 0 0 0 4px rgba(255, 0, 110, 0.55)',
        }
      } else {
        styles[m.to] = {
          background:
            'radial-gradient(circle, rgba(0,255,136,0.45) 22%, transparent 24%)',
        }
      }
    }
    return styles
  }, [selectedSquare, legalMoves])

  // Clear highlights whenever the board changes (e.g. opponent moves)
  useEffect(() => {
    setSelectedSquare(null)
    setLegalMoves([])
  }, [fen])

  // ===== Leave guard =====
  const gameActive = isMP && !result
  useLeaveGuard(gameActive)

  useRegisterLeaveGuard(gameActive, ({ commit, cancel }) => {
    setPendingLeave({ commit, cancel })
  })

  const handleStay = () => {
    pendingLeave?.cancel?.()
    setPendingLeave(null)
  }
  const handleForfeit = () => {
    if (isMP && socket.connected && roomCode) {
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
        reason: 'resign',
      })
    }
    const commit = pendingLeave?.commit
    setPendingLeave(null)
    commit?.()
  }

  const turn = fenTurn(fen)
  const myTurn =
    !result &&
    !flagged &&
    (!isMP || !opponentDc.disconnected) &&
    (myColor ? turn === myColor : true)
  const captured = useMemo(() => capturedFromMoves(history), [history])
  const sanHistory = useMemo(() => history.map((m) => m.san), [history])

  // Auto-scroll move list to bottom on each new move
  useEffect(() => {
    if (moveListRef.current) {
      moveListRef.current.scrollTop = moveListRef.current.scrollHeight
    }
  }, [history.length])

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
  const opponentColor = myColor === 'w' ? 'b' : 'w'

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
        {isMP && (
          <ClockRow
            name={opponentLabel}
            ms={liveClocks[opponentColor]}
            active={turn === opponentColor && !result && !flagged}
            colorClass="bg-arcadia-surface"
          />
        )}
        <CapturedRow
          pieces={captured[myColor === 'w' ? 'b' : 'w']}
          opponentPieces={captured[myColor === 'w' ? 'w' : 'b']}
          accent="green"
          label="CAPTURED"
        />
        <div className="my-2 overflow-hidden rounded-lg border-2 border-neon-cyan/50 bg-arcadia-surface p-1 shadow-neon-cyan">
          <Chessboard
            options={{
              position: fen,
              boardOrientation: myColor === 'b' ? 'black' : 'white',
              onPieceDrop,
              onSquareClick,
              squareStyles,
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
        <CapturedRow
          pieces={captured[myColor === 'w' ? 'w' : 'b']}
          opponentPieces={captured[myColor === 'w' ? 'b' : 'w']}
          accent="pink"
          label="LOST"
        />
        {isMP && (
          <ClockRow
            name={displayName ?? 'You'}
            ms={liveClocks[myColor ?? 'w']}
            active={turn === (myColor ?? 'w') && !result && !flagged}
            colorClass="bg-arcadia-surface"
          />
        )}

        {isMP && opponentDc.disconnected && !result && (
          <DisconnectBanner
            username={opponentDc.username}
            secondsRemaining={opponentDc.secondsRemaining}
          />
        )}

        {isMP && reconnecting && !result && (
          <div className="lb-slide-in mt-3 rounded-md border border-neon-cyan/60 bg-arcadia-surface/85 px-4 py-3 text-center font-arcade text-[10px] text-neon-cyan">
            RECONNECTING…
          </div>
        )}

        {flagged && !result && (
          <div className="lb-slide-in mt-3 rounded-md border-2 border-neon-pink/70 bg-arcadia-surface/85 px-4 py-3 text-center font-arcade text-[11px] text-neon-pink shadow-neon-pink">
            ⚑ {flagged === myColor ? 'YOU' : 'OPPONENT'} FLAGGED · WAITING
            FOR SERVER…
          </div>
        )}

        {result && <ResultPanel result={result} myColor={myColor} />}
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
          color={opponentColor}
          active={turn === opponentColor && !result}
          thinking={!isMP && aiThinking}
        />
        <PlayerStrip
          name={displayName ?? 'You'}
          subtitle="YOU"
          color={myColor ?? 'w'}
          active={myTurn && !result}
        />

        <MoveList history={sanHistory} scrollRef={moveListRef} />

        {!isMP && !result && (
          <button
            type="button"
            onClick={handleUndo}
            disabled={undosLeft <= 0 || history.length < 2}
            className="rounded-md border border-neon-cyan/50 px-3 py-2 font-arcade text-[10px] text-neon-cyan hover:bg-neon-cyan/10 hover:shadow-neon-cyan disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:shadow-none"
          >
            ↩ UNDO ({undosLeft} left)
          </button>
        )}

        {isMP && !result && (
          <button
            type="button"
            onClick={handleSync}
            disabled={reconnecting}
            className="rounded-md border border-white/15 px-3 py-2 font-arcade text-[9px] text-white/55 hover:border-neon-cyan/60 hover:text-neon-cyan disabled:opacity-50"
          >
            {reconnecting ? 'SYNCING…' : '↻ SYNC'}
          </button>
        )}

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

      {pendingLeave && (
        <LeaveConfirm onStay={handleStay} onForfeit={handleForfeit} />
      )}

      {pendingPromotion && (
        <PromotionPicker
          color={myColor ?? 'w'}
          onPick={handlePromotionPick}
          onCancel={() => setPendingPromotion(null)}
        />
      )}

      {resumeOffer && (
        <ResumeModal
          savedAt={resumeOffer.savedAt}
          difficulty={resumeOffer.difficulty}
          onResume={handleResumeSPGame}
          onNewGame={handleStartFreshSPGame}
        />
      )}
    </div>
  )
}

function ResumeModal({ savedAt, difficulty, onResume, onNewGame }) {
  const elapsed = formatElapsed(Date.now() - (savedAt ?? Date.now()))
  return (
    <div
      className="fixed inset-0 z-[1300] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Resume previous chess game"
    >
      <div className="w-full max-w-sm rounded-xl border border-neon-cyan/60 bg-arcadia-surface p-6 text-center shadow-neon-cyan">
        <h3 className="font-arcade text-sm text-neon-cyan drop-shadow-[0_0_8px_rgba(0,212,255,0.5)]">
          ★ CONTINUE PREVIOUS GAME?
        </h3>
        <p className="mt-3 text-xs text-white/65">
          You have an in-progress chess game.
        </p>
        <p className="mt-1 font-arcade text-[10px] text-white/40">
          Started {elapsed}
          {difficulty ? ` · ${difficulty.toUpperCase()}` : ''}
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={onResume}
            className="rounded-md border border-neon-green/70 bg-neon-green/10 px-4 py-2 font-arcade text-[10px] text-neon-green hover:bg-neon-green/20 hover:shadow-neon-green"
          >
            ▶ RESUME
          </button>
          <button
            type="button"
            onClick={onNewGame}
            className="rounded-md border border-neon-pink/70 bg-neon-pink/10 px-4 py-2 font-arcade text-[10px] text-neon-pink hover:bg-neon-pink/20 hover:shadow-neon-pink"
          >
            ✕ NEW GAME
          </button>
        </div>
      </div>
    </div>
  )
}

function ClockRow({ name, ms, active, colorClass = '' }) {
  const low = ms < 60_000 && ms > 0
  const dead = ms <= 0
  const cls = active
    ? low
      ? 'text-neon-pink border-neon-pink/70 shadow-neon-pink chess-clock-low'
      : 'text-neon-green border-neon-green/70 shadow-neon-green'
    : 'text-white/45 border-white/15'
  return (
    <div
      className={`my-1 flex items-center justify-between rounded-md border px-3 py-1.5 font-mono ${colorClass} ${cls}`}
    >
      <span className="truncate font-arcade text-[9px] text-white/55">
        {name}
      </span>
      <span className="font-arcade text-base tracking-wider">
        {dead ? '00:00' : fmtClock(ms)}
      </span>
    </div>
  )
}

function CapturedRow({ pieces, opponentPieces, accent, label }) {
  const myScore = materialScore(pieces)
  const theirScore = materialScore(opponentPieces)
  const advantage = myScore - theirScore
  if (!pieces || pieces.length === 0) {
    return (
      <p className="font-arcade text-[8px] text-white/30">
        {label}: —{' '}
        {advantage > 0 && (
          <span className="text-neon-green">+{advantage}</span>
        )}
      </p>
    )
  }
  const tone = accent === 'green' ? 'text-neon-green' : 'text-neon-pink'
  return (
    <p className="font-arcade text-[9px] text-white/60">
      <span className={`${tone} mr-2`}>{label}</span>
      {pieces.map((p) => PIECE_ICON[p] ?? '?').join(' ')}{' '}
      {advantage > 0 && (
        <span className="ml-2 text-neon-green">+{advantage}</span>
      )}
    </p>
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

function MoveList({ history, scrollRef }) {
  return (
    <div className="rounded-lg border border-white/10 bg-arcadia-surface/60 p-3">
      <p className="font-arcade text-[9px] text-white/45">MOVES</p>
      <div
        ref={scrollRef}
        className="mt-2 max-h-44 overflow-y-auto font-mono text-xs leading-relaxed text-white/75"
      >
        {history.length === 0 ? (
          <p className="text-white/30">No moves yet.</p>
        ) : (
          <ol className="grid grid-cols-[auto_1fr_1fr] gap-x-2">
            {Array.from({ length: Math.ceil(history.length / 2) }).map(
              (_, i) => {
                const w = history[i * 2]
                const b = history[i * 2 + 1]
                const isLastW = i * 2 === history.length - 1
                const isLastB = i * 2 + 1 === history.length - 1
                return (
                  <li key={i} className="contents">
                    <span className="font-arcade text-[8px] text-white/35">
                      {i + 1}.
                    </span>
                    <span
                      className={
                        isLastW
                          ? 'rounded bg-neon-cyan/15 px-1 text-neon-cyan'
                          : ''
                      }
                    >
                      {w}
                    </span>
                    <span
                      className={
                        isLastB
                          ? 'rounded bg-neon-cyan/15 px-1 text-neon-cyan'
                          : ''
                      }
                    >
                      {b ?? ''}
                    </span>
                  </li>
                )
              },
            )}
          </ol>
        )}
      </div>
    </div>
  )
}

function DisconnectBanner({ username, secondsRemaining }) {
  return (
    <div
      role="alert"
      className="lb-slide-in mt-3 flex items-center justify-between gap-3 rounded-md border-2 border-neon-pink/60 bg-arcadia-surface/95 px-4 py-3 shadow-neon-pink"
    >
      <div className="min-w-0">
        <p className="font-arcade text-[10px] text-neon-pink">
          {username ?? 'OPPONENT'} DISCONNECTED
        </p>
        <p className="mt-1 text-[10px] text-white/60">
          Waiting for reconnect — board paused
        </p>
      </div>
      <span className="font-arcade text-lg text-neon-pink">
        {secondsRemaining}s
      </span>
    </div>
  )
}

function ResultPanel({ result, myColor }) {
  const isDraw = result.winner === 'draw'
  const won = !isDraw && result.winner === myColor
  const title = isDraw ? 'DRAW' : won ? 'YOU WIN!' : 'YOU LOST'
  const accent = won
    ? 'border-neon-green/60 shadow-neon-green text-neon-green'
    : isDraw
      ? 'border-neon-cyan/60 shadow-neon-cyan text-neon-cyan'
      : 'border-neon-pink/60 shadow-neon-pink text-neon-pink'

  return (
    <div
      className={`lb-slide-in mt-4 rounded-xl border-2 bg-arcadia-surface/85 px-5 py-4 text-center backdrop-blur ${accent}`}
    >
      <p className="font-arcade text-base drop-shadow-[0_0_10px_currentColor]">
        ★ {title} ★
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
  )
}

function LeaveConfirm({ onStay, onForfeit }) {
  return (
    <div
      className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-sm rounded-xl border border-neon-pink/60 bg-arcadia-surface p-6 shadow-neon-pink">
        <h3 className="font-arcade text-sm text-neon-pink">
          ⚠ LEAVE ACTIVE GAME?
        </h3>
        <p className="mt-3 text-xs text-white/65">
          You're in the middle of a game. Leaving will forfeit and your
          opponent wins.
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onStay}
            className="rounded-md border border-neon-green/70 bg-neon-green/10 px-4 py-2 font-arcade text-[10px] text-neon-green hover:bg-neon-green/20 hover:shadow-neon-green"
          >
            STAY
          </button>
          <button
            type="button"
            onClick={onForfeit}
            className="rounded-md border border-neon-pink/70 bg-neon-pink/10 px-4 py-2 font-arcade text-[10px] text-neon-pink hover:bg-neon-pink/20 hover:shadow-neon-pink"
          >
            🏳 FORFEIT
          </button>
        </div>
      </div>
    </div>
  )
}

const PROMOTION_OPTIONS = [
  { piece: 'q', label: 'QUEEN', whiteIcon: '♕', blackIcon: '♛' },
  { piece: 'r', label: 'ROOK', whiteIcon: '♖', blackIcon: '♜' },
  { piece: 'b', label: 'BISHOP', whiteIcon: '♗', blackIcon: '♝' },
  { piece: 'n', label: 'KNIGHT', whiteIcon: '♘', blackIcon: '♞' },
]

function PromotionPicker({ color, onPick, onCancel }) {
  return (
    <div
      className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Pick promotion piece"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-xl border border-neon-cyan/60 bg-arcadia-surface p-5 shadow-neon-cyan"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-arcade text-sm text-neon-cyan">
          ★ PROMOTE TO
        </h3>
        <p className="mt-2 text-[10px] text-white/45">
          Pick a piece for your pawn.
        </p>
        <div className="mt-4 grid grid-cols-4 gap-2">
          {PROMOTION_OPTIONS.map((opt) => (
            <button
              key={opt.piece}
              type="button"
              onClick={() => onPick(opt.piece)}
              className="flex flex-col items-center gap-1 rounded-md border-2 border-neon-cyan/50 bg-arcadia-bg/60 p-3 transition hover:border-neon-cyan hover:shadow-neon-cyan"
            >
              <span className="text-3xl">
                {color === 'w' ? opt.whiteIcon : opt.blackIcon}
              </span>
              <span className="font-arcade text-[8px] text-white/65">
                {opt.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
