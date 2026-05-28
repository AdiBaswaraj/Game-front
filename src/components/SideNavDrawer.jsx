import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useFriends } from '../context/FriendsContext'
import { useToast } from '../context/ToastContext'
import { createRoom, searchUsers } from '../lib/api'
import { socket } from '../lib/socket'
import Avatar from './Avatar'
import { ChessIcon, SnakeLadderIcon, WordPuzzleIcon } from '../assets/icons/index.jsx'

const NAV_LINKS = [
  { to: '/', icon: '🏠', label: 'HOME' },
  { to: '/leaderboard', icon: '🏆', label: 'HALL OF FAME' },
  { to: '/settings', icon: '⚙', label: 'SETTINGS' },
]

const MP_GAMES = [
  { id: 'chess', name: 'Chess', Icon: ChessIcon },
  { id: 'snake-and-ladder', name: 'Snake & Ladder', Icon: SnakeLadderIcon },
  { id: 'word-puzzle', name: 'Word Puzzle', Icon: WordPuzzleIcon },
]

function formatJoinDate(s) {
  if (!s) return null
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
}

export default function SideNavDrawer({ open, onClose }) {
  let auth = {}
  try {
    auth = useAuth() ?? {}
  } catch {
    auth = {}
  }
  const { user, isGuest, displayName, loading, openLogin, signOut } = auth

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (typeof document === 'undefined') return null

  const handleLogin = () => {
    onClose()
    openLogin?.()
  }
  const handleSignOut = () => {
    onClose()
    signOut?.()
  }

  const drawer = (
    <>
      <div
        onClick={onClose}
        className={`fixed inset-0 z-[1000] bg-black/60 transition-opacity duration-200 ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        style={{ backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
      />
      <aside
        aria-label="Navigation"
        aria-hidden={!open}
        className={`fixed inset-y-0 right-0 z-[1010] flex w-full flex-col text-white sm:w-80 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{
          background: 'rgba(5, 5, 8, 0.95)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderLeft: '2px solid rgba(0, 255, 136, 0.2)',
          transition: 'transform 400ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      >
        <header className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <span className="neon-text font-arcade text-sm text-neon-green">
            <span className="text-neon-cyan">★</span> ARCADIA
          </span>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-md font-arcade text-xs text-white/50 transition hover:bg-white/[0.06] hover:text-neon-pink"
            aria-label="Close navigation"
          >
            ✕
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            <ProfileSkeleton />
          ) : user ? (
            <SignedInCard
              name={displayName}
              joinDate={user.created_at}
              onClose={onClose}
            />
          ) : isGuest ? (
            <GuestCard name={displayName} onLogin={handleLogin} />
          ) : (
            <SignedOutCard onLogin={handleLogin} />
          )}

          <DividerLabel>NAVIGATE</DividerLabel>

          <nav aria-label="Primary" className="px-3">
            <ul className="space-y-1">
              {NAV_LINKS.map((item) => (
                <NavLinkItem key={item.to} item={item} onClose={onClose} />
              ))}
            </ul>
          </nav>

          {user && (
            <>
              <DividerLabel>FRIENDS</DividerLabel>
              <FriendsSection
                onClose={onClose}
                displayName={displayName}
                userId={user.id}
              />
            </>
          )}
        </div>

        {user && (
          <button
            type="button"
            onClick={handleSignOut}
            className="flex shrink-0 items-center gap-4 border-t border-white/[0.06] px-5 py-4 font-arcade text-[11px] text-neon-pink transition hover:bg-neon-pink/10 hover:shadow-[inset_0_0_20px_rgba(255,0,110,0.15)]"
          >
            <span className="text-lg" aria-hidden="true">
              ↩
            </span>
            <span>SIGN OUT</span>
          </button>
        )}

        <footer className="shrink-0 border-t border-white/[0.06] px-5 py-3 text-center font-arcade text-[9px] text-white/30">
          © ARCADIA 2026
        </footer>
      </aside>
    </>
  )

  return createPortal(drawer, document.body)
}

function DividerLabel({ children }) {
  return (
    <div className="my-4 flex items-center gap-3 px-5">
      <div className="h-px flex-1 bg-white/[0.06]" />
      <span className="font-arcade text-[9px] tracking-[0.3em] text-white/35">
        {children}
      </span>
      <div className="h-px flex-1 bg-white/[0.06]" />
    </div>
  )
}

function NavLinkItem({ item, onClose }) {
  const location = useLocation()
  const isActive =
    item.to === '/'
      ? location.pathname === '/'
      : location.pathname.startsWith(item.to)
  return (
    <li>
      <Link
        to={item.to}
        onClick={onClose}
        className={`relative flex items-center gap-4 rounded-md px-5 py-3 font-arcade text-[11px] transition-all duration-200 ${
          isActive
            ? 'bg-white/[0.05] text-neon-green'
            : 'text-white/80 hover:bg-white/[0.05] hover:text-neon-cyan'
        }`}
      >
        {isActive && (
          <span className="absolute inset-y-2 left-0 w-0.5 rounded-r bg-neon-green shadow-neon-green" />
        )}
        <span className="text-lg" aria-hidden="true">
          {item.icon}
        </span>
        <span>{item.label}</span>
      </Link>
    </li>
  )
}

function SignedInCard({ name, joinDate, onClose }) {
  const joined = formatJoinDate(joinDate)
  return (
    <Link
      to={`/profile/${encodeURIComponent(name ?? '')}`}
      onClick={onClose}
      className="flex items-center gap-4 px-5 py-5 transition hover:bg-white/[0.04]"
    >
      <span
        className="grid place-items-center rounded-full p-[2px]"
        style={{
          background:
            'linear-gradient(135deg, var(--neon-green), var(--neon-cyan))',
        }}
      >
        <span className="grid place-items-center rounded-full bg-arcadia-bg">
          <Avatar name={name} size="lg" />
        </span>
      </span>
      <div className="min-w-0">
        <p className="neon-text truncate font-arcade text-[12px] text-neon-green">
          {name ?? 'Player'}
        </p>
        <p className="mt-1 flex items-center gap-1.5 font-arcade text-[9px] text-neon-green/85">
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-neon-green shadow-neon-green" />
          ONLINE
        </p>
        {joined && (
          <p className="mt-1 text-[10px] text-white/45">
            Member since {joined}
          </p>
        )}
      </div>
    </Link>
  )
}

function GuestCard({ name, onLogin }) {
  return (
    <div className="px-5 py-5">
      <div className="flex items-center gap-3">
        <Avatar name={name} size="lg" />
        <div className="min-w-0">
          <p className="truncate font-arcade text-[11px] text-white">
            {name ?? 'Guest'}
          </p>
          <p className="mt-1 text-[10px] text-white/45">Guest mode</p>
        </div>
      </div>
      <p className="mt-3 text-[11px] text-white/55">
        Sign in to save scores and add friends.
      </p>
      <button
        type="button"
        onClick={onLogin}
        className="mt-3 w-full rounded-md border border-neon-cyan/60 bg-neon-cyan/10 px-3 py-2 font-arcade text-[10px] text-neon-cyan transition hover:bg-neon-cyan/20 hover:shadow-neon-cyan"
      >
        ▶ LOGIN
      </button>
    </div>
  )
}

function SignedOutCard({ onLogin }) {
  return (
    <div className="px-5 py-5 text-center">
      <p className="font-arcade text-[10px] text-white/60">
        SIGN IN TO SAVE SCORES
      </p>
      <p className="mt-2 text-[11px] text-white/45">
        Track high scores, add friends, and play head-to-head.
      </p>
      <button
        type="button"
        onClick={onLogin}
        className="mt-3 w-full rounded-md border border-neon-cyan/60 bg-neon-cyan/10 px-3 py-2 font-arcade text-[10px] text-neon-cyan transition hover:bg-neon-cyan/20 hover:shadow-neon-cyan"
      >
        ▶ LOGIN
      </button>
    </div>
  )
}

function ProfileSkeleton() {
  return (
    <div className="flex items-center gap-3 px-5 py-5">
      <div className="h-16 w-16 animate-pulse rounded-full bg-white/5" />
      <div className="flex-1 space-y-2">
        <div className="h-3 w-2/3 animate-pulse rounded bg-white/5" />
        <div className="h-2 w-1/2 animate-pulse rounded bg-white/5" />
      </div>
    </div>
  )
}

// ===== Friends section =====

const TABS = ['ONLINE', 'REQUESTS', 'FIND']

function FriendsSection({ onClose, displayName, userId }) {
  const friendsCtx = useFriends() ?? {}
  const {
    friends = [],
    friendsLoading,
    pendingRequests = [],
    requestsLoading,
    refreshFriends,
    refreshPending,
    acceptRequest,
    declineOrRemove,
    sendRequest,
    isAlreadyFriend,
    isPendingOutgoing,
  } = friendsCtx

  const [tab, setTab] = useState('ONLINE')
  const [invitingFriendId, setInvitingFriendId] = useState(null)

  useEffect(() => {
    refreshFriends?.()
    refreshPending?.()
  }, [refreshFriends, refreshPending])

  const pendingCount = pendingRequests.length

  return (
    <section>
      {pendingCount > 0 && (
        <div className="px-5 pb-1 text-right">
          <span className="rounded-full bg-neon-pink px-1.5 py-0.5 font-arcade text-[8px] text-arcadia-bg">
            {pendingCount} pending
          </span>
        </div>
      )}

      <nav className="flex px-3" aria-label="Friends tabs">
        {TABS.map((t) => {
          const active = tab === t
          const badge = t === 'REQUESTS' && pendingCount > 0
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`relative flex-1 py-2 font-arcade text-[9px] transition ${
                active ? 'text-neon-cyan' : 'text-white/45 hover:text-white'
              }`}
            >
              {t}
              {badge && (
                <span className="ml-1 inline-block rounded-full bg-neon-pink px-1 py-0.5 text-[7px] text-arcadia-bg">
                  {pendingCount}
                </span>
              )}
              {active && (
                <span className="absolute inset-x-2 bottom-0 h-0.5 rounded bg-neon-cyan shadow-neon-cyan" />
              )}
            </button>
          )
        })}
      </nav>

      <div className="px-3 py-3">
        {tab === 'ONLINE' && (
          <OnlineList
            friends={friends}
            loading={friendsLoading}
            onClose={onClose}
            invitingFriendId={invitingFriendId}
            setInvitingFriendId={setInvitingFriendId}
            displayName={displayName}
            onRemove={(f) => {
              if (!window.confirm(`Remove ${f.username}?`)) return
              declineOrRemove?.(f.friendshipId, `Removed ${f.username}.`)
            }}
          />
        )}
        {tab === 'REQUESTS' && (
          <RequestsList
            requests={pendingRequests}
            loading={requestsLoading}
            onClose={onClose}
            onAccept={(r) => acceptRequest?.(r)}
            onDecline={(r) =>
              declineOrRemove?.(r.friendshipId, 'Request declined.')
            }
          />
        )}
        {tab === 'FIND' && (
          <FindList
            onClose={onClose}
            sendRequest={sendRequest}
            isAlreadyFriend={isAlreadyFriend}
            isPendingOutgoing={isPendingOutgoing}
            displayName={displayName}
            pendingRequests={pendingRequests}
          />
        )}
      </div>
    </section>
  )
}

function OnlineList({
  friends,
  loading,
  onClose,
  invitingFriendId,
  setInvitingFriendId,
  displayName,
  onRemove,
}) {
  const toast = useToast()
  const navigate = useNavigate()

  if (loading && friends.length === 0) return <Skeleton rows={3} />
  if (friends.length === 0) {
    return (
      <Empty>No friends yet. Use FIND to add players.</Empty>
    )
  }

  const handleInvite = async (friend, gameId) => {
    setInvitingFriendId(null)
    try {
      const res = await createRoom({ gameId, username: displayName })
      const roomCode = res?.code ?? res?.roomCode ?? res?.room_code
      if (!roomCode) {
        toast.error('Could not create room. Try again.')
        return
      }
      socket.emit('send_friend_invite', {
        toUserId: friend.userId,
        roomCode,
        gameId,
        fromUsername: displayName,
      })
      toast.success(`Invite sent to ${friend.username}.`)
      onClose?.()
      navigate(`/room/${roomCode}`)
    } catch (err) {
      toast.error(
        `Could not create room — ${err?.message ?? 'unknown error'}`,
      )
    }
  }

  return (
    <ul className="space-y-1">
      {friends.map((f) => {
        const expanded = invitingFriendId === f.userId
        return (
          <li
            key={f.userId ?? f.friendshipId ?? f.username}
            className="rounded-md border border-white/5 bg-white/[0.02]"
          >
            <div className="flex items-center gap-3 px-2 py-2">
              <Link
                to={`/profile/${encodeURIComponent(f.username ?? '')}`}
                onClick={onClose}
                className="flex min-w-0 flex-1 items-center gap-2"
              >
                <span
                  className={`inline-block h-2 w-2 rounded-full ${
                    f.isOnline
                      ? 'bg-neon-green shadow-neon-green'
                      : 'bg-white/20'
                  }`}
                />
                <span className="truncate font-arcade text-[10px] text-white">
                  {f.username}
                </span>
              </Link>
              {f.isOnline && (
                <button
                  type="button"
                  onClick={() =>
                    setInvitingFriendId(expanded ? null : f.userId)
                  }
                  className="rounded-md border border-neon-cyan/60 bg-neon-cyan/10 px-2 py-1 font-arcade text-[8px] text-neon-cyan hover:bg-neon-cyan/20 hover:shadow-neon-cyan"
                >
                  {expanded ? 'CANCEL' : 'INVITE'}
                </button>
              )}
              <button
                type="button"
                onClick={() => onRemove(f)}
                className="font-arcade text-[9px] text-white/35 hover:text-neon-pink"
                title="Remove friend"
              >
                ✕
              </button>
            </div>
            {expanded && (
              <div className="border-t border-white/5 px-2 py-2">
                <p className="font-arcade text-[8px] text-white/45 mb-1">
                  PICK A GAME
                </p>
                <div className="flex flex-col gap-1">
                  {MP_GAMES.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => handleInvite(f, g.id)}
                      className="flex items-center gap-2 rounded-md border border-white/10 bg-arcadia-surface/60 px-2 py-1.5 text-left transition hover:border-neon-pink/60 hover:text-neon-pink"
                    >
                      <g.Icon size={18} />
                      <span className="font-arcade text-[9px]">{g.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function RequestsList({ requests, loading, onClose, onAccept, onDecline }) {
  if (loading && requests.length === 0) return <Skeleton rows={3} />
  if (requests.length === 0) return <Empty>No pending requests.</Empty>

  return (
    <ul className="space-y-1">
      {requests.map((r) => (
        <li
          key={r.friendshipId ?? r.userId}
          className="flex items-center gap-2 rounded-md border border-white/5 bg-white/[0.02] px-2 py-2"
        >
          <Link
            to={`/profile/${encodeURIComponent(r.username ?? '')}`}
            onClick={onClose}
            className="min-w-0 flex-1 truncate font-arcade text-[10px] text-white"
          >
            {r.username}
          </Link>
          <button
            type="button"
            onClick={() => onAccept(r)}
            className="rounded-md border border-neon-green/60 bg-neon-green/10 px-2 py-1 font-arcade text-[8px] text-neon-green hover:bg-neon-green/20 hover:shadow-neon-green"
          >
            ACCEPT
          </button>
          <button
            type="button"
            onClick={() => onDecline(r)}
            className="rounded-md border border-white/15 px-2 py-1 font-arcade text-[8px] text-white/55 hover:border-neon-pink/60 hover:text-neon-pink"
          >
            DECLINE
          </button>
        </li>
      ))}
    </ul>
  )
}

function FindList({
  onClose,
  sendRequest,
  isAlreadyFriend,
  isPendingOutgoing,
  displayName,
  pendingRequests,
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    const q = query.trim()
    if (!q) {
      setResults([])
      setSearching(false)
      return
    }
    setSearching(true)
    setTouched(true)
    const id = setTimeout(async () => {
      try {
        const data = await searchUsers(q)
        setResults(
          (data ?? []).filter(
            (r) => r.username?.toLowerCase() !== displayName?.toLowerCase(),
          ),
        )
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => clearTimeout(id)
  }, [query, displayName])

  const incoming = new Set(pendingRequests.map((r) => r.username))

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="search username"
        className="w-full rounded-md border border-white/10 bg-arcadia-surface px-2 py-1.5 text-xs text-white placeholder:text-white/30 focus:border-neon-cyan focus:outline-none focus:ring-1 focus:ring-neon-cyan/40"
      />
      <div className="mt-2 min-h-[64px]">
        {!touched && (
          <Empty>Type a name to search players.</Empty>
        )}
        {touched && searching && <Skeleton rows={2} />}
        {touched && !searching && results.length === 0 && (
          <Empty>No players found.</Empty>
        )}
        {touched && !searching && results.length > 0 && (
          <ul className="space-y-1">
            {results.map((r) => {
              const isFriend = isAlreadyFriend?.(r.username)
              const isPending =
                isPendingOutgoing?.(r.username) || incoming.has(r.username)
              return (
                <li
                  key={r.userId ?? r.username}
                  className="flex items-center gap-2 rounded-md border border-white/5 bg-white/[0.02] px-2 py-2"
                >
                  <Link
                    to={`/profile/${encodeURIComponent(r.username ?? '')}`}
                    onClick={onClose}
                    className="min-w-0 flex-1 truncate font-arcade text-[10px] text-white"
                  >
                    {r.username}
                  </Link>
                  {isFriend ? (
                    <span className="rounded-md border border-neon-green/40 px-2 py-1 font-arcade text-[8px] text-neon-green">
                      FRIENDS
                    </span>
                  ) : isPending ? (
                    <span className="rounded-md border border-white/15 px-2 py-1 font-arcade text-[8px] text-white/55">
                      PENDING
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => sendRequest?.(r.username)}
                      className="rounded-md border border-neon-pink/60 bg-neon-pink/10 px-2 py-1 font-arcade text-[8px] text-neon-pink hover:bg-neon-pink/20 hover:shadow-neon-pink"
                    >
                      ADD
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

function Empty({ children }) {
  return (
    <p className="px-2 py-3 text-center text-[10px] text-white/40">
      {children}
    </p>
  )
}

function Skeleton({ rows }) {
  return (
    <div className="space-y-1">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-2 rounded-md border border-white/5 bg-white/[0.02] px-2 py-2"
        >
          <div className="h-2 w-2 animate-pulse rounded-full bg-white/10" />
          <div className="flex-1 space-y-1">
            <div className="h-2 w-2/3 animate-pulse rounded bg-white/10" />
          </div>
        </div>
      ))}
    </div>
  )
}
