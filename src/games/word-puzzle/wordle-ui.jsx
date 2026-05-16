export const ROWS = 6
export const STATE_PRIORITY = { correct: 3, present: 2, absent: 1 }
export const KEY_ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', '⌫'],
]

export function makeEmptyBoard(cols) {
  return Array.from({ length: ROWS }, () =>
    Array.from({ length: cols }, () => ({ letter: '', state: 'empty' })),
  )
}

export function evaluate(guess, answer) {
  const g = guess.toLowerCase()
  const a = answer.toLowerCase()
  const n = g.length
  const result = Array(n).fill('absent')
  const used = Array(n).fill(false)
  for (let i = 0; i < n; i++) {
    if (g[i] === a[i]) {
      result[i] = 'correct'
      used[i] = true
    }
  }
  for (let i = 0; i < n; i++) {
    if (result[i] === 'correct') continue
    for (let j = 0; j < n; j++) {
      if (!used[j] && g[i] === a[j]) {
        result[i] = 'present'
        used[j] = true
        break
      }
    }
  }
  return result
}

export function Board({ board, cols, activeRow, shakeRow }) {
  return (
    <div className="flex flex-col gap-1.5" style={{ perspective: '600px' }}>
      {board.map((row, r) => (
        <div
          key={r}
          className={`grid gap-1.5 ${
            shakeRow && r === activeRow ? 'wp-row-shake' : ''
          }`}
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {row.map((tile, c) => (
            <Tile key={c} tile={tile} index={c} cols={cols} />
          ))}
        </div>
      ))}
    </div>
  )
}

function Tile({ tile, index, cols }) {
  const animClass =
    tile.state === 'correct'
      ? 'wp-tile-correct'
      : tile.state === 'present'
        ? 'wp-tile-present'
        : tile.state === 'absent'
          ? 'wp-tile-absent'
          : ''
  const popClass = tile.state === 'typed' ? 'wp-tile-pop' : ''
  const baseBg = tile.state === 'typed' ? 'border-white/35' : 'border-white/15'

  const sizeClass =
    cols >= 6
      ? 'h-12 w-12 text-base sm:h-14 sm:w-14 sm:text-lg'
      : cols === 4
        ? 'h-16 w-16 text-xl sm:h-20 sm:w-20 sm:text-2xl'
        : 'h-14 w-14 text-lg sm:h-16 sm:w-16 sm:text-xl'

  return (
    <div
      className={`flex items-center justify-center rounded-md border-2 bg-arcadia-surface font-arcade uppercase tracking-wider text-white ${sizeClass} ${baseBg} ${animClass} ${popClass}`}
      style={{ animationDelay: animClass ? `${index * 0.3}s` : undefined }}
    >
      {tile.letter}
    </div>
  )
}

export function Keyboard({ keyStates, onKey }) {
  return (
    <div className="flex w-full flex-col items-center gap-1.5">
      {KEY_ROWS.map((row, ri) => (
        <div key={ri} className="flex w-full justify-center gap-1.5">
          {row.map((k) => (
            <KeyButton
              key={k}
              label={k}
              state={keyStates[k]}
              onClick={() => onKey(k)}
              wide={k === 'ENTER' || k === '⌫'}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

function KeyButton({ label, state, onClick, wide }) {
  let cls = 'border-white/15 bg-arcadia-surface text-white hover:bg-white/5'
  if (state === 'correct')
    cls = 'border-neon-green bg-neon-green text-arcadia-bg'
  else if (state === 'present')
    cls = 'border-yellow-500 bg-yellow-500 text-arcadia-bg'
  else if (state === 'absent')
    cls = 'border-white/10 bg-[#2a2a36] text-white/50'

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-12 select-none items-center justify-center rounded-md border font-arcade text-[10px] uppercase transition ${cls} ${
        wide ? 'flex-[1.6] text-[9px]' : 'flex-1'
      }`}
    >
      {label}
    </button>
  )
}

// Compose display board: overlay current guess into the active row
export function composeDisplayBoard(board, currentRow, currentGuess, cols) {
  const b = board.map((row) => row.map((cell) => ({ ...cell })))
  for (let i = 0; i < cols; i++) {
    const ch = currentGuess[i]
    b[currentRow][i] = {
      letter: ch ? ch.toUpperCase() : '',
      state: ch ? 'typed' : 'empty',
    }
  }
  return b
}

export function updateKeyStates(prev, states, guess) {
  const next = { ...prev }
  for (let i = 0; i < guess.length; i++) {
    const letter = guess[i].toUpperCase()
    const s = states[i]
    const existing = next[letter]
    if (!existing || STATE_PRIORITY[s] > STATE_PRIORITY[existing]) {
      next[letter] = s
    }
  }
  return next
}
