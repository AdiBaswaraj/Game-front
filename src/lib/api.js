import { supabase } from './supabase'

const BASE = import.meta.env.VITE_BACKEND_URL || ''

async function authHeaders() {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function jsonFetch(url, init = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(init.headers || {}),
    ...(await authHeaders()),
  }
  const res = await fetch(url, { ...init, headers })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    console.error(`[api] ${init.method ?? 'GET'} ${url} failed`, res.status, text)
    const err = new Error(`Request failed: ${res.status}`)
    err.status = res.status
    err.body = text
    throw err
  }
  return res.json().catch(() => ({}))
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

// ===== Friends =====

export async function getFriends(userId) {
  const url = `${BASE}/api/friends/${userId}`
  console.log('[api] GET', url)
  const data = await jsonFetch(url)
  console.log('[api] friends response', data)
  return Array.isArray(data) ? data : []
}

export async function getPendingRequests(userId) {
  const url = `${BASE}/api/friends/${userId}/pending`
  console.log('[api] GET', url)
  const data = await jsonFetch(url)
  console.log('[api] pending response', data)
  return Array.isArray(data) ? data : []
}

export async function sendFriendRequest(requesterId, addresseeUsername) {
  return jsonFetch(`${BASE}/api/friends/request`, {
    method: 'POST',
    body: JSON.stringify({
      requesterId,
      addresseeUsername,
    }),
  })
}

export async function acceptFriendRequest(userId, friendshipId) {
  return jsonFetch(`${BASE}/api/friends/accept`, {
    method: 'POST',
    body: JSON.stringify({ userId, friendshipId }),
  })
}

export async function removeFriend(userId, friendshipId) {
  return jsonFetch(`${BASE}/api/friends/remove`, {
    method: 'POST',
    body: JSON.stringify({ userId, friendshipId }),
  })
}

// Backend may not yet have /api/friends/search — try it, fall back to
// querying Supabase profiles directly via the anon key (RLS allows
// public reads on profiles).
export async function searchUsers(query) {
  const trimmed = (query || '').trim()
  if (!trimmed) return []
  try {
    const data = await jsonFetch(
      `${BASE}/api/friends/search?username=${encodeURIComponent(trimmed)}`,
    )
    if (Array.isArray(data)) return data
  } catch (err) {
    if (err.status && err.status !== 404) {
      console.warn('[api] search fallthrough to supabase:', err.status)
    }
  }
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, avatar_url')
    .ilike('username', `%${trimmed}%`)
    .limit(10)
  if (error) {
    console.error('[api] supabase profile search failed', error)
    return []
  }
  return (data ?? []).map((p) => ({
    userId: p.id,
    username: p.username,
    avatar_url: p.avatar_url,
  }))
}

// ===== Rooms =====

export async function createRoom({ gameId, username }) {
  return jsonFetch(`${BASE}/api/rooms/create`, {
    method: 'POST',
    body: JSON.stringify({ gameId, username }),
  })
}

export async function getRoom(code) {
  return jsonFetch(`${BASE}/api/rooms/${code}`)
}
