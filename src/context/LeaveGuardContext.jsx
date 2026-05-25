import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'

const LeaveGuardContext = createContext(null)

// A leave guard is `(req) => boolean | void` where req carries
// `{ target, commit }`. Returning `false` blocks the default
// navigation; the guard is expected to call `req.commit()` later
// (e.g. after the user confirms in a modal). Returning anything else
// lets navigation proceed.
export function LeaveGuardProvider({ children }) {
  const guardRef = useRef(null)
  const requestLeave = useCallback((args) => {
    const guard = guardRef.current
    if (!guard) return true
    return guard(args)
  }, [])

  const registerGuard = useCallback((fn) => {
    guardRef.current = fn
    return () => {
      if (guardRef.current === fn) guardRef.current = null
    }
  }, [])

  return (
    <LeaveGuardContext.Provider value={{ requestLeave, registerGuard }}>
      {children}
    </LeaveGuardContext.Provider>
  )
}

export function useLeaveGuardContext() {
  return useContext(LeaveGuardContext)
}

// Lower-level hook — register a guard and receive {commit, cancel}
// when the user attempts to leave. Consumers manage their own modal.
export function useRegisterLeaveGuard(active, onAttempt) {
  const ctx = useLeaveGuardContext()
  const [askArgs, setAskArgs] = useState(null)

  useEffect(() => {
    if (!ctx || !active) return
    const guard = (req) => {
      setAskArgs({
        commit: () => {
          setAskArgs(null)
          req.commit()
        },
        cancel: () => setAskArgs(null),
        target: req.target,
      })
      return false
    }
    const unregister = ctx.registerGuard(guard)
    return unregister
  }, [active, ctx])

  useEffect(() => {
    if (!askArgs) return
    onAttempt?.(askArgs)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [askArgs])

  return askArgs
}

// Higher-level hook that renders its own confirmation modal. Most
// games should use this. Returns React JSX (portaled) to render
// wherever convenient — placement doesn't affect the modal position.
//
// kind:   'single' or 'multi'
// active: when true the guard is registered
// onForfeit: required for 'multi'; called BEFORE commit when the user
//   chooses to leave. Typically emits game_over to the server.
export function useGameLeaveGuard({ active, kind = 'single', onForfeit }) {
  const ctx = useLeaveGuardContext()
  const [askArgs, setAskArgs] = useState(null)

  useEffect(() => {
    if (!ctx || !active) return
    const guard = (req) => {
      setAskArgs(req)
      return false
    }
    return ctx.registerGuard(guard)
  }, [active, ctx])

  // beforeunload safety net for refresh / tab close
  useEffect(() => {
    if (!active) return
    const handler = (e) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [active])

  if (typeof document === 'undefined' || !askArgs) return null

  const handleStay = () => setAskArgs(null)
  const handleLeave = async () => {
    const commit = askArgs.commit
    setAskArgs(null)
    if (kind === 'multi' && onForfeit) {
      try {
        await onForfeit()
      } catch {
        // never block navigation on a failed forfeit emit
      }
    }
    commit?.()
  }

  return createPortal(
    <LeaveConfirmModal kind={kind} onStay={handleStay} onLeave={handleLeave} />,
    document.body,
  )
}

function LeaveConfirmModal({ kind, onStay, onLeave }) {
  const isMulti = kind === 'multi'
  return (
    <div
      className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`w-full max-w-sm rounded-xl border-2 bg-arcadia-surface p-6 ${
          isMulti
            ? 'border-neon-pink/60 shadow-neon-pink'
            : 'border-neon-cyan/60 shadow-neon-cyan'
        }`}
      >
        <h3
          className={`font-arcade text-sm ${
            isMulti ? 'text-neon-pink' : 'text-neon-cyan'
          }`}
        >
          ⚠ LEAVE GAME?
        </h3>
        <p className="mt-3 text-xs text-white/65">
          {isMulti
            ? 'You will forfeit the match. Your opponent wins.'
            : 'Your progress will be lost and not saved.'}
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onStay}
            className="rounded-md border border-neon-green/70 bg-neon-green/10 px-4 py-2 font-arcade text-[10px] text-neon-green hover:bg-neon-green/20 hover:shadow-neon-green"
          >
            STAY IN GAME
          </button>
          <button
            type="button"
            onClick={onLeave}
            className="rounded-md border border-neon-pink/70 bg-neon-pink/10 px-4 py-2 font-arcade text-[10px] text-neon-pink hover:bg-neon-pink/20 hover:shadow-neon-pink"
          >
            {isMulti ? '🏳 FORFEIT' : 'LEAVE'}
          </button>
        </div>
      </div>
    </div>
  )
}
