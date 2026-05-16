import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useFriends } from '../context/FriendsContext'
import { searchUsers } from '../lib/api'
import Avatar from './Avatar'

const TABS = ['FRIENDS', 'REQUESTS', 'FIND']

export default function FriendsDrawer() {
  const {
    drawerOpen,
    closeDrawer,
    friends,
    friendsLoading,
    pendingRequests,
    requestsLoading,
    refreshFriends,
    refreshPending,
    acceptRequest,
    declineOrRemove,
    openInviteModal,
  } = useFriends()
  const [tab, setTab] = useState('FRIENDS')

  useEffect(() => {
    if (!drawerOpen) return
    setTab('FRIENDS')
    refreshFriends()
    refreshPending()
  }, [drawerOpen, refreshFriends, refreshPending])

  useEffect(() => {
    if (!drawerOpen) return
    const onKey = (e) => {
      if (e.key === 'Escape') closeDrawer()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [drawerOpen, closeDrawer])

  return (
    <>
      <div
        className={`fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm transition-opacity duration-200 ${
          drawerOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={closeDrawer}
      />
      <aside
        className={`fixed inset-y-0 right-0 z-[80] flex w-full flex-col border-l-2 border-neon-cyan/50 bg-arcadia-bg shadow-[0_0_40px_-10px_rgba(0,212,255,0.5)] transition-transform duration-300 sm:w-96 ${
          drawerOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        aria-label="Friends"
        aria-hidden={!drawerOpen}
      >
        <header className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h2 className="font-arcade text-sm text-neon-cyan drop-shadow-[0_0_8px_rgba(0,212,255,0.5)]">
            ★ FRIENDS
          </h2>
          <button
            type="button"
            onClick={closeDrawer}
            className="rounded p-1 font-arcade text-xs text-white/50 transition hover:text-neon-pink"
            aria-label="Close drawer"
          >
            ✕
          </button>
        </header>

        <nav className="flex border-b border-white/10 px-2">
          {TABS.map((t) => {
            const active = tab === t
            const badge = t === 'REQUESTS' && pendingRequests.length > 0
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`relative flex-1 py-3 font-arcade text-[10px] transition ${
                  active
                    ? 'text-neon-cyan'
                    : 'text-white/45 hover:text-white'
                }`}
              >
                {t}
                {badge && (
                  <span className="ml-1.5 inline-block rounded-full bg-neon-pink px-1.5 py-0.5 text-[8px] text-arcadia-bg">
                    {pendingRequests.length}
                  </span>
                )}
                {active && (
                  <span className="absolute inset-x-2 bottom-0 h-0.5 rounded bg-neon-cyan shadow-neon-cyan" />
                )}
              </button>
            )
          })}
        </nav>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {tab === 'FRIENDS' && (
            <FriendsList
              friends={friends}
              loading={friendsLoading}
              onInvite={openInviteModal}
              onRemove={(f) => {
                if (!window.confirm(`Remove ${f.username}?`)) return
                declineOrRemove(f.friendshipId, `Removed ${f.username}.`)
              }}
              onProfile={closeDrawer}
            />
          )}
          {tab === 'REQUESTS' && (
            <RequestsList
              requests={pendingRequests}
              loading={requestsLoading}
              onAccept={acceptRequest}
              onDecline={(r) => declineOrRemove(r.friendshipId, 'Request declined.')}
              onProfile={closeDrawer}
            />
          )}
          {tab === 'FIND' && <FindTab onProfile={closeDrawer} />}
        </div>
      </aside>
    </>
  )
}

function FriendsList({ friends, loading, onInvite, onRemove, onProfile }) {
  if (loading && friends.length === 0) {
    return <SkeletonList rows={4} />
  }
  if (friends.length === 0) {
    return (
      <EmptyState>
        No friends yet. Find players in the FIND tab.
      </EmptyState>
    )
  }
  return (
    <ul className="divide-y divide-white/5">
      {friends.map((f) => (
        <li
          key={f.userId ?? f.friendshipId ?? f.username}
          className="flex items-center gap-3 px-4 py-3"
        >
          <Link
            to={`/profile/${encodeURIComponent(f.username)}`}
            onClick={onProfile}
            className="flex min-w-0 flex-1 items-center gap-3"
          >
            <Avatar name={f.username} size="md" online={f.isOnline} />
            <span className="min-w-0">
              <span className="block truncate font-arcade text-[11px] text-white">
                {f.username}
              </span>
              <span
                className={`block text-[10px] ${
                  f.isOnline ? 'text-neon-green' : 'text-white/35'
                }`}
              >
                {f.isOnline ? 'ONLINE' : 'OFFLINE'}
              </span>
            </span>
          </Link>
          <div className="flex flex-col gap-1.5">
            {f.isOnline && (
              <button
                type="button"
                onClick={() => onInvite(f)}
                className="rounded-md border border-neon-cyan/60 bg-neon-cyan/10 px-3 py-1 font-arcade text-[9px] text-neon-cyan transition hover:bg-neon-cyan/20 hover:shadow-neon-cyan"
              >
                INVITE
              </button>
            )}
            <button
              type="button"
              onClick={() => onRemove(f)}
              className="rounded-md border border-white/15 px-3 py-1 font-arcade text-[9px] text-white/55 transition hover:border-neon-pink/60 hover:text-neon-pink"
            >
              REMOVE
            </button>
          </div>
        </li>
      ))}
    </ul>
  )
}

function RequestsList({ requests, loading, onAccept, onDecline, onProfile }) {
  if (loading && requests.length === 0) {
    return <SkeletonList rows={3} />
  }
  if (requests.length === 0) {
    return <EmptyState>No pending requests.</EmptyState>
  }
  return (
    <ul className="divide-y divide-white/5">
      {requests.map((r) => (
        <li
          key={r.friendshipId ?? r.userId}
          className="flex items-center gap-3 px-4 py-3"
        >
          <Link
            to={`/profile/${encodeURIComponent(r.username)}`}
            onClick={onProfile}
            className="flex min-w-0 flex-1 items-center gap-3"
          >
            <Avatar name={r.username} size="md" />
            <span className="min-w-0">
              <span className="block truncate font-arcade text-[11px] text-white">
                {r.username}
              </span>
              <span className="block text-[10px] text-white/40">
                Wants to be friends
              </span>
            </span>
          </Link>
          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              onClick={() => onAccept(r)}
              className="rounded-md border border-neon-green/60 bg-neon-green/10 px-3 py-1 font-arcade text-[9px] text-neon-green transition hover:bg-neon-green/20 hover:shadow-neon-green"
            >
              ACCEPT
            </button>
            <button
              type="button"
              onClick={() => onDecline(r)}
              className="rounded-md border border-white/15 px-3 py-1 font-arcade text-[9px] text-white/55 transition hover:border-neon-pink/60 hover:text-neon-pink"
            >
              DECLINE
            </button>
          </div>
        </li>
      ))}
    </ul>
  )
}

function FindTab({ onProfile }) {
  const { user, displayName } = useAuth()
  const {
    friends,
    pendingRequests,
    isAlreadyFriend,
    isPendingOutgoing,
    sendRequest,
  } = useFriends()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [touched, setTouched] = useState(false)

  // Debounced search
  useEffect(() => {
    const q = query.trim()
    if (!q) {
      setResults([])
      setSearching(false)
      return
    }
    setSearching(true)
    setTouched(true)
    const handle = setTimeout(async () => {
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
    return () => clearTimeout(handle)
  }, [query, displayName])

  const incomingUsernames = new Set(pendingRequests.map((r) => r.username))

  return (
    <div className="flex flex-col">
      <div className="border-b border-white/10 p-3">
        <label className="block">
          <span className="font-arcade text-[9px] text-white/40">
            SEARCH BY USERNAME
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. Player_4821"
            className="mt-1 w-full rounded-md border border-white/10 bg-arcadia-surface px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-neon-cyan focus:outline-none focus:ring-1 focus:ring-neon-cyan/40"
          />
        </label>
      </div>
      <div className="min-h-0 flex-1">
        {!touched && (
          <EmptyState>
            Type a username to search.
            <br />
            <span className="text-[9px] text-white/30">
              Note: /api/friends/search may not be live yet — falls back to
              Supabase profiles search.
            </span>
          </EmptyState>
        )}
        {touched && searching && <SkeletonList rows={3} />}
        {touched && !searching && results.length === 0 && (
          <EmptyState>No players found.</EmptyState>
        )}
        {touched && !searching && results.length > 0 && (
          <ul className="divide-y divide-white/5">
            {results.map((r) => {
              const isFriend = isAlreadyFriend(r.username)
              const isPending =
                isPendingOutgoing(r.username) || incomingUsernames.has(r.username)
              const isSelf =
                r.username?.toLowerCase() === displayName?.toLowerCase()
              if (isSelf) return null
              return (
                <li
                  key={r.userId ?? r.username}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  <Link
                    to={`/profile/${encodeURIComponent(r.username)}`}
                    onClick={onProfile}
                    className="flex min-w-0 flex-1 items-center gap-3"
                  >
                    <Avatar name={r.username} size="md" />
                    <span className="block min-w-0 truncate font-arcade text-[11px] text-white">
                      {r.username}
                    </span>
                  </Link>
                  {isFriend ? (
                    <span className="rounded-md border border-neon-green/40 px-3 py-1 font-arcade text-[9px] text-neon-green">
                      FRIENDS
                    </span>
                  ) : isPending ? (
                    <span className="rounded-md border border-white/15 px-3 py-1 font-arcade text-[9px] text-white/55">
                      PENDING
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => sendRequest(r.username)}
                      disabled={!user}
                      className="rounded-md border border-neon-pink/60 bg-neon-pink/10 px-3 py-1 font-arcade text-[9px] text-neon-pink transition hover:bg-neon-pink/20 hover:shadow-neon-pink disabled:opacity-50"
                    >
                      ADD FRIEND
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

function EmptyState({ children }) {
  return (
    <div className="flex h-full min-h-[200px] items-center justify-center px-6 text-center text-xs leading-relaxed text-white/45">
      {children}
    </div>
  )
}

function SkeletonList({ rows }) {
  return (
    <ul className="divide-y divide-white/5">
      {Array.from({ length: rows }).map((_, i) => (
        <li key={i} className="flex items-center gap-3 px-4 py-3">
          <div className="h-10 w-10 animate-pulse rounded-full bg-white/10" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-2/3 animate-pulse rounded bg-white/10" />
            <div className="h-2 w-1/3 animate-pulse rounded bg-white/5" />
          </div>
        </li>
      ))}
    </ul>
  )
}
