import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useFriends } from '../context/FriendsContext'
import SideNavDrawer from './SideNavDrawer'

export default function Navbar() {
  const { user, isGuest, displayName, loading, openLogin, openSignup, signOut } =
    useAuth()
  const friendsCtx = useFriends()
  const onlineCount = friendsCtx?.onlineCount ?? 0
  const [navOpen, setNavOpen] = useState(false)
  const [countFlash, setCountFlash] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const prevCountRef = useRef(onlineCount)

  useEffect(() => {
    if (onlineCount !== prevCountRef.current) {
      prevCountRef.current = onlineCount
      setCountFlash(true)
      const t = setTimeout(() => setCountFlash(false), 500)
      return () => clearTimeout(t)
    }
  }, [onlineCount])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={`fixed inset-x-0 top-0 z-[100] border-b transition-[border-color,background-color] duration-300 ${
        scrolled
          ? 'border-neon-green/30 bg-[rgba(5,5,8,0.92)]'
          : 'border-neon-green/10 bg-[rgba(5,5,8,0.8)]'
      }`}
      style={{ backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 md:px-8">
        <div className="flex items-center gap-3 md:gap-5">
          <button
            type="button"
            onClick={() => setNavOpen(true)}
            className="grid h-10 w-10 place-items-center rounded-md border border-white/15 font-arcade text-xs text-white/70 transition hover:border-neon-green/60 hover:text-neon-green"
            aria-label="Open navigation"
          >
            ☰
          </button>
          <Link
            to="/"
            className="neon-text inline-flex items-center gap-2 font-arcade text-base text-neon-green md:text-xl"
          >
            <span aria-hidden="true" className="text-neon-cyan">
              ★
            </span>
            ARCADIA
          </Link>
        </div>

        <SideNavDrawer open={navOpen} onClose={() => setNavOpen(false)} />

        <div className="flex items-center gap-3 md:gap-5">
          <span
            className={`glass-panel hidden items-center gap-2 px-3 py-1.5 font-arcade text-[10px] text-neon-cyan transition-shadow sm:inline-flex ${
              countFlash ? 'shadow-neon-cyan' : ''
            }`}
            style={{ borderRadius: 8 }}
            aria-label="players online"
          >
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-neon-green shadow-neon-green" />
            <span
              key={onlineCount}
              className="badge-flip inline-block tabular-nums text-neon-green"
            >
              {onlineCount}
            </span>{' '}
            <span className="text-white/65">PLAYERS ONLINE</span>
          </span>

          {loading ? (
            <div className="h-7 w-24 animate-pulse rounded-md bg-white/5" />
          ) : user ? (
            <SignedIn name={displayName} onSignOut={signOut} />
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

function SignedIn({ name, onSignOut }) {
  return (
    <div className="flex items-center gap-3">
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
