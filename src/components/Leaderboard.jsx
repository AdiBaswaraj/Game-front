import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { getLeaderboard } from '../lib/api'
import { profileNameFor } from '../lib/profile'

function fmtDate(s) {
  if (!s) return ''
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: '2-digit',
  })
}

function fmtScoreTime(seconds) {
  const s = Number(seconds) || 0
  const m = Math.floor(s / 60)
  const r = s % 60
  if (m > 0) return `${m}:${String(r).padStart(2, '0')}`
  return `${r}s`
}

function fmtScorePoints(n) {
  return String(Math.max(0, Number(n) || 0)).padStart(6, '0')
}

function fmtScoreGuesses(n) {
  const v = Number(n) || 0
  if (v >= 7) return 'X/6'
  return `${v}/6`
}

export const SCORE_FORMATS = {
  points: fmtScorePoints,
  time: fmtScoreTime,
  guesses: fmtScoreGuesses,
}

export default function Leaderboard({
  gameId,
  scoreFormat = 'points',
  lowerIsBetter = false,
  max = 10,
  title = 'HIGH SCORES',
  className = '',
}) {
  const { user } = useAuth()
  const [entries, setEntries] = useState(null)
  const [error, setError] = useState(false)
  const myName = profileNameFor(user)
  const formatScore = SCORE_FORMATS[scoreFormat] ?? fmtScorePoints

  useEffect(() => {
    let cancelled = false
    setEntries(null)
    setError(false)
    getLeaderboard(gameId)
      .then((data) => {
        if (cancelled) return
        const sorted = [...data].sort((a, b) =>
          lowerIsBetter ? a.score - b.score : b.score - a.score,
        )
        setEntries(sorted.slice(0, max))
      })
      .catch(() => {
        if (cancelled) return
        setError(true)
      })
    return () => {
      cancelled = true
    }
  }, [gameId, lowerIsBetter, max])

  return (
    <div
      className={`rounded-xl border border-neon-cyan/40 bg-arcadia-surface/80 p-4 shadow-[0_0_25px_-12px_rgba(0,212,255,0.6)] ${className}`}
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-arcade text-[11px] text-neon-cyan drop-shadow-[0_0_8px_rgba(0,212,255,0.6)]">
          ★ {title}
        </h3>
        <span className="font-arcade text-[8px] uppercase text-white/40">
          TOP {max}
        </span>
      </div>

      <div className="grid grid-cols-[1.5rem_1fr_auto_auto] gap-x-3 font-arcade text-[9px] text-white/35">
        <span>#</span>
        <span>PLAYER</span>
        <span className="text-right">SCORE</span>
        <span className="text-right">DATE</span>
      </div>
      <div className="mt-1 h-px bg-white/10" />

      <div className="mt-2 space-y-1">
        {entries === null && <Skeleton rows={Math.min(max, 6)} />}
        {error && (
          <p className="py-4 text-center text-xs text-neon-pink/80">
            Couldn't load scores.
          </p>
        )}
        {entries && entries.length === 0 && (
          <p className="py-4 text-center text-xs text-white/45">
            No scores yet. Set the record.
          </p>
        )}
        {entries?.map((entry, i) => {
          const isMe = !!myName && entry.username === myName
          return (
            <Row
              key={`${entry.username}-${entry.completed_at}-${i}`}
              rank={i + 1}
              name={entry.username || 'Player'}
              score={formatScore(entry.score)}
              date={fmtDate(entry.completed_at)}
              isMe={isMe}
            />
          )
        })}
      </div>
    </div>
  )
}

function Row({ rank, name, score, date, isMe }) {
  const rankColor =
    rank === 1
      ? 'text-neon-green'
      : rank === 2
        ? 'text-neon-cyan'
        : rank === 3
          ? 'text-neon-pink'
          : 'text-white/55'

  return (
    <div
      className={`grid grid-cols-[1.5rem_1fr_auto_auto] items-center gap-x-3 rounded-md px-2 py-1.5 text-sm transition ${
        isMe
          ? 'border border-neon-green/60 bg-neon-green/10 shadow-[inset_0_0_18px_rgba(0,255,136,0.18)]'
          : ''
      }`}
    >
      <span className={`font-arcade text-[10px] ${rankColor}`}>
        {String(rank).padStart(2, '0')}
      </span>
      <span
        className={`truncate font-arcade text-[10px] ${
          isMe ? 'text-neon-green' : 'text-white'
        }`}
      >
        {isMe ? `YOU · ${name}` : name}
      </span>
      <span
        className={`text-right font-arcade text-[10px] ${
          isMe ? 'text-neon-green' : 'text-neon-cyan'
        }`}
      >
        {score}
      </span>
      <span className="text-right font-arcade text-[8px] text-white/40">
        {date}
      </span>
    </div>
  )
}

function Skeleton({ rows }) {
  return (
    <div className="space-y-1">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="grid grid-cols-[1.5rem_1fr_auto_auto] items-center gap-x-3 px-2 py-1.5"
        >
          <div className="h-3 w-5 rounded bg-white/10" />
          <div className="h-3 w-3/5 rounded bg-white/10" />
          <div className="h-3 w-12 rounded bg-white/10 justify-self-end" />
          <div className="h-3 w-10 rounded bg-white/10 justify-self-end" />
        </div>
      ))}
    </div>
  )
}
