// Standard American checkers rules engine.
// - 8x8 board, pieces sit on dark squares only ((r + c) is odd in our
//   coordinate system).
// - 'w' (white / red) starts at the bottom and moves toward row 0.
// - 'b' (black) starts at the top and moves toward row 7.
// - Men move one diagonal forward. Kings move one diagonal in any
//   direction.
// - Captures jump over an adjacent opponent into an empty cell beyond.
// - **Forced captures**: if any capture is available for the side to
//   move, every move that side makes must be a capture.
// - Multi-jumps are mandatory while another capture is available from
//   the new square. Promotion mid-chain STOPS the chain (American
//   rules — sometimes called the "huffing" rule).
// - Game ends when a side has no pieces left or no legal moves.

export const SIZE = 8

const inBounds = (r, c) => r >= 0 && r < SIZE && c >= 0 && c < SIZE

function pieceDirs(piece) {
  if (piece.king) {
    return [
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1],
    ]
  }
  return piece.color === 'w'
    ? [
        [-1, -1],
        [-1, 1],
      ]
    : [
        [1, -1],
        [1, 1],
      ]
}

export function initialBoard() {
  const board = Array.from({ length: SIZE }, () => Array(SIZE).fill(null))
  // Black at the top
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < SIZE; c++) {
      if ((r + c) % 2 === 1) board[r][c] = { color: 'b', king: false }
    }
  }
  // White at the bottom
  for (let r = 5; r < 8; r++) {
    for (let c = 0; c < SIZE; c++) {
      if ((r + c) % 2 === 1) board[r][c] = { color: 'w', king: false }
    }
  }
  return board
}

function captureMovesFrom(board, r, c) {
  const piece = board[r][c]
  if (!piece) return []
  const moves = []
  for (const [dr, dc] of pieceDirs(piece)) {
    const midR = r + dr
    const midC = c + dc
    const newR = r + 2 * dr
    const newC = c + 2 * dc
    if (!inBounds(newR, newC)) continue
    if (board[newR][newC] !== null) continue
    const middle = board[midR]?.[midC]
    if (!middle) continue
    if (middle.color === piece.color) continue
    moves.push({
      from: [r, c],
      to: [newR, newC],
      captured: [midR, midC],
    })
  }
  return moves
}

function simpleMovesFrom(board, r, c) {
  const piece = board[r][c]
  if (!piece) return []
  const moves = []
  for (const [dr, dc] of pieceDirs(piece)) {
    const newR = r + dr
    const newC = c + dc
    if (!inBounds(newR, newC)) continue
    if (board[newR][newC] !== null) continue
    moves.push({ from: [r, c], to: [newR, newC] })
  }
  return moves
}

function allCaptureMoves(board, color) {
  const moves = []
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c]?.color === color) {
        moves.push(...captureMovesFrom(board, r, c))
      }
    }
  }
  return moves
}

function allSimpleMoves(board, color) {
  const moves = []
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c]?.color === color) {
        moves.push(...simpleMovesFrom(board, r, c))
      }
    }
  }
  return moves
}

// All legal moves for `color`. If captures exist anywhere, only
// captures are returned (forced capture rule).
export function legalMoves(board, color) {
  const captures = allCaptureMoves(board, color)
  if (captures.length > 0) return captures
  return allSimpleMoves(board, color)
}

// Legal moves from a specific square. Honours forced captures — if any
// other piece of the same colour can capture, this piece must capture
// too (returns [] if it can't).
export function legalMovesFrom(board, color, r, c) {
  if (board[r]?.[c]?.color !== color) return []
  const fromCaptures = captureMovesFrom(board, r, c)
  if (fromCaptures.length > 0) return fromCaptures
  if (allCaptureMoves(board, color).length > 0) return []
  return simpleMovesFrom(board, r, c)
}

function cloneBoard(board) {
  return board.map((row) => row.map((cell) => (cell ? { ...cell } : null)))
}

// Applies one move and returns:
//   { board, kinged, mustContinue, continuationMoves }
// `mustContinue` is true only when a capture was made AND the same
// piece (which did not promote on this move) has at least one further
// capture available.
export function applyMove(board, move) {
  const next = cloneBoard(board)
  const [fr, fc] = move.from
  const [tr, tc] = move.to
  const piece = next[fr][fc]
  next[fr][fc] = null
  let landed = { ...piece }
  if (move.captured) {
    const [cr, cc] = move.captured
    next[cr][cc] = null
  }
  let kinged = false
  if (!landed.king) {
    if (
      (landed.color === 'w' && tr === 0) ||
      (landed.color === 'b' && tr === SIZE - 1)
    ) {
      landed = { ...landed, king: true }
      kinged = true
    }
  }
  next[tr][tc] = landed
  let mustContinue = false
  let continuationMoves = []
  if (move.captured && !kinged) {
    continuationMoves = captureMovesFrom(next, tr, tc)
    if (continuationMoves.length > 0) mustContinue = true
  }
  return { board: next, kinged, mustContinue, continuationMoves }
}

export function countPieces(board, color) {
  let men = 0
  let kings = 0
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const p = board[r][c]
      if (p?.color === color) {
        if (p.king) kings++
        else men++
      }
    }
  }
  return { men, kings, total: men + kings }
}

// Returns { winner: 'w'|'b'|'draw', reason } if the game ends with
// `turn` about to move, else null.
export function gameResult(board, turn) {
  const w = countPieces(board, 'w').total
  const b = countPieces(board, 'b').total
  if (w === 0) return { winner: 'b', reason: 'no_pieces' }
  if (b === 0) return { winner: 'w', reason: 'no_pieces' }
  if (legalMoves(board, turn).length === 0) {
    return { winner: turn === 'w' ? 'b' : 'w', reason: 'no_moves' }
  }
  return null
}

// ===== AI =====
// Lightweight minimax with material counting. For chain captures we
// greedily extend the chain (kings count more than men, so the first
// chain a side finds is rarely the worst-scoring one).

const VAL_MAN = 100
const VAL_KING = 280
const VAL_ADVANCE = 2 // small bonus for advancing toward promotion

function evalSide(board, color) {
  let score = 0
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const p = board[r][c]
      if (p?.color !== color) continue
      score += p.king ? VAL_KING : VAL_MAN
      if (!p.king) {
        // advance bonus
        score += color === 'w' ? (SIZE - 1 - r) * VAL_ADVANCE : r * VAL_ADVANCE
      }
    }
  }
  return score
}

function evaluate(board, perspective) {
  const me = evalSide(board, perspective)
  const them = evalSide(board, perspective === 'w' ? 'b' : 'w')
  return me - them
}

// Walks chain captures greedily so the engine treats a multi-jump as
// a single atomic move when searching. We also pass back the final
// board for use by the caller.
function applyChained(board, move) {
  let cur = applyMove(board, move)
  let pos = move.to
  while (cur.mustContinue) {
    const next = cur.continuationMoves[0]
    cur = applyMove(cur.board, next)
    pos = next.to
  }
  return cur.board
}

function minimax(board, turn, depth, alpha, beta, perspective) {
  const result = gameResult(board, turn)
  if (result) {
    if (result.winner === 'draw') return 0
    return result.winner === perspective ? 100000 + depth : -100000 - depth
  }
  if (depth <= 0) return evaluate(board, perspective)
  const moves = legalMoves(board, turn)
  if (turn === perspective) {
    let best = -Infinity
    for (const move of moves) {
      const next = applyChained(board, move)
      const score = minimax(
        next,
        turn === 'w' ? 'b' : 'w',
        depth - 1,
        alpha,
        beta,
        perspective,
      )
      if (score > best) best = score
      if (best > alpha) alpha = best
      if (beta <= alpha) break
    }
    return best
  } else {
    let best = Infinity
    for (const move of moves) {
      const next = applyChained(board, move)
      const score = minimax(
        next,
        turn === 'w' ? 'b' : 'w',
        depth - 1,
        alpha,
        beta,
        perspective,
      )
      if (score < best) best = score
      if (best < beta) beta = best
      if (beta <= alpha) break
    }
    return best
  }
}

// Picks the best move for `color`. depth ∈ {1, 3, 5} for easy / medium
// / hard. Returns null if the side has no moves.
export function chooseAiMove(board, color, depth = 3) {
  const moves = legalMoves(board, color)
  if (moves.length === 0) return null
  let best = moves[0]
  let bestScore = -Infinity
  const shuffled = moves.slice().sort(() => Math.random() - 0.5)
  for (const move of shuffled) {
    const next = applyChained(board, move)
    const score = minimax(
      next,
      color === 'w' ? 'b' : 'w',
      depth - 1,
      -Infinity,
      Infinity,
      color,
    )
    if (score > bestScore) {
      bestScore = score
      best = move
    }
  }
  return best
}
