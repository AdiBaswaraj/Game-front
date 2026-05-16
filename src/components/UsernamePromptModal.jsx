import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'

const PROMPT_PREFIX = 'arcadia:usernamePrompted:'

export default function UsernamePromptModal() {
  const { user, displayName, loading } = useAuth()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    if (loading || !user) return
    const key = `${PROMPT_PREFIX}${user.id}`
    if (localStorage.getItem(key)) return
    setValue(displayName ?? '')
    setOpen(true)
    setTimeout(() => inputRef.current?.focus(), 60)
  }, [user, displayName, loading])

  const close = (rememberSkip) => {
    if (rememberSkip && user) {
      try {
        localStorage.setItem(`${PROMPT_PREFIX}${user.id}`, '1')
      } catch {}
    }
    setOpen(false)
  }

  const save = async (e) => {
    e?.preventDefault()
    const trimmed = value.trim()
    if (!trimmed || !user) {
      close(true)
      return
    }
    if (trimmed === displayName) {
      close(true)
      return
    }
    setSaving(true)
    try {
      const { error: pErr } = await supabase
        .from('profiles')
        .update({ username: trimmed })
        .eq('id', user.id)
      if (pErr) throw pErr
      const { error: aErr } = await supabase.auth.updateUser({
        data: { full_name: trimmed },
      })
      if (aErr) throw aErr
      toast.show({ message: 'Username set.', duration: 2500 })
      close(true)
    } catch (err) {
      console.error('[username-prompt] update failed', err)
      toast.show({
        message: 'Could not save username.',
        duration: 3000,
      })
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Choose username"
    >
      <form
        onSubmit={save}
        className="w-full max-w-sm rounded-xl border border-neon-cyan/50 bg-arcadia-surface p-6 shadow-neon-cyan"
      >
        <h2 className="font-arcade text-sm text-neon-cyan drop-shadow-[0_0_8px_rgba(0,212,255,0.5)]">
          ★ CHOOSE YOUR ARCADE NAME
        </h2>
        <p className="mt-2 text-xs text-white/55">
          This is what other players see on leaderboards and in rooms.
          You can change it later from your profile.
        </p>
        <label className="mt-5 block">
          <span className="font-arcade text-[9px] uppercase text-white/55">
            Username
          </span>
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value.slice(0, 24))}
            placeholder="Player_4821"
            maxLength={24}
            className="mt-1 w-full rounded-md border border-white/10 bg-arcadia-bg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-neon-cyan focus:outline-none focus:ring-1 focus:ring-neon-cyan/40"
          />
        </label>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => close(true)}
            className="rounded-md border border-white/15 px-4 py-2 font-arcade text-[10px] text-white/60 hover:border-neon-pink/60 hover:text-neon-pink"
          >
            SKIP
          </button>
          <button
            type="submit"
            disabled={saving || !value.trim()}
            className="rounded-md border border-neon-green/70 bg-neon-green/10 px-4 py-2 font-arcade text-[10px] text-neon-green hover:bg-neon-green/20 hover:shadow-neon-green disabled:opacity-50"
          >
            {saving ? '...' : '▶ CONFIRM'}
          </button>
        </div>
      </form>
    </div>
  )
}
