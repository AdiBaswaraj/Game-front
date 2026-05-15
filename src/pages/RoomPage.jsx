import { useParams } from 'react-router-dom'

export default function RoomPage() {
  const { roomCode } = useParams()
  return (
    <div className="flex min-h-screen items-center justify-center bg-arcadia-bg">
      <h1 className="font-arcade text-xl text-neon-pink md:text-3xl">
        ROOM: {roomCode}
      </h1>
    </div>
  )
}
