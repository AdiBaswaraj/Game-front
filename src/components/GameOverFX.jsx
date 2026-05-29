import { Link } from 'react-router-dom'
import { TrophyIcon } from '../assets/icons/index.jsx'

const PARTICLES = [
  { dx: -100, dy: -80, delay: 0,    color: '#00ff88' },
  { dx:  100, dy: -80, delay: 0.06, color: '#00d4ff' },
  { dx: -120, dy:  30, delay: 0.10, color: '#00ff88' },
  { dx:  120, dy:  30, delay: 0.14, color: '#ffd700' },
  { dx:    0, dy: -120, delay: 0.08, color: '#00d4ff' },
  { dx:  -60, dy:  90, delay: 0.16, color: '#ffd700' },
  { dx:   60, dy:  90, delay: 0.20, color: '#00ff88' },
]

export function WinParticles() {
  return (
    <span
      className="pointer-events-none absolute inset-0 overflow-visible"
      aria-hidden="true"
    >
      {PARTICLES.map((p, i) => (
        <span
          key={i}
          className="go-particle font-arcade text-base"
          style={{
            left: '50%',
            top: '40%',
            color: p.color,
            textShadow: `0 0 10px ${p.color}, 0 0 18px ${p.color}80`,
            '--dx': `${p.dx}px`,
            '--dy': `${p.dy}px`,
            animationDelay: `${p.delay}s`,
          }}
        >
          ★
        </span>
      ))}
    </span>
  )
}

export function HallOfFameButton({ signedIn, className = '' }) {
  if (!signedIn) return null
  return (
    <Link
      to="/leaderboard"
      className={`inline-flex items-center justify-center gap-1.5 rounded-md border border-neon-cyan/60 bg-neon-cyan/10 px-4 py-2 text-center font-arcade text-[10px] text-neon-cyan transition hover:bg-neon-cyan/20 hover:shadow-neon-cyan ${className}`}
    >
      <TrophyIcon size={14} aria-hidden="true" />
      <span>HALL OF FAME</span>
    </Link>
  )
}
