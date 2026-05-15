import { useParams } from 'react-router-dom'

export default function GamePage() {
  const { gameId } = useParams()
  return (
    <div className="flex min-h-screen items-center justify-center bg-arcadia-bg">
      <h1 className="font-arcade text-xl text-neon-cyan md:text-3xl">
        GAME: {gameId}
      </h1>
    </div>
  )
}
