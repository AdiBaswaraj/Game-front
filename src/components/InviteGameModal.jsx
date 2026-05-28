import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useFriends } from '../context/FriendsContext'
import { useToast } from '../context/ToastContext'
import { createRoom } from '../lib/api'
import { socket } from '../lib/socket'

const MP_GAMES = [
  { id: 'chess', name: 'Chess', icon: '♟️', accent: 'pink' },
  { id: 'snake-and-ladder', name: 'Snake & Ladder', icon: '🎲', accent: 'cyan' },
  { id: 'word-puzzle', name: 'Word Puzzle Battle', icon: '🔤', accent: 'green' },
]

const ACCENTS = {
  green: 'border-neon-green/60 hover:border-neon-green hover:shadow-neon-green text-neon-green',
  cyan: 'border-neon-cyan/60 hover:border-neon-cyan hover:shadow-neon-cyan text-neon-cyan',
  pink: 'border-neon-pink/60 hover:border-neon-pink hover:shadow-neon-pink text-neon-pink',
}

export default function InviteGameModal() {
  const { displayName } = useAuth()
  const { inviteFriend, closeInviteModal, closeDrawer } = useFriends()
  const toast = useToast()
  const navigate = useNavigate()
  const open = !!inviteFriend

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') closeInviteModal()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, closeInviteModal])

  if (!open) return null

  const pickGame = async (gameId, e) => {
    // Defensive — these buttons are already type="button" and not in a
    // form, but we belt-and-suspenders against any accidental default
    // submission / bubble that could turn the click into a navigation.
    if (e) {
      e.preventDefault?.()
      e.stopPropagation?.()
    }
    try {
      const res = await createRoom({ gameId, username: displayName })
      const roomCode = res?.roomCode ?? res?.room_code ?? res?.code
      if (!roomCode) {
        toast.error('Could not create room. Try again.')
        return
      }
      socket.emit('send_friend_invite', {
        toUserId: inviteFriend.userId,
        roomCode,
        gameId,
        fromUsername: displayName,
      })
      toast.success(`Invite sent to ${inviteFriend.username}.`)
      closeInviteModal()
      closeDrawer()
      navigate(`/room/${roomCode}`)
    } catch (err) {
      toast.error(
        `Could not create room — ${err?.message ?? 'unknown error'}`,
      )
    }
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={closeInviteModal}
      role="dialog"
      aria-modal="true"
      aria-label="Invite friend to a game"
    >
      <div
        className="w-full max-w-sm rounded-xl border border-neon-pink/50 bg-arcadia-surface shadow-neon-pink"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-white/5 px-5 py-4">
          <div>
            <h3 className="font-arcade text-xs text-neon-pink">
              ⚔ INVITE {inviteFriend.username?.toUpperCase()}
            </h3>
            <p className="mt-1 text-[10px] text-white/45">Pick a cabinet.</p>
          </div>
          <button
            type="button"
            onClick={closeInviteModal}
            className="rounded p-1 font-arcade text-xs text-white/50 transition hover:text-neon-pink"
            aria-label="Close"
          >
            ✕
          </button>
        </header>
        <div className="grid grid-cols-1 gap-3 p-5">
          {MP_GAMES.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={(e) => pickGame(g.id, e)}
              className={`flex items-center gap-4 rounded-lg border-2 bg-arcadia-bg/60 p-4 transition ${ACCENTS[g.accent]}`}
            >
              <span className="text-2xl">{g.icon}</span>
              <span className="font-arcade text-[11px]">{g.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
