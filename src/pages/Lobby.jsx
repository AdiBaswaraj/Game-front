import Navbar from '../components/Navbar'
import Hero from '../components/Hero'
import GameCard from '../components/GameCard'
import Footer from '../components/Footer'
import { games } from '../data/games'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

export default function Lobby() {
  useDocumentTitle('Lobby')
  return (
    <div className="scanlines relative min-h-screen bg-arcadia-bg text-white">
      <Navbar />
      <Hero />

      <main className="mx-auto max-w-7xl px-4 pb-12 pt-14 md:px-8">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <h2 className="font-arcade text-lg text-white md:text-2xl">
              SELECT YOUR GAME
            </h2>
            <p className="mt-2 text-sm text-white/50">
              {games.length} cabinets available · solo & versus
            </p>
          </div>
          <span className="hidden font-arcade text-[10px] text-neon-cyan/70 md:inline">
            ↳ PICK A TITLE
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6">
          {games.map((game) => (
            <GameCard key={game.id} game={game} />
          ))}
        </div>
      </main>

      <Footer />
    </div>
  )
}
