// Four breathing colour blobs anchored to the corners of the
// viewport. Pure CSS — animation lives in index.css (.ambient-blob +
// @keyframes ambient-breathe). Each blob expands from scale 1 → 1.4
// and fades 0.6 → 1 over its duration, with a staggered delay so the
// composite never feels mechanically synchronised.

const BLOBS = [
  {
    color: 'rgba(0, 255, 136, 0.07)',
    top: '-10%',
    left: '-10%',
    delay: '0s',
    duration: '10s',
  },
  {
    color: 'rgba(0, 212, 255, 0.05)',
    top: '-10%',
    right: '-10%',
    delay: '3s',
    duration: '13s',
  },
  {
    color: 'rgba(112, 0, 255, 0.05)',
    bottom: '-10%',
    left: '-10%',
    delay: '6s',
    duration: '11s',
  },
  {
    color: 'rgba(255, 0, 110, 0.04)',
    bottom: '-10%',
    right: '-10%',
    delay: '9s',
    duration: '12s',
  },
]

export default function AmbientBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 overflow-hidden"
      style={{ zIndex: 0 }}
    >
      {BLOBS.map((b, i) => (
        <span
          key={i}
          className="ambient-blob"
          style={{
            top: b.top,
            left: b.left,
            right: b.right,
            bottom: b.bottom,
            background: b.color,
            '--dur': b.duration,
            '--delay': b.delay,
          }}
        />
      ))}
    </div>
  )
}
