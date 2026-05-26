import { useEffect, useState } from 'react'
import { useViewport } from '../hooks/useViewport'

// Shows a small dismissable banner when the device is in portrait
// orientation on a narrow screen. Dismissal is remembered in
// sessionStorage so it doesn't keep popping up during the same play
// session.
export default function LandscapeHint({ keyName = 'default', message }) {
  const { width, isPortrait } = useViewport()
  const storageKey = `arcadia:landscapeHint:dismissed:${keyName}`
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(storageKey) === '1'
    } catch {
      return false
    }
  })

  useEffect(() => {
    if (!dismissed) return
    try {
      sessionStorage.setItem(storageKey, '1')
    } catch {}
  }, [dismissed, storageKey])

  // Only show on portrait and narrow screens.
  if (dismissed) return null
  if (!isPortrait) return null
  if (width >= 720) return null

  return (
    <div className="lb-slide-in mx-auto mb-3 flex w-full max-w-md items-center justify-between gap-3 rounded-md border border-neon-cyan/40 bg-arcadia-surface/85 px-3 py-2 text-[10px] text-neon-cyan">
      <span>↻ {message ?? 'Rotate device for a better experience'}</span>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="font-arcade text-[9px] text-white/55 hover:text-neon-pink"
        aria-label="Dismiss rotation hint"
      >
        ✕
      </button>
    </div>
  )
}
