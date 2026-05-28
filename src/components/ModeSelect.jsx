import { Link, useNavigate } from 'react-router-dom'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

const ACCENTS = {
  green:
    'border-neon-green/60 hover:border-neon-green hover:shadow-neon-green text-neon-green',
  cyan: 'border-neon-cyan/60 hover:border-neon-cyan hover:shadow-neon-cyan text-neon-cyan',
  pink: 'border-neon-pink/60 hover:border-neon-pink hover:shadow-neon-pink text-neon-pink',
}

export default function ModeSelect({
  title,
  icon,
  cards,
  backTo = '/',
  backLabel = 'LOBBY',
}) {
  const navigate = useNavigate()
  useDocumentTitle(`${title} — Mode`)

  return (
    <div className="route-fade-in relative min-h-screen bg-arcadia-bg text-white">
      <header className="sticky top-0 z-30 border-b border-neon-green/30 bg-arcadia-bg/85 shadow-[0_1px_0_0_rgba(0,255,136,0.2)] backdrop-blur-md">
        <div className="mx-auto grid max-w-7xl grid-cols-[1fr_auto_1fr] items-center px-4 py-4 md:px-8">
          <Link
            to={backTo}
            className="flex items-center gap-2 justify-self-start font-arcade text-[10px] text-neon-cyan transition hover:text-neon-green md:text-xs"
          >
            <span aria-hidden="true">◀</span>
            {backLabel}
          </Link>
          <h1 className="justify-self-center font-arcade text-sm text-neon-green drop-shadow-[0_0_8px_rgba(0,255,136,0.4)] md:text-lg">
            {icon && <span className="mr-2">{icon}</span>}
            {title}
          </h1>
          <span className="justify-self-end" />
        </div>
      </header>

      <main className="mx-auto flex max-w-5xl flex-col items-center px-4 py-12 md:py-20">
        <p className="font-arcade text-[10px] text-white/45 md:text-xs">
          SELECT MODE
        </p>
        <div
          className={`mt-8 grid w-full grid-cols-1 gap-4 ${
            cards.length >= 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'
          }`}
        >
          {cards.map((card) => (
            <button
              key={card.id}
              type="button"
              onClick={() => navigate(card.to)}
              className={`mode-card group flex h-full flex-col items-center justify-between gap-3 rounded-xl border-2 bg-arcadia-surface/70 p-6 transition-all duration-200 hover:-translate-y-1 ${ACCENTS[card.accent] ?? ACCENTS.cyan}`}
            >
              <div className="flex flex-col items-center gap-3">
                {card.icon && <span className="text-3xl">{card.icon}</span>}
                <span className="font-arcade text-base">{card.label}</span>
                {card.tag && (
                  <span className="text-center text-xs leading-relaxed text-white/55">
                    {card.tag}
                  </span>
                )}
              </div>
              {card.subItems && card.subItems.length > 0 && (
                <ul className="flex flex-wrap items-center justify-center gap-2 pt-1">
                  {card.subItems.map((s) => (
                    <li
                      key={s}
                      className="rounded-md border border-white/10 px-2 py-0.5 font-arcade text-[9px] text-white/55"
                    >
                      {s}
                    </li>
                  ))}
                </ul>
              )}
            </button>
          ))}
        </div>
      </main>
    </div>
  )
}
