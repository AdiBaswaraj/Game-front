import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useFriends } from '../context/FriendsContext'
import { useToast } from '../context/ToastContext'
import { getLeaderboard } from '../lib/api'
import { supabase } from '../lib/supabase'
import { profileNameFor } from '../lib/profile'
import Avatar from '../components/Avatar'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

const SINGLE_PLAYER_GAMES = [
  { id: 'snake', name: 'Snake', icon: '🐍', scoreFormat: 'points', lowerIsBetter: false },
  { id: 'sudoku-easy', name: 'Sudoku · Easy', icon: '🔢', scoreFormat: 'time', lowerIsBetter: true },
  { id: 'sudoku-medium', name: 'Sudoku · Medium', icon: '🔢', scoreFormat: 'time', lowerIsBetter: true },
  { id: 'sudoku-hard', name: 'Sudoku · Hard', icon: '🔢', scoreFormat: 'time', lowerIsBetter: true },
  { id: 'minesweeper-easy', name: 'Minesweeper · Easy', icon: '💣', scoreFormat: 'time', lowerIsBetter: true },
  { id: 'minesweeper-medium', name: 'Minesweeper · Medium', icon: '💣', scoreFormat: 'time', lowerIsBetter: true },
  { id: 'minesweeper-hard', name: 'Minesweeper · Hard', icon: '💣', scoreFormat: 'time', lowerIsBetter: true },
  { id: 'word-puzzle', name: 'Word Puzzle', icon: '🔤', scoreFormat: 'guesses', lowerIsBetter: true },
]

const MULTIPLAYER_GAMES = [
  { id: 'chess', name: 'Chess', icon: '♟️' },
  { id: 'snake-and-ladder', name: 'Snake & Ladder', icon: '🎲' },
]

function formatScore(format, n) {
  const v = Number(n) || 0
  if (format === 'time') {
    const m = Math.floor(v / 60)
    const r = v % 60
    return m > 0 ? `${m}:${String(r).padStart(2, '0')}` : `${r}s`
  }
  if (format === 'guesses') return v >= 7 ? 'X/6' : `${v}/6`
  return String(v).padStart(6, '0')
}

function formatDate(s) {
  if (!s) return '—'
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function ProfilePage() {
  const { username } = useParams()
  const decodedUsername = useMemo(
    () => decodeURIComponent(username ?? ''),
    [username],
  )
  const { user: me, displayName: myName } = useAuth()
  const {
    friends,
    sendRequest,
    declineOrRemove,
    isAlreadyFriend,
    isPendingOutgoing,
  } = useFriends()
  const toast = useToast()

  useDocumentTitle(decodedUsername ? `@${decodedUsername}` : 'Profile')

  const isOwnProfile =
    !!me && myName?.toLowerCase() === decodedUsername.toLowerCase()
  const friendRecord = friends.find(
    (f) => f.username?.toLowerCase() === decodedUsername.toLowerCase(),
  )

  const [profile, setProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [profileError, setProfileError] = useState(null)
  const [stats, setStats] = useState(null)
  const [recent, setRecent] = useState([])
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)

  // Load profile from Supabase
  useEffect(() => {
    let cancelled = false
    setProfileLoading(true)
    setProfileError(null)
    supabase
      .from('profiles')
      .select('id, username, avatar_url, created_at')
      .ilike('username', decodedUsername)
      .limit(1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          console.error('[profile] supabase error', error)
          setProfileError('Could not load profile.')
        } else if (!data) {
          setProfileError('Player not found.')
        } else {
          setProfile(data)
          setEditValue(data.username ?? '')
        }
        setProfileLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [decodedUsername])

  // Pull this user's scores across all known game IDs in parallel
  useEffect(() => {
    if (!profile) return
    let cancelled = false
    const allGameIds = [
      ...SINGLE_PLAYER_GAMES.map((g) => g.id),
      ...MULTIPLAYER_GAMES.map((g) => g.id),
    ]
    Promise.all(
      allGameIds.map((gid) =>
        getLeaderboard(gid)
          .then((rows) => ({ gid, rows: rows ?? [] }))
          .catch(() => ({ gid, rows: [] })),
      ),
    ).then((results) => {
      if (cancelled) return
      const byGame = {}
      const all = []
      for (const { gid, rows } of results) {
        const mine = rows.filter(
          (r) => r.username?.toLowerCase() === decodedUsername.toLowerCase(),
        )
        byGame[gid] = mine
        for (const r of mine) all.push({ ...r, gameId: gid })
      }
      setStats(byGame)
      all.sort((a, b) => {
        const ta = new Date(a.completed_at).getTime() || 0
        const tb = new Date(b.completed_at).getTime() || 0
        return tb - ta
      })
      setRecent(all.slice(0, 5))
    })
    return () => {
      cancelled = true
    }
  }, [profile, decodedUsername])

  const startEdit = () => {
    setEditValue(profile?.username ?? '')
    setEditing(true)
  }

  const saveUsername = useCallback(async () => {
    const next = editValue.trim()
    if (!next || !me) {
      setEditing(false)
      return
    }
    if (next === profile?.username) {
      setEditing(false)
      return
    }
    setSaving(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ username: next })
        .eq('id', me.id)
      if (error) throw error
      await supabase.auth.updateUser({ data: { full_name: next } })
      setProfile((p) => ({ ...p, username: next }))
      toast.success('Username updated.')
      setEditing(false)
    } catch (err) {
      console.error('[profile] update error', err)
      toast.error('Could not update username. Try again.')
    } finally {
      setSaving(false)
    }
  }, [editValue, me, profile?.username, toast])

  if (profileLoading) {
    return (
      <Page>
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <div className="h-28 w-28 animate-pulse rounded-full bg-white/5" />
          <div className="h-4 w-40 animate-pulse rounded bg-white/5" />
        </div>
      </Page>
    )
  }

  if (profileError) {
    return (
      <Page>
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <p className="font-arcade text-sm text-neon-pink">{profileError}</p>
          <Link
            to="/"
            className="rounded-md border border-white/20 px-4 py-2 font-arcade text-[10px] text-white/70 hover:border-neon-cyan/60 hover:text-neon-cyan"
          >
            BACK TO LOBBY
          </Link>
        </div>
      </Page>
    )
  }

  const isOnline = !!friendRecord?.isOnline
  const isFriend = isAlreadyFriend(profile.username)
  const isPending = isPendingOutgoing(profile.username)

  return (
    <Page>
      <section className="flex flex-col items-center gap-4 text-center md:flex-row md:items-start md:gap-8 md:text-left">
        <Avatar
          name={profile.username}
          size="xl"
          online={isFriend ? isOnline : undefined}
        />
        <div className="flex flex-1 flex-col items-center gap-2 md:items-start">
          {editing ? (
            <div className="flex w-full max-w-xs items-center gap-2">
              <input
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                maxLength={24}
                className="flex-1 rounded-md border border-neon-cyan/50 bg-arcadia-surface px-3 py-2 font-arcade text-sm text-neon-cyan focus:outline-none focus:ring-1 focus:ring-neon-cyan"
              />
              <button
                type="button"
                onClick={saveUsername}
                disabled={saving}
                className="rounded-md border border-neon-green/60 bg-neon-green/10 px-3 py-2 font-arcade text-[10px] text-neon-green hover:bg-neon-green/20 disabled:opacity-50"
              >
                SAVE
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="font-arcade text-[10px] text-white/45 hover:text-white"
              >
                CANCEL
              </button>
            </div>
          ) : (
            <h1 className="font-arcade text-xl text-neon-green drop-shadow-[0_0_10px_rgba(0,255,136,0.4)] md:text-2xl">
              {profile.username}
            </h1>
          )}
          <p className="text-xs text-white/45">
            Member since {formatDate(profile.created_at)}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {isOwnProfile ? (
              !editing && (
                <button
                  type="button"
                  onClick={startEdit}
                  className="rounded-md border border-neon-cyan/60 bg-neon-cyan/10 px-3 py-1.5 font-arcade text-[10px] text-neon-cyan hover:bg-neon-cyan/20 hover:shadow-neon-cyan"
                >
                  ✎ EDIT USERNAME
                </button>
              )
            ) : isFriend ? (
              <>
                <span className="rounded-md border border-neon-green/40 px-3 py-1.5 font-arcade text-[10px] text-neon-green">
                  FRIENDS ✓
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (!friendRecord?.friendshipId) return
                    if (!window.confirm(`Remove ${profile.username}?`)) return
                    declineOrRemove(
                      friendRecord.friendshipId,
                      `Removed ${profile.username}.`,
                    )
                  }}
                  className="rounded-md border border-white/15 px-3 py-1.5 font-arcade text-[10px] text-white/55 hover:border-neon-pink/60 hover:text-neon-pink"
                >
                  REMOVE FRIEND
                </button>
              </>
            ) : isPending ? (
              <span className="rounded-md border border-white/15 px-3 py-1.5 font-arcade text-[10px] text-white/55">
                PENDING
              </span>
            ) : (
              me && (
                <button
                  type="button"
                  onClick={() => sendRequest(profile.username)}
                  className="rounded-md border border-neon-pink/60 bg-neon-pink/10 px-3 py-1.5 font-arcade text-[10px] text-neon-pink hover:bg-neon-pink/20 hover:shadow-neon-pink"
                >
                  ADD FRIEND
                </button>
              )
            )}
          </div>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="mb-4 font-arcade text-xs text-white/60">★ STATS</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SINGLE_PLAYER_GAMES.map((g) => (
            <StatCard
              key={g.id}
              icon={g.icon}
              name={g.name}
              stat={summarizeSP(g, stats?.[g.id])}
            />
          ))}
          {MULTIPLAYER_GAMES.map((g) => (
            <StatCard
              key={g.id}
              icon={g.icon}
              name={g.name}
              stat={summarizeMP(stats?.[g.id])}
            />
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="mb-4 font-arcade text-xs text-white/60">
          ★ RECENT ACTIVITY
        </h2>
        {!stats ? (
          <div className="rounded-lg border border-white/10 bg-arcadia-surface/60 p-6 text-center text-xs text-white/40">
            Loading…
          </div>
        ) : recent.length === 0 ? (
          <div className="rounded-lg border border-white/10 bg-arcadia-surface/60 p-6 text-center text-xs text-white/40">
            No recorded games yet.
          </div>
        ) : (
          <ul className="divide-y divide-white/5 rounded-lg border border-white/10 bg-arcadia-surface/60">
            {recent.map((r, i) => {
              const meta =
                SINGLE_PLAYER_GAMES.find((g) => g.id === r.gameId) ||
                MULTIPLAYER_GAMES.find((g) => g.id === r.gameId)
              return (
                <li
                  key={`${r.gameId}-${r.completed_at}-${i}`}
                  className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 px-4 py-3"
                >
                  <span className="text-lg">{meta?.icon ?? '🎮'}</span>
                  <span className="font-arcade text-[10px] text-white">
                    {meta?.name ?? r.gameId}
                  </span>
                  <span className="font-arcade text-[10px] text-neon-cyan">
                    {meta?.scoreFormat
                      ? formatScore(meta.scoreFormat, r.score)
                      : r.score}
                  </span>
                  <span className="font-arcade text-[9px] text-white/40">
                    {formatDate(r.completed_at)}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </Page>
  )
}

function summarizeSP(meta, rows) {
  if (!rows) return null
  if (rows.length === 0) return { empty: true }
  const sorted = [...rows].sort((a, b) =>
    meta.lowerIsBetter ? a.score - b.score : b.score - a.score,
  )
  const best = sorted[0]
  const lastBy = [...rows].sort(
    (a, b) =>
      (new Date(b.completed_at).getTime() || 0) -
      (new Date(a.completed_at).getTime() || 0),
  )[0]
  return {
    primaryLabel: 'BEST',
    primaryValue: formatScore(meta.scoreFormat, best.score),
    secondaryLabel: 'LAST',
    secondaryValue: formatDate(lastBy?.completed_at),
  }
}

function summarizeMP(rows) {
  if (!rows) return null
  if (rows.length === 0) return { empty: true }
  const wins = rows.filter((r) => Number(r.score) > 0).length
  const losses = rows.length - wins
  return {
    primaryLabel: 'WINS',
    primaryValue: String(wins),
    secondaryLabel: 'LOSSES',
    secondaryValue: String(losses),
  }
}

function StatCard({ icon, name, stat }) {
  return (
    <div className="rounded-lg border border-white/10 bg-arcadia-surface/60 p-4">
      <div className="flex items-center gap-2">
        <span className="text-lg">{icon}</span>
        <span className="font-arcade text-[10px] text-white/70">{name}</span>
      </div>
      {!stat ? (
        <div className="mt-3 h-10 animate-pulse rounded bg-white/5" />
      ) : stat.empty ? (
        <p className="mt-3 text-[10px] text-white/35">No plays yet.</p>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div>
            <p className="font-arcade text-[8px] text-white/40">
              {stat.primaryLabel}
            </p>
            <p className="mt-1 font-arcade text-sm text-neon-green">
              {stat.primaryValue}
            </p>
          </div>
          <div>
            <p className="font-arcade text-[8px] text-white/40">
              {stat.secondaryLabel}
            </p>
            <p className="mt-1 font-arcade text-[11px] text-neon-cyan">
              {stat.secondaryValue}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

function Page({ children }) {
  return (
    <div className="scanlines route-fade-in relative min-h-screen bg-arcadia-bg text-white">
      <header className="sticky top-0 z-30 border-b border-neon-green/30 bg-arcadia-bg/85 shadow-[0_1px_0_0_rgba(0,255,136,0.2)] backdrop-blur-md">
        <div className="mx-auto grid max-w-7xl grid-cols-[1fr_auto_1fr] items-center px-4 py-4 md:px-8">
          <Link
            to="/"
            className="flex items-center gap-2 justify-self-start font-arcade text-[10px] text-neon-cyan transition hover:text-neon-green md:text-xs"
          >
            <span aria-hidden="true">◀</span>
            LOBBY
          </Link>
          <h1 className="justify-self-center font-arcade text-sm text-neon-green drop-shadow-[0_0_8px_rgba(0,255,136,0.4)] md:text-lg">
            <span className="mr-2">👤</span>
            PROFILE
          </h1>
          <span className="justify-self-end" />
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8 md:px-8 md:py-12">
        {children}
      </main>
    </div>
  )
}
