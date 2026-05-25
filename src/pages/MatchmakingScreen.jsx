import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { socket } from '../lib/socket'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

const BASE = import.meta.env.VITE_BACKEND_URL || ''
const TIMEOUT_S = 30

const GAME_LABELS = {
  chess: { name: 'CHESS', icon: '♟️' },
  'snake-and-ladder': { name: 'SNAKE & LADDER', icon: '🎲' },
  'word-puzzle': { name: 'WORD PUZZLE', icon: '🔤' },
}

function pick(o, ...keys) {
  for (const k of keys) if (o && o[k] != null) return o[k]
  return undefined
}

export default function MatchmakingScreen() {
  const { gameId } = useParams()
  const { user, displayName, loading: authLoading, openLogin } = useAuth()
  const navigate = useNavigate()
  useDocumentTitle(`${(GAME_LABELS[gameId]?.name ?? 'GAME')} — Matchmaking`)

  const [phase, setPhase] = useState('searching') // searching | matched | timeout
  const [queueSize, setQueueSize] = useState(0)
  const [remaining, setRemaining] = useState(TIMEOUT_S)
  const [opponent, setOpponent] = useState(null)
  const cleanupSentRef = useRef(false)
  const matchedRef = useRef(false)

  const sendLeaveQueue = useCallback(() => {
    if (cleanupSentRef.current) return
    cleanupSentRef.current = true
    if (user?.id) {
      socket.emit('leave_queue', { gameId, userId: user.id })
    }
  }, [gameId, user?.id])

  const sendJoinQueue = useCallback(() => {
    if (!user) return
    cleanupSentRef.current = false
    matchedRef.current = false
    setRemaining(TIMEOUT_S)
    setOpponent(null)
    setPhase('searching')
    if (!socket.connected) socket.connect()
    socket.emit('join_queue', {
      gameId,
      userId: user.id,
      username: displayName,
    })
  }, [displayName, gameId, user])

  // Join queue on mount, leave queue on unmount
  useEffect(() => {
    if (authLoading || !user) return
    sendJoinQueue()
    return () => {
      if (!matchedRef.current) sendLeaveQueue()
    }
    // sendJoinQueue / sendLeaveQueue are stable for the current user
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id, gameId])

  // Listen for queue events
  useEffect(() => {
    if (!user) return

    const onWaiting = () => {
      // Already showing the searching state; nothing to do.
    }
    const onMatched = (data) => {
      console.log('[clock] raw data received:', JSON.stringify(data))
      console.log('[clock] data.clock:', data?.clock)
      console.log('[clock] data.room?.gameState?.clock:', data?.room?.gameState?.clock)
      console.log('[clock] data.gameState?.clock:', data?.gameState?.clock)
      const roomCode = pick(data, 'roomCode', 'room_code', 'code')
      const opponentUsername = pick(
        data,
        'opponentUsername',
        'opponent_username',
        'opponent',
      )
      if (!roomCode) return
      matchedRef.current = true
      cleanupSentRef.current = true // backend already pulled us out of the queue
      setOpponent(opponentUsername ?? 'OPPONENT')
      setPhase('matched')
      // Briefly show "OPPONENT FOUND!" before navigating
      setTimeout(() => {
        navigate(`/game/${gameId}?room=${roomCode}`, { replace: true })
      }, 1500)
    }
    socket.on('queue_waiting', onWaiting)
    socket.on('queue_matched', onMatched)
    return () => {
      socket.off('queue_waiting', onWaiting)
      socket.off('queue_matched', onMatched)
    }
  }, [gameId, navigate, user])

  // Poll queue size every 5s
  useEffect(() => {
    if (phase !== 'searching') return
    let cancelled = false
    const fetchSize = async () => {
      try {
        const res = await fetch(`${BASE}/api/queue/${gameId}`)
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled) setQueueSize(data?.waiting ?? 0)
      } catch {
        // network — fine, just keep showing old number
      }
    }
    fetchSize()
    const id = setInterval(fetchSize, 5000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [phase, gameId])

  // Countdown
  useEffect(() => {
    if (phase !== 'searching') return
    const id = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(id)
          sendLeaveQueue()
          setPhase('timeout')
          return 0
        }
        return r - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [phase, sendLeaveQueue])

  const handleCancel = () => {
    sendLeaveQueue()
    navigate(`/game/${gameId}/mode`)
  }

  const handleTryAgain = () => {
    sendJoinQueue()
  }

  const handlePrivateRoom = () => {
    sendLeaveQueue()
    navigate(`/game/${gameId}/room`)
  }

  const label = GAME_LABELS[gameId] ?? { name: gameId?.toUpperCase(), icon: '🎮' }

  if (!authLoading && !user) {
    return (
      <Shell title={label.name} icon={label.icon} backTo={`/game/${gameId}/mode`}>
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="font-arcade text-sm text-neon-pink">
            Login required for matchmaking.
          </p>
          <button
            type="button"
            onClick={openLogin}
            className="rounded-md border border-neon-cyan/60 bg-neon-cyan/10 px-4 py-2 font-arcade text-[10px] text-neon-cyan hover:bg-neon-cyan/20 hover:shadow-neon-cyan"
          >
            LOGIN
          </button>
        </div>
      </Shell>
    )
  }

  return (
    <Shell title={label.name} icon={label.icon} backTo={`/game/${gameId}/mode`} backLabel="MODE">
      <main className="mx-auto flex max-w-2xl flex-col items-center px-4 py-10 md:py-16">
        {phase === 'searching' && (
          <SearchingView
            you={displayName}
            queueSize={queueSize}
            remaining={remaining}
            onCancel={handleCancel}
          />
        )}
        {phase === 'matched' && <MatchedView you={displayName} opponent={opponent} />}
        {phase === 'timeout' && (
          <TimeoutView
            onRetry={handleTryAgain}
            onPrivateRoom={handlePrivateRoom}
          />
        )}
      </main>
    </Shell>
  )
}

function SearchingView({ you, queueSize, remaining, onCancel }) {
  return (
    <>
      <p className="font-arcade text-[11px] text-neon-cyan drop-shadow-[0_0_8px_rgba(0,212,255,0.45)]">
        SEARCHING FOR OPPONENT…
      </p>

      <Radar>
        <div className="text-center">
          <p className="font-arcade text-[9px] text-white/45">YOU</p>
          <p className="mt-1 max-w-[10rem] truncate font-arcade text-[12px] text-neon-green">
            {you ?? 'Player'}
          </p>
        </div>
      </Radar>

      <div className="mt-2 flex items-center gap-3 rounded-md border border-neon-cyan/30 bg-neon-cyan/5 px-3 py-1.5">
        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-neon-cyan shadow-neon-cyan" />
        <span className="font-arcade text-[10px] text-neon-cyan">
          {queueSize} {queueSize === 1 ? 'PLAYER' : 'PLAYERS'} IN QUEUE
        </span>
      </div>

      <p className="mt-4 font-arcade text-[10px] text-white/40">
        {remaining}s REMAINING
      </p>

      <button
        type="button"
        onClick={onCancel}
        className="mt-10 rounded-md border border-neon-pink/60 px-5 py-2 font-arcade text-[10px] text-neon-pink hover:bg-neon-pink/10 hover:shadow-neon-pink"
      >
        ✕ CANCEL
      </button>
    </>
  )
}

function MatchedView({ you, opponent }) {
  return (
    <div className="flex flex-col items-center gap-6">
      <p className="font-arcade text-2xl text-neon-green drop-shadow-[0_0_16px_rgba(0,255,136,0.55)] md:text-3xl">
        ★ OPPONENT FOUND ★
      </p>
      <div className="flex items-center gap-6 text-center">
        <div>
          <p className="font-arcade text-[9px] text-white/45">YOU</p>
          <p className="mt-1 max-w-[10rem] truncate font-arcade text-sm text-neon-green">
            {you ?? 'Player'}
          </p>
        </div>
        <span className="font-arcade text-base text-white/35">VS</span>
        <div>
          <p className="font-arcade text-[9px] text-white/45">OPPONENT</p>
          <p className="mt-1 max-w-[10rem] truncate font-arcade text-sm text-neon-pink">
            {opponent ?? 'Player'}
          </p>
        </div>
      </div>
      <p className="font-arcade text-[10px] text-white/40">ENTERING GAME…</p>
    </div>
  )
}

function TimeoutView({ onRetry, onPrivateRoom }) {
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <p className="font-arcade text-2xl text-neon-pink drop-shadow-[0_0_14px_rgba(255,0,110,0.5)] md:text-3xl">
        NO OPPONENTS FOUND
      </p>
      <p className="max-w-sm text-sm text-white/55">
        Nobody else is in the queue right now. Try again, or set up a private
        room and share the code.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={onRetry}
          className="rounded-md border border-neon-green/70 bg-neon-green/10 px-5 py-2.5 font-arcade text-[11px] text-neon-green hover:bg-neon-green/20 hover:shadow-neon-green"
        >
          ▶ TRY AGAIN
        </button>
        <button
          type="button"
          onClick={onPrivateRoom}
          className="rounded-md border border-neon-cyan/70 bg-neon-cyan/10 px-5 py-2.5 font-arcade text-[11px] text-neon-cyan hover:bg-neon-cyan/20 hover:shadow-neon-cyan"
        >
          ⚔ CREATE PRIVATE ROOM
        </button>
      </div>
    </div>
  )
}

function Radar({ children }) {
  return (
    <div className="relative my-8 grid h-56 w-56 place-items-center">
      {[0, 800, 1600].map((delay, i) => (
        <span
          key={i}
          className="mm-radar-pulse absolute inset-0 rounded-full border-2 border-neon-green/55"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
      <span className="pointer-events-none absolute inset-2 rounded-full border border-white/5" />
      <span className="pointer-events-none absolute inset-10 rounded-full border border-white/5" />
      <span
        className="mm-radar-sweep pointer-events-none absolute inset-0"
        aria-hidden="true"
      >
        <span className="block h-full w-1/2 origin-right" style={{
          background:
            'linear-gradient(to right, transparent, rgba(0,255,136,0.35))',
          clipPath: 'polygon(0 50%, 100% 0, 100% 100%)',
        }} />
      </span>
      <div className="relative z-10 grid h-20 w-20 place-items-center rounded-full border-2 border-neon-green bg-arcadia-bg shadow-neon-green">
        {children}
      </div>
    </div>
  )
}

function Shell({ title, icon, backTo, backLabel = 'LOBBY', children }) {
  return (
    <div className="scanlines relative min-h-screen bg-arcadia-bg text-white">
      <header className="sticky top-0 z-30 border-b border-neon-green/30 bg-arcadia-bg/85 shadow-[0_1px_0_0_rgba(0,255,136,0.2)] backdrop-blur-md">
        <div className="mx-auto grid max-w-7xl grid-cols-[1fr_auto_1fr] items-center px-4 py-4 md:px-8">
          <Link
            to={backTo ?? '/'}
            className="flex items-center gap-2 justify-self-start font-arcade text-[10px] text-neon-cyan transition hover:text-neon-green md:text-xs"
          >
            <span aria-hidden="true">◀</span>
            {backLabel}
          </Link>
          <h1 className="justify-self-center font-arcade text-sm text-neon-green drop-shadow-[0_0_8px_rgba(0,255,136,0.4)] md:text-lg">
            {icon && <span className="mr-2">{icon}</span>}
            {title}
          </h1>
          <span className="justify-self-end" />
        </div>
      </header>
      {children}
    </div>
  )
}
