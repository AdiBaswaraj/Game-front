import { supabase } from './supabase'

const BASE = import.meta.env.VITE_BACKEND_URL || ''

async function authHeaders() {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// Force-refresh the supabase session and return a fresh access_token.
// Returns null if the user is signed out or the refresh fails — the
// caller should treat that as "needs to log in again".
async function refreshSupabaseToken() {
  try {
    const { data, error } = await supabase.auth.refreshSession()
    if (error) {
      console.warn('[api] supabase refresh failed', error)
      return null
    }
    return data?.session?.access_token ?? null
  } catch (err) {
    console.warn('[api] supabase refresh threw', err)
    return null
  }
}

// Parses the backend's structured error body. Backend contract:
//   { "code": "SESSION_EXPIRED", "message": "..." }
// Falls back to plain status text if the body isn't JSON.
function attachErrorCode(err, body) {
  if (body && typeof body === 'object') {
    if (typeof body.code === 'string') err.code = body.code
    if (typeof body.message === 'string') err.message = body.message
  }
  return err
}

// Fetch with bounded retries on network errors and 5xx. Used by the
// room create / lookup endpoints — a single dropped TCP connection
// (common on flaky carrier networks) used to surface as "failed to
// create room" with no way out except refresh. Each attempt has its
// own AbortController so a hung TCP socket can't eat the full retry
// budget waiting for the browser's ~minute-long default timeout.
async function fetchWithRetry(
  url,
  init,
  { retries = 2, backoffMs = 600, perAttemptTimeoutMs = 6000 } = {},
) {
  let lastErr
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), perAttemptTimeoutMs)
    try {
      const res = await fetch(url, { ...init, signal: ctrl.signal })
      clearTimeout(t)
      // Retry transient 5xx; surface 4xx straight to the caller so the
      // UI can show "room not found" / "auth required" etc.
      if (res.status >= 500 && attempt < retries) {
        await new Promise((r) => setTimeout(r, backoffMs * (attempt + 1)))
        continue
      }
      return res
    } catch (err) {
      clearTimeout(t)
      lastErr = err
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, backoffMs * (attempt + 1)))
        continue
      }
    }
  }
  throw lastErr ?? new Error('Network error')
}

async function jsonFetch(url, init = {}) {
  const doFetch = async () => {
    const headers = {
      'Content-Type': 'application/json',
      ...(init.headers || {}),
      ...(await authHeaders()),
    }
    return fetchWithRetry(url, { ...init, headers })
  }

  let res = await doFetch()
  // Mirror createRoom's session-refresh dance for all authed endpoints:
  // parse the body once to look for { code: 'SESSION_EXPIRED' }; if we
  // see it, refresh the token and re-issue the request. Otherwise fall
  // through to the original error-handling path.
  if (res.status === 401) {
    const text = await res.text().catch(() => '')
    let data = null
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = null
    }
    if (data?.code === 'SESSION_EXPIRED') {
      const fresh = await refreshSupabaseToken()
      if (fresh) {
        res = await doFetch()
      } else {
        const err = new Error('Session expired. Please log in again.')
        err.status = 401
        err.code = 'SESSION_EXPIRED'
        err.body = data
        throw err
      }
    } else {
      // Other 401 — bubble up with as much detail as we have.
      console.error(`[api] ${init.method ?? 'GET'} ${url} 401`, text)
      const err = new Error(data?.message || 'Request failed: 401')
      err.status = 401
      err.body = data ?? text
      attachErrorCode(err, data)
      throw err
    }
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    let data = null
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = null
    }
    console.error(`[api] ${init.method ?? 'GET'} ${url} failed`, res.status, text)
    const err = new Error(data?.message || `Request failed: ${res.status}`)
    err.status = res.status
    err.body = data ?? text
    attachErrorCode(err, data)
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
  const url = `${BASE}/api/rooms/create`
  console.log('[room] attempting create:', {
    backendUrl: BASE,
    gameId,
    username,
    fullUrl: url,
  })

  if (!BASE) {
    const err = new Error('Backend URL not configured')
    err.code = 'CLIENT_MISCONFIGURED'
    console.error('[room] VITE_BACKEND_URL is undefined!')
    throw err
  }

  // Single attempt that we can re-run if the first response says the
  // session expired. The fetchWithRetry inside handles network blips
  // and 5xx already; 401 SESSION_EXPIRED is a one-off refresh-and-go.
  const attempt = async () => {
    const headers = {
      'Content-Type': 'application/json',
      ...(await authHeaders()),
    }
    const response = await fetchWithRetry(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ gameId, username }),
    })
    const text = await response.text()
    let data
    try {
      data = text ? JSON.parse(text) : {}
    } catch {
      const err = new Error(`Non-JSON response: ${text.slice(0, 100)}`)
      err.status = response.status
      throw err
    }
    return { response, data }
  }

  let { response, data } = await attempt()

  // Backend contract: 401 + { code: 'SESSION_EXPIRED' } means the
  // access token is past its lifetime but the refresh token is still
  // good. Refresh once and re-fire. Any other 401 (MISSING_TOKEN,
  // invalid claims) bubbles up so the UI can ask the user to log in.
  if (response.status === 401 && data?.code === 'SESSION_EXPIRED') {
    console.log('[room] session expired — refreshing supabase token')
    const fresh = await refreshSupabaseToken()
    if (fresh) {
      const next = await attempt()
      response = next.response
      data = next.data
    } else {
      const err = new Error(
        'Your session has expired. Please log in again.',
      )
      err.status = 401
      err.code = 'SESSION_EXPIRED'
      err.body = data
      throw err
    }
  }

  if (!response.ok) {
    console.error('[room] backend error:', response.status, data)
    const err = new Error(
      data?.message ||
        (data?.code === 'MISSING_TOKEN'
          ? 'Please log in to create a room.'
          : data?.code === 'VALIDATION_FAILED'
            ? 'Could not create room — invalid game.'
            : `Could not create room (HTTP ${response.status}).`),
    )
    err.status = response.status
    err.body = data
    attachErrorCode(err, data)
    throw err
  }

  const code = data?.code ?? data?.roomCode ?? data?.room_code
  if (!code) {
    console.error('[room] missing room code in response:', data)
    const err = new Error('No room code in response')
    err.code = 'MALFORMED_RESPONSE'
    throw err
  }

  console.log('[room] success! code:', code)
  return data
}

export async function getRoom(code) {
  return jsonFetch(`${BASE}/api/rooms/${code}`)
}
