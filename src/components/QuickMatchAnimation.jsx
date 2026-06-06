import { useEffect, useRef, useState } from 'react'

// Pool of stylised arcade handles that flash up around the radar. The
// list is intentionally pixelated / cyber-flavoured so it reads as
// "phantom signals from the player network" rather than real people.
const PHANTOM_HANDLES = [
  'NEO_42', 'XENO', 'PIX3L', 'GHOST_07', 'RUNNER',
  'ARCADE9', 'STARRY', 'V01D', 'BIT_R0T', 'CTRL_Z',
  'NOVA', 'BYTE_X', 'KAI', 'ZER0', 'PH4SE',
  'CIPHER', 'GLITCH', 'PIXEL_K', 'SH4DOW', 'QU3RY',
  'CR4SH', 'L00P', 'F0RT_X', 'TR4CE',
]

const SLOT_COUNT = 8 // evenly spaced positions around the ring
const PHANTOM_TTL_MS = 1700 // visible lifespan per phantom (matches CSS keyframe)
const SPAWN_EVERY_MS = 380 // attempt a new phantom this often

/**
 * Shared "Quick Match" radar animation. Used for every multiplayer
 * matchmaking screen and meant to drop into any future game with
 * matchmaking — pass `you` (the local player name) and optionally
 * tweak `size`.
 *
 *  ┌─────── outer ticked ring ───────┐
 *  │   ╲                       ╱     │   phantom blips fade in/out
 *  │    ●          YOU         ●     │   in 8 fixed slots around the
 *  │              [ name ]           │   middle ring
 *  │    ●                      ●     │   sweep beam rotates over them
 *  │   ╱                       ╲     │   crosshair + concentric rings
 *  └─────────────────────────────────┘   for depth
 *
 * The sweep uses SVG <animateTransform> (instead of CSS) so it rotates
 * reliably on every browser, including the ones where CSS
 * transform-origin on SVG groups is flaky.
 */
export default function QuickMatchAnimation({ you, size = 288 }) {
  const [phantoms, setPhantoms] = useState(() => Array(SLOT_COUNT).fill(null))
  const [scanCounter, setScanCounter] = useState(() =>
    1000 + Math.floor(Math.random() * 9000),
  )
  const phantomKeyRef = useRef(0)

  // Spawn a phantom into a random empty slot at a steady cadence, and
  // schedule its removal once the CSS fade-out has played out. Mounted
  // refs aren't needed — the setInterval cleanup tears everything down
  // when the screen unmounts.
  useEffect(() => {
    const spawn = () => {
      setPhantoms((prev) => {
        const empty = []
        for (let i = 0; i < SLOT_COUNT; i++) if (!prev[i]) empty.push(i)
        if (empty.length === 0) return prev
        const slotIdx = empty[Math.floor(Math.random() * empty.length)]
        const name =
          PHANTOM_HANDLES[Math.floor(Math.random() * PHANTOM_HANDLES.length)]
        const key = ++phantomKeyRef.current
        const next = [...prev]
        next[slotIdx] = { name, key }
        setTimeout(() => {
          setPhantoms((p) => {
            if (p[slotIdx]?.key !== key) return p
            const n = [...p]
            n[slotIdx] = null
            return n
          })
        }, PHANTOM_TTL_MS)
        return next
      })
    }
    // Seed with a single phantom so the radar doesn't read as empty
    // for the first frame.
    spawn()
    const id = setInterval(spawn, SPAWN_EVERY_MS)
    return () => clearInterval(id)
  }, [])

  // Decorative counter that ticks up — pure arcade chrome, no game
  // state. Reset isn't needed; it just keeps climbing.
  useEffect(() => {
    const id = setInterval(() => {
      setScanCounter((c) => c + 1 + Math.floor(Math.random() * 3))
    }, 220)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="qm-scope flex flex-col items-center">
      <div
        className="relative"
        style={{ width: size, height: size }}
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 400 400"
          className="absolute inset-0 h-full w-full"
        >
          <defs>
            <radialGradient id="qm-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(0, 255, 136, 0.16)" />
              <stop offset="70%" stopColor="rgba(0, 255, 136, 0.04)" />
              <stop offset="100%" stopColor="rgba(0, 255, 136, 0)" />
            </radialGradient>
            <linearGradient id="qm-sweep-grad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="rgba(0, 255, 136, 0)" />
              <stop offset="100%" stopColor="rgba(0, 255, 136, 0.55)" />
            </linearGradient>
          </defs>

          {/* Soft inner glow */}
          <circle cx="200" cy="200" r="195" fill="url(#qm-glow)" />

          {/* Concentric rings: solid outer, dashed mid, solid inner. */}
          <circle cx="200" cy="200" r="195" fill="none"
            stroke="rgba(0, 255, 136, 0.18)" strokeWidth="1" />
          <circle cx="200" cy="200" r="140" fill="none"
            stroke="rgba(0, 255, 136, 0.18)" strokeDasharray="3 7"
            strokeWidth="1" />
          <circle cx="200" cy="200" r="90" fill="none"
            stroke="rgba(0, 255, 136, 0.22)" strokeWidth="1" />

          {/* Faint crosshair */}
          <line x1="200" y1="6" x2="200" y2="394"
            stroke="rgba(0, 255, 136, 0.08)" />
          <line x1="6" y1="200" x2="394" y2="200"
            stroke="rgba(0, 255, 136, 0.08)" />

          {/* 24 tick marks on the outer ring (every 15°). The 4
              cardinal ticks render a touch brighter. */}
          {Array.from({ length: 24 }).map((_, i) => {
            const a = (i / 24) * Math.PI * 2
            const cardinal = i % 6 === 0
            const inner = cardinal ? 178 : 184
            const outer = 196
            const x1 = 200 + Math.cos(a) * inner
            const y1 = 200 + Math.sin(a) * inner
            const x2 = 200 + Math.cos(a) * outer
            const y2 = 200 + Math.sin(a) * outer
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={
                  cardinal
                    ? 'rgba(0, 255, 136, 0.55)'
                    : 'rgba(0, 255, 136, 0.28)'
                }
                strokeWidth={cardinal ? 1.5 : 1}
              />
            )
          })}

          {/* Rotating sweep wedge. <animateTransform> avoids the
              transform-origin flakiness CSS has on SVG groups. */}
          <g>
            <path
              d="M 200 200 L 200 8 A 192 192 0 0 1 392 200 Z"
              fill="url(#qm-sweep-grad)"
              opacity="0.65"
            />
            <line
              x1="200"
              y1="200"
              x2="200"
              y2="8"
              stroke="rgba(0, 255, 136, 0.85)"
              strokeWidth="1.5"
            />
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="0 200 200"
              to="360 200 200"
              dur="2.6s"
              repeatCount="indefinite"
            />
          </g>

          {/* Central bullseye dot — sits on top of the sweep. */}
          <circle cx="200" cy="200" r="2.4" fill="rgba(0, 255, 136, 0.9)" />
        </svg>

        {/* Phantom blips around the middle ring. Plain DOM so each
            blip gets its own CSS animation lifecycle. */}
        {phantoms.map((p, i) => {
          if (!p) return null
          const angle = (i / SLOT_COUNT) * 2 * Math.PI - Math.PI / 2
          const RADIUS_PCT = 35
          const left = 50 + Math.cos(angle) * RADIUS_PCT
          const top = 50 + Math.sin(angle) * RADIUS_PCT
          return (
            <div
              key={p.key}
              className="absolute"
              style={{
                left: `${left}%`,
                top: `${top}%`,
                transform: 'translate(-50%, -50%)',
                width: 0,
                height: 0,
              }}
            >
              <div className="qm-phantom flex -translate-x-1/2 -translate-y-1/2 flex-col items-center">
                <span className="qm-phantom-dot" />
                <span className="qm-phantom-name mt-1.5 whitespace-nowrap font-arcade text-[8px] text-neon-cyan/85">
                  {p.name}
                </span>
              </div>
            </div>
          )
        })}

        {/* Center YOU node. The shadow-neon-green ring pulses subtly
            to read as "active beacon". */}
        <div className="absolute inset-0 grid place-items-center">
          <div className="qm-center relative grid h-24 w-24 place-items-center rounded-full border-2 border-neon-green bg-arcadia-bg shadow-neon-green sm:h-28 sm:w-28">
            <div className="px-2 text-center">
              <p className="font-arcade text-[8px] text-white/45">YOU</p>
              <p className="mt-1 max-w-[5.5rem] truncate font-arcade text-[10px] text-neon-green">
                {you ?? 'Player'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Arcade chrome readout — pure decoration, ties the radar to
          the surrounding UI. */}
      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3 font-arcade text-[8px] text-white/40">
        <span className="text-right tracking-[0.18em]">
          SCAN&nbsp;<span className="text-neon-green/80">●</span>
        </span>
        <span className="tabular-nums tracking-[0.2em] text-neon-cyan/70">
          Q-{scanCounter.toString().padStart(5, '0')}
        </span>
        <span className="text-left tracking-[0.18em]">
          NET&nbsp;<span className="text-neon-green/80">●</span>
        </span>
      </div>
    </div>
  )
}
