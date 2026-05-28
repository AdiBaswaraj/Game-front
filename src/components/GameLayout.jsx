import { Suspense } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useFullscreen } from '../hooks/useFullscreen'
import { useLeaveGuardContext } from '../context/LeaveGuardContext'
import GameLoadingScreen from './GameLoadingScreen'

const ACCENTS = {
  green:  { color: 'text-neon-green',  border: 'border-neon-green/15' },
  cyan:   { color: 'text-neon-cyan',   border: 'border-neon-cyan/15' },
  pink:   { color: 'text-neon-pink',   border: 'border-neon-pink/15' },
  purple: { color: 'text-neon-purple', border: 'border-neon-purple/15' },
  amber:  { color: 'text-amber-400',   border: 'border-amber-400/15' },
}

export default function GameLayout({
  title,
  icon,
  Icon,
  children,
  backTo = '/',
  backLabel = 'LOBBY',
  loadingVariant = 'default',
  accent = 'green',
}) {
  useDocumentTitle(title ?? null)
  const navigate = useNavigate()
  const guardCtx = useLeaveGuardContext()
  const { isFullscreen, toggle, supported: fsSupported } = useFullscreen()
  const a = ACCENTS[accent] ?? ACCENTS.green

  const guarded = (target) => (e) => {
    if (!guardCtx) return
    const ok = guardCtx.requestLeave({
      target,
      commit: () => navigate(target),
    })
    if (ok === false) e?.preventDefault?.()
  }

  const headerPad = isFullscreen ? 'py-2 md:py-2' : 'py-4'
  const labelHidden = isFullscreen ? 'sm:hidden' : 'hidden sm:inline'

  return (
    <div className="game-page route-fade-in relative flex min-h-[100dvh] flex-col bg-arcadia-bg text-white">
      <header
        className={`sticky top-0 z-30 shrink-0 border-b ${a.border}`}
        style={{
          background: 'rgba(5, 5, 8, 0.9)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        <div
          className={`mx-auto grid max-w-7xl grid-cols-[1fr_auto_1fr] items-center px-4 md:px-8 ${headerPad}`}
        >
          <Link
            to={backTo}
            onClick={guarded(backTo)}
            className="group flex min-h-[44px] min-w-[44px] items-center gap-2 justify-self-start rounded-md border border-transparent px-2 font-arcade text-[10px] text-neon-cyan transition hover:border-white/10 hover:bg-white/[0.04] hover:text-neon-green md:text-xs"
            aria-label={backLabel}
            title={backLabel}
          >
            <span aria-hidden="true">◀</span>
            <span className={labelHidden}>{backLabel}</span>
          </Link>
          <h1
            className={`neon-text inline-flex items-center justify-self-center gap-2 font-arcade ${
              isFullscreen ? 'text-xs md:text-sm' : 'text-sm md:text-lg'
            } ${a.color}`}
          >
            {Icon ? (
              <Icon size={isFullscreen ? 18 : 22} aria-hidden="true" />
            ) : (
              icon && <span>{icon}</span>
            )}
            <span>{title}</span>
          </h1>
          <div className="flex items-center gap-1 justify-self-end md:gap-2">
            {fsSupported && (
              <button
                type="button"
                onClick={toggle}
                className="grid h-11 w-11 place-items-center rounded-md border border-white/15 bg-white/[0.02] font-arcade text-base text-white/70 transition hover:border-neon-cyan/60 hover:bg-white/[0.06] hover:text-neon-cyan"
                aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                title="Fullscreen (F)"
              >
                {isFullscreen ? '⊠' : '⛶'}
              </button>
            )}
            <Link
              to="/"
              onClick={guarded('/')}
              className="flex min-h-[44px] items-center gap-1.5 rounded-md border border-white/15 bg-white/[0.02] px-2.5 py-1 font-arcade text-[10px] text-white/70 transition hover:border-neon-green/60 hover:bg-white/[0.06] hover:text-neon-green md:text-xs"
              aria-label="Home"
              title="Home"
            >
              <span aria-hidden="true">🏠</span>
              <span className={labelHidden}>HOME</span>
            </Link>
          </div>
        </div>
      </header>
      <main
        className={`mx-auto flex w-full max-w-7xl flex-1 flex-col ${
          isFullscreen ? 'px-2 py-2' : 'px-4 py-6 md:px-8 md:py-10'
        }`}
      >
        <Suspense fallback={<GameLoadingScreen variant={loadingVariant} />}>
          {children}
        </Suspense>
      </main>
    </div>
  )
}
