import AmbientBackground from './AmbientBackground'
import ParticleField from './ParticleField'
import GameSilhouettes from './GameSilhouettes'

export default function LobbyBackground() {
  return (
    <>
      <div className="lobby-bg-gradient pointer-events-none fixed inset-0 -z-10" />
      <AmbientBackground />
      <GameSilhouettes />
      <ParticleField />
    </>
  )
}
