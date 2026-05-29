import { createPortal } from 'react-dom'
import { HallOfFameButton, WinParticles } from './GameOverFX'
import { LobbyBackLink } from '../context/GameOverFlashContext'
import { TrophyIcon } from '../assets/icons/index.jsx'

// One game-over overlay surface used by every single-player game. The
// outer layer is position: fixed inset 0 z-500 with a blurred dark
// scrim so it covers everything — including the canvas — regardless of
// what the game itself draws.
//
// variant:
//   'lose'     → pink border, shake
//   'win'      → green border, particle burst
//   'new-high' → gold border, larger star burst + "NEW HIGH SCORE!"

const VARIANTS = {
  lose: {
    borderColor: 'rgba(255, 0, 110, 0.5)',
    cornerCls: 'pixel-corners-pink',
    shake: true,
    icon: '💥',
    titleColor: 'text-neon-pink',
    shadowCls: 'shadow-neon-pink',
    burst: false,
  },
  win: {
    borderColor: 'rgba(0, 255, 136, 0.5)',
    cornerCls: '',
    shake: false,
    icon: '★',
    titleColor: 'text-neon-green',
    shadowCls: 'shadow-neon-green',
    burst: true,
  },
  'new-high': {
    borderColor: 'rgba(255, 215, 0, 0.6)',
    cornerCls: 'pixel-corners-amber',
    shake: false,
    IconComp: TrophyIcon,
    titleColor: 'text-amber-400',
    shadowCls: 'shadow-[0_0_18px_rgba(255,215,0,0.45)]',
    burst: 'gold',
  },
}

const GOLD_BURST = [
  { dx: -110, dy: -80, color: '#ffd700', delay: 0 },
  { dx: 110, dy: -80, color: '#ffd700', delay: 0.05 },
  { dx: -130, dy: 30, color: '#ffaa00', delay: 0.1 },
  { dx: 130, dy: 30, color: '#ffaa00', delay: 0.15 },
  { dx: 0, dy: -130, color: '#ffd700', delay: 0.08 },
  { dx: -80, dy: 100, color: '#ffaa00', delay: 0.12 },
  { dx: 80, dy: 100, color: '#ffd700', delay: 0.16 },
  { dx: -55, dy: -55, color: '#ffd700', delay: 0.2 },
  { dx: 55, dy: -55, color: '#ffaa00', delay: 0.24 },
]

function GoldBurst() {
  return (
    <span
      className="pointer-events-none absolute inset-0 overflow-visible"
      aria-hidden="true"
    >
      {GOLD_BURST.map((p, i) => (
        <span
          key={i}
          className="hs-burst font-arcade text-base"
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

export default function GameOverPanel({
  variant = 'lose',
  title,
  mainValue,
  mainLabel,
  secondaryValue,
  secondaryLabel,
  signedIn = false,
  onPrimary,
  primaryLabel = '▶ PLAY AGAIN',
  extras,
}) {
  if (typeof document === 'undefined') return null
  const v = VARIANTS[variant] ?? VARIANTS.lose

  const overlay = (
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center px-4"
      style={{
        background: 'rgba(5, 5, 8, 0.92)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`go-overlay-in glass-panel pixel-corners ${v.cornerCls} relative w-full max-w-[360px] overflow-visible px-6 py-6 text-center ${v.shadowCls}`}
        style={{
          borderColor: v.borderColor,
          borderWidth: 2,
          zIndex: 501,
        }}
      >
        {v.burst === 'gold' && <GoldBurst />}
        {v.burst === true && <WinParticles />}
        <p
          className={`relative font-arcade text-base ${v.titleColor} ${
            v.shake ? 'go-shake' : ''
          } md:text-lg`}
        >
          <span className="go-icon-pop inline-flex items-center">
            {v.IconComp ? (
              <v.IconComp size={18} aria-hidden="true" />
            ) : (
              v.icon
            )}
          </span>{' '}
          {title}
        </p>

        {mainValue != null && (
          <div className="relative mt-5">
            <p className="font-arcade text-[9px] tracking-widest text-white/45">
              {mainLabel}
            </p>
            <div
              className="mx-auto mt-2 inline-block rounded-md border px-5 py-2"
              style={{
                borderColor: v.borderColor,
                background: 'rgba(255, 255, 255, 0.03)',
              }}
            >
              <p
                className={`neon-text font-arcade text-3xl tabular-nums ${v.titleColor}`}
              >
                {mainValue}
              </p>
            </div>
          </div>
        )}

        {secondaryValue != null && (
          <div className="relative mt-4">
            <p className="font-arcade text-[9px] tracking-widest text-white/45">
              {secondaryLabel}
            </p>
            <p className="mt-1 font-arcade text-base tabular-nums text-white/80">
              {secondaryValue}
            </p>
          </div>
        )}

        {extras && <div className="relative mt-3">{extras}</div>}

        <div className="relative mt-6 flex flex-col gap-2">
          {onPrimary && (
            <button
              type="button"
              onClick={onPrimary}
              className="w-full rounded-md border border-neon-green/70 bg-neon-green/10 px-4 py-2 font-arcade text-[10px] text-neon-green transition hover:bg-neon-green/20 hover:shadow-neon-green"
            >
              {primaryLabel}
            </button>
          )}
          <HallOfFameButton
            signedIn={signedIn}
            className="w-full"
          />
          <LobbyBackLink className="w-full rounded-md border border-white/20 px-4 py-2 text-center font-arcade text-[10px] text-white/70 transition hover:border-neon-cyan/60 hover:text-neon-cyan">
            ◀ BACK TO LOBBY
          </LobbyBackLink>
        </div>
      </div>
    </div>
  )

  return createPortal(overlay, document.body)
}
