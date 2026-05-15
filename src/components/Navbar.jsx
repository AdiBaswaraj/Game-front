import { Link } from 'react-router-dom'

export default function Navbar({ playersOnline = 0 }) {
  return (
    <header className="sticky top-0 z-40 border-b border-neon-green/40 bg-arcadia-bg/85 backdrop-blur-md shadow-[0_1px_0_0_rgba(0,255,136,0.25),0_10px_30px_-20px_rgba(0,255,136,0.5)]">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 md:px-8">
        <Link
          to="/"
          className="font-arcade text-base text-neon-green drop-shadow-[0_0_8px_rgba(0,255,136,0.6)] md:text-xl"
        >
          ARCADIA
        </Link>

        <div className="flex items-center gap-3 md:gap-5">
          <span
            className="hidden items-center gap-2 rounded-md border border-neon-cyan/40 bg-neon-cyan/5 px-3 py-1.5 font-arcade text-[10px] text-neon-cyan sm:inline-flex"
            aria-label="players online"
          >
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-neon-cyan shadow-neon-cyan" />
            {playersOnline} PLAYERS ONLINE
          </span>

          <button
            type="button"
            onClick={() => {}}
            className="font-arcade text-[10px] text-white/80 transition hover:text-neon-cyan md:text-xs"
          >
            LOGIN
          </button>
          <button
            type="button"
            onClick={() => {}}
            className="rounded-md border border-neon-pink/70 bg-neon-pink/10 px-3 py-1.5 font-arcade text-[10px] text-neon-pink transition hover:bg-neon-pink/20 hover:shadow-neon-pink md:text-xs"
          >
            SIGN UP
          </button>
        </div>
      </div>
    </header>
  )
}
