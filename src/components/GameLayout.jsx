import { Link, useNavigate } from 'react-router-dom'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useFullscreen } from '../hooks/useFullscreen'
import { useLeaveGuardContext } from '../context/LeaveGuardContext'

export default function GameLayout({
  title,
  icon,
  children,
  backTo = '/',
  backLabel = 'LOBBY',
}) {
  useDocumentTitle(title ?? null)
  const navigate = useNavigate()
  const guardCtx = useLeaveGuardContext()
  const { isFullscreen, toggle, supported: fsSupported } = useFullscreen()

  const guarded = (target) => (e) => {
    if (!guardCtx) return
    const ok = guardCtx.requestLeave({
      target,
      commit: () => navigate(target),
    })
    if (ok === false) e?.preventDefault?.()
  }

  // In fullscreen the header is minimal — icons only, slimmer height,
  // so the board has more vertical space.
  const headerPad = isFullscreen ? 'py-2 md:py-2' : 'py-4'
  const labelHidden = isFullscreen ? 'sm:hidden' : 'hidden sm:inline'

  return (
    <div className="game-page scanlines relative flex min-h-[100dvh] flex-col bg-arcadia-bg text-white">
      <header
        className={`sticky top-0 z-30 shrink-0 border-b border-neon-green/30 bg-arcadia-bg/85 shadow-[0_1px_0_0_rgba(0,255,136,0.2)] backdrop-blur-md`}
      >
        <div
          className={`mx-auto grid max-w-7xl grid-cols-[1fr_auto_1fr] items-center px-4 md:px-8 ${headerPad}`}
        >
          <Link
            to={backTo}
            onClick={guarded(backTo)}
            className="flex min-h-[44px] min-w-[44px] items-center gap-2 justify-self-start rounded-md px-2 font-arcade text-[10px] text-neon-cyan transition hover:text-neon-green md:text-xs"
            aria-label={backLabel}
            title={backLabel}
          >
            <span aria-hidden="true">◀</span>
            <span className={labelHidden}>{backLabel}</span>
          </Link>
          <h1
            className={`justify-self-center font-arcade ${
              isFullscreen ? 'text-xs md:text-sm' : 'text-sm md:text-lg'
            } text-neon-green drop-shadow-[0_0_8px_rgba(0,255,136,0.4)]`}
          >
            {icon && <span className="mr-2">{icon}</span>}
            {title}
          </h1>
          <div className="flex items-center gap-1 justify-self-end md:gap-2">
            {fsSupported && (
              <button
                type="button"
                onClick={toggle}
                className="grid h-11 w-11 place-items-center rounded-md border border-white/15 font-arcade text-base text-white/70 transition hover:border-neon-cyan/60 hover:text-neon-cyan"
                aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                title="Fullscreen (F)"
              >
                {isFullscreen ? '⊠' : '⛶'}
              </button>
            )}
            <Link
              to="/"
              onClick={guarded('/')}
              className="flex min-h-[44px] items-center gap-1.5 rounded-md border border-white/15 px-2.5 py-1 font-arcade text-[10px] text-white/70 transition hover:border-neon-green/60 hover:text-neon-green md:text-xs"
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
        className={`mx-auto w-full max-w-7xl flex-1 ${
          isFullscreen ? 'px-2 py-2' : 'px-4 py-6 md:px-8 md:py-10'
        }`}
      >
        {children}
      </main>
    </div>
  )
}
