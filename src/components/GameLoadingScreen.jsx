import { useEffect, useState } from 'react'

const DEFAULT_TEXTS = [
  'LOADING CABINET…',
  'WARMING UP…',
  'INSERTING COIN…',
  'CALIBRATING CONTROLS…',
  'BOOTING ROM…',
]

const CHESS_TEXTS = [
  'INITIALIZING STOCKFISH…',
  'OPENING THE BOOK…',
  'COMPILING ENGINE…',
  'WARMING UP THE GRANDMASTER…',
]

const DOT_COLORS = ['#00ff88', '#00d4ff', '#ff006e', '#00ff88']

export default function GameLoadingScreen({ variant = 'default' }) {
  const texts = variant === 'chess' ? CHESS_TEXTS : DEFAULT_TEXTS
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 900)
    return () => clearInterval(t)
  }, [])
  const flavor = texts[tick % texts.length]
  return (
    <div
      className="flex w-full flex-1 flex-col items-center justify-center gap-6 py-16 text-center"
      role="status"
      aria-live="polite"
    >
      <div className="flex gap-3">
        {DOT_COLORS.map((c, i) => (
          <span
            key={i}
            className="loader-dot block h-3 w-3 rounded-sm"
            style={{
              backgroundColor: c,
              color: c,
              animationDelay: `${i * 0.15}s`,
            }}
          />
        ))}
      </div>
      <p
        key={flavor}
        className="loader-text-in font-arcade text-[10px] text-neon-cyan/80 md:text-xs"
      >
        {flavor}
      </p>
    </div>
  )
}
