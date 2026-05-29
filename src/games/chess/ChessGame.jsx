import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Chess } from 'chess.js'
import { Chessboard } from 'react-chessboard'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { getRoom } from '../../lib/api'
import { socket } from '../../lib/socket'
import Avatar from '../../components/Avatar'
import { HallOfFameButton, WinParticles } from '../../components/GameOverFX'
import {
  LobbyBackLink,
  useArmGameOverFlash,
} from '../../context/GameOverFlashContext'
import { useOpponentDisconnect } from '../../hooks/useOpponentDisconnect'
import { useViewport } from '../../hooks/useViewport'
import { useFullscreen } from '../../hooks/useFullscreen'
import { useGameLeaveGuard } from '../../context/LeaveGuardContext'
import {
  DIFFICULTY_SETTINGS,
  DIFFICULTY_THINK_DELAY,
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
  // Mirror room / myColor / user.id so the MP socket handlers can read
  // the latest values without re-registering. Without this, the handler
  // useEffect would tear down and re-attach listeners every time room
  // changed — and any match_result that fired during the gap would be
  // silently dropped.
  const roomRef = useRef(room)
  const myColorRef = useRef(myColor)
  const userIdRef = useRef(null)
  roomRef.current = room
  myColorRef.current = myColor
  userIdRef.current = user?.id ?? null
  const [result, setResult] = useState(null) // {winner: 'w'|'b'|'draw', reason}
  useArmGameOverFlash(!!result)
  const [error, setError] = useState(null)
  // boardSize now derived from viewport; containerRef no longer needed
  // for measurement but kept for any future use.
  const containerRef = useRef(null)
  const aiThinkingRef = useRef(false)
  const [aiThinking, setAiThinking] = useState(false)
  const [engineState, setEngineStateLocal] = useState('idle')
  const [reconnecting, setReconnecting] = useState(false)
  const [resignConfirm, setResignConfirm] = useState(false)
  const [selectedSquare, setSelectedSquare] = useState(null)
  const [legalMoves, setLegalMoves] = useState([]) // verbose moves
  const [pendingPromotion, setPendingPromotion] = useState(null) // {from,to}
  const [undosLeft, setUndosLeft] = useState(5)
  const [clockFlash, setClockFlash] = useState(null) // {color, text, key}
  const [lastMove, setLastMove] = useState(null) // {from, to}

  // Derive last move + check king square from chess.js whenever the
  // position changes. Covers SP moves, bot moves, and MP move_accepted
  // alike without having to plumb the highlight through every code path.
  useEffect(() => {
    const verbose = chessRef.current.history({ verbose: true })
    const last = verbose[verbose.length - 1]
    setLastMove(last ? { from: last.from, to: last.to } : null)
  }, [fen])

  const checkSquare = useMemo(() => {
    const c = chessRef.current
    if (!c || !c.inCheck()) return null
    const turn = c.turn()
    const board = c.board()
    for (let r = 0; r < 8; r++) {
      for (let cIdx = 0; cIdx < 8; cIdx++) {
        const sq = board[r][cIdx]
        if (sq && sq.type === 'k' && sq.color === turn) {
          return `${String.fromCharCode(97 + cIdx)}${8 - r}`
        }
      }
    }
    return null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fen])
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
  const wasDcRef = useRef(false)
  useEffect(() => {
    if (!isMP) return
    if (opponentDc.disconnected && !wasDcRef.current) {
      wasDcRef.current = true
      toast.warning(
        `${opponentDc.username ?? 'Opponent'} disconnected. Waiting for reconnect…`,
      )
    } else if (!opponentDc.disconnected && wasDcRef.current) {
      wasDcRef.current = false
      toast.success('Opponent reconnected.')
    }
  }, [isMP, opponentDc.disconnected, opponentDc.username, toast])

  // Viewport-aware board size. Desktop reserves room for the right-
  // side info panel (clocks + captures + move list); mobile reserves
  // a vertical strip for the same controls stacked below the board.
  const { width: vw, height: vh } = useViewport()
  const { isFullscreen } = useFullscreen()
  const isDesktop = vw >= 1024
  const sidebarWidth = isDesktop ? 304 : 0
  const headerH = isFullscreen ? 56 : 72
  // Mobile strip = top clock + bottom clock + captured rows + move
  // list panel + buttons. Desktop sidebar covers all of that.
  const controlsH = isDesktop
    ? 24
    : isFullscreen
      ? 200
      : 280
  const pad = isFullscreen ? 8 : 16
  const availW = Math.max(0, vw - sidebarWidth - pad * 2)
  const availH = Math.max(0, vh - headerH - controlsH - pad * 2)
  const boardSize = Math.max(
    260,
    Math.min(availW, availH, isFullscreen ? 720 : 560),
  )

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
      // Clocks restart fresh on resume — per spec we don't restore them.
      setClockBase({
        w: DEFAULT_CLOCK_MS,
        b: DEFAULT_CLOCK_MS,
        activeColor: fenTurn(c.fen()),
        baseTime: Date.now(),
      })
      setLiveClocks({ w: DEFAULT_CLOCK_MS, b: DEFAULT_CLOCK_MS })
      setFlagged(null)
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
    setClockBase({
      w: DEFAULT_CLOCK_MS,
      b: DEFAULT_CLOCK_MS,
      activeColor: 'w',
      baseTime: Date.now(),
    })
    setLiveClocks({ w: DEFAULT_CLOCK_MS, b: DEFAULT_CLOCK_MS })
    setFlagged(null)
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
        toast.warning('CHECK!', { duration: 1500 })
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
      const players = roomRef.current?.players ?? []
      const myId = userIdRef.current
      const myCol = myColorRef.current
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
          : winnerId === myId
            ? myCol
            : myCol === 'w'
              ? 'b'
              : 'w'
      if (reason === 'draw') winnerColor = 'draw'
      const youResigned =
        reason === 'resign' &&
        winnerId !== myId &&
        myCol &&
        myCol !== winnerColor
      const opponentResigned =
        reason === 'resign' && winnerId === myId
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

    const onMatchResult = (data) => {
      console.log('[match_result] RECEIVED:', data)
      console.log('[match_result] winnerId:', data?.winnerId)
      console.log('[match_result] myId:', userIdRef.current)
      finalizeResult(data)
    }
    const onGameOver = (data) => {
      console.log('[game_over] RECEIVED:', data)
      finalizeResult(data)
    }

    const onOpponentLeft = () => {
      toast.warning('Opponent left the game.')
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMP])

  // ===== Local clock countdown =====
  // Runs in BOTH multiplayer and vs computer mode. In MP the
  // clockBase comes from the server (move_accepted carries clocks).
  // In SP we drive clockBase locally — see the next effect that
  // flips activeColor whenever the FEN turn changes.
  useEffect(() => {
    if (result || flagged) return
    // SP-only: don't tick until the player has actually made a move.
    // Before the first move the clock just shows 10:00 statically.
    if (!isMP && history.length === 0) return
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
      if (isMP && now - lastDebugLog >= 5000) {
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
        if (!isMP) {
          setResult({
            winner: 'b',
            reason:
              myColor === 'w' ? 'YOU TIMED OUT' : 'BOT TIMED OUT',
          })
        }
      }
      if (bRem === 0 && clockBase.activeColor === 'b') {
        setFlagged('b')
        clearInterval(id)
        if (!isMP) {
          setResult({
            winner: 'w',
            reason:
              myColor === 'b' ? 'YOU TIMED OUT' : 'BOT TIMED OUT',
          })
        }
      }
    }, 100)
    return () => clearInterval(id)
  }, [isMP, clockBase, result, flagged, myColor, history.length])

  // ===== SP clock driver =====
  // In vs-computer mode there is no server, so we have to commit the
  // moving side's remaining time and flip activeColor whenever the
  // FEN's turn marker changes (i.e. after every accepted move,
  // player or AI). This effect is the SP equivalent of MP's
  // move_accepted clock update.
  useEffect(() => {
    if (isMP) return
    if (result || flagged) return
    const turnNow = fenTurn(fen)
    if (turnNow === clockBase.activeColor) return
    setClockBase({
      w: liveClocks.w,
      b: liveClocks.b,
      activeColor: turnNow,
      baseTime: Date.now(),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fen, isMP, result, flagged])

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
    const cfg = DIFFICULTY_SETTINGS[difficulty] ?? DIFFICULTY_SETTINGS.easy
    const startedAt = Date.now()
    const [delayBase, delayJitter] =
      DIFFICULTY_THINK_DELAY[difficulty] ?? [600, 600]
    const targetDelay = delayBase + Math.random() * delayJitter
    getBestMove(chessRef.current.fen(), cfg)
      .then((uci) => {
        // Pad the engine response with a randomised "think" delay so the
        // bot never snap-moves. The engine often returns in <50ms at low
        // depths, which feels uncanny without this hold.
        const elapsed = Date.now() - startedAt
        const wait = Math.max(0, targetDelay - elapsed)
        return new Promise((resolve) =>
          window.setTimeout(() => resolve(uci), wait),
        )
      })
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
            toast.warning('CHECK!', { duration: 1500 })
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
        toast.warning('CHECK!', { duration: 1500 })
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
  // Compensates the player with +15s on their clock so undo can't be
  // weaponised to stall for time.
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

    const me = myColor ?? 'w'
    setClockBase((prev) => ({
      ...prev,
      [me]: prev[me] + 15_000,
      baseTime: Date.now(),
    }))
    setLiveClocks((prev) => ({
      ...prev,
      [me]: prev[me] + 15_000,
    }))
    setClockFlash({ color: me, text: '+15s', key: Date.now() })
  }, [isMP, result, undosLeft, myColor])

  // Auto-dismiss the clock flash after 1s.
  useEffect(() => {
    if (!clockFlash) return
    const id = window.setTimeout(() => setClockFlash(null), 1000)
    return () => window.clearTimeout(id)
  }, [clockFlash])

  // Clicking RESIGN just opens the modal — actual emit is in onResignConfirm
  const handleResign = useCallback(() => {
    console.log('[resign] button clicked')
    console.log('[resign] socket connected:', socket.connected)
    console.log('[resign] roomCode:', roomCode)
    setResignConfirm(true)
  }, [roomCode])

  const onResignConfirm = useCallback(() => {
    setResignConfirm(false)
    if (!isMP) {
      console.log('[resign] single-player resign')
      setResult({
        winner: myColor === 'w' ? 'b' : 'w',
        reason: 'YOU RESIGNED',
      })
      return
    }
    const opponent = room?.players?.find(
      (p) =>
        (p.userId ?? p.user_id ?? p.id) !== user?.id &&
        (p.username ?? p.name)?.toLowerCase() !==
          displayName?.toLowerCase(),
    )
    const opponentId =
      opponent?.userId ?? opponent?.user_id ?? opponent?.id
    console.log('[chess MP] opponent:', opponentId, 'from players:', room?.players)
    if (!socket.connected) {
      console.warn('[resign] emit aborted — socket disconnected')
      toast.error('Connection lost — try again.')
      return
    }
    if (!opponentId) {
      console.error(
        '[resign] no opponentId resolved — winnerId would be undefined; players:',
        room?.players,
      )
      toast.error('Cannot resign — opponent not found.')
      return
    }
    const payload = {
      roomCode,
      winnerId: opponentId,
      loserId: user?.id,
      score: 0,
      reason: 'resign',
    }
    console.log('[resign] emitting game_over:', payload)
    socket.emit('game_over', payload)
    console.log('[resign] game_over emitted')
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
    // Layer order matters: lastMove → check king → selection → legal
    // moves. Each later layer overwrites the previous on the same
    // square so the most relevant cue wins.
    if (lastMove) {
      styles[lastMove.from] = { backgroundColor: 'rgba(0, 212, 255, 0.2)' }
      styles[lastMove.to] = { backgroundColor: 'rgba(0, 212, 255, 0.3)' }
    }
    if (checkSquare) {
      styles[checkSquare] = {
        animation: 'chess-check-pulse 800ms ease-in-out infinite',
      }
    }
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
  }, [selectedSquare, legalMoves, lastMove, checkSquare])

  // Clear highlights whenever the board changes (e.g. opponent moves)
  useEffect(() => {
    setSelectedSquare(null)
    setLegalMoves([])
  }, [fen])

  // ===== Leave guard =====
  // Chess uses the same useGameLeaveGuard hook as every other game.
  // 'multi' shows the forfeit copy and emits game_over on confirm.
  // 'single' (computer mode) shows the "progress will be lost" copy.
  const opponentForGuard =
    room?.players?.find(
      (p) =>
        (p.userId ?? p.user_id ?? p.id) !== user?.id &&
        (p.username ?? p.name)?.toLowerCase() !==
          displayName?.toLowerCase(),
    ) ?? null
  const leaveModal = useGameLeaveGuard({
    active: isMP ? !result : !result && history.length > 0,
    kind: isMP ? 'multi' : 'single',
    onForfeit: () => {
      if (!isMP || !socket.connected || !roomCode) return
      const oppId =
        opponentForGuard?.userId ??
        opponentForGuard?.user_id ??
        opponentForGuard?.id ??
        null
      socket.emit('game_over', {
        roomCode,
        winnerId: oppId,
        loserId: user?.id,
        score: 0,
        reason: 'resign',
      })
    },
  })

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
    : `BOT (${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)})`
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
    <div className="flex h-full flex-col gap-3 lg:grid lg:grid-cols-[auto_18rem] lg:gap-5">
      <div
        ref={containerRef}
        className="relative mx-auto flex shrink-0 flex-col"
        style={{ width: boardSize }}
      >
        <PlayerHeader
          name={opponentLabel}
          subtitle={isMP ? 'OPPONENT' : 'BOT'}
          color={opponentColor}
          ms={liveClocks[opponentColor]}
          active={turn === opponentColor && !result && !flagged}
          flash={clockFlash?.color === opponentColor ? clockFlash : null}
          materialDelta={Math.max(
            0,
            materialScore(captured[myColor ?? 'w']) -
              materialScore(captured[opponentColor]),
          )}
          alignment="top"
        />
        <CapturedRow
          pieces={captured[myColor === 'w' ? 'b' : 'w']}
          opponentPieces={captured[myColor === 'w' ? 'w' : 'b']}
          accent="green"
          label="CAPTURED"
        />
        <GameStatusRow
          myTurn={myTurn}
          isMP={isMP}
          aiThinking={aiThinking}
          inCheck={!!checkSquare}
          result={result}
          moveNumber={Math.floor(history.length / 2) + 1}
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
              animationDuration: 150,
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
        <PlayerHeader
          name={displayName ?? 'You'}
          subtitle="YOU"
          color={myColor ?? 'w'}
          ms={liveClocks[myColor ?? 'w']}
          active={turn === (myColor ?? 'w') && !result && !flagged}
          flash={clockFlash?.color === (myColor ?? 'w') ? clockFlash : null}
          materialDelta={Math.max(
            0,
            materialScore(captured[opponentColor]) -
              materialScore(captured[myColor ?? 'w']),
          )}
          alignment="bottom"
        />
        {!isMP && history.length === 0 && !result && (
          <p className="mt-1 text-center font-arcade text-[9px] text-white/45">
            MAKE YOUR FIRST MOVE TO START THE CLOCK
          </p>
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

        {result && (
          <ResultPanel
            result={result}
            myColor={myColor}
            signedIn={!!user}
            isBot={!isMP}
          />
        )}
      </div>

      <aside className="flex shrink-0 flex-col gap-2 lg:gap-3">
        {!isMP && engineState === 'loading' && (
          <div className="flex items-center gap-2 rounded-lg border border-neon-cyan/40 bg-neon-cyan/10 px-3 py-2 text-[10px] text-neon-cyan">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-neon-cyan shadow-neon-cyan" />
            <span className="font-arcade">LOADING ENGINE…</span>
          </div>
        )}
        {!isMP && engineState === 'fallback' && (
          <div className="rounded-lg border border-neon-pink/40 bg-neon-pink/10 px-3 py-2 text-[10px]">
            <p className="font-arcade text-neon-pink">BOT: BASIC MODE</p>
            <p className="mt-1 text-[9px] text-white/55">
              Engine failed to load. Falling back to random legal moves.
            </p>
          </div>
        )}
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
            className="mt-1 self-center font-arcade text-[10px] text-neon-pink/55 transition hover:text-neon-pink hover:drop-shadow-[0_0_6px_rgba(255,0,110,0.7)]"
          >
            ⚑ Resign
          </button>
        )}
      </aside>

      {leaveModal}
      {resignConfirm && (
        <ResignModal
          onCancel={() => setResignConfirm(false)}
          onConfirm={onResignConfirm}
        />
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

function ClockRow({ name, ms, active, colorClass = '', flash }) {
  const low = ms < 60_000 && ms > 0
  const dead = ms <= 0
  const cornerCls = active
    ? low
      ? 'pixel-corners pixel-corners-pink'
      : 'pixel-corners'
    : 'pixel-corners pixel-corners-cyan'
  const stateCls = active
    ? low
      ? 'text-neon-pink shadow-neon-pink chess-clock-low'
      : 'text-neon-green shadow-neon-green'
    : 'text-white/45'
  return (
    <div
      className={`glass-panel ${cornerCls} relative my-1 flex items-center justify-between px-3 py-1.5 font-mono ${colorClass} ${stateCls}`}
    >
      {flash && (
        <span
          key={flash.key}
          className="badge-flip pointer-events-none absolute -top-3 right-2 rounded-md border border-neon-green/60 bg-neon-green/15 px-1.5 py-0.5 font-arcade text-[9px] text-neon-green shadow-neon-green"
        >
          {flash.text}
        </span>
      )}
      <span className="truncate font-arcade text-[9px] text-white/55">
        {name}
      </span>
      <span className="neon-text font-arcade text-base tracking-wider">
        {dead ? '00:00' : fmtClock(ms)}
      </span>
    </div>
  )
}

const TOTAL_CLOCK_MS = 600_000

function PlayerHeader({
  name,
  subtitle,
  color,
  ms,
  active,
  flash,
  materialDelta,
  alignment,
}) {
  const ratio = Math.max(0, Math.min(1, ms / TOTAL_CLOCK_MS))
  const low = ms < 30_000 && ms > 0
  const warn = !low && ms < 120_000 && ms > 0
  const barColor = low ? '#ff006e' : warn ? '#ffd700' : '#00ff88'
  const dead = ms <= 0

  const nameRow = (
    <div className="flex items-center gap-2 px-3 py-1.5">
      <Avatar name={name} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-arcade text-[10px] text-white">
          {name}
          {materialDelta > 0 && (
            <span className="ml-1.5 font-arcade text-[9px] text-neon-green">
              +{materialDelta}
            </span>
          )}
        </p>
        <p className="font-arcade text-[8px] text-white/40">{subtitle}</p>
      </div>
      <span className="font-arcade text-[10px] text-white/55">
        {color === 'w' ? '♙ w' : '♟ b'}
      </span>
    </div>
  )

  const clockBar = (
    <div className="relative flex items-center gap-3 px-3 py-1.5">
      <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-200"
          style={{
            width: `${ratio * 100}%`,
            background: barColor,
            boxShadow: active ? `0 0 8px ${barColor}` : 'none',
          }}
        />
      </div>
      <span
        className={`font-arcade text-[11px] tabular-nums ${
          low
            ? 'chess-clock-low text-neon-pink'
            : active
              ? 'text-neon-green'
              : 'text-white/60'
        }`}
      >
        {dead ? '00:00' : fmtClock(ms)}
      </span>
      {flash && (
        <span
          key={flash.key}
          className="badge-flip absolute -top-2 right-2 rounded-md border border-neon-green/60 bg-neon-green/15 px-1.5 py-0.5 font-arcade text-[9px] text-neon-green shadow-neon-green"
        >
          {flash.text}
        </span>
      )}
    </div>
  )

  return (
    <div
      className={`glass-panel my-1 overflow-hidden ${
        active ? 'pixel-corners' : 'pixel-corners pixel-corners-cyan'
      }`}
    >
      {alignment === 'top' ? (
        <>
          {nameRow}
          {clockBar}
        </>
      ) : (
        <>
          {clockBar}
          {nameRow}
        </>
      )}
    </div>
  )
}

function GameStatusRow({
  myTurn,
  isMP,
  aiThinking,
  inCheck,
  result,
  moveNumber,
}) {
  let label = null
  let cls = 'text-neon-green'
  let dots = false
  if (result) {
    if (result.winner === 'draw') {
      label = 'DRAW'
      cls = 'text-neon-cyan'
    } else {
      label = result.reason || 'GAME OVER'
      cls = 'text-neon-pink'
    }
  } else if (inCheck) {
    label = 'CHECK!'
    cls = 'text-neon-pink chess-clock-low'
  } else if (myTurn) {
    label = 'YOUR TURN'
  } else if (!isMP && aiThinking) {
    label = 'BOT THINKING'
    cls = 'text-white/65'
    dots = true
  } else {
    label = 'OPPONENT MOVES'
    cls = 'text-white/55'
  }
  return (
    <div className="my-1 flex items-center justify-between px-2 py-1 font-arcade text-[10px]">
      <span className={`flex items-center gap-2 ${cls}`}>
        {label}
        {dots && (
          <span
            className="bot-dot-stack inline-flex items-center gap-1"
            aria-hidden="true"
          >
            <span className="bot-dot inline-block h-1 w-1 rounded-full bg-current" />
            <span className="bot-dot inline-block h-1 w-1 rounded-full bg-current" />
            <span className="bot-dot inline-block h-1 w-1 rounded-full bg-current" />
          </span>
        )}
      </span>
      <span className="font-arcade text-[9px] tracking-wide text-white/40">
        MOVE {moveNumber}
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
        className="mt-2 max-h-[100px] overflow-y-auto font-mono text-xs leading-relaxed text-white/75 lg:max-h-44"
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

function ResultPanel({ result, myColor, signedIn, isBot = false }) {
  const isDraw = result.winner === 'draw'
  const won = !isDraw && result.winner === myColor
  const title = isDraw
    ? 'DRAW'
    : isBot
      ? won
        ? 'YOU BEAT THE BOT!'
        : 'BOT WINS'
      : won
        ? 'YOU WIN!'
        : 'YOU LOST'
  const accent = won
    ? 'shadow-neon-green text-neon-green'
    : isDraw
      ? 'shadow-neon-cyan text-neon-cyan'
      : 'shadow-neon-pink text-neon-pink'
  const cornerCls = isDraw
    ? 'pixel-corners-cyan'
    : won
      ? ''
      : 'pixel-corners-pink'
  const borderColor = won
    ? 'rgba(0,255,136,0.5)'
    : isDraw
      ? 'rgba(0,212,255,0.5)'
      : 'rgba(255,0,110,0.5)'

  return (
    <div
      className={`go-overlay-in glass-panel pixel-corners ${cornerCls} relative mt-4 overflow-visible px-5 py-4 text-center ${accent}`}
      style={{ borderColor, borderWidth: 2 }}
    >
      {won && <WinParticles />}
      <p
        className={`relative font-arcade text-base drop-shadow-[0_0_10px_currentColor] ${
          !won && !isDraw ? 'go-shake' : ''
        }`}
      >
        <span className="go-icon-pop">★</span> {title}{' '}
        <span className="go-icon-pop">★</span>
      </p>
      <p className="relative mt-1 text-xs text-white/60">{result.reason}</p>
      <div className="relative mt-4 flex flex-col justify-center gap-2 sm:flex-row">
        <HallOfFameButton signedIn={signedIn} />
        <LobbyBackLink className="rounded-md border border-neon-cyan/60 bg-neon-cyan/10 px-4 py-2 text-center font-arcade text-[10px] text-neon-cyan hover:bg-neon-cyan/20 hover:shadow-neon-cyan">
          BACK TO LOBBY
        </LobbyBackLink>
      </div>
    </div>
  )
}

function ResignModal({ onCancel, onConfirm }) {
  return (
    <div
      className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-sm rounded-xl border-2 border-neon-pink/60 bg-arcadia-surface p-6 shadow-neon-pink">
        <h3 className="font-arcade text-sm text-neon-pink">
          ♟ RESIGN GAME?
        </h3>
        <p className="mt-3 text-xs text-white/65">
          Your opponent will be declared winner.
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-neon-green/70 bg-neon-green/10 px-4 py-2 font-arcade text-[10px] text-neon-green hover:bg-neon-green/20 hover:shadow-neon-green"
          >
            KEEP PLAYING
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-md border border-neon-pink/70 bg-neon-pink/10 px-4 py-2 font-arcade text-[10px] text-neon-pink hover:bg-neon-pink/20 hover:shadow-neon-pink"
          >
            🏳 RESIGN
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
