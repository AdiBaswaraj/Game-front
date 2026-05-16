import { useNavigate } from 'react-router-dom'
import { useFriends } from '../context/FriendsContext'
import { socket } from '../lib/socket'

const GAME_NAMES = {
  chess: 'Chess',
  'snake-and-ladder': 'Snake & Ladder',
  'word-puzzle': 'Word Puzzle Battle',
}

export default function GameInviteBanner() {
  const { incomingInvite, dismissIncomingInvite } = useFriends()
  const navigate = useNavigate()

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
      className="fixed inset-x-0 top-4 z-[95] flex justify-center px-3"
    >
      <div className="lb-slide-in flex w-full max-w-md items-center gap-3 rounded-lg border-2 border-neon-pink/60 bg-arcadia-surface/95 px-4 py-3 shadow-neon-pink backdrop-blur">
        <div className="flex-1 text-sm">
          <p className="font-arcade text-[10px] text-neon-pink">
            ⚔ GAME INVITE
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
