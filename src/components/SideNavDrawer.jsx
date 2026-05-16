import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const navItems = ({ displayName, openLogin, signOut }) => [
  { to: '/', icon: '🏠', label: 'HOME' },
  { to: '/leaderboard', icon: '🏆', label: 'HALL OF FAME' },
  displayName
    ? {
        to: `/profile/${encodeURIComponent(displayName)}`,
        icon: '👤',
        label: 'PROFILE',
      }
    : { type: 'action', icon: '👤', label: 'LOGIN', onClick: openLogin },
  { to: '/settings', icon: '⚙', label: 'SETTINGS' },
  displayName && {
    type: 'action',
    icon: '↩',
    label: 'SIGN OUT',
    onClick: signOut,
    accent: 'pink',
  },
].filter(Boolean)

export default function SideNavDrawer({ open, onClose }) {
  const { displayName, openLogin, signOut } = useAuth()

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const items = navItems({ displayName, openLogin, signOut })

  return (
    <>
      <div
        className={`fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm transition-opacity duration-200 ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
      />
      <aside
        className={`fixed inset-y-0 left-0 z-[80] flex w-72 flex-col border-r-2 border-neon-green/50 bg-arcadia-bg shadow-[0_0_40px_-10px_rgba(0,255,136,0.5)] transition-transform duration-300 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Navigation"
        aria-hidden={!open}
      >
        <header className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <span className="font-arcade text-sm text-neon-green drop-shadow-[0_0_8px_rgba(0,255,136,0.5)]">
            ★ ARCADIA
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 font-arcade text-xs text-white/50 transition hover:text-neon-pink"
            aria-label="Close nav"
          >
            ✕
          </button>
        </header>
        <nav className="flex-1 overflow-y-auto py-2">
          <ul className="divide-y divide-white/5">
            {items.map((item, i) =>
              item.type === 'action' ? (
                <li key={`${item.label}-${i}`}>
                  <button
                    type="button"
                    onClick={() => {
                      onClose()
                      item.onClick?.()
                    }}
                    className={`flex w-full items-center gap-4 px-5 py-4 font-arcade text-[11px] transition hover:bg-white/5 ${
                      item.accent === 'pink'
                        ? 'text-neon-pink hover:text-neon-pink'
                        : 'text-white/75 hover:text-neon-cyan'
                    }`}
                  >
                    <span className="text-lg" aria-hidden="true">
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </button>
                </li>
              ) : (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    onClick={onClose}
                    className="flex items-center gap-4 px-5 py-4 font-arcade text-[11px] text-white/75 transition hover:bg-white/5 hover:text-neon-cyan"
                  >
                    <span className="text-lg" aria-hidden="true">
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </Link>
                </li>
              ),
            )}
          </ul>
        </nav>
        <footer className="border-t border-white/5 px-5 py-3 text-center font-arcade text-[9px] text-white/30">
          © ARCADIA 2026
        </footer>
      </aside>
    </>
  )
}
