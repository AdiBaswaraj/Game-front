import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { profileNameFor } from '../lib/profile'

export default function UsernamePromptModal() {
  const { user, loading } = useAuth()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)
  const checkedForRef = useRef(null)
  const inputRef = useRef(null)

  // Decide whether to show the prompt by querying the profiles table.
  // We only check once per user.id — if the row has a non-empty
  // username, the prompt is suppressed forever for that user.
  useEffect(() => {
    if (loading) return
    if (!user) {
      setOpen(false)
      checkedForRef.current = null
      return
    }
    if (checkedForRef.current === user.id) return

    let cancelled = false
    ;(async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', user.id)
          .maybeSingle()
        if (cancelled) return
        checkedForRef.current = user.id

        if (error) {
          console.warn('[username-prompt] profile fetch failed', error)
          return
        }
        const existing = (data?.username ?? '').trim()
        if (existing) {
          // Already has a username — nothing to prompt.
          setOpen(false)
          return
        }
        // No username yet — prefill with whatever metadata we have,
        // never show an empty input.
        const fallback = profileNameFor(user) ?? ''
        setValue(fallback)
        setOpen(true)
        setTimeout(() => inputRef.current?.focus(), 60)
      } catch (err) {
        console.warn('[username-prompt] exception', err)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user, loading])

  // ESC closes
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const close = () => setOpen(false)

  const save = async (e) => {
    e?.preventDefault()
    const trimmed = value.trim()
    if (!trimmed || !user) {
      close()
      return
    }
    setSaving(true)
    try {
      const { error: pErr } = await supabase.from('profiles').upsert(
        {
          id: user.id,
          username: trimmed,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' },
      )
      if (pErr) throw pErr
      // Keep auth metadata in sync so profileNameFor returns the chosen
      // name without an extra round-trip.
      const { error: aErr } = await supabase.auth.updateUser({
        data: { full_name: trimmed },
      })
      if (aErr) throw aErr
      toast.success('Username set.')
      close()
    } catch (err) {
      console.error('[username-prompt] save failed', err)
      toast.error('Could not save username. Try again.')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
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
            onClick={close}
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
