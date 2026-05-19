export const SIZE = 10
export const GOAL = SIZE * SIZE

// New backend map (verified server-side). Must be copied verbatim — do
// not derive these positions in any other file.
export const LADDERS = {
  4: 25,
  13: 46,
  33: 52,
  42: 63,
  50: 69,
  57: 76,
  62: 81,
  71: 92,
}

export const SNAKES = {
  17: 3,
  35: 14,
  54: 28,
  63: 37,
  72: 51,
  88: 24,
  97: 61,
  98: 6,
}

// Convert a 1..100 position to a (row, col) inside an SIZE x SIZE grid
// laid out top-to-bottom, with boustrophedon (snake-pattern) numbering.
// Bottom-left = 1, bottom-right = 10, top-left = 100 (per the spec
// formula). Use this for token placement, square labels, animation
// steps, and SVG arrow endpoints.
export function squareToCell(position) {
  if (position < 1 || position > GOAL) return null
  const pos = position - 1
  const fromBottom = Math.floor(pos / SIZE)
  const col = fromBottom % 2 === 0 ? pos % SIZE : SIZE - 1 - (pos % SIZE)
  const row = SIZE - 1 - fromBottom
  return { row, col }
}

export function squareCenter(n, unit) {
  const cell = squareToCell(n)
  if (!cell) return null
  return {
    x: cell.col * unit + unit / 2,
    y: cell.row * unit + unit / 2,
  }
}

// All squares a token traverses moving from `from` to `to`, inclusive
// of `to`. Walks ±1 along the snake path so animation looks like a
// dice roll (or a ladder climb / snake slide).
export function pathBetween(from, to) {
  const path = []
  if (to === from) return path
  const step = to > from ? 1 : -1
  for (let n = from + step; step > 0 ? n <= to : n >= to; n += step) {
    path.push(n)
  }
  return path
}

// Build the move-resolution chain for a roll. Returns an array of
// { at, kind, from } stages:
//   - kind 'land' means dice landing square
//   - kind 'ladder' means a ladder climb from previous stage
//   - kind 'snake' means a snake slide from previous stage
// Order matches the backend's two sequential ifs: ladder first, then
// snake, so 42 → 63 → 37 produces three stages. If finalAt is
// provided and disagrees with our computed end, we trust the server
// and return a single direct hop so the token at least lands correctly.
export function computeStages({ start, roll, finalAt }) {
  if (start + roll > GOAL) return [] // overshoot — stay
  let cur = start + roll
  const stages = [{ at: cur, kind: 'land', from: start }]
  if (LADDERS[cur] != null) {
    const from = cur
    cur = LADDERS[cur]
    stages.push({ at: cur, kind: 'ladder', from })
  }
  if (SNAKES[cur] != null) {
    const from = cur
    cur = SNAKES[cur]
    stages.push({ at: cur, kind: 'snake', from })
  }
  if (typeof finalAt === 'number' && finalAt !== cur) {
    return [{ at: finalAt, kind: 'land', from: start, forced: true }]
  }
  return stages
}
