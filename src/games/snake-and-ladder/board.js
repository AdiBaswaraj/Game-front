export const SIZE = 10
export const GOAL = SIZE * SIZE

// Classic Snakes & Ladders layout. Frontend never enforces these — the
// backend resolves jumps. We use them purely to draw the SVG overlay.
export const LADDERS = {
  1: 38,
  4: 14,
  9: 31,
  21: 42,
  28: 84,
  36: 44,
  51: 67,
  71: 91,
  80: 100,
}

export const SNAKES = {
  17: 7,
  54: 34,
  62: 19,
  64: 60,
  87: 24,
  93: 73,
  95: 75,
  98: 79,
}

// Convert a 1..100 square to a (row, col) inside an SIZE x SIZE grid laid
// out top-to-bottom. Row 0 is the top of the rendered board (squares
// 91-100), row SIZE-1 is the bottom (1-10), boustrophedon left-right.
export function squareToCell(n) {
  if (n < 1 || n > GOAL) return null
  const fromBottom = Math.floor((n - 1) / SIZE)
  const row = SIZE - 1 - fromBottom
  const inRow = (n - 1) % SIZE
  const col = fromBottom % 2 === 0 ? inRow : SIZE - 1 - inRow
  return { row, col }
}

// Pixel center of a square inside an `unit` x `unit` cell.
export function squareCenter(n, unit) {
  const cell = squareToCell(n)
  if (!cell) return null
  return {
    x: cell.col * unit + unit / 2,
    y: cell.row * unit + unit / 2,
  }
}

// All squares a token traverses moving from `from` to `to` on the
// snake-style board, inclusive of `to`. Returns [] if from === to.
// Walks +1 along the snake path so animation looks like a roll.
export function pathBetween(from, to) {
  const path = []
  if (to === from) return path
  const step = to > from ? 1 : -1
  for (let n = from + step; step > 0 ? n <= to : n >= to; n += step) {
    path.push(n)
  }
  return path
}
