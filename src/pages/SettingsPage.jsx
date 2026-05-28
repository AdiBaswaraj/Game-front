import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

const SOUND_KEY = 'arcadia:soundEnabled'

export default function SettingsPage() {
  useDocumentTitle('Settings')
  const { user, displayName, signOut } = useAuth()
  const [sound, setSound] = useState(
    () => localStorage.getItem(SOUND_KEY) !== '0',
  )

  const toggleSound = () => {
    const next = !sound
    setSound(next)
    localStorage.setItem(SOUND_KEY, next ? '1' : '0')
  }

  return (
    <div className="route-fade-in relative min-h-screen bg-arcadia-bg text-white">
      <header className="sticky top-0 z-30 border-b border-neon-green/30 bg-arcadia-bg/85 shadow-[0_1px_0_0_rgba(0,255,136,0.2)] backdrop-blur-md">
        <div className="mx-auto grid max-w-7xl grid-cols-[1fr_auto_1fr] items-center px-4 py-4 md:px-8">
          <Link
            to="/"
            className="flex items-center gap-2 justify-self-start font-arcade text-[10px] text-neon-cyan transition hover:text-neon-green md:text-xs"
          >
            <span aria-hidden="true">◀</span>
            LOBBY
          </Link>
          <h1 className="justify-self-center font-arcade text-sm text-neon-green drop-shadow-[0_0_8px_rgba(0,255,136,0.4)] md:text-lg">
            <span className="mr-2">⚙</span>
            SETTINGS
          </h1>
          <span className="justify-self-end" />
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-6 px-4 py-10 md:px-8 md:py-14">
        <section className="rounded-xl border border-white/10 bg-arcadia-surface/60 p-5">
          <h2 className="font-arcade text-xs text-neon-cyan">ACCOUNT</h2>
          {user ? (
            <div className="mt-4 space-y-2">
              <Row label="Name">
                <Link
                  to={`/profile/${encodeURIComponent(displayName ?? '')}`}
                  className="text-neon-green hover:underline"
                >
                  {displayName}
                </Link>
              </Row>
              <Row label="Email">
                <span className="text-white/70">
                  {user.email ?? '—'}
                </span>
              </Row>
              <button
                type="button"
                onClick={signOut}
                className="mt-4 rounded-md border border-neon-pink/60 bg-neon-pink/10 px-4 py-2 font-arcade text-[10px] text-neon-pink hover:bg-neon-pink/20 hover:shadow-neon-pink"
              >
                SIGN OUT
              </button>
            </div>
          ) : (
            <p className="mt-3 text-xs text-white/45">
              Not signed in. Login from the lobby to access account
              settings.
            </p>
          )}
        </section>

        <section className="rounded-xl border border-white/10 bg-arcadia-surface/60 p-5">
          <h2 className="font-arcade text-xs text-neon-cyan">PREFERENCES</h2>
          <div className="mt-4 space-y-2">
            <ToggleRow
              label="Game sound effects"
              hint="Reserved for future builds. No sounds ship today."
              value={sound}
              onChange={toggleSound}
            />
          </div>
        </section>

        <section className="rounded-xl border border-white/10 bg-arcadia-surface/60 p-5">
          <h2 className="font-arcade text-xs text-neon-cyan">ABOUT</h2>
          <p className="mt-3 text-xs leading-relaxed text-white/55">
            Arcadia is an open-source arcade platform.
            <br />
            <span className="text-white/35">v0.9 · 2026</span>
          </p>
        </section>
      </main>
    </div>
  )
}

function Row({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="font-arcade text-[10px] text-white/50">{label}</span>
      <span className="text-sm">{children}</span>
    </div>
  )
}

function ToggleRow({ label, hint, value, onChange }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm text-white">{label}</p>
        {hint && <p className="text-[10px] text-white/35">{hint}</p>}
      </div>
      <button
        type="button"
        onClick={onChange}
        className={`relative h-6 w-11 rounded-full border transition ${
          value
            ? 'border-neon-green/70 bg-neon-green/30 shadow-neon-green'
            : 'border-white/15 bg-white/5'
        }`}
        aria-pressed={value}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${
            value ? 'left-6 bg-neon-green' : 'left-0.5'
          }`}
        />
      </button>
    </div>
  )
}
