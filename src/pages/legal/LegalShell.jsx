import { Link } from 'react-router-dom'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'

export default function LegalShell({ title, lastUpdated, children }) {
  useDocumentTitle(title)
  return (
    <div className="relative min-h-screen text-white">
      <header
        className="sticky top-[60px] z-30 border-b border-white/[0.06]"
        style={{
          background: 'rgba(5, 5, 8, 0.85)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 md:px-8">
          <Link
            to="/"
            className="flex items-center gap-2 font-arcade text-[10px] text-neon-cyan transition hover:text-neon-green md:text-xs"
          >
            <span aria-hidden="true">◀</span> BACK TO LOBBY
          </Link>
          <span className="neon-text font-arcade text-[10px] text-neon-green md:text-xs">
            ★ ARCADIA
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-[680px] px-4 py-10 md:px-6 md:py-16">
        <article
          className="glass-panel pixel-corners pixel-corners-cyan p-6 md:p-10"
          style={{ background: 'rgba(255, 255, 255, 0.03)' }}
        >
          <header className="mb-6 text-center">
            <h1 className="neon-text font-arcade text-base text-neon-cyan md:text-lg">
              {title}
            </h1>
            {lastUpdated && (
              <p className="mt-3 font-arcade text-[9px] text-white/35 md:text-[10px]">
                LAST UPDATED · {lastUpdated}
              </p>
            )}
          </header>

          <div className="legal-body space-y-7 text-[14px] leading-[1.8] text-[#a0a0b0]">
            {children}
          </div>
        </article>
      </main>
    </div>
  )
}

// Renders a numbered legal section. Section number is neon green; the
// title sits next to it in neon cyan pixel font.
export function Section({ number, title, children }) {
  return (
    <section>
      <h2 className="mb-3 flex items-baseline gap-3 font-arcade text-[11px] uppercase md:text-xs">
        <span className="text-neon-green">{number}.</span>
        <span className="text-neon-cyan">{title}</span>
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  )
}

export function List({ items }) {
  return (
    <ul className="ml-4 list-disc space-y-1 marker:text-neon-green/60">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  )
}
