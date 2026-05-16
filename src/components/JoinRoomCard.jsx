import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { getRoom } from '../lib/api'

const ROOM_LEN = 6

export default function JoinRoomCard() {
  const { user, displayName, openLogin } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e) => {
    e?.preventDefault()
    const cleaned = code.trim().toUpperCase()
    if (cleaned.length !== ROOM_LEN) {
      toast.show({ message: `Room code is ${ROOM_LEN} characters.`, duration: 2000 })
      return
    }
    if (!user) {
      toast.show({
        message: 'Login required to join a room.',
        action: { label: 'LOGIN', onClick: openLogin },
      })
      return
    }
    setSubmitting(true)
    try {
      const room = await getRoom(cleaned)
      const players = room?.players ?? []
      const max = room?.maxPlayers ?? room?.max_players ?? 2
      const alreadyIn = players.some(
        (p) =>
          (user?.id &&
            (p.userId ?? p.user_id ?? p.id) === user.id) ||
          (p.username ?? p.name)?.toLowerCase() ===
            displayName?.toLowerCase(),
      )
      if (!alreadyIn && players.length >= max) {
        toast.show({ message: 'Room is full.', duration: 2500 })
        return
      }
      navigate(`/room/${cleaned}`)
    } catch (err) {
      const message =
        err?.status === 404 ? 'Room not found.' : 'Could not join room.'
      toast.show({ message, duration: 2500 })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="mb-8 rounded-xl border border-neon-cyan/30 bg-arcadia-surface/60 p-5 shadow-[0_0_25px_-15px_rgba(0,212,255,0.6)]">
      <form
        onSubmit={submit}
        className="flex flex-col items-center gap-3 sm:flex-row sm:gap-4"
      >
        <div className="flex-1">
          <p className="font-arcade text-[10px] text-neon-cyan">
            ⚔ HAVE A ROOM CODE?
          </p>
          <p className="mt-1 text-xs text-white/50">
            Enter the 6-character code from a friend to jump straight in.
          </p>
        </div>
        <input
          value={code}
          onChange={(e) =>
            setCode(
              e.target.value
                .toUpperCase()
                .replace(/[^A-Z0-9]/g, '')
                .slice(0, ROOM_LEN),
            )
          }
          placeholder="ABCDEF"
          aria-label="Room code"
          className="w-full max-w-[10rem] rounded-md border border-white/15 bg-arcadia-bg px-3 py-2.5 text-center font-arcade text-base tracking-[0.4em] text-neon-green placeholder:text-white/25 focus:border-neon-cyan focus:outline-none focus:ring-1 focus:ring-neon-cyan/40 sm:w-auto"
        />
        <button
          type="submit"
          disabled={submitting || code.length !== ROOM_LEN}
          className="rounded-md border border-neon-green/70 bg-neon-green/10 px-5 py-2.5 font-arcade text-[11px] text-neon-green transition hover:bg-neon-green/20 hover:shadow-neon-green disabled:opacity-40 disabled:hover:bg-neon-green/10 disabled:hover:shadow-none"
        >
          {submitting ? '...' : '▶ JOIN'}
        </button>
      </form>
    </section>
  )
}
