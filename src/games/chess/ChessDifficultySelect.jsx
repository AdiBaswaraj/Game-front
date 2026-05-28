import { Link, useNavigate } from 'react-router-dom'

const LEVELS = [
  { id: 'easy', label: 'EASY', accent: 'green', tag: 'Depth 2 · Stockfish' },
  { id: 'medium', label: 'MEDIUM', accent: 'cyan', tag: 'Depth 6 · Stockfish' },
  { id: 'hard', label: 'HARD', accent: 'pink', tag: 'Depth 14 · Stockfish' },
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
      <header className="sticky top-0 z-30 border-b border-neon-green/30 bg-arcadia-bg/85 shadow-[0_1px_0_0_rgba(0,255,136,0.2)] backdrop-blur-md">
        <div className="mx-auto grid max-w-7xl grid-cols-[1fr_auto_1fr] items-center px-4 py-4 md:px-8">
          <Link
            to="/game/chess"
            className="flex items-center gap-2 justify-self-start font-arcade text-[10px] text-neon-cyan transition hover:text-neon-green md:text-xs"
          >
            <span aria-hidden="true">◀</span>
            MODE
          </Link>
          <h1 className="justify-self-center font-arcade text-sm text-neon-green drop-shadow-[0_0_8px_rgba(0,255,136,0.4)] md:text-lg">
            <span className="mr-2">🤖</span>
            CHESS VS COMPUTER
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
          Engine runs in your browser. No leaderboard for VS COMPUTER.
        </p>
      </main>
    </div>
  )
}
