import { useEffect } from 'react'

// Browser-level guard for refresh / close-tab during an active game.
// In-app navigation has to be intercepted at the component level —
// React Router v6 BrowserRouter has no useBlocker support.
export function useLeaveGuard(active) {
  useEffect(() => {
    if (!active) return
    const handler = (e) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [active])
}
