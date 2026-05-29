// Ambient orbs + tiny drifting particles used inside the side-nav
// drawer. Pure-CSS animations; rendered behind content via z-index 0.
// `tint` switches the color palette: 'green' for the main panel,
// 'cyan' for the Friends sub-panel.

const PALETTES = {
  green: {
    orbA: 'rgba(0, 255, 136, 0.06)',
    orbB: 'rgba(0, 212, 255, 0.04)',
    orbC: 'rgba(112, 0, 255, 0.05)',
    dot:  'rgba(0, 255, 136, 0.55)',
  },
  cyan: {
    orbA: 'rgba(0, 212, 255, 0.08)',
    orbB: 'rgba(0, 212, 255, 0.05)',
    orbC: 'rgba(112, 0, 255, 0.05)',
    dot:  'rgba(0, 212, 255, 0.6)',
  },
}

// Fixed positions + drifts so the layout is stable across re-renders.
const PARTICLES = [
  { left: '12%',  top: '18%', dx: '14px',  dy: '-22px', dur: '9s'  },
  { left: '82%',  top: '12%', dx: '-18px', dy: '24px',  dur: '11s' },
  { left: '24%',  top: '46%', dx: '20px',  dy: '14px',  dur: '8s'  },
  { left: '68%',  top: '54%', dx: '-12px', dy: '-18px', dur: '12s' },
  { left: '38%',  top: '72%', dx: '16px',  dy: '-12px', dur: '10s' },
  { left: '88%',  top: '78%', dx: '-22px', dy: '-20px', dur: '13s' },
  { left: '18%',  top: '88%', dx: '14px',  dy: '20px',  dur: '9s'  },
]

export default function PanelAmbience({ tint = 'green' }) {
  const p = PALETTES[tint] ?? PALETTES.green
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ zIndex: 0 }}
    >
      {/* Three drifting orbs */}
      <div
        className="orb-drift-a absolute h-[120px] w-[120px] rounded-full blur-2xl"
        style={{ top: '8%', left: '20%', background: p.orbA }}
      />
      <div
        className="orb-drift-b absolute h-[80px] w-[80px] rounded-full blur-2xl"
        style={{ top: '46%', left: '60%', background: p.orbB }}
      />
      <div
        className="orb-drift-c absolute h-[100px] w-[100px] rounded-full blur-2xl"
        style={{ top: '78%', left: '18%', background: p.orbC }}
      />

      {/* Drifting particle dots */}
      {PARTICLES.map((q, i) => (
        <span
          key={i}
          className="panel-particle absolute block h-[2px] w-[2px] rounded-full"
          style={{
            left: q.left,
            top: q.top,
            background: p.dot,
            boxShadow: `0 0 6px ${p.dot}`,
            '--dx': q.dx,
            '--dy': q.dy,
            '--dur': q.dur,
          }}
        />
      ))}
    </div>
  )
}
