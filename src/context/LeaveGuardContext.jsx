import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'

const LeaveGuardContext = createContext(null)

// A leave guard is `(commit) => boolean | void`. Returning `false` (or
// asynchronously calling commit later) defers the navigation. Returning
// `true` (or anything truthy) lets it through. If no guard is
// registered, navigation proceeds normally.
export function LeaveGuardProvider({ children }) {
  const guardRef = useRef(null)
  // We expose request as a stable identity so consumers can subscribe
  // without thrashing.
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

// Register a guard for the lifetime of the component (when `active`).
// `onAttempt({ commit, cancel })` is called when the back link is hit.
export function useRegisterLeaveGuard(active, onAttempt) {
  const ctx = useLeaveGuardContext()
  const [askArgs, setAskArgs] = useState(null)

  useEffect(() => {
    if (!ctx || !active) return
    const guard = (req) => {
      // Defer to consumer with a commit/cancel pair.
      setAskArgs({
        commit: () => {
          setAskArgs(null)
          req.commit()
        },
        cancel: () => setAskArgs(null),
        target: req.target,
      })
      return false // block default navigation
    }
    const unregister = ctx.registerGuard(guard)
    return unregister
  }, [active, ctx])

  // Forward the latest ask to the consumer via callback when it appears
  useEffect(() => {
    if (!askArgs) return
    onAttempt?.(askArgs)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [askArgs])

  return askArgs
}
