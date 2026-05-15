import { supabase } from './supabase'

const BASE = import.meta.env.VITE_BACKEND_URL || ''

async function authHeaders() {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function postScore({ userId, gameId, score }) {
  const headers = {
    'Content-Type': 'application/json',
    ...(await authHeaders()),
  }
  const res = await fetch(`${BASE}/api/scores`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      user_id: userId,
      game_id: gameId,
      score,
      completed_at: new Date().toISOString(),
    }),
  })
  if (!res.ok) throw new Error(`Score save failed: ${res.status}`)
  return res.json().catch(() => ({}))
}

export async function getLeaderboard(gameId) {
  const res = await fetch(`${BASE}/api/scores/leaderboard/${gameId}`)
  if (!res.ok) throw new Error(`Leaderboard fetch failed: ${res.status}`)
  const data = await res.json()
  return Array.isArray(data) ? data : []
}
