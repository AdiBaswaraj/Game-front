import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import Lobby from './pages/Lobby'
import GamePage from './pages/GamePage'
import RoomPage from './pages/RoomPage'
import LeaderboardPage from './pages/LeaderboardPage'
import ProfilePage from './pages/ProfilePage'
import SettingsPage from './pages/SettingsPage'
import JoinByCodePage from './pages/JoinByCodePage'
import PrivacyPage from './pages/legal/PrivacyPage'
import TermsPage from './pages/legal/TermsPage'
import CookiesPage from './pages/legal/CookiesPage'
import Navbar from './components/Navbar'
import PageTransition from './components/PageTransition'
import { FriendsProvider } from './context/FriendsContext'
import { LeaveGuardProvider } from './context/LeaveGuardContext'
import { GameOverFlashProvider } from './context/GameOverFlashContext'

// Game pages have their own fixed header (GameLayout) — showing the
// main Navbar there would double up. Everywhere else the Navbar lives
// at App scope so it persists across navigation and stays visible
// while pages scroll underneath.
function AppShell() {
  const location = useLocation()
  const isGameRoute =
    location.pathname.startsWith('/game/') ||
    location.pathname.startsWith('/room/')
  return (
    <>
      {!isGameRoute && <Navbar />}
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
          <Route path="/profile/:username" element={<ProfilePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/join/:roomCode" element={<JoinByCodePage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/cookies" element={<CookiesPage />} />
        </Routes>
      </PageTransition>
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <FriendsProvider>
        <LeaveGuardProvider>
          <GameOverFlashProvider>
            <div className="scanlines">
              <AppShell />
            </div>
          </GameOverFlashProvider>
        </LeaveGuardProvider>
      </FriendsProvider>
    </BrowserRouter>
  )
}
