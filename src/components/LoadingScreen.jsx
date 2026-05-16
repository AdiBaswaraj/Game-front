export default function LoadingScreen({
  message = 'LOADING…',
  detail,
  inline = false,
}) {
  const wrap = inline
    ? 'flex flex-col items-center justify-center gap-4 py-12 text-center'
    : 'flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center'
  return (
    <div className={wrap}>
      <PixelSpinner />
      <p className="font-arcade text-[11px] text-neon-cyan drop-shadow-[0_0_8px_rgba(0,212,255,0.45)]">
        {message}
      </p>
      {detail && <p className="text-xs text-white/45">{detail}</p>}
    </div>
  )
}

function PixelSpinner() {
  const dots = Array.from({ length: 8 })
  return (
    <div
      className="relative h-10 w-10"
      role="presentation"
      aria-hidden="true"
    >
      {dots.map((_, i) => {
        const angle = (i / 8) * 2 * Math.PI
        const x = 16 + Math.cos(angle) * 14
        const y = 16 + Math.sin(angle) * 14
        return (
          <span
            key={i}
            className="absolute h-2 w-2 rounded-sm bg-neon-green animate-pulse"
            style={{
              left: x,
              top: y,
              animationDelay: `${i * 100}ms`,
              boxShadow: '0 0 8px rgba(0,255,136,0.6)',
            }}
          />
        )
      })}
    </div>
  )
}
