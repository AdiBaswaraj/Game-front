import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'

const ACCENTS = {
  'neon-green': {
    cornerClass: 'pixel-corners',
    title: 'text-neon-green',
    badge: 'border-neon-green/50 bg-neon-green/10 text-neon-green',
    btnIdle:
      'border-neon-green/60 text-neon-green hover:bg-neon-green hover:text-arcadia-bg hover:border-neon-green hover:shadow-neon-green',
    glow: 'group-hover:shadow-neon-green',
  },
  'neon-cyan': {
    cornerClass: 'pixel-corners pixel-corners-cyan',
    title: 'text-neon-cyan',
    badge: 'border-neon-cyan/50 bg-neon-cyan/10 text-neon-cyan',
    btnIdle:
      'border-neon-cyan/60 text-neon-cyan hover:bg-neon-cyan hover:text-arcadia-bg hover:border-neon-cyan hover:shadow-neon-cyan',
    glow: 'group-hover:shadow-neon-cyan',
  },
  'neon-pink': {
    cornerClass: 'pixel-corners pixel-corners-pink',
    title: 'text-neon-pink',
    badge: 'border-neon-pink/50 bg-neon-pink/10 text-neon-pink',
    btnIdle:
      'border-neon-pink/60 text-neon-pink hover:bg-neon-pink hover:text-arcadia-bg hover:border-neon-pink hover:shadow-neon-pink',
    glow: 'group-hover:shadow-neon-pink',
  },
}

export default function GameCard({ game, index = 0 }) {
  const navigate = useNavigate()
  const { user, openLogin } = useAuth()
  const toast = useToast()
  const a = ACCENTS[game.accent] ?? ACCENTS['neon-green']

  const handlePlay = () => {
    if (game.multiplayer) {
      if (game.hasModeSelect) {
        navigate(`/game/${game.id}/mode`)
        return
      }
      if (!user) {
        toast.show({
          message: 'Login required for multiplayer.',
          action: { label: 'LOGIN', onClick: openLogin },
        })
        return
      }
      navigate(`/game/${game.id}/room`)
      return
    }
    if (game.hasDifficulty) {
      navigate(`/game/${game.id}/difficulty`)
    } else {
      navigate(`/game/${game.id}`)
    }
  }

  return (
    <article
      className={`lobby-card group relative flex flex-col gap-4 rounded-lg p-6 transition-all duration-200 ease-out hover:-translate-y-1 active:-translate-y-0 ${a.cornerClass} ${a.glow}`}
      style={{
        background: 'var(--bg-surface)',
        backdropFilter: 'var(--glass-blur)',
        WebkitBackdropFilter: 'var(--glass-blur)',
        border: '1px solid var(--glass-border)',
        boxShadow: 'var(--glass-shadow)',
        '--card-index': index,
      }}
    >
      <span
        className={`absolute right-3 top-3 rounded-md border px-2 py-0.5 font-arcade text-[9px] ${a.badge}`}
      >
        {game.players}
      </span>

      <span
        className="lobby-card-icon inline-flex h-12 w-12 items-center justify-center transition-transform duration-200 group-hover:-translate-y-1"
        aria-hidden="true"
      >
        {game.Icon ? <game.Icon size={48} /> : <span className="text-4xl">{game.icon}</span>}
      </span>

      <div className="min-w-0">
        <h3 className={`font-arcade text-sm leading-snug ${a.title}`}>
          {game.name}
        </h3>
        <p className="mt-1.5 text-xs uppercase tracking-widest text-white/45">
          {game.category}
        </p>
      </div>

      <button
        type="button"
        onClick={handlePlay}
        className={`mt-auto w-full rounded-md border bg-transparent py-2.5 font-arcade text-[11px] transition-all duration-200 ease-out ${a.btnIdle}`}
      >
        ▶ PLAY
      </button>
    </article>
  )
}
