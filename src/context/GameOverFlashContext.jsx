import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate } from 'react-router-dom'

const Ctx = createContext(null)

export function GameOverFlashProvider({ children }) {
  const [flashing, setFlashing] = useState(false)
  const armedRef = useRef(false)

  const arm = useCallback(() => {
    armedRef.current = true
  }, [])
  const disarm = useCallback(() => {
    armedRef.current = false
  }, [])

  // Plays the full-screen flash for 200ms if armed; otherwise resolves
  // immediately. Returns a Promise so callers can `await` then navigate.
  const flash = useCallback(() => {
    if (!armedRef.current) return Promise.resolve()
    armedRef.current = false
    setFlashing(true)
    return new Promise((resolve) => {
      setTimeout(() => {
        setFlashing(false)
        resolve()
      }, 200)
    })
  }, [])

  const value = useMemo(() => ({ arm, disarm, flash }), [arm, disarm, flash])

  return (
    <Ctx.Provider value={value}>
      {children}
      {flashing &&
        typeof document !== 'undefined' &&
        createPortal(<FlashOverlay />, document.body)}
    </Ctx.Provider>
  )
}

function FlashOverlay() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flash-fade fixed inset-0 z-[9000] flex items-center justify-center"
      style={{
        background: 'rgba(5, 5, 8, 0.92)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      <p className="neon-text font-arcade text-sm text-neon-green md:text-base">
        GAME OVER — RETURNING TO LOBBY
      </p>
    </div>
  )
}

export function useGameOverFlash() {
  return useContext(Ctx)
}

// Arms the flash when `isOver` becomes true, disarms when it goes false.
// Drop this into any game with terminal state to opt the BACK TO LOBBY
// links inside game-over overlays into the flash transition.
export function useArmGameOverFlash(isOver) {
  const ctx = useContext(Ctx)
  useEffect(() => {
    if (!ctx) return
    if (isOver) ctx.arm()
    else ctx.disarm()
  }, [isOver, ctx])
}

// Drop-in replacement for <Link to="/">…</Link> inside game-over
// overlays. If the flash is armed it plays the 200ms transition then
// navigates; otherwise it navigates immediately. Identical visual API
// to react-router-dom Link.
export function LobbyBackLink({ to = '/', children, onClick, ...rest }) {
  const ctx = useContext(Ctx)
  const navigate = useNavigate()
  const handleClick = async (e) => {
    if (onClick) onClick(e)
    if (e.defaultPrevented) return
    if (!ctx) return
    e.preventDefault()
    await ctx.flash()
    navigate(to)
  }
  return (
    <Link to={to} onClick={handleClick} {...rest}>
      {children}
    </Link>
  )
}
