import { supabase } from './supabase'

const BASE = import.meta.env.VITE_BACKEND_URL || ''

async function authHeaders() {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function postScore({ userId, gameId, score }) {
  const body = {
    user_id: userId,
    game_id: gameId,
    score,
    completed_at: new Date().toISOString(),
  }
  const url = `${BASE}/api/scores`
  const headers = {
    'Content-Type': 'application/json',
    ...(await authHeaders()),
  }
  console.log('[api] POST /api/scores', body)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      console.error('[api] POST /api/scores failed', res.status, text)
      throw new Error(`Score save failed: ${res.status}`)
    }
    const json = await res.json().catch(() => ({}))
    console.log('[api] POST /api/scores response', json)
    return json
  } catch (err) {
    console.error('[api] POST /api/scores error', err)
    throw err
  }
}

export async function getLeaderboard(gameId) {
  const url = `${BASE}/api/scores/leaderboard/${gameId}`
  console.log('[api] GET', url)
  try {
    const res = await fetch(url)
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      console.error('[api] GET leaderboard failed', res.status, text)
      throw new Error(`Leaderboard fetch failed: ${res.status}`)
    }
    const data = await res.json()
    console.log(`[api] GET leaderboard(${gameId}) response`, data)
    return Array.isArray(data) ? data : []
  } catch (err) {
    console.error('[api] GET leaderboard error', err)
    throw err
  }
}
