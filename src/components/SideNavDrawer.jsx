import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Avatar from './Avatar'

const NAV_LINKS = [
  { to: '/', icon: '🏠', label: 'HOME' },
  { to: '/leaderboard', icon: '🏆', label: 'HALL OF FAME' },
  { to: '/settings', icon: '⚙', label: 'SETTINGS' },
]

function formatJoinDate(s) {
  if (!s) return null
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
}

export default function SideNavDrawer({ open, onClose }) {
  // Be defensive — never let a missing/null auth context crash the drawer.
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

  // SSR safety
  if (typeof document === 'undefined') return null

  const handleLogin = () => {
    onClose()
    openLogin?.()
  }
  const handleSignOut = () => {
    onClose()
    signOut?.()
  }

  // Render via portal directly into <body>. Some ancestors (sticky nav,
  // transformed wrappers) can create containing blocks that re-anchor
  // position:fixed children — portaling sidesteps that entirely.
  const drawer = (
    <>
      <div
        onClick={onClose}
        className={`fixed inset-0 z-[1000] bg-black/60 backdrop-blur-sm transition-opacity duration-200 ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />
      <aside
        aria-label="Navigation"
        aria-hidden={!open}
        className={`fixed inset-y-0 left-0 z-[1010] flex w-72 max-w-[85vw] flex-col border-r-2 border-neon-green/50 bg-arcadia-bg text-white shadow-[0_0_40px_-10px_rgba(0,255,136,0.5)] transition-transform duration-300 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <header className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-4">
          <span className="font-arcade text-sm text-neon-green drop-shadow-[0_0_8px_rgba(0,255,136,0.5)]">
            ★ ARCADIA
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 font-arcade text-xs text-white/50 transition hover:text-neon-pink"
            aria-label="Close navigation"
          >
            ✕
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {/* TEMP DEBUG MARKER — remove once panel is verified */}
          <div
            data-debug="sidenav-marker"
            style={{
              background: '#ff006e',
              color: '#0a0a0f',
              padding: '6px 12px',
              fontSize: 10,
              textAlign: 'center',
              fontFamily: '"Press Start 2P", monospace',
              letterSpacing: 1,
            }}
          >
            PANEL CONTENT TEST
          </div>

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

          <nav aria-label="Primary">
            <ul className="border-t border-white/5">
              {NAV_LINKS.map((item) => (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    onClick={onClose}
                    className="flex items-center gap-4 px-5 py-4 font-arcade text-[11px] text-white/80 transition hover:bg-white/5 hover:text-neon-cyan"
                  >
                    <span className="text-lg" aria-hidden="true">
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        {user && (
          <button
            type="button"
            onClick={handleSignOut}
            className="flex shrink-0 items-center gap-4 border-t border-white/10 px-5 py-4 font-arcade text-[11px] text-neon-pink transition hover:bg-white/5"
          >
            <span className="text-lg" aria-hidden="true">↩</span>
            <span>SIGN OUT</span>
          </button>
        )}

        <footer className="shrink-0 border-t border-white/5 px-5 py-3 text-center font-arcade text-[9px] text-white/30">
          © ARCADIA 2026
        </footer>
      </aside>
    </>
  )

  return createPortal(drawer, document.body)
}

function SignedInCard({ name, joinDate, onClose }) {
  const joined = formatJoinDate(joinDate)
  return (
    <Link
      to={`/profile/${encodeURIComponent(name ?? '')}`}
      onClick={onClose}
      className="flex items-center gap-3 border-b border-white/5 px-5 py-5 transition hover:bg-white/5"
    >
      <Avatar name={name} size="lg" />
      <div className="min-w-0">
        <p className="truncate font-arcade text-[12px] text-neon-green drop-shadow-[0_0_6px_rgba(0,255,136,0.4)]">
          {name ?? 'Player'}
        </p>
        {joined && (
          <p className="mt-1 text-[10px] text-white/45">Member since {joined}</p>
        )}
        <p className="mt-1 font-arcade text-[9px] text-neon-cyan/80">
          VIEW PROFILE →
        </p>
      </div>
    </Link>
  )
}

function GuestCard({ name, onLogin }) {
  return (
    <div className="border-b border-white/5 px-5 py-5">
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
    <div className="border-b border-white/5 px-5 py-5 text-center">
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
    <div className="flex items-center gap-3 border-b border-white/5 px-5 py-5">
      <div className="h-16 w-16 animate-pulse rounded-full bg-white/5" />
      <div className="flex-1 space-y-2">
        <div className="h-3 w-2/3 animate-pulse rounded bg-white/5" />
        <div className="h-2 w-1/2 animate-pulse rounded bg-white/5" />
      </div>
    </div>
  )
}
