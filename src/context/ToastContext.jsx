import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null)
  const timerRef = useRef(null)

  const dismiss = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
    setToast(null)
  }, [])

  const show = useCallback(
    (opts) => {
      if (timerRef.current) clearTimeout(timerRef.current)
      setToast(opts)
      const duration = opts.duration ?? 5000
      if (duration > 0) {
        timerRef.current = setTimeout(() => setToast(null), duration)
      }
    },
    [],
  )

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return (
    <ToastContext.Provider value={{ show, dismiss }}>
      {children}
      {toast && <ToastView toast={toast} onDismiss={dismiss} />}
    </ToastContext.Provider>
  )
}

function ToastView({ toast, onDismiss }) {
  const handleAction = () => {
    onDismiss()
    toast.action?.onClick?.()
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 left-1/2 z-[90] flex w-[min(90vw,28rem)] -translate-x-1/2 items-center gap-4 rounded-lg border border-neon-pink/60 bg-arcadia-surface/95 px-5 py-3 shadow-neon-pink backdrop-blur"
    >
      <div className="flex-1 text-sm text-white">{toast.message}</div>
      {toast.action && (
        <button
          type="button"
          onClick={handleAction}
          className="rounded-md border border-neon-cyan/60 bg-neon-cyan/10 px-3 py-1.5 font-arcade text-[10px] text-neon-cyan transition hover:bg-neon-cyan/20 hover:shadow-neon-cyan"
        >
          {toast.action.label}
        </button>
      )}
      <button
        type="button"
        onClick={onDismiss}
        className="font-arcade text-xs text-white/40 transition hover:text-white"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
