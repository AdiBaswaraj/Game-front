import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useFriends } from '../context/FriendsContext'
import SideNavDrawer from './SideNavDrawer'

export default function Navbar({ playersOnline = 0 }) {
  const { user, isGuest, displayName, loading, openLogin, openSignup, signOut } =
    useAuth()
  const friendsCtx = useFriends()
  const pendingCount = friendsCtx?.pendingRequests?.length ?? 0
  const [navOpen, setNavOpen] = useState(false)

  return (
    <header className="sticky top-0 z-40 border-b border-neon-green/40 bg-arcadia-bg/85 shadow-[0_1px_0_0_rgba(0,255,136,0.25),0_10px_30px_-20px_rgba(0,255,136,0.5)] backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 md:px-8">
        <div className="flex items-center gap-3 md:gap-5">
          <button
            type="button"
            onClick={() => setNavOpen(true)}
            className="rounded-md border border-white/15 px-2.5 py-1.5 font-arcade text-xs text-white/70 transition hover:border-neon-green/60 hover:text-neon-green"
            aria-label="Open navigation"
          >
            ☰
          </button>
          <Link
            to="/"
            className="font-arcade text-base text-neon-green drop-shadow-[0_0_8px_rgba(0,255,136,0.6)] md:text-xl"
          >
            ARCADIA
          </Link>
          <Link
            to="/leaderboard"
            className="hidden items-center gap-1.5 font-arcade text-[10px] text-white/65 transition hover:text-neon-cyan sm:flex md:text-xs"
          >
            <span aria-hidden="true">🏆</span>
            <span>HALL OF FAME</span>
          </Link>
        </div>

        <SideNavDrawer open={navOpen} onClose={() => setNavOpen(false)} />

        <div className="flex items-center gap-3 md:gap-5">
          <span
            className="hidden items-center gap-2 rounded-md border border-neon-cyan/40 bg-neon-cyan/5 px-3 py-1.5 font-arcade text-[10px] text-neon-cyan sm:inline-flex"
            aria-label="players online"
          >
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-neon-cyan shadow-neon-cyan" />
            {playersOnline} PLAYERS ONLINE
          </span>

          {loading ? (
            <div className="h-7 w-24 animate-pulse rounded-md bg-white/5" />
          ) : user ? (
            <SignedIn
              name={displayName}
              onSignOut={signOut}
              onOpenFriends={friendsCtx?.openDrawer}
              pendingCount={pendingCount}
            />
          ) : isGuest ? (
            <GuestBadge
              name={displayName}
              onLogin={openLogin}
              onSignOut={signOut}
            />
          ) : (
            <LoggedOut onLogin={openLogin} onSignup={openSignup} />
          )}
        </div>
      </div>
    </header>
  )
}

function SignedIn({ name, onSignOut, onOpenFriends, pendingCount }) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onOpenFriends}
        className="relative rounded-md border border-white/15 px-3 py-1.5 font-arcade text-[10px] text-white/75 transition hover:border-neon-cyan/60 hover:text-neon-cyan"
        aria-label="Open friends panel"
      >
        <span aria-hidden="true">👥</span>
        <span className="ml-1 hidden sm:inline">FRIENDS</span>
        {pendingCount > 0 && (
          <span className="absolute -right-1.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-neon-pink px-1 text-[8px] font-bold text-arcadia-bg shadow-neon-pink">
            {pendingCount}
          </span>
        )}
      </button>
      <Link
        to={`/profile/${encodeURIComponent(name ?? '')}`}
        className="hidden font-arcade text-[10px] text-neon-green transition hover:text-neon-cyan sm:inline"
      >
        {truncate(name, 14)}
      </Link>
      <button
        type="button"
        onClick={onSignOut}
        className="rounded-md border border-neon-pink/60 bg-neon-pink/10 px-3 py-1.5 font-arcade text-[10px] text-neon-pink transition hover:bg-neon-pink/20 hover:shadow-neon-pink md:text-xs"
      >
        SIGN OUT
      </button>
    </div>
  )
}

function GuestBadge({ name, onLogin, onSignOut }) {
  return (
    <div className="flex items-center gap-3">
      <div className="hidden flex-col items-end leading-tight sm:flex">
        <span className="font-arcade text-[10px] text-white/70">
          {truncate(name, 14)}
        </span>
        <button
          type="button"
          onClick={onLogin}
          className="font-arcade text-[8px] text-neon-cyan/80 transition hover:text-neon-cyan"
        >
          LOGIN TO SAVE SCORES
        </button>
      </div>
      <button
        type="button"
        onClick={onLogin}
        className="font-arcade text-[10px] text-neon-cyan transition hover:text-neon-cyan sm:hidden"
      >
        LOGIN
      </button>
      <button
        type="button"
        onClick={onSignOut}
        className="font-arcade text-[10px] text-white/40 transition hover:text-neon-pink"
        title="Exit guest mode"
      >
        ✕
      </button>
    </div>
  )
}

function LoggedOut({ onLogin, onSignup }) {
  return (
    <>
      <button
        type="button"
        onClick={onLogin}
        className="font-arcade text-[10px] text-white/80 transition hover:text-neon-cyan md:text-xs"
      >
        LOGIN
      </button>
      <button
        type="button"
        onClick={onSignup}
        className="rounded-md border border-neon-pink/70 bg-neon-pink/10 px-3 py-1.5 font-arcade text-[10px] text-neon-pink transition hover:bg-neon-pink/20 hover:shadow-neon-pink md:text-xs"
      >
        SIGN UP
      </button>
    </>
  )
}

function truncate(s, n) {
  if (!s) return ''
  return s.length > n ? `${s.slice(0, n - 1)}…` : s
}
