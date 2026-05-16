const PALETTE = [
  { color: '#00ff88', bg: 'rgba(0,255,136,0.12)' },
  { color: '#00d4ff', bg: 'rgba(0,212,255,0.12)' },
  { color: '#ff006e', bg: 'rgba(255,0,110,0.12)' },
  { color: '#ffaa00', bg: 'rgba(255,170,0,0.14)' },
  { color: '#a78bfa', bg: 'rgba(167,139,250,0.14)' },
]

function hash(s) {
  let h = 0
  const str = String(s ?? '')
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

export function avatarColorFor(name) {
  return PALETTE[hash(name) % PALETTE.length]
}

const SIZES = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-base',
  lg: 'h-16 w-16 text-2xl',
  xl: 'h-28 w-28 text-5xl',
}

export default function Avatar({ name, size = 'md', online }) {
  const letter = (String(name ?? '?')[0] || '?').toUpperCase()
  const { color, bg } = avatarColorFor(name)
  const sizeCls = SIZES[size] ?? SIZES.md

  return (
    <span className="relative inline-flex shrink-0">
      <span
        className={`grid place-items-center rounded-full font-arcade ${sizeCls}`}
        style={{
          backgroundColor: bg,
          color,
          boxShadow: `inset 0 0 0 2px ${color}, 0 0 14px ${color}40`,
        }}
        aria-hidden="true"
      >
        {letter}
      </span>
      {online !== undefined && (
        <span
          className={`absolute -bottom-0 -right-0 h-2.5 w-2.5 rounded-full ring-2 ring-arcadia-bg ${
            online ? 'bg-neon-green shadow-neon-green' : 'bg-white/20'
          }`}
          aria-label={online ? 'online' : 'offline'}
        />
      )}
    </span>
  )
}
