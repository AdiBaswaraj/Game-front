import { useViewport } from '../../hooks/useViewport'

export const ROWS = 6
export const STATE_PRIORITY = { correct: 3, present: 2, absent: 1 }
export const KEY_ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', '⌫'],
]

// Compute tile + key sizes that keep the 6-row grid and the on-screen
// keyboard both visible without scrolling on any viewport.
//   Default formula: cell = min(availableH/6, availableW/cols, 62)
//   If that drops below 36px, shrink keyboard rows to 38px and retry.
//   Very short viewports (height < 580) get 36px keys + tighter row gap.
export function useWordPuzzleSize(cols = 5) {
  const { width, height } = useViewport()
  const headerH = 72
  const padding = 32
  const veryShort = height < 580

  let keyH = veryShort ? 36 : 48
  let rowGap = veryShort ? 4 : 6
  let keyboardH = keyH * 3 + 8 * 2 // 3 rows + 2 row gaps (~8px)

  const compute = (kbH) => {
    const availableH = Math.max(120, height - headerH - kbH - padding)
    const availableW = Math.max(120, width - 32)
    return Math.min(
      Math.floor(availableH / ROWS),
      Math.floor(availableW / cols),
      62,
    )
  }

  let cellSize = compute(keyboardH)
  if (cellSize < 36 && keyH > 38) {
    keyH = 38
    keyboardH = keyH * 3 + 8 * 2
    cellSize = compute(keyboardH)
  }
  cellSize = Math.max(28, cellSize) // absolute floor

  return { cellSize, keyH, rowGap }
}

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

export function Board({
  board,
  cols,
  activeRow,
  shakeRow,
  cellSize = 56,
  rowGap = 6,
}) {
  return (
    <div
      className="flex flex-col"
      style={{ perspective: '600px', gap: `${rowGap}px` }}
    >
      {board.map((row, r) => {
        const isActive = r === activeRow
        return (
          <div
            key={r}
            className={`relative grid ${
              shakeRow && isActive ? 'wp-row-shake' : ''
            }`}
            style={{
              gridTemplateColumns: `repeat(${cols}, ${cellSize}px)`,
              gap: `${rowGap}px`,
              // 3px neon-green indicator on the active row's left edge.
              paddingLeft: isActive ? 8 : 0,
              marginLeft: isActive ? -8 : 0,
              borderLeft: isActive
                ? '3px solid rgba(0, 255, 136, 0.4)'
                : '3px solid transparent',
              transition: 'border-color 200ms ease',
            }}
          >
            {row.map((tile, c) => (
              <Tile key={c} tile={tile} index={c} cellSize={cellSize} />
            ))}
          </div>
        )
      })}
    </div>
  )
}

function Tile({ tile, index, cellSize = 56 }) {
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
  const fontSize = Math.max(12, Math.floor(cellSize * 0.45))

  return (
    <div
      className={`flex items-center justify-center rounded-md border-2 bg-arcadia-surface font-arcade uppercase tracking-wider text-white ${baseBg} ${animClass} ${popClass}`}
      style={{
        width: cellSize,
        height: cellSize,
        fontSize,
        // 200ms cascade per letter — matches the new 400ms wp-flip-*
        // duration so a 5-letter row reveals in ~1200ms total.
        animationDelay: animClass ? `${index * 0.2}s` : undefined,
      }}
    >
      {tile.letter}
    </div>
  )
}

// Middle row has 9 keys vs. 10 in the top row — a small horizontal
// inset centres it without forcing fixed widths on any key.
const MIDDLE_INSET_PCT = 5

export function Keyboard({ keyStates, onKey, keyH = 48 }) {
  return (
    <div
      className="flex flex-col items-stretch gap-1.5"
      style={{
        width: '100%',
        maxWidth: '100vw',
        boxSizing: 'border-box',
        padding: '0 4px',
        margin: 0,
        overflow: 'hidden',
      }}
    >
      {KEY_ROWS.map((row, ri) => {
        const isMiddle = ri === 1
        return (
          <div
            key={ri}
            className="flex w-full"
            style={{
              gap: '4px',
              boxSizing: 'border-box',
              paddingLeft: isMiddle ? `${MIDDLE_INSET_PCT}%` : 0,
              paddingRight: isMiddle ? `${MIDDLE_INSET_PCT}%` : 0,
            }}
          >
            {row.map((k) => (
              <KeyButton
                key={k}
                label={k}
                state={keyStates[k]}
                onClick={() => onKey(k)}
                wide={k === 'ENTER' || k === '⌫'}
                keyH={keyH}
              />
            ))}
          </div>
        )
      })}
    </div>
  )
}

function KeyButton({ label, state, onClick, wide, keyH = 48 }) {
  let cls = 'border-white/15 bg-arcadia-surface text-white hover:bg-white/5'
  if (state === 'correct')
    cls = 'border-neon-green bg-neon-green text-arcadia-bg'
  else if (state === 'present')
    cls = 'border-yellow-500 bg-yellow-500 text-arcadia-bg'
  else if (state === 'absent')
    cls = 'border-white/10 bg-[#2a2a36] text-white/50'

  // Font size scales with key height so short viewports stay readable.
  const fontSize = Math.max(8, Math.floor(keyH * 0.22))

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex select-none items-center justify-center rounded-md border font-arcade uppercase transition ${cls}`}
      style={{
        flex: wide ? '1.5 1 0' : '1 1 0',
        minWidth: 0,
        height: keyH,
        fontSize: wide ? Math.max(7, fontSize - 1) : fontSize,
      }}
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
