import { Link, useNavigate } from 'react-router-dom'
import { ModeRobotIcon } from '../../assets/icons/index.jsx'

const LEVELS = [
  { id: 'easy',   label: 'EASY',   accent: 'green', tag: 'Beginner — makes blunders' },
  { id: 'medium', label: 'MEDIUM', accent: 'cyan',  tag: 'Casual — misses tactics' },
  { id: 'hard',   label: 'HARD',   accent: 'pink',  tag: 'Club player — challenging' },
]

const ACCENTS = {
  green:
    'border-neon-green/60 hover:border-neon-green hover:shadow-neon-green text-neon-green',
  cyan: 'border-neon-cyan/60 hover:border-neon-cyan hover:shadow-neon-cyan text-neon-cyan',
  pink: 'border-neon-pink/60 hover:border-neon-pink hover:shadow-neon-pink text-neon-pink',
}

export default function ChessDifficultySelect() {
  const navigate = useNavigate()

  return (
    <div className="relative min-h-screen bg-arcadia-bg text-white">
      <header className="sticky top-0 z-30 border-b" style={{ background: "rgba(5, 5, 8, 0.9)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", borderBottomColor: "rgba(0, 255, 136, 0.1)" }}>
        <div className="mx-auto grid max-w-7xl grid-cols-[1fr_auto_1fr] items-center px-4 py-4 md:px-8">
          <Link
            to="/game/chess"
            className="flex items-center gap-2 justify-self-start font-arcade text-[10px] text-neon-cyan transition hover:text-neon-green md:text-xs"
          >
            <span aria-hidden="true">◀</span>
            MODE
          </Link>
          <h1 className="inline-flex items-center justify-self-center gap-2 font-arcade text-sm text-neon-green drop-shadow-[0_0_8px_rgba(0,255,136,0.4)] md:text-lg">
            <ModeRobotIcon size={22} aria-hidden="true" />
            <span>BOT DIFFICULTY</span>
          </h1>
          <span className="justify-self-end" />
        </div>
      </header>

      <main className="mx-auto flex max-w-3xl flex-col items-center px-4 py-12 md:py-20">
        <p className="font-arcade text-[10px] text-white/45 md:text-xs">
          SELECT DIFFICULTY
        </p>
        <div className="mt-8 grid w-full grid-cols-1 gap-4 sm:grid-cols-3">
          {LEVELS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => navigate(`/game/chess/computer/${opt.id}`)}
              className={`group flex flex-col items-center gap-3 rounded-xl border-2 bg-arcadia-surface/70 p-6 transition-all duration-200 hover:-translate-y-1 ${ACCENTS[opt.accent]}`}
            >
              <span className="font-arcade text-lg">{opt.label}</span>
              <span className="text-xs uppercase tracking-widest text-white/45">
                {opt.tag}
              </span>
            </button>
          ))}
        </div>
        <p className="mt-8 text-center text-[10px] text-white/35">
          Engine runs in your browser. No leaderboard for VS BOT.
        </p>
      </main>
    </div>
  )
}
