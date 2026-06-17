# Backend notes

Hand-off notes for the backend team. Each section describes a frontend
feature the UI already routes / wires up but that needs server-side
support before it actually works for a user.

---

## 0. POST /api/rooms/create contract — implemented on the frontend ✅

Backend confirmed the new shape on 2026-06-17. Frontend now matches:

- Sends `Authorization: Bearer <supabase_jwt>` on every request.
- Sends body `{ "gameId": "...", "username": "..." }`.
- Reads response `{ "code": "ABC123", ... }` — any extra fields
  (`room`, `profile`, etc.) pass through untouched.
- Branches on the structured error body:

  | Status | `code` | Frontend behaviour |
  |--------|--------|--------------------|
  | 401 | `MISSING_TOKEN` | Toast "Your session expired — please log in again." |
  | 401 | `SESSION_EXPIRED` | Auto-refreshes the supabase session, re-fires the request once. Only surfaces an error to the UI if the refresh itself fails. |
  | 400 | `VALIDATION_FAILED` | Toast "This game isn't available for private rooms yet." |
  | 5xx | (any) | Already retried by `fetchWithRetry` (linear backoff, 6 s per-attempt timeout). |

The same refresh-and-retry pattern is now applied across **every**
authenticated endpoint via `jsonFetch` (`getRoom`, friends APIs, etc.),
so the user shouldn't see "Session expired" toasts mid-game unless
their refresh token has actually died.

---

## 1. Snake multiplayer — full design

### Status
The Snake mode-select on the frontend now offers **QUICK MATCH** and
**PRIVATE ROOM** as cards. Both routes through to the same
`MatchmakingScreen` / `PrivateRoomScreen` components Chess and
Snake & Ladder already use, and `snake` has been added to both
screens' `GAME_LABELS` map. **Until the backend implements the events
below, those cards will queue forever / fail to create a room.**

### Concept
Two snakes on the same authoritative server-side board. Round is
**2 minutes**. Highest score when the clock hits zero wins. Death
(wall, own body, other snake's body, head-on-head collision) **resets
the dead player's score to 0** — a surviving player who plays
cautiously can keep banking points while the aggressor pays for every
collision. Dead snake respawns at a safe location after ~1.5 s.

### Authority model
The server should be the single source of truth for snake positions,
food, scores, deaths, and the round timer. Clients only send
*direction inputs* (one of UP/DOWN/LEFT/RIGHT) and render whatever the
server broadcasts. This is the same pattern the existing Snake &
Ladder multiplayer uses, just with a much higher tick rate.

### Tick rate
**~10–12 ticks per second** is enough. Match the frontend's solo
`SPEED_FLOOR_MS = 85` so the perceived speed is consistent. Each tick:

1. Apply every client's queued direction (one per snake — drop any
   that would 180° the snake instantly).
2. Advance every alive snake's head one cell.
3. Resolve collisions (wall / own body / other body / head-on-head).
4. Resolve food eats (the cell the new head lands on equals the food
   cell).
5. Respawn food if eaten.
6. Schedule respawns for dead snakes (`respawnAt = now + 1500`).
7. Broadcast the new state via `state_sync` (see below).

### Suggested socket events

| Direction | Event | Payload |
|-----------|-------|---------|
| C → S | `join_queue` (reuse) | `{ gameId: 'snake', userId, username }` |
| S → C | `queue_matched` (reuse) | `{ roomCode, opponentUsername, … }` |
| C → S | `join_room` (reuse) | `{ roomCode, username }` |
| C → S | `snake_input` | `{ roomCode, direction: 'up'\|'down'\|'left'\|'right' }` |
| S → C | `state_sync` | see below |
| S → C | `game_over` | `{ winnerId, scores: { [userId]: number }, reason: 'time'\|'forfeit' }` |
| S → C | `opponent_left` (reuse) | `{ username }` |

`state_sync` payload:

```json
{
  "roomCode": "ABC123",
  "tick": 142,
  "remainingMs": 91300,
  "food": { "x": 12, "y": 7 },
  "snakes": [
    {
      "userId": "u1",
      "username": "magerex",
      "color": "green",
      "alive": true,
      "body": [{ "x": 4, "y": 4 }, { "x": 3, "y": 4 }, …],
      "direction": "right",
      "score": 60,
      "respawnAt": null
    },
    {
      "userId": "u2",
      "username": "neo_42",
      "color": "pink",
      "alive": false,
      "body": [],
      "direction": "left",
      "score": 0,
      "respawnAt": 1739204812345
    }
  ]
}
```

### Lobby / queue
- The existing `/api/queue/:gameId` endpoint that powers the
  "PLAYERS IN QUEUE" badge in `MatchmakingScreen` should start
  counting users in the Snake queue. No new endpoint needed; just
  add `snake` to whatever map drives it.
- Match-making rule: as soon as two users sit in the Snake queue, pair
  them, create a room, emit `queue_matched` with the room code to
  both, navigate them into the room. Same as Chess / S&L today.

### Private room
- `POST /api/rooms/create` already accepts `{ gameId, username }` —
  just whitelist `'snake'` as a valid `gameId`. The frontend doesn't
  care what `maxPlayers` is for the response, but `2` is correct.

### Round timer
- Server-authoritative. Start the clock when both `join_room`s have
  landed AND both players have signalled ready (the existing
  `player_ready` event in `RoomPage` is reused). At t=0 emit
  `game_over` with the higher-scoring player as `winnerId`, or
  `winnerId: null` and a draw flag if scores are equal.

### Frontend file that consumes this
None yet — once these events land, I'll wire a `SnakeMultiplayerGame`
component that listens to `state_sync` / `game_over` and renders the
shared canvas. Right now the user just sees the matchmaking radar
spin forever.

---

## 2. "Create room" failing for new accounts / new devices on the same network

### Symptom the user reported
> "I still see that creating room thing in my new phone which uses
> same network just new account in different phone"

i.e. on the user's main phone everything works, but a brand-new
account on a second phone hits "Could not create room" or hangs on
the CREATING ROOM… spinner.

### Things the frontend already handles
- `lib/socket.js` is on `transports: ['polling', 'websocket']` so the
  socket can fall back to long-polling on restrictive networks.
- `lib/api.js`'s `createRoom` / `getRoom` retry transient network
  errors and 5xx up to twice with linear backoff (0.6s, 1.2s) and a
  6s per-attempt AbortController timeout.
- `CreateTab` has an 18s top-level deadline before showing "Room
  creation timed out. Please try again."
- The frontend logs every step under the `[room]` prefix so the
  browser console on the failing phone will show exactly which step
  threw.

### Suspected backend-side causes
1. **Auth header race for brand-new accounts.** The Supabase session
   token *should* be ready by the time the player clicks Quick Match
   / Private Room, but if the backend's `Authorization` check rejects
   missing-or-stale tokens with a non-retriable 4xx (e.g. 401), the
   frontend won't retry and the user sees the failure immediately. If
   the backend currently 401s when a row in some `users` table is
   missing for that Supabase user id, that would explain "works on
   main phone (row exists), fails on new account (row doesn't yet)".
   - **Ask:** what response does the backend send when a logged-in
     user's id has no matching row in the users / profiles table? Is
     it 401? 404? 500?
   - **Suggested fix:** on first `POST /api/rooms/create` from an
     unknown-but-validly-authenticated user id, *lazily create* the
     row from the Supabase JWT claims (id, email, full_name) instead
     of rejecting. Or have the signup flow guarantee the row is in
     place before returning to the client.

2. **Username collision / unique constraint on `username` in the
   users table.** The frontend defaults `displayName` for an
   unprompted new account to whatever `profileNameFor(user)` returns
   — typically `email.split('@')[0]` or `'Player'`. If the backend
   has `UNIQUE(username)` on the rooms-side users table, two new
   accounts that share an `email.split('@')[0]` (or both fall through
   to `'Player'`) will collide on insert, and the room create returns
   an opaque 5xx.
   - **Ask:** is there a UNIQUE on `username` anywhere in the room
     creation path? If so, return a structured error so the
     frontend can route the user to the username-prompt modal
     instead of timing out.

3. **Rate-limit keyed by IP, not by user id.** Two phones on the
   same Wi-Fi look like the same IP to the backend. If the limiter
   says "max N room creations per IP per minute" and the main phone
   has already burned that budget, the second phone gets 429s and
   never sees the room.
   - **Ask:** is room-create rate-limited by IP? If yes, please key
     it by `userId` (from the Bearer token) instead.

4. **CORS / cookie-domain issue specifically for newer Safari /
   Brave / iOS Private Relay.** The screenshot shared earlier was
   from Brave on iPhone. Brave's shield and Apple Private Relay both
   spoof IP and can break a single-CORS-origin setup. If the API
   returns the wrong `Access-Control-Allow-Origin` for one of those
   client contexts, the fetch fails before the body is read and the
   user sees the retry-loop expire.
   - **Ask:** what `Access-Control-Allow-Origin` is the API
     returning for `OPTIONS /api/rooms/create`? Is it pinned to a
     single origin or a wildcard?

### What to look at in backend logs
For one failing room-create attempt from the new-account phone, grab:
- The raw POST body (`gameId`, `username`).
- The Supabase `userId` extracted from the Bearer.
- The full response status + body.
- Whether the auth middleware rejected, the DB query rejected, or the
  socket emit failed.
- The client IP and Wi-Fi vs cellular guess.

That'll narrow it down to one of the four buckets above in two
minutes.

### What the frontend will do once you confirm
- If you return a structured `409 USERNAME_TAKEN` body the frontend
  can pop the UsernamePromptModal instead of the generic toast.
- If you return `401 SESSION_EXPIRED` the frontend can force a token
  refresh and retry once, transparently.
- Anything else continues to surface "Could not create room — <body
  message>" with TRY AGAIN, same as today.

---

## 3. Checkers (Draughts) — new game

### Status on the frontend
Checkers is being added on the frontend the same way Chess was:
- Local rules engine for VS BOT and PASS & PLAY modes — no backend
  needed for those.
- Online multiplayer mode-select cards (QUICK MATCH + PRIVATE ROOM)
  route through the shared matchmaking / room screens.

### What backend needs to do for online
**Game state.** Backend should own the board (8×8, dark squares only),
whose turn it is, the chain-of-jumps state for the current move (so a
client can't cheat by halting a forced multi-capture early), and a
move clock if you want timed matches.

**Suggested socket events.**

| Direction | Event | Payload |
|-----------|-------|---------|
| C → S | `join_queue` (reuse) | `{ gameId: 'checkers', userId, username }` |
| S → C | `queue_matched` (reuse) | same as today |
| C → S | `make_move` | `{ roomCode, from: 'b6', to: 'a5' }` |
| S → C | `move_accepted` | `{ move, board, turn, captures, kinged, mustChain: boolean }` |
| S → C | `state_sync` | `{ board, turn, clocks, history }` |
| S → C | `game_over` | `{ winnerId, reason: 'no_pieces'\|'no_moves'\|'resign'\|'timeout' }` |
| C → S | `resign` (reuse) | `{ roomCode }` |

**Board notation.** Use the same algebraic letters chess uses
(`a1`…`h8`). Only dark squares have pieces (a1, c1, e1, g1, b2, d2,
…), but the notation covers the whole board so the server can validate
"that's a light square, illegal".

**Move object.** Each move is `{ from, to }`. For multi-jump chains
the client sends each jump as a separate `make_move` and the server
replies with `mustChain: true` until the chain is exhausted, then
`mustChain: false` and `turn` flips.

**Forced captures.** American rules (which the frontend implements):
if any capture is available, the player *must* take a capture. The
server enforces this — reject any non-capture move with a 409 when a
capture exists.

**Backwards compatibility.** Nothing to break — Checkers is a new
`gameId`, just register it everywhere `chess` is registered (queue
counter endpoint, matchmaking, room create).

### Lobby tile
The Lobby tile + the home `games` array will get a Checkers entry
once the frontend ships its assets. Backend doesn't need to do
anything for the tile itself — it's pure frontend.

---

## Open questions / parking lot

- Should the **Snake** round length be configurable per-room (lobby
  picker for 60s / 120s / 180s)? Frontend can plumb a length param
  into `createRoom`; tell me what payload field to use.
- For the **scoreboard** at end of a Snake round, do you want the
  result posted to the existing `/api/scores` endpoint? If yes, what
  `score` value — peak score, final score, or total food eaten? The
  solo game posts `final score`.
- **Checkers AI** for the VS BOT mode is implemented in the frontend
  using a small minimax. It does not need backend support. If you'd
  rather move the AI server-side later, the move format above is
  already the right one to use.
