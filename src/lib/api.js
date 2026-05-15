import { supabase } from './supabase'

const BASE = import.meta.env.VITE_BACKEND_URL || ''

async function authHeaders() {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function postScore({ gameId, score }) {
  const headers = {
    'Content-Type': 'application/json',
    ...(await authHeaders()),
  }
  const res = await fetch(`${BASE}/api/scores`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ gameId, score }),
  })
  if (!res.ok) throw new Error(`Score save failed: ${res.status}`)
  return res.json().catch(() => ({}))
}

export async function getLeaderboard(gameId) {
  const res = await fetch(`${BASE}/api/scores/leaderboard/${gameId}`)
  if (!res.ok) throw new Error(`Leaderboard fetch failed: ${res.status}`)
  return res.json()
}
