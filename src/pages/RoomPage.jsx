import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { getRoom } from '../lib/api'
import { socket } from '../lib/socket'
import Avatar from '../components/Avatar'
import { games as gameMeta } from '../data/games'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

const MP_GAME_NAMES = {
  chess: { name: 'Chess', icon: '♟️' },
  'snake-and-ladder': { name: 'Snake & Ladder', icon: '🎲' },
  'word-puzzle': { name: 'Word Puzzle Battle', icon: '🔤' },
}

function pick(obj, ...keys) {
  for (const k of keys) {
    if (obj && obj[k] != null) return obj[k]
  }
  return undefined
}

function normalizePlayer(p) {
  if (!p) return null
  return {
    userId: pick(p, 'userId', 'user_id', 'id'),
    username: pick(p, 'username', 'name') ?? 'Player',
    ready: !!pick(p, 'ready', 'isReady', 'is_ready'),
    isHost: !!pick(p, 'isHost', 'is_host', 'host'),
    isConnected: pick(p, 'isConnected', 'is_connected', 'connected') ?? true,
  }
}

function normalizeRoom(r) {
  if (!r) return null
  return {
    code:
      pick(r, 'code', 'roomCode', 'room_code') ??
      pick(r, 'id'),
    gameId: pick(r, 'gameId', 'game_id'),
    status: pick(r, 'status'),
    players: (pick(r, 'players') ?? []).map(normalizePlayer).filter(Boolean),
    maxPlayers: pick(r, 'maxPlayers', 'max_players') ?? 2,
  }
}

export default function RoomPage() {
  const { roomCode } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { user, displayName, loading: authLoading, openLogin } = useAuth()

  const [room, setRoom] = useState(null)
  const [phase, setPhase] = useState('loading') // loading | error | ready | starting
  const [errorMsg, setErrorMsg] = useState('')
  const [opponentLeft, setOpponentLeft] = useState(false)
  const [pendingReady, setPendingReady] = useState(false)
  const [copied, setCopied] = useState(false)
  const joinedRef = useRef(false)

  const code = (roomCode ?? '').toUpperCase()
  useDocumentTitle(`Room ${code}`)
  const gameInfo =
    (room?.gameId && MP_GAME_NAMES[room.gameId]) ||
    (room?.gameId &&
      gameMeta.find((g) => g.id === room.gameId) &&
      (() => {
        const m = gameMeta.find((g) => g.id === room.gameId)
        return { name: m.name, icon: m.icon }
      })()) || {
      name: room?.gameId?.toUpperCase() ?? 'GAME',
      icon: '🎮',
    }

  const me = useMemo(() => {
    if (!room) return null
    const u = displayName?.toLowerCase()
    return (
      room.players.find(
        (p) =>
          (user?.id && p.userId === user.id) ||
          (u && p.username?.toLowerCase() === u),
      ) ?? null
    )
  }, [room, user?.id, displayName])

  const opponent = useMemo(() => {
    if (!room) return null
    return room.players.find((p) => p !== me) ?? null
  }, [room, me])

  // Initial REST fetch to verify room and prefill state
  useEffect(() => {
    if (authLoading) return
    if (!displayName) {
      setPhase('error')
      setErrorMsg('You need a username to join a room.')
      return
    }
    let cancelled = false
    setPhase('loading')
    setErrorMsg('')
    getRoom(code)
      .then((data) => {
        if (cancelled) return
        const r = normalizeRoom(data)
        if (!r) {
          setPhase('error')
          setErrorMsg('Room not found.')
          return
        }
        // If room is full and I'm not in it, block
        const alreadyIn = r.players.some(
          (p) =>
            (user?.id && p.userId === user.id) ||
            p.username?.toLowerCase() === displayName.toLowerCase(),
        )
        if (!alreadyIn && r.players.length >= (r.maxPlayers ?? 2)) {
          setPhase('error')
          setErrorMsg('Room is full.')
          return
        }
        setRoom(r)
        setPhase('ready')
      })
      .catch((err) => {
        if (cancelled) return
        setPhase('error')
        setErrorMsg(
          err.status === 404 ? 'Room not found.' : 'Could not load room.',
        )
      })
    return () => {
      cancelled = true
    }
  }, [code, authLoading, displayName, user?.id])

  // Connect + emit join_room once we know the room exists
  useEffect(() => {
    if (phase !== 'ready' || !displayName) return
    if (!socket.connected) socket.connect()

    const announce = () => {
      if (joinedRef.current) return
      joinedRef.current = true
      socket.emit('join_room', { roomCode: code, username: displayName })
    }
    if (socket.connected) announce()
    socket.on('connect', announce)

    return () => {
      socket.off('connect', announce)
    }
  }, [phase, code, displayName])

  // Listen for room_update / game_start / opponent_left
  useEffect(() => {
    if (phase === 'loading' || phase === 'error') return

    const onRoomUpdate = (data) => {
      const r = normalizeRoom(data)
      if (!r || r.code !== code) return
      setRoom(r)
      setOpponentLeft(false)
      // server confirmed my ready state — clear optimistic flag
      const meNow = r.players.find(
        (p) =>
          (user?.id && p.userId === user.id) ||
          p.username?.toLowerCase() === displayName?.toLowerCase(),
      )
      if (meNow?.ready) setPendingReady(false)
    }
    const onGameStart = (data) => {
      const gameId =
        pick(data, 'gameId', 'game_id') ?? room?.gameId
      if (!gameId) return
      setPhase('starting')
      navigate(`/game/${gameId}?room=${code}`, { replace: true })
    }
    const onOpponentLeft = (data) => {
      setOpponentLeft(true)
      const who = pick(data, 'username', 'name')
      toast.show({
        message: who ? `${who} left the game.` : 'Opponent left the game.',
        duration: 4000,
      })
    }

    socket.on('room_update', onRoomUpdate)
    socket.on('game_start', onGameStart)
    socket.on('opponent_left', onOpponentLeft)
    return () => {
      socket.off('room_update', onRoomUpdate)
      socket.off('game_start', onGameStart)
      socket.off('opponent_left', onOpponentLeft)
    }
  }, [phase, code, navigate, toast, room?.gameId, user?.id, displayName])

  // On unmount, notify backend we left this specific room. We do NOT
  // disconnect the global socket — it stays alive for friend presence.
  useEffect(() => {
    return () => {
      if (joinedRef.current && socket.connected) {
        socket.emit('leave_room', { roomCode: code, username: displayName })
      }
      joinedRef.current = false
    }
  }, [code, displayName])

  const handleReady = useCallback(() => {
    if (!me || me.ready || pendingReady) return
    setPendingReady(true)
    socket.emit('player_ready', {
      roomCode: code,
      username: displayName,
    })
  }, [me, pendingReady, code, displayName])

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.show({ message: 'Copy failed — select manually.', duration: 2500 })
    }
  }, [code, toast])

  if (authLoading) return <Shell>{null}</Shell>

  if (phase === 'error') {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <p className="font-arcade text-sm text-neon-pink">{errorMsg}</p>
          {!displayName ? (
            <button
              type="button"
              onClick={openLogin}
              className="rounded-md border border-neon-cyan/60 bg-neon-cyan/10 px-4 py-2 font-arcade text-[10px] text-neon-cyan hover:bg-neon-cyan/20 hover:shadow-neon-cyan"
            >
              LOGIN
            </button>
          ) : null}
          <Link
            to="/"
            className="rounded-md border border-white/20 px-4 py-2 font-arcade text-[10px] text-white/70 hover:border-neon-cyan/60 hover:text-neon-cyan"
          >
            BACK TO LOBBY
          </Link>
        </div>
      </Shell>
    )
  }

  if (phase === 'loading' || !room) {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <p className="font-arcade text-[11px] text-white/55">
            ENTERING ROOM…
          </p>
          <Dots />
        </div>
      </Shell>
    )
  }

  const isReady = me?.ready || pendingReady
  const bothReady = room.players.length === 2 && room.players.every((p) => p.ready)
  const waitingForOpponent = !opponent || !opponent.isConnected

  return (
    <Shell>
      <section className="flex flex-col items-center gap-3 text-center">
        <span className="font-arcade text-[10px] text-white/45">ROOM CODE</span>
        <div className="flex items-center gap-3">
          <span className="font-arcade text-3xl tracking-[0.4em] text-neon-green drop-shadow-[0_0_14px_rgba(0,255,136,0.55)] md:text-5xl">
            {code}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            className="rounded-md border border-neon-cyan/60 bg-neon-cyan/10 px-3 py-1.5 font-arcade text-[10px] text-neon-cyan transition hover:bg-neon-cyan/20 hover:shadow-neon-cyan"
          >
            {copied ? '✓ COPIED' : '📋 COPY CODE'}
          </button>
        </div>
        <p className="text-xs text-white/45">
          Send this code to your friend.
        </p>
      </section>

      <section className="mt-8 flex flex-col items-center gap-2 text-center">
        <span className="font-arcade text-[9px] text-white/40">PLAYING</span>
        <p className="font-arcade text-base text-neon-cyan md:text-lg">
          <span className="mr-2">{gameInfo.icon}</span>
          {gameInfo.name.toUpperCase()}
        </p>
      </section>

      <section className="mt-10 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
        <PlayerCard player={me} isMe label="YOU" />
        <span className="text-center font-arcade text-base text-white/40">
          VS
        </span>
        <PlayerCard player={opponent} placeholder="WAITING FOR OPPONENT" />
      </section>

      {opponentLeft && (
        <p className="mt-6 text-center text-xs text-neon-pink">
          Opponent left the game.
        </p>
      )}

      <section className="mt-10 flex flex-col items-center gap-3">
        {opponentLeft ? (
          <Link
            to="/"
            className="rounded-md border border-neon-cyan/60 bg-neon-cyan/10 px-5 py-2.5 font-arcade text-[11px] text-neon-cyan hover:bg-neon-cyan/20 hover:shadow-neon-cyan"
          >
            BACK TO LOBBY
          </Link>
        ) : (
          <>
            <button
              type="button"
              onClick={handleReady}
              disabled={!me || isReady || waitingForOpponent}
              className={`rounded-md border-2 px-6 py-2.5 font-arcade text-[11px] transition ${
                isReady
                  ? 'cursor-default border-neon-cyan/40 text-neon-cyan'
                  : waitingForOpponent
                    ? 'cursor-not-allowed border-white/15 text-white/35'
                    : 'border-neon-green/70 bg-neon-green/10 text-neon-green hover:bg-neon-green/20 hover:shadow-neon-green'
              }`}
            >
              {isReady
                ? bothReady
                  ? 'STARTING…'
                  : 'WAITING…'
                : waitingForOpponent
                  ? 'WAITING FOR OPPONENT'
                  : '▶ READY'}
            </button>
            <Link
              to="/"
              className="font-arcade text-[9px] text-white/40 transition hover:text-neon-pink"
            >
              LEAVE ROOM
            </Link>
          </>
        )}
      </section>
    </Shell>
  )
}

function PlayerCard({ player, isMe, label, placeholder }) {
  if (!player) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-white/15 bg-arcadia-surface/40 p-4">
        <div className="grid h-16 w-16 place-items-center rounded-full border-2 border-white/10 text-2xl text-white/30">
          ?
        </div>
        <span className="font-arcade text-[10px] text-white/40">
          {placeholder ?? 'WAITING…'}
        </span>
        <Dots />
      </div>
    )
  }
  return (
    <div
      className={`flex flex-col items-center gap-2 rounded-xl border-2 bg-arcadia-surface/70 p-4 ${
        player.ready
          ? 'border-neon-green/60 shadow-neon-green'
          : 'border-white/15'
      }`}
    >
      <Avatar name={player.username} size="lg" />
      <span className="max-w-[10rem] truncate font-arcade text-[11px] text-white">
        {player.username}
      </span>
      {label && (
        <span className="font-arcade text-[8px] text-white/40">{label}</span>
      )}
      <span
        className={`rounded-md border px-2 py-0.5 font-arcade text-[9px] ${
          player.ready
            ? 'border-neon-green/60 bg-neon-green/10 text-neon-green'
            : 'border-white/15 text-white/55'
        }`}
      >
        {player.ready ? 'READY' : 'NOT READY'}
      </span>
    </div>
  )
}

function Dots() {
  return (
    <span className="inline-flex items-center gap-1" aria-hidden="true">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-neon-cyan [animation-delay:0ms]" />
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-neon-cyan [animation-delay:120ms]" />
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-neon-cyan [animation-delay:240ms]" />
    </span>
  )
}

function Shell({ children }) {
  return (
    <div className="scanlines route-fade-in relative min-h-screen bg-arcadia-bg text-white">
      <header className="sticky top-0 z-30 border-b border-neon-green/30 bg-arcadia-bg/85 shadow-[0_1px_0_0_rgba(0,255,136,0.2)] backdrop-blur-md">
        <div className="mx-auto grid max-w-7xl grid-cols-[1fr_auto_1fr] items-center px-4 py-4 md:px-8">
          <Link
            to="/"
            className="flex items-center gap-2 justify-self-start font-arcade text-[10px] text-neon-cyan transition hover:text-neon-green md:text-xs"
          >
            <span aria-hidden="true">◀</span>
            LOBBY
          </Link>
          <h1 className="justify-self-center font-arcade text-sm text-neon-green drop-shadow-[0_0_8px_rgba(0,255,136,0.4)] md:text-lg">
            <span className="mr-2">⚔</span>
            ROOM
          </h1>
          <span className="justify-self-end" />
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10 md:px-8 md:py-16">
        {children}
      </main>
    </div>
  )
}
