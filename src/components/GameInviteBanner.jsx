import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFriends } from '../context/FriendsContext'
import { socket } from '../lib/socket'
import { SwordsIcon } from '../assets/icons/index.jsx'

const GAME_NAMES = {
  chess: 'Chess',
  'snake-and-ladder': 'Snake & Ladder',
  'word-puzzle': 'Word Puzzle Battle',
}

export default function GameInviteBanner() {
  const { incomingInvite, dismissIncomingInvite } = useFriends()
  const navigate = useNavigate()

  // Auto-dismiss the invite banner after 30 seconds if the user
  // hasn't decided. Resets when a different invite arrives.
  useEffect(() => {
    if (!incomingInvite) return
    const id = window.setTimeout(() => dismissIncomingInvite(), 30_000)
    return () => window.clearTimeout(id)
  }, [incomingInvite, dismissIncomingInvite])

  if (!incomingInvite) return null

  const gameName =
    GAME_NAMES[incomingInvite.gameId] ?? incomingInvite.gameId ?? 'a game'

  const handleJoin = () => {
    dismissIncomingInvite()
    if (incomingInvite.roomCode) {
      navigate(`/room/${incomingInvite.roomCode}`)
    }
  }

  const handleDecline = () => {
    if (incomingInvite.fromUserId) {
      socket.emit('decline_friend_invite', {
        toUserId: incomingInvite.fromUserId,
        fromUsername: incomingInvite.fromUsername,
      })
    }
    dismissIncomingInvite()
  }

  return (
    <div
      role="alert"
      className="pointer-events-none fixed left-1/2 z-[900] -translate-x-1/2 px-3"
      style={{ top: 68 }}
    >
      <div
        className="lb-slide-in glass-panel pixel-corners pointer-events-auto flex items-center gap-3 px-4 py-3 backdrop-blur"
        style={{
          width: 'min(360px, 90vw)',
          borderColor: 'rgba(0, 255, 136, 0.45)',
          borderWidth: 2,
          boxShadow: '0 8px 28px rgba(0, 0, 0, 0.5)',
        }}
      >
        <div className="flex-1 text-sm">
          <p className="inline-flex items-center gap-1.5 font-arcade text-[10px] text-neon-green">
            <SwordsIcon size={12} aria-hidden="true" />
            <span>GAME INVITE</span>
          </p>
          <p className="mt-1 text-white">
            <span className="font-arcade text-[11px] text-neon-cyan">
              {incomingInvite.fromUsername}
            </span>
            <span className="text-white/70"> invited you to play </span>
            <span className="font-arcade text-[11px] text-neon-green">
              {gameName}
            </span>
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            onClick={handleJoin}
            className="rounded-md border border-neon-green/70 bg-neon-green/15 px-3 py-1 font-arcade text-[10px] text-neon-green transition hover:bg-neon-green/25 hover:shadow-neon-green"
          >
            JOIN
          </button>
          <button
            type="button"
            onClick={handleDecline}
            className="rounded-md border border-white/15 px-3 py-1 font-arcade text-[10px] text-white/55 transition hover:border-neon-pink/60 hover:text-neon-pink"
          >
            DECLINE
          </button>
        </div>
      </div>
    </div>
  )
}
