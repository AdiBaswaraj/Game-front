import { useEffect, useState } from 'react'

// Tracks the inner viewport size and recomputes whenever the window
// resizes, fullscreen toggles, or orientation changes. Returns
// { width, height, isPortrait }.
export function useViewport() {
  const [v, setV] = useState(() =>
    typeof window === 'undefined'
      ? { width: 1024, height: 768, isPortrait: false }
      : {
          width: window.innerWidth,
          height: window.innerHeight,
          isPortrait: window.innerHeight >= window.innerWidth,
        },
  )

  useEffect(() => {
    const calc = () => {
      setV({
        width: window.innerWidth,
        height: window.innerHeight,
        isPortrait: window.innerHeight >= window.innerWidth,
      })
    }
    calc()
    window.addEventListener('resize', calc)
    window.addEventListener('orientationchange', calc)
    document.addEventListener('fullscreenchange', calc)
    document.addEventListener('webkitfullscreenchange', calc)
    return () => {
      window.removeEventListener('resize', calc)
      window.removeEventListener('orientationchange', calc)
      document.removeEventListener('fullscreenchange', calc)
      document.removeEventListener('webkitfullscreenchange', calc)
    }
  }, [])

  return v
}

// Computes a square game-board size that fits within the viewport
// after subtracting a header and any controls below the board.
// minSize floors the result so the board never collapses on tiny
// devices; maxSize caps it so we don't blow up on huge monitors.
export function useSquareGameSize({
  headerHeight = 72,
  controlsHeight = 0,
  padding = 16,
  minSize = 240,
  maxSize = 640,
} = {}) {
  const { width, height } = useViewport()
  const availableW = Math.max(0, width - padding * 2)
  const availableH = Math.max(0, height - headerHeight - controlsHeight - padding * 2)
  const raw = Math.min(availableW, availableH, maxSize)
  return Math.max(minSize, raw)
}
