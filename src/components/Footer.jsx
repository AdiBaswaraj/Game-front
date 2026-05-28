import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="mt-20 border-t border-white/[0.06]">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-3 gap-y-2 px-6 py-8 text-center font-arcade text-[10px] text-white/40 md:text-xs">
        <span>© ARCADIA 2026</span>
        <span aria-hidden="true" className="text-white/15">·</span>
        <Link to="/privacy" className="transition hover:text-neon-cyan">
          PRIVACY
        </Link>
        <span aria-hidden="true" className="text-white/15">·</span>
        <Link to="/terms" className="transition hover:text-neon-cyan">
          TERMS
        </Link>
        <span aria-hidden="true" className="text-white/15">·</span>
        <Link to="/cookies" className="transition hover:text-neon-cyan">
          COOKIES
        </Link>
      </div>
    </footer>
  )
}
