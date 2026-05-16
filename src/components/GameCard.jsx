import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { createRoom } from '../lib/api'

const ACCENTS = {
  'neon-green': {
    border: 'border-neon-green/40 hover:border-neon-green',
    glow: 'hover:shadow-neon-green',
    text: 'text-neon-green',
    badgeBg: 'bg-neon-green/10 border-neon-green/40 text-neon-green',
    iconHalo: 'shadow-[0_0_30px_rgba(0,255,136,0.25)]',
    btn:
      'border-neon-green/60 text-neon-green hover:bg-neon-green/15 hover:shadow-neon-green',
  },
  'neon-cyan': {
    border: 'border-neon-cyan/40 hover:border-neon-cyan',
    glow: 'hover:shadow-neon-cyan',
    text: 'text-neon-cyan',
    badgeBg: 'bg-neon-cyan/10 border-neon-cyan/40 text-neon-cyan',
    iconHalo: 'shadow-[0_0_30px_rgba(0,212,255,0.25)]',
    btn:
      'border-neon-cyan/60 text-neon-cyan hover:bg-neon-cyan/15 hover:shadow-neon-cyan',
  },
  'neon-pink': {
    border: 'border-neon-pink/40 hover:border-neon-pink',
    glow: 'hover:shadow-neon-pink',
    text: 'text-neon-pink',
    badgeBg: 'bg-neon-pink/10 border-neon-pink/40 text-neon-pink',
    iconHalo: 'shadow-[0_0_30px_rgba(255,0,110,0.25)]',
    btn:
      'border-neon-pink/60 text-neon-pink hover:bg-neon-pink/15 hover:shadow-neon-pink',
  },
}

export default function GameCard({ game }) {
  const navigate = useNavigate()
  const { user, displayName, openLogin } = useAuth()
  const toast = useToast()
  const [creating, setCreating] = useState(false)
  const a = ACCENTS[game.accent] ?? ACCENTS['neon-green']

  const handlePlay = async () => {
    if (game.multiplayer) {
      // Games like Chess have a mode select (vs CPU / vs Player) before
      // a room is created. Send them through that screen first.
      if (game.hasModeSelect) {
        navigate(`/game/${game.id}`)
        return
      }
      if (!user) {
        toast.show({
          message: 'Login required for multiplayer.',
          action: { label: 'LOGIN', onClick: openLogin },
        })
        return
      }
      if (creating) return
      setCreating(true)
      try {
        const res = await createRoom({
          gameId: game.id,
          username: displayName,
        })
        const code = res?.roomCode ?? res?.room_code ?? res?.code
        if (!code) {
          toast.show({ message: 'Could not create room.', duration: 2500 })
          return
        }
        navigate(`/room/${code}`)
      } catch {
        toast.show({ message: 'Could not create room.', duration: 2500 })
      } finally {
        setCreating(false)
      }
      return
    }
    if (game.hasDifficulty) {
      navigate(`/game/${game.id}/difficulty`)
    } else {
      navigate(`/game/${game.id}`)
    }
  }

  return (
    <article
      className={`group relative flex flex-col rounded-xl border ${a.border} ${a.glow} bg-arcadia-surface/70 p-5 transition-all duration-200 hover:-translate-y-1`}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={`inline-flex h-14 w-14 items-center justify-center rounded-lg border border-white/10 bg-arcadia-bg text-3xl ${a.iconHalo}`}
          aria-hidden="true"
        >
          {game.icon}
        </span>
        <span
          className={`rounded-md border px-2 py-1 font-arcade text-[9px] ${a.badgeBg}`}
        >
          {game.players}
        </span>
      </div>

      <h3 className={`mt-5 font-arcade text-sm leading-snug ${a.text}`}>
        {game.name}
      </h3>
      <p className="mt-2 text-xs uppercase tracking-widest text-white/45">
        {game.category}
      </p>

      <button
        type="button"
        onClick={handlePlay}
        disabled={creating}
        className={`mt-6 w-full rounded-md border bg-transparent py-2.5 font-arcade text-[11px] transition-all duration-200 disabled:opacity-60 ${a.btn}`}
      >
        {creating ? 'CREATING…' : '▶ PLAY'}
      </button>
    </article>
  )
}
