import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

const ToastContext = createContext(null)

const TONES = {
  success: {
    border: 'border-neon-green/70',
    glow: 'shadow-neon-green',
    icon: '✓',
    iconColor: 'text-neon-green',
  },
  error: {
    border: 'border-neon-pink/70',
    glow: 'shadow-neon-pink',
    icon: '✕',
    iconColor: 'text-neon-pink',
  },
  info: {
    border: 'border-neon-cyan/70',
    glow: 'shadow-neon-cyan',
    icon: 'ℹ',
    iconColor: 'text-neon-cyan',
  },
  warning: {
    border: 'border-amber-400/70',
    glow: 'shadow-[0_0_18px_rgba(251,191,36,0.45)]',
    icon: '⚠',
    iconColor: 'text-amber-400',
  },
}

const DEFAULT_DURATIONS = {
  success: 3500,
  info: 3500,
  warning: 4500,
  error: 5000,
}

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null)
  const timerRef = useRef(null)

  const dismiss = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
    setToast(null)
  }, [])

  const show = useCallback((opts) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    const tone = TONES[opts.tone] ? opts.tone : 'info'
    const next = { ...opts, tone, id: Date.now() + Math.random() }
    setToast(next)
    const duration = opts.duration ?? DEFAULT_DURATIONS[tone]
    if (duration > 0) {
      timerRef.current = setTimeout(() => setToast(null), duration)
    }
  }, [])

  const success = useCallback(
    (message, opts = {}) => show({ ...opts, tone: 'success', message }),
    [show],
  )
  const error = useCallback(
    (message, opts = {}) => show({ ...opts, tone: 'error', message }),
    [show],
  )
  const info = useCallback(
    (message, opts = {}) => show({ ...opts, tone: 'info', message }),
    [show],
  )
  const warning = useCallback(
    (message, opts = {}) => show({ ...opts, tone: 'warning', message }),
    [show],
  )

  const value = useMemo(
    () => ({ show, success, error, info, warning, dismiss }),
    [show, success, error, info, warning, dismiss],
  )

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast && <ToastView key={toast.id} toast={toast} onDismiss={dismiss} />}
    </ToastContext.Provider>
  )
}

function ToastView({ toast, onDismiss }) {
  const t = TONES[toast.tone] ?? TONES.info
  const handleAction = () => {
    onDismiss()
    toast.action?.onClick?.()
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={`toast-in fixed left-1/2 z-[1300] flex w-[min(90vw,28rem)] -translate-x-1/2 items-center gap-3 rounded-lg border bg-arcadia-surface/95 px-5 py-3 backdrop-blur ${t.border} ${t.glow}`}
      style={{ top: 'calc(env(safe-area-inset-top, 0px) + 76px)' }}
    >
      <span className={`font-arcade text-sm ${t.iconColor}`} aria-hidden="true">
        {t.icon}
      </span>
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
