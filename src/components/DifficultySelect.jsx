import { Link, useNavigate } from 'react-router-dom'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

const ACCENT_BY_DIFF = {
  easy: {
    border: 'border-neon-green/60 hover:border-neon-green',
    glow: 'hover:shadow-neon-green',
    text: 'text-neon-green',
  },
  medium: {
    border: 'border-neon-cyan/60 hover:border-neon-cyan',
    glow: 'hover:shadow-neon-cyan',
    text: 'text-neon-cyan',
  },
  hard: {
    border: 'border-neon-pink/60 hover:border-neon-pink',
    glow: 'hover:shadow-neon-pink',
    text: 'text-neon-pink',
  },
}

const DEFAULT_OPTIONS = [
  { id: 'easy', label: 'EASY', tag: 'Take it slow' },
  { id: 'medium', label: 'MEDIUM', tag: 'For regulars' },
  { id: 'hard', label: 'HARD', tag: 'Bring tissues' },
]

export default function DifficultySelect({
  title,
  icon,
  gameId,
  options = DEFAULT_OPTIONS,
}) {
  const navigate = useNavigate()
  useDocumentTitle(`${title} — Difficulty`)

  return (
    <div className="scanlines relative min-h-screen bg-arcadia-bg text-white">
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
            {icon && <span className="mr-2">{icon}</span>}
            {title}
          </h1>
          <span className="justify-self-end" />
        </div>
      </header>

      <main className="mx-auto flex max-w-3xl flex-col items-center px-4 py-12 md:py-20">
        <p className="font-arcade text-[10px] text-white/45 md:text-xs">
          SELECT DIFFICULTY
        </p>
        <div className="mt-8 grid w-full grid-cols-1 gap-4 sm:grid-cols-3">
          {options.map((opt) => {
            const a = ACCENT_BY_DIFF[opt.id] ?? ACCENT_BY_DIFF.easy
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => navigate(`/game/${gameId}/${opt.id}`)}
                className={`group flex flex-col items-center gap-3 rounded-xl border-2 bg-arcadia-surface/70 p-6 transition-all duration-200 hover:-translate-y-1 ${a.border} ${a.glow}`}
              >
                <span className={`font-arcade text-lg ${a.text}`}>
                  {opt.label}
                </span>
                <span className="text-xs uppercase tracking-widest text-white/45">
                  {opt.tag}
                </span>
              </button>
            )
          })}
        </div>
      </main>
    </div>
  )
}
