import { Link } from 'react-router-dom'

export default function GameLayout({ title, icon, children }) {
  return (
    <div className="scanlines relative min-h-screen bg-arcadia-bg text-white">
      <header className="sticky top-0 z-30 border-b border-neon-green/30 bg-arcadia-bg/85 backdrop-blur-md shadow-[0_1px_0_0_rgba(0,255,136,0.2)]">
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
      <main className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-10">
        {children}
      </main>
    </div>
  )
}
