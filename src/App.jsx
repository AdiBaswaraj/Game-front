import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Lobby from './pages/Lobby'
import GamePage from './pages/GamePage'
import RoomPage from './pages/RoomPage'
import LeaderboardPage from './pages/LeaderboardPage'
import ProfilePage from './pages/ProfilePage'
import SettingsPage from './pages/SettingsPage'
import JoinByCodePage from './pages/JoinByCodePage'
import PageTransition from './components/PageTransition'
import { FriendsProvider } from './context/FriendsContext'
import { LeaveGuardProvider } from './context/LeaveGuardContext'
import { GameOverFlashProvider } from './context/GameOverFlashContext'

export default function App() {
  return (
    <BrowserRouter>
      <FriendsProvider>
        <LeaveGuardProvider>
          <GameOverFlashProvider>
            <div className="scanlines">
              <PageTransition>
                <Routes>
                  <Route path="/" element={<Lobby />} />
                  <Route path="/game/:gameId" element={<GamePage />} />
                  <Route
                    path="/game/:gameId/:difficulty"
                    element={<GamePage />}
                  />
                  <Route
                    path="/game/:gameId/:difficulty/:variant"
                    element={<GamePage />}
                  />
                  <Route path="/room/:roomCode" element={<RoomPage />} />
                  <Route path="/leaderboard" element={<LeaderboardPage />} />
                  <Route
                    path="/profile/:username"
                    element={<ProfilePage />}
                  />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route
                    path="/join/:roomCode"
                    element={<JoinByCodePage />}
                  />
                </Routes>
              </PageTransition>
            </div>
          </GameOverFlashProvider>
        </LeaveGuardProvider>
      </FriendsProvider>
    </BrowserRouter>
  )
}
