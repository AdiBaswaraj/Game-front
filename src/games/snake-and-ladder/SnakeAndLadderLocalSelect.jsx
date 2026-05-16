import { Link, useNavigate } from 'react-router-dom'

const COUNTS = [
  { n: 2, label: '2 PLAYERS', accent: 'green' },
  { n: 3, label: '3 PLAYERS', accent: 'cyan' },
  { n: 4, label: '4 PLAYERS', accent: 'pink' },
]

const ACCENTS = {
  green:
    'border-neon-green/60 hover:border-neon-green hover:shadow-neon-green text-neon-green',
  cyan: 'border-neon-cyan/60 hover:border-neon-cyan hover:shadow-neon-cyan text-neon-cyan',
  pink: 'border-neon-pink/60 hover:border-neon-pink hover:shadow-neon-pink text-neon-pink',
}

export default function SnakeAndLadderLocalSelect() {
  const navigate = useNavigate()
  return (
    <div className="scanlines relative min-h-screen bg-arcadia-bg text-white">
      <header className="sticky top-0 z-30 border-b border-neon-green/30 bg-arcadia-bg/85 shadow-[0_1px_0_0_rgba(0,255,136,0.2)] backdrop-blur-md">
        <div className="mx-auto grid max-w-7xl grid-cols-[1fr_auto_1fr] items-center px-4 py-4 md:px-8">
          <Link
            to="/game/snake-and-ladder"
            className="flex items-center gap-2 justify-self-start font-arcade text-[10px] text-neon-cyan transition hover:text-neon-green md:text-xs"
          >
            <span aria-hidden="true">◀</span>
            MODE
          </Link>
          <h1 className="justify-self-center font-arcade text-sm text-neon-green drop-shadow-[0_0_8px_rgba(0,255,136,0.4)] md:text-lg">
            <span className="mr-2">👥</span>
            LOCAL PLAY
          </h1>
          <span className="justify-self-end" />
        </div>
      </header>
      <main className="mx-auto flex max-w-3xl flex-col items-center px-4 py-12 md:py-20">
        <p className="font-arcade text-[10px] text-white/45 md:text-xs">
          HOW MANY PLAYERS?
        </p>
        <div className="mt-8 grid w-full grid-cols-1 gap-4 sm:grid-cols-3">
          {COUNTS.map((opt) => (
            <button
              key={opt.n}
              type="button"
              onClick={() =>
                navigate(`/game/snake-and-ladder/local/${opt.n}`)
              }
              className={`group flex flex-col items-center gap-3 rounded-xl border-2 bg-arcadia-surface/70 p-6 transition-all duration-200 hover:-translate-y-1 ${ACCENTS[opt.accent]}`}
            >
              <span className="font-arcade text-lg">{opt.label}</span>
              <span className="text-xs uppercase tracking-widest text-white/45">
                Same device · take turns
              </span>
            </button>
          ))}
        </div>
      </main>
    </div>
  )
}
