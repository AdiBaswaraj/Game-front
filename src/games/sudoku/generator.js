const N = 9

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function isSafe(grid, r, c, num) {
  for (let i = 0; i < N; i++) {
    if (grid[r][i] === num) return false
    if (grid[i][c] === num) return false
  }
  const br = Math.floor(r / 3) * 3
  const bc = Math.floor(c / 3) * 3
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      if (grid[br + i][bc + j] === num) return false
    }
  }
  return true
}

function fill(grid) {
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (grid[r][c] === 0) {
        for (const n of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
          if (isSafe(grid, r, c, n)) {
            grid[r][c] = n
            if (fill(grid)) return true
            grid[r][c] = 0
          }
        }
        return false
      }
    }
  }
  return true
}

const HOLES = { easy: 40, medium: 50, hard: 58 }

export function generatePuzzle(difficulty = 'easy') {
  const solution = Array.from({ length: N }, () => Array(N).fill(0))
  fill(solution)
  const puzzle = solution.map((row) => [...row])
  const holes = HOLES[difficulty] ?? HOLES.easy
  let removed = 0
  while (removed < holes) {
    const r = Math.floor(Math.random() * N)
    const c = Math.floor(Math.random() * N)
    if (puzzle[r][c] !== 0) {
      puzzle[r][c] = 0
      removed++
    }
  }
  return { puzzle, solution }
}

export function findConflicts(grid) {
  const conflicts = new Set()
  const mark = (r, c) => conflicts.add(`${r},${c}`)
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const v = grid[r][c]
      if (!v) continue
      for (let i = 0; i < N; i++) {
        if (i !== c && grid[r][i] === v) {
          mark(r, c)
          break
        }
      }
      for (let i = 0; i < N; i++) {
        if (i !== r && grid[i][c] === v) {
          mark(r, c)
          break
        }
      }
      const br = Math.floor(r / 3) * 3
      const bc = Math.floor(c / 3) * 3
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          const rr = br + i
          const cc = bc + j
          if ((rr !== r || cc !== c) && grid[rr][cc] === v) mark(r, c)
        }
      }
    }
  }
  return conflicts
}

export function isComplete(grid) {
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (grid[r][c] === 0) return false
    }
  }
  return true
}

export function matchesSolution(grid, solution) {
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (grid[r][c] !== solution[r][c]) return false
    }
  }
  return true
}
