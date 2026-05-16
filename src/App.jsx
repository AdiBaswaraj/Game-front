import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Lobby from './pages/Lobby'
import GamePage from './pages/GamePage'
import RoomPage from './pages/RoomPage'
import LeaderboardPage from './pages/LeaderboardPage'
import ProfilePage from './pages/ProfilePage'
import { FriendsProvider } from './context/FriendsContext'

export default function App() {
  return (
    <BrowserRouter>
      <FriendsProvider>
        <Routes>
          <Route path="/" element={<Lobby />} />
          <Route path="/game/:gameId" element={<GamePage />} />
          <Route path="/game/:gameId/:difficulty" element={<GamePage />} />
          <Route
            path="/game/:gameId/:difficulty/:variant"
            element={<GamePage />}
          />
          <Route path="/room/:roomCode" element={<RoomPage />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/profile/:username" element={<ProfilePage />} />
        </Routes>
      </FriendsProvider>
    </BrowserRouter>
  )
}
