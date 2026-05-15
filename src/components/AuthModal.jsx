import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function AuthModal({ open, initialTab = 'login', onClose }) {
  const { continueAsGuest } = useAuth()
  const [tab, setTab] = useState(initialTab)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const emailRef = useRef(null)

  useEffect(() => {
    if (open) {
      setTab(initialTab)
      setError('')
      setInfo('')
      setTimeout(() => emailRef.current?.focus(), 50)
    }
  }, [open, initialTab])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    setInfo('')
    try {
      if (tab === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw error
        onClose()
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        if (data.session) {
          onClose()
        } else {
          setInfo('Check your email to confirm your account.')
        }
      }
    } catch (err) {
      setError(err?.message ?? 'Something went wrong.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleGoogle = async () => {
    setError('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (error) setError(error.message)
  }

  const isLogin = tab === 'login'

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Authentication"
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-xl border border-neon-cyan/50 bg-arcadia-surface shadow-neon-cyan"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 rounded p-1 font-arcade text-xs text-white/50 transition hover:text-neon-pink"
          aria-label="Close"
        >
          ✕
        </button>

        <div className="border-b border-white/5 px-6 py-5">
          <h2 className="font-arcade text-sm text-neon-green md:text-base">
            ★ {isLogin ? 'INSERT COIN' : 'NEW PLAYER'}
          </h2>
          <p className="mt-1 text-xs text-white/45">
            {isLogin ? 'Welcome back, player.' : 'Create your arcade account.'}
          </p>
        </div>

        <div className="flex gap-2 px-6 pt-5">
          <button
            type="button"
            onClick={() => setTab('login')}
            className={`flex-1 rounded-md border px-3 py-2 font-arcade text-[10px] transition ${
              isLogin
                ? 'border-neon-green/60 bg-neon-green/10 text-neon-green'
                : 'border-white/10 text-white/50 hover:text-white'
            }`}
          >
            LOGIN
          </button>
          <button
            type="button"
            onClick={() => setTab('signup')}
            className={`flex-1 rounded-md border px-3 py-2 font-arcade text-[10px] transition ${
              !isLogin
                ? 'border-neon-pink/60 bg-neon-pink/10 text-neon-pink'
                : 'border-white/10 text-white/50 hover:text-white'
            }`}
          >
            SIGN UP
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 px-6 py-5">
          <label className="block">
            <span className="font-arcade text-[9px] uppercase text-white/55">
              Email
            </span>
            <input
              ref={emailRef}
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-white/10 bg-arcadia-bg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-neon-cyan focus:outline-none focus:ring-1 focus:ring-neon-cyan/40"
              placeholder="player@arcadia.gg"
            />
          </label>

          <label className="block">
            <span className="font-arcade text-[9px] uppercase text-white/55">
              Password
            </span>
            <input
              type="password"
              required
              minLength={6}
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-white/10 bg-arcadia-bg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-neon-cyan focus:outline-none focus:ring-1 focus:ring-neon-cyan/40"
              placeholder="••••••••"
            />
          </label>

          {error && (
            <p className="text-xs text-neon-pink" role="alert">
              {error}
            </p>
          )}
          {info && <p className="text-xs text-neon-cyan">{info}</p>}

          <button
            type="submit"
            disabled={submitting}
            className={`w-full rounded-md border py-2.5 font-arcade text-[11px] transition disabled:opacity-50 ${
              isLogin
                ? 'border-neon-green/60 text-neon-green hover:bg-neon-green/15 hover:shadow-neon-green'
                : 'border-neon-pink/60 text-neon-pink hover:bg-neon-pink/15 hover:shadow-neon-pink'
            }`}
          >
            {submitting ? '...' : isLogin ? '▶ LOGIN' : '▶ CREATE ACCOUNT'}
          </button>
        </form>

        <div className="flex items-center gap-3 px-6">
          <span className="h-px flex-1 bg-white/10" />
          <span className="font-arcade text-[9px] text-white/40">OR</span>
          <span className="h-px flex-1 bg-white/10" />
        </div>

        <div className="space-y-2 px-6 py-5">
          <button
            type="button"
            onClick={handleGoogle}
            className="flex w-full items-center justify-center gap-2 rounded-md border border-white/15 bg-white/5 py-2.5 text-sm text-white transition hover:border-neon-cyan/60 hover:text-neon-cyan"
          >
            <span aria-hidden="true">🔑</span>
            Continue with Google
          </button>

          <button
            type="button"
            onClick={continueAsGuest}
            className="w-full rounded-md border border-dashed border-white/20 py-2.5 font-arcade text-[10px] text-white/60 transition hover:border-neon-cyan/40 hover:text-neon-cyan"
          >
            ▷ CONTINUE AS GUEST
          </button>
          <p className="pt-1 text-center text-[10px] text-white/35">
            Guests can play but won't keep scores or friends.
          </p>
        </div>
      </div>
    </div>
  )
}
