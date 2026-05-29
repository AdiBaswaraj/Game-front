import { useEffect, useRef, useState } from 'react'
import Navbar from '../components/Navbar'
import Hero from '../components/Hero'
import GameCard from '../components/GameCard'
import Footer from '../components/Footer'
import LobbyBackground from '../components/lobby/LobbyBackground'
import { games } from '../data/games'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

function useInView(threshold = 0.2) {
  const ref = useRef(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          obs.disconnect()
        }
      },
      { threshold },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return [ref, inView]
}

function SectionHeader() {
  const [ref, inView] = useInView(0.1)
  return (
    <div ref={ref} className={`io-fade-in mb-8 ${inView ? 'io-visible' : ''}`}>
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2
            className="neon-text-soft font-arcade text-lg md:text-2xl"
            style={{ color: 'var(--neon-green-soft)' }}
          >
            SELECT YOUR GAME
          </h2>
          <p className="mt-2 text-sm text-white/50">
            {games.length} cabinets available · solo &amp; versus
          </p>
        </div>
        <span className="hidden font-arcade text-[10px] text-neon-cyan/70 md:inline">
          ↳ PICK A TITLE
        </span>
      </div>
      <div className="neon-rule mt-4" />
    </div>
  )
}

export default function Lobby() {
  useDocumentTitle('Lobby')
  return (
    <div className="relative min-h-screen text-white">
      <LobbyBackground />
      <div className="relative z-10">
        <Navbar />
        <Hero />

        <main className="mx-auto max-w-7xl px-4 pb-12 pt-14 md:px-8">
          <SectionHeader />

          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6">
            {games.map((game, i) => (
              <GameCard key={game.id} game={game} index={i} />
            ))}
          </div>
        </main>

        <Footer />
      </div>
    </div>
  )
}
