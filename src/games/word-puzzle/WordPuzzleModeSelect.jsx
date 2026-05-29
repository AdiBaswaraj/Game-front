import { Link, useNavigate } from 'react-router-dom'
import {
  CalendarIcon,
  InfinityIcon,
  SwordsIcon,
  WordPuzzleIcon,
} from '../../assets/icons/index.jsx'

export default function WordPuzzleModeSelect() {
  const navigate = useNavigate()

  return (
    <div className="relative min-h-screen bg-arcadia-bg text-white">
      <header className="sticky top-0 z-30 border-b" style={{ background: "rgba(5, 5, 8, 0.9)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", borderBottomColor: "rgba(0, 255, 136, 0.1)" }}>
        <div className="mx-auto grid max-w-7xl grid-cols-[1fr_auto_1fr] items-center px-4 py-4 md:px-8">
          <Link
            to="/"
            className="flex items-center gap-2 justify-self-start font-arcade text-[10px] text-neon-cyan transition hover:text-neon-green md:text-xs"
          >
            <span aria-hidden="true">◀</span>
            LOBBY
          </Link>
          <h1 className="inline-flex items-center justify-self-center gap-2 font-arcade text-sm text-neon-green drop-shadow-[0_0_8px_rgba(0,255,136,0.4)] md:text-lg">
            <WordPuzzleIcon size={22} aria-hidden="true" />
            <span>WORD PUZZLE</span>
          </h1>
          <span className="justify-self-end" />
        </div>
      </header>

      <main className="mx-auto flex max-w-3xl flex-col items-center px-4 py-12 md:py-20">
        <p className="font-arcade text-[10px] text-white/45 md:text-xs">
          SELECT MODE
        </p>
        <div className="mt-8 grid w-full grid-cols-1 gap-4 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => navigate('/game/word-puzzle/daily')}
            className="mode-card group flex flex-col items-center gap-3 rounded-xl border-2 border-neon-cyan/60 bg-arcadia-surface/70 p-6 text-neon-cyan transition-all duration-200 hover:-translate-y-1 hover:border-neon-cyan hover:shadow-neon-cyan"
          >
            <CalendarIcon size={32} />
            <span className="font-arcade text-base">DAILY CHALLENGE</span>
            <span className="text-xs uppercase tracking-widest text-white/45">
              One word a day · ranked
            </span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/game/word-puzzle/free')}
            className="mode-card group flex flex-col items-center gap-3 rounded-xl border-2 border-neon-green/60 bg-arcadia-surface/70 p-6 text-neon-green transition-all duration-200 hover:-translate-y-1 hover:border-neon-green hover:shadow-neon-green"
          >
            <InfinityIcon size={32} />
            <span className="font-arcade text-base">FREE PLAY</span>
            <span className="text-xs uppercase tracking-widest text-white/45">
              Unlimited rounds · unranked
            </span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/game/word-puzzle/mode')}
            className="mode-card group flex flex-col items-center gap-3 rounded-xl border-2 border-neon-pink/60 bg-arcadia-surface/70 p-6 text-neon-pink transition-all duration-200 hover:-translate-y-1 hover:border-neon-pink hover:shadow-neon-pink"
          >
            <SwordsIcon size={32} />
            <span className="font-arcade text-base">BATTLE</span>
            <span className="text-xs uppercase tracking-widest text-white/45">
              Head-to-head · same word
            </span>
          </button>
        </div>
      </main>
    </div>
  )
}
