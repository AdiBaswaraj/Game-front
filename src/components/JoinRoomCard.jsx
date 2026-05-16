import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { createRoom, getRoom } from '../lib/api'

const ROOM_LEN = 6

const MP_GAMES = [
  { id: 'chess', name: 'Chess', icon: '♟️', accent: 'pink' },
  { id: 'snake-and-ladder', name: 'Snake & Ladder', icon: '🎲', accent: 'cyan' },
  { id: 'word-puzzle', name: 'Word Puzzle', icon: '🔤', accent: 'green' },
]

const ACCENTS = {
  green: 'border-neon-green/60 hover:border-neon-green hover:shadow-neon-green text-neon-green',
  cyan: 'border-neon-cyan/60 hover:border-neon-cyan hover:shadow-neon-cyan text-neon-cyan',
  pink: 'border-neon-pink/60 hover:border-neon-pink hover:shadow-neon-pink text-neon-pink',
}

export default function JoinRoomCard() {
  const { user, displayName, openLogin } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [creating, setCreating] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const pickerRef = useRef(null)

  useEffect(() => {
    if (!pickerOpen) return
    const onClick = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setPickerOpen(false)
      }
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setPickerOpen(false)
    }
    window.addEventListener('mousedown', onClick)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onClick)
      window.removeEventListener('keydown', onKey)
    }
  }, [pickerOpen])

  const submitJoin = async (e) => {
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

  const handleCreateClick = () => {
    if (!user) {
      toast.show({
        message: 'Login required to create a room.',
        action: { label: 'LOGIN', onClick: openLogin },
      })
      return
    }
    setPickerOpen((v) => !v)
  }

  const createForGame = async (gameId) => {
    if (creating) return
    setCreating(true)
    try {
      const res = await createRoom({ gameId, username: displayName })
      const roomCode = res?.roomCode ?? res?.room_code ?? res?.code
      if (!roomCode) {
        toast.show({ message: 'Could not create room.', duration: 2500 })
        return
      }
      setPickerOpen(false)
      navigate(`/room/${roomCode}`)
    } catch {
      toast.show({ message: 'Could not create room.', duration: 2500 })
    } finally {
      setCreating(false)
    }
  }

  return (
    <section className="relative mb-8 rounded-xl border border-neon-cyan/30 bg-arcadia-surface/60 p-5 shadow-[0_0_25px_-15px_rgba(0,212,255,0.6)]">
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-end sm:gap-5">
        <div className="flex-1">
          <p className="font-arcade text-[10px] text-neon-cyan">⚔ PLAY WITH A FRIEND</p>
          <p className="mt-1 text-xs text-white/50">
            Spin up a new room or jump into one with a 6-character code.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 sm:flex-nowrap">
          <form onSubmit={submitJoin} className="flex items-center gap-2">
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
              className="w-32 rounded-md border border-white/15 bg-arcadia-bg px-3 py-2.5 text-center font-arcade text-base tracking-[0.4em] text-neon-green placeholder:text-white/25 focus:border-neon-cyan focus:outline-none focus:ring-1 focus:ring-neon-cyan/40"
            />
            <button
              type="submit"
              disabled={submitting || code.length !== ROOM_LEN}
              className="rounded-md border border-neon-green/70 bg-neon-green/10 px-4 py-2.5 font-arcade text-[11px] text-neon-green transition hover:bg-neon-green/20 hover:shadow-neon-green disabled:opacity-40 disabled:hover:bg-neon-green/10 disabled:hover:shadow-none"
            >
              {submitting ? '...' : '▶ JOIN'}
            </button>
          </form>

          <button
            type="button"
            onClick={handleCreateClick}
            className="rounded-md border border-neon-pink/60 bg-neon-pink/10 px-4 py-2.5 font-arcade text-[11px] text-neon-pink transition hover:bg-neon-pink/20 hover:shadow-neon-pink"
          >
            + CREATE ROOM
          </button>
        </div>
      </div>

      {pickerOpen && (
        <div
          ref={pickerRef}
          className="absolute right-4 top-full z-30 mt-2 w-72 rounded-xl border border-neon-pink/50 bg-arcadia-surface/95 p-3 shadow-neon-pink backdrop-blur"
          role="dialog"
          aria-label="Pick a game"
        >
          <p className="px-1 pb-2 font-arcade text-[9px] text-white/45">
            PICK A GAME
          </p>
          <div className="flex flex-col gap-2">
            {MP_GAMES.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => createForGame(g.id)}
                disabled={creating}
                className={`flex items-center gap-3 rounded-lg border-2 bg-arcadia-bg/60 p-3 text-left transition disabled:opacity-50 ${ACCENTS[g.accent]}`}
              >
                <span className="text-xl">{g.icon}</span>
                <span className="font-arcade text-[10px]">{g.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
