import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { createRoom, getRoom } from '../lib/api'
import { socket } from '../lib/socket'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

const ROOM_LEN = 6
const GAME_LABELS = {
  chess: { name: 'CHESS', icon: '♟️' },
  'snake-and-ladder': { name: 'SNAKE & LADDER', icon: '🎲' },
  'word-puzzle': { name: 'WORD PUZZLE', icon: '🔤' },
}

function pick(o, ...keys) {
  for (const k of keys) if (o && o[k] != null) return o[k]
  return undefined
}

export default function PrivateRoomScreen() {
  const { gameId } = useParams()
  const { user, displayName, openLogin, loading: authLoading } = useAuth()
  const label = GAME_LABELS[gameId] ?? { name: gameId?.toUpperCase(), icon: '🎮' }
  useDocumentTitle(`${label.name} — Private Room`)

  const [tab, setTab] = useState('create') // 'create' | 'join'

  // Show a connecting state while auth resolves rather than flashing
  // the "login required" screen — the auth resolution can take up to
  // 3s in degraded network conditions before the AuthContext timeout
  // fires.
  if (authLoading) {
    return (
      <Shell title={label.name} icon={label.icon} backTo={`/game/${gameId}/mode`}>
        <main className="mx-auto flex max-w-2xl flex-col items-center gap-3 px-4 py-16 text-center md:py-24">
          <p className="font-arcade text-[11px] text-neon-cyan">CONNECTING…</p>
          <p className="text-xs text-white/45">Checking your session.</p>
        </main>
      </Shell>
    )
  }

  if (!user) {
    return (
      <Shell title={label.name} icon={label.icon} backTo={`/game/${gameId}/mode`}>
        <main className="mx-auto flex max-w-2xl flex-col items-center gap-4 px-4 py-16 text-center md:py-24">
          <p className="font-arcade text-sm text-neon-pink">
            Login required for private rooms.
          </p>
          <button
            type="button"
            onClick={openLogin}
            className="rounded-md border border-neon-cyan/60 bg-neon-cyan/10 px-4 py-2 font-arcade text-[10px] text-neon-cyan hover:bg-neon-cyan/20 hover:shadow-neon-cyan"
          >
            LOGIN
          </button>
        </main>
      </Shell>
    )
  }

  // Defensive: if user is set but displayName is still null/empty for
  // some reason (race during user_metadata population, etc.), don't
  // mount CreateTab yet — auto-create would fire with username=null.
  if (!displayName) {
    return (
      <Shell title={label.name} icon={label.icon} backTo={`/game/${gameId}/mode`}>
        <main className="mx-auto flex max-w-2xl flex-col items-center gap-3 px-4 py-16 text-center md:py-24">
          <p className="font-arcade text-[11px] text-neon-cyan">PREPARING…</p>
          <p className="text-xs text-white/45">Loading your profile.</p>
        </main>
      </Shell>
    )
  }

  return (
    <Shell title={label.name} icon={label.icon} backTo={`/game/${gameId}/mode`}>
      <main className="mx-auto flex w-full max-w-xl flex-col px-4 py-10 md:py-14">
        <Tabs tab={tab} setTab={setTab} />
        {tab === 'create' ? (
          <CreateTab gameId={gameId} username={displayName} userId={user.id} />
        ) : (
          <JoinTab gameId={gameId} userId={user.id} displayName={displayName} />
        )}
      </main>
    </Shell>
  )
}

function Tabs({ tab, setTab }) {
  return (
    <nav className="mb-6 flex gap-2 rounded-md border border-white/10 bg-arcadia-surface/60 p-1">
      {['create', 'join'].map((t) => {
        const active = tab === t
        return (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`flex-1 rounded px-3 py-2 font-arcade text-[10px] transition ${
              active
                ? 'bg-neon-cyan/15 text-neon-cyan shadow-[inset_0_0_0_1px_rgba(0,212,255,0.6)]'
                : 'text-white/55 hover:text-white'
            }`}
          >
            {t === 'create' ? '✦ CREATE' : '▶ JOIN'}
          </button>
        )
      })}
    </nav>
  )
}

function CreateTab({ gameId, username, userId }) {
  const navigate = useNavigate()
  const toast = useToast()
  const [code, setCode] = useState(null)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  // requestedRef guards against duplicate create calls (StrictMode
  // double-mount and any re-render-triggered re-fire).
  const requestedRef = useRef(false)
  const joinedRef = useRef(false)
  // mountedRef lets us safely commit state from an async resolution
  // without using a cancellation flag — which previously bailed out of
  // a successful response if the component re-rendered between the
  // fetch starting and resolving (race with auth-state changes).
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  // Auto-create on first mount, but only when the username is actually
  // available. Calling createRoom with a null/undefined username races
  // with auth resolution and the backend can return 400.
  useEffect(() => {
    console.log('[room] CreateTab effect:', {
      username,
      userId,
      requested: requestedRef.current,
    })
    if (!username) {
      console.log('[room] waiting for username…')
      return
    }
    if (requestedRef.current) return
    requestedRef.current = true
    console.log('[room] CreateTab calling createRoom', { gameId, username })
    createRoom({ gameId, username })
      .then((res) => {
        console.log('[room] CreateTab handler running', {
          mounted: mountedRef.current,
          res,
        })
        if (!mountedRef.current) return
        const c = res?.roomCode ?? res?.room_code ?? res?.code
        if (!c) {
          const msg = 'Could not create room — no code in response.'
          setError(msg)
          toast.show({ message: msg, duration: 4500 })
          return
        }
        setCode(String(c).toUpperCase())
      })
      .catch((err) => {
        console.error('[room] CreateTab createRoom failed', err)
        if (!mountedRef.current) return
        const msg = `Could not create room — ${err?.message ?? 'unknown error'}`
        setError(msg)
        toast.show({ message: msg, duration: 4500 })
      })
  }, [gameId, username, userId, toast])

  // Once we have a code, subscribe to room socket events and join the
  // socket room so we receive room_update when opponent arrives.
  useEffect(() => {
    if (!code) return
    if (!socket.connected) {
      console.log('[room] socket not yet connected, calling connect()')
      socket.connect()
    }

    const announce = () => {
      if (joinedRef.current) return
      joinedRef.current = true
      console.log('[room] socket connected:', socket.connected, '— emit join_room', { code, username })
      socket.emit('join_room', { roomCode: code, username })
    }
    if (socket.connected) {
      announce()
    } else {
      // Defer until the socket actually connects — emit-while-disconnected
      // queues in socket.io-client but we want the log to fire at the
      // real connect moment for visibility.
      socket.once('connect', announce)
    }

    const onRoomUpdate = (data) => {
      const players = pick(data, 'players') ?? []
      const dataCode = pick(data, 'roomCode', 'room_code', 'code')
      if (dataCode && String(dataCode).toUpperCase() !== code) return
      if (players.length >= 2) {
        // Opponent has joined — both players meet in the ready-up lobby.
        navigate(`/room/${code}`, { replace: true })
      }
    }
    const onOpponentLeft = () => {
      // Someone bailed before pairing — keep waiting.
    }

    socket.on('room_update', onRoomUpdate)
    socket.on('opponent_left', onOpponentLeft)
    return () => {
      socket.off('connect', announce)
      socket.off('room_update', onRoomUpdate)
      socket.off('opponent_left', onOpponentLeft)
    }
  }, [code, username, navigate])

  // Best-effort leave_room on unmount (skips if we already navigated to /room)
  useEffect(() => {
    return () => {
      if (code && joinedRef.current && !location.pathname.startsWith(`/room/${code}`)) {
        socket.emit('leave_room', { roomCode: code, username })
        joinedRef.current = false
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  const shareLink = code
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/join/${code}`
    : ''

  const copyCode = async () => {
    if (!code) return
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
      toast.success(`ROOM CODE COPIED · ${code}`)
    } catch {
      toast.error('Copy failed — select the code manually.')
    }
  }

  const copyLink = async () => {
    if (!shareLink) return
    try {
      await navigator.clipboard.writeText(shareLink)
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 1500)
      toast.success('INVITE LINK COPIED')
    } catch {
      toast.error('Copy failed — select the link manually.')
    }
  }

  const shareNative = async () => {
    if (!shareLink) return
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Arcadia Room',
          text: `Join my Arcadia room: ${code}`,
          url: shareLink,
        })
      } catch {
        // user dismissed
      }
    } else {
      copyLink()
    }
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <p className="font-arcade text-sm text-neon-pink">{error}</p>
        <Link
          to={`/game/${gameId}/mode`}
          className="rounded-md border border-white/20 px-4 py-2 font-arcade text-[10px] text-white/70 hover:border-neon-cyan/60 hover:text-neon-cyan"
        >
          BACK
        </Link>
      </div>
    )
  }

  if (!code) {
    return (
      <div className="flex flex-col items-center gap-3 py-10">
        <p className="font-arcade text-[11px] text-white/55">CREATING ROOM…</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <p className="font-arcade text-[10px] text-white/45">ROOM CODE</p>
      <CodeBoxes value={code} />

      <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
        <button
          type="button"
          onClick={copyCode}
          className="rounded-md border border-neon-cyan/60 bg-neon-cyan/10 px-4 py-2 font-arcade text-[10px] text-neon-cyan hover:bg-neon-cyan/20 hover:shadow-neon-cyan"
        >
          {copied ? '✓ COPIED!' : '📋 COPY CODE'}
        </button>
        <button
          type="button"
          onClick={shareNative}
          className="rounded-md border border-neon-pink/60 bg-neon-pink/10 px-4 py-2 font-arcade text-[10px] text-neon-pink hover:bg-neon-pink/20 hover:shadow-neon-pink"
        >
          ↗ SHARE
        </button>
      </div>

      <div className="w-full rounded-md border border-white/10 bg-arcadia-surface/60 p-3 text-left">
        <p className="font-arcade text-[9px] text-white/40">SHAREABLE LINK</p>
        <div className="mt-2 flex items-center gap-2">
          <input
            readOnly
            value={shareLink}
            className="flex-1 truncate rounded-md border border-white/10 bg-arcadia-bg px-3 py-2 font-mono text-xs text-white/75"
          />
          <button
            type="button"
            onClick={copyLink}
            className="shrink-0 rounded-md border border-neon-cyan/60 px-3 py-2 font-arcade text-[9px] text-neon-cyan hover:bg-neon-cyan/15 hover:shadow-neon-cyan"
          >
            {linkCopied ? '✓' : 'COPY'}
          </button>
        </div>
      </div>

      <div className="mt-2 flex items-center gap-2 font-arcade text-[10px] text-white/45">
        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-neon-cyan shadow-neon-cyan" />
        WAITING FOR OPPONENT…
      </div>

      <Link
        to={`/game/${gameId}/mode`}
        className="font-arcade text-[9px] text-white/40 hover:text-neon-pink"
      >
        ✕ CANCEL
      </Link>
    </div>
  )
}

function JoinTab({ gameId, userId, displayName, initialCode = '' }) {
  const navigate = useNavigate()
  const toast = useToast()
  const [chars, setChars] = useState(() =>
    fillChars(initialCode.toUpperCase().padEnd(ROOM_LEN, '').slice(0, ROOM_LEN)),
  )
  const [submitting, setSubmitting] = useState(false)
  const [shake, setShake] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const boxRefs = useRef([])

  const code = chars.join('')
  const ready = code.length === ROOM_LEN && /^[A-Z0-9]{6}$/.test(code)

  useEffect(() => {
    if (initialCode && /^[A-Z0-9]{6}$/i.test(initialCode)) {
      // Submitted by parent (deep link). Trigger submit automatically.
      submit(initialCode.toUpperCase())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCode])

  const setCharAt = (idx, ch) => {
    setErrorMsg('')
    setChars((prev) => {
      const next = [...prev]
      next[idx] = ch
      return next
    })
  }

  const handleChange = (idx, raw) => {
    const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (!cleaned) {
      setCharAt(idx, '')
      return
    }
    // Paste support — first char into current box, rest spill forward
    let i = idx
    for (const ch of cleaned) {
      if (i >= ROOM_LEN) break
      setCharAt(i, ch)
      i += 1
    }
    const focusIdx = Math.min(i, ROOM_LEN - 1)
    boxRefs.current[focusIdx]?.focus()
  }

  const handleKeyDown = (idx, e) => {
    if (e.key === 'Backspace') {
      e.preventDefault()
      if (chars[idx]) {
        setCharAt(idx, '')
      } else if (idx > 0) {
        setCharAt(idx - 1, '')
        boxRefs.current[idx - 1]?.focus()
      }
    } else if (e.key === 'ArrowLeft' && idx > 0) {
      boxRefs.current[idx - 1]?.focus()
    } else if (e.key === 'ArrowRight' && idx < ROOM_LEN - 1) {
      boxRefs.current[idx + 1]?.focus()
    } else if (e.key === 'Enter' && ready) {
      submit(code)
    }
  }

  const submit = async (codeStr) => {
    setSubmitting(true)
    setErrorMsg('')
    try {
      const room = await getRoom(codeStr)
      const players = room?.players ?? []
      const max = room?.maxPlayers ?? room?.max_players ?? 2
      const alreadyIn = players.some(
        (p) =>
          (userId && (p.userId ?? p.user_id ?? p.id) === userId) ||
          (p.username ?? p.name)?.toLowerCase() ===
            displayName?.toLowerCase(),
      )
      if (!alreadyIn && players.length >= max) {
        setErrorMsg('Room is full.')
        setShake(true)
        setTimeout(() => setShake(false), 450)
        return
      }
      navigate(`/room/${codeStr}`)
    } catch (err) {
      const message =
        err?.status === 404 ? 'Room not found.' : 'Could not join room.'
      setErrorMsg(message)
      setShake(true)
      setTimeout(() => setShake(false), 450)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <p className="font-arcade text-[10px] text-white/45">
        ENTER 6-CHARACTER ROOM CODE
      </p>

      <div
        className={`flex gap-2 ${shake ? 'wp-row-shake' : ''}`}
        aria-label="Room code"
      >
        {chars.map((ch, i) => (
          <input
            key={i}
            ref={(el) => (boxRefs.current[i] = el)}
            value={ch}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            maxLength={2}
            inputMode="text"
            autoCapitalize="characters"
            aria-label={`Character ${i + 1}`}
            className="h-14 w-12 rounded-md border-2 border-white/15 bg-arcadia-surface text-center font-arcade text-2xl text-neon-green caret-neon-green focus:border-neon-cyan focus:outline-none focus:ring-2 focus:ring-neon-cyan/40"
          />
        ))}
      </div>

      {errorMsg && (
        <p className="font-arcade text-[10px] text-neon-pink" role="alert">
          {errorMsg}
        </p>
      )}

      <button
        type="button"
        onClick={() => submit(code)}
        disabled={!ready || submitting}
        className="rounded-md border-2 border-neon-green/70 bg-neon-green/10 px-6 py-2.5 font-arcade text-[11px] text-neon-green transition hover:bg-neon-green/20 hover:shadow-neon-green disabled:opacity-40 disabled:hover:bg-neon-green/10 disabled:hover:shadow-none"
      >
        {submitting ? '...' : '▶ JOIN'}
      </button>
    </div>
  )
}

function fillChars(s) {
  const out = Array(ROOM_LEN).fill('')
  for (let i = 0; i < Math.min(s.length, ROOM_LEN); i++) {
    out[i] = s[i]
  }
  return out
}

function CodeBoxes({ value }) {
  const chars = value.padEnd(ROOM_LEN, ' ').slice(0, ROOM_LEN).split('')
  return (
    <div className="flex gap-2">
      {chars.map((ch, i) => (
        <span
          key={i}
          className="grid h-14 w-12 place-items-center rounded-md border-2 border-neon-green/60 bg-arcadia-surface text-2xl text-neon-green drop-shadow-[0_0_10px_rgba(0,255,136,0.45)]"
        >
          {ch.trim() ? ch : '·'}
        </span>
      ))}
    </div>
  )
}

export function PrivateRoomScreenWithJoinCode({ gameId, prefilledCode }) {
  // Variant used by /join/:roomCode — opens JOIN tab and pre-submits
  const { user, displayName, openLogin } = useAuth()
  const label = GAME_LABELS[gameId] ?? { name: gameId?.toUpperCase(), icon: '🎮' }

  if (!user) {
    return (
      <Shell title={label.name} icon={label.icon} backTo="/">
        <main className="mx-auto flex max-w-2xl flex-col items-center gap-4 px-4 py-16 text-center md:py-24">
          <p className="font-arcade text-sm text-neon-pink">
            Login required to join a private room.
          </p>
          <button
            type="button"
            onClick={openLogin}
            className="rounded-md border border-neon-cyan/60 bg-neon-cyan/10 px-4 py-2 font-arcade text-[10px] text-neon-cyan hover:bg-neon-cyan/20 hover:shadow-neon-cyan"
          >
            LOGIN
          </button>
        </main>
      </Shell>
    )
  }

  return (
    <Shell title={label.name} icon={label.icon} backTo="/">
      <main className="mx-auto flex w-full max-w-xl flex-col px-4 py-10 md:py-14">
        <p className="mb-4 text-center font-arcade text-[10px] text-neon-cyan">
          INVITE LINK · JOINING…
        </p>
        <JoinTab
          gameId={gameId}
          userId={user.id}
          displayName={displayName}
          initialCode={prefilledCode}
        />
      </main>
    </Shell>
  )
}

function Shell({ title, icon, backTo, backLabel = 'BACK', children }) {
  return (
    <div className="relative min-h-screen bg-arcadia-bg text-white">
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
