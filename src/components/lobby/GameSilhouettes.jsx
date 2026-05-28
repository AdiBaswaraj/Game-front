const SILHOUETTES = [
  { char: '♟', size: 90,  top: '14%', dir: 'rtl', duration: 58, delay: 0,    rot: 360,  opacity: 0.07 },
  { char: '♜', size: 110, top: '32%', dir: 'ltr', duration: 72, delay: -12,  rot: -360, opacity: 0.06 },
  { char: '♞', size: 80,  top: '64%', dir: 'rtl', duration: 60, delay: -28,  rot: 360,  opacity: 0.075 },
  { char: '♛', size: 100, top: '82%', dir: 'ltr', duration: 65, delay: -38,  rot: -360, opacity: 0.05 },
  { char: '⚀', size: 70,  top: '46%', dir: 'rtl', duration: 50, delay: -6,   rot: 360,  opacity: 0.07 },
  { char: '⚂', size: 75,  top: '8%',  dir: 'ltr', duration: 62, delay: -18,  rot: -360, opacity: 0.065 },
  { char: '⚄', size: 85,  top: '90%', dir: 'rtl', duration: 70, delay: -44,  rot: 360,  opacity: 0.055 },
  { char: '7',  size: 95,  top: '56%', dir: 'ltr', duration: 55, delay: -22,  rot: -360, opacity: 0.08 },
]

export default function GameSilhouettes() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 overflow-hidden"
      style={{ zIndex: 0 }}
    >
      {SILHOUETTES.map((s, i) => (
        <span
          key={i}
          className="absolute font-arcade leading-none"
          style={{
            top: s.top,
            left: 0,
            fontSize: `${s.size}px`,
            color: '#ffffff',
            opacity: s.opacity,
            willChange: 'transform',
            animation: `silhouette-drift-${s.dir} ${s.duration}s linear infinite`,
            animationDelay: `${s.delay}s`,
          }}
        >
          {s.char}
        </span>
      ))}
    </div>
  )
}
