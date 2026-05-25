import { Link, useNavigate } from 'react-router-dom'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
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

  const guarded = (target) => (e) => {
    if (!guardCtx) return
    const ok = guardCtx.requestLeave({
      target,
      commit: () => navigate(target),
    })
    if (ok === false) e?.preventDefault?.()
  }

  return (
    <div className="scanlines relative min-h-screen bg-arcadia-bg text-white">
      <header className="sticky top-0 z-30 border-b border-neon-green/30 bg-arcadia-bg/85 shadow-[0_1px_0_0_rgba(0,255,136,0.2)] backdrop-blur-md">
        <div className="mx-auto grid max-w-7xl grid-cols-[1fr_auto_1fr] items-center px-4 py-4 md:px-8">
          <Link
            to={backTo}
            onClick={guarded(backTo)}
            className="flex items-center gap-2 justify-self-start font-arcade text-[10px] text-neon-cyan transition hover:text-neon-green md:text-xs"
          >
            <span aria-hidden="true">◀</span>
            {backLabel}
          </Link>
          <h1 className="justify-self-center font-arcade text-sm text-neon-green drop-shadow-[0_0_8px_rgba(0,255,136,0.4)] md:text-lg">
            {icon && <span className="mr-2">{icon}</span>}
            {title}
          </h1>
          <Link
            to="/"
            onClick={guarded('/')}
            className="flex items-center gap-1.5 justify-self-end rounded-md border border-white/15 px-2.5 py-1 font-arcade text-[10px] text-white/70 transition hover:border-neon-green/60 hover:text-neon-green md:text-xs"
            aria-label="Home"
            title="Home"
          >
            <span aria-hidden="true">🏠</span>
            <span className="hidden sm:inline">HOME</span>
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-10">
        {children}
      </main>
    </div>
  )
}
