import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { SwordsIcon } from '../assets/icons/index.jsx'
import { getRoom } from '../lib/api'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import LoadingScreen from '../components/LoadingScreen'

export default function JoinByCodePage() {
  const { roomCode } = useParams()
  const navigate = useNavigate()
  const code = (roomCode ?? '').toUpperCase()
  useDocumentTitle(`Join ${code}`)

  const { user, displayName, loading: authLoading, openLogin } = useAuth()
  const [error, setError] = useState(null)
  const [phase, setPhase] = useState('checking')

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      setPhase('login')
      return
    }
    if (!/^[A-Z0-9]{6}$/.test(code)) {
      setError('Invalid room code.')
      setPhase('error')
      return
    }

    let cancelled = false
    setPhase('checking')
    getRoom(code)
      .then((room) => {
        if (cancelled) return
        const players = room?.players ?? []
        const max = room?.maxPlayers ?? room?.max_players ?? 2
        const alreadyIn = players.some(
          (p) =>
            (user?.id && (p.userId ?? p.user_id ?? p.id) === user.id) ||
            (p.username ?? p.name)?.toLowerCase() ===
              displayName?.toLowerCase(),
        )
        if (!alreadyIn && players.length >= max) {
          setError('This room is full.')
          setPhase('error')
          return
        }
        navigate(`/room/${code}`, { replace: true })
      })
      .catch((err) => {
        if (cancelled) return
        setError(
          err?.status === 404 ? 'Room not found.' : 'Could not load room.',
        )
        setPhase('error')
      })
    return () => {
      cancelled = true
    }
  }, [authLoading, user, displayName, code, navigate])

  return (
    <div className="relative min-h-screen text-white" style={{ paddingTop: 60 }}>
      <header className="sticky top-[60px] z-30 border-b border-neon-green/30 bg-arcadia-bg/85 shadow-[0_1px_0_0_rgba(0,255,136,0.2)] backdrop-blur-md">
        <div className="mx-auto grid max-w-7xl grid-cols-[1fr_auto_1fr] items-center px-4 py-4 md:px-8">
          <Link
            to="/"
            className="flex items-center gap-2 justify-self-start font-arcade text-[10px] text-neon-cyan transition hover:text-neon-green md:text-xs"
          >
            <span aria-hidden="true">◀</span>
            LOBBY
          </Link>
          <h1 className="inline-flex items-center justify-self-center gap-2 font-arcade text-sm text-neon-green drop-shadow-[0_0_8px_rgba(0,255,136,0.4)] md:text-lg">
            <SwordsIcon size={22} aria-hidden="true" />
            <span>JOIN ROOM</span>
          </h1>
          <span className="justify-self-end" />
        </div>
      </header>

      <main className="mx-auto flex max-w-lg flex-col items-center gap-5 px-4 py-16 text-center md:py-24">
        <p className="font-arcade text-[10px] text-white/45">ROOM CODE</p>
        <span className="font-arcade text-3xl tracking-[0.4em] text-neon-green drop-shadow-[0_0_14px_rgba(0,255,136,0.55)] md:text-5xl">
          {code}
        </span>

        {phase === 'checking' && <LoadingScreen message="JOINING ROOM…" inline />}

        {phase === 'login' && (
          <>
            <p className="text-sm text-white/55">
              You need to be signed in to join this room.
            </p>
            <button
              type="button"
              onClick={openLogin}
              className="rounded-md border border-neon-cyan/60 bg-neon-cyan/10 px-5 py-2.5 font-arcade text-[11px] text-neon-cyan hover:bg-neon-cyan/20 hover:shadow-neon-cyan"
            >
              ▶ LOGIN
            </button>
          </>
        )}

        {phase === 'error' && (
          <>
            <p className="font-arcade text-sm text-neon-pink">{error}</p>
            <Link
              to="/"
              className="rounded-md border border-white/20 px-4 py-2 font-arcade text-[10px] text-white/70 hover:border-neon-cyan/60 hover:text-neon-cyan"
            >
              BACK TO LOBBY
            </Link>
          </>
        )}
      </main>
    </div>
  )
}
