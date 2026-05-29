// 48×48 pixel-art game icons. All shapes are rectangles — no curves.
// Each icon centers its motif within the viewBox and uses a single
// neon primary color so it composes cleanly with the surrounding glass
// surface.

export function SnakeIcon({ size = 48, ...rest }) {
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      fill="none"
      role="img"
      aria-label="Snake"
      {...rest}
    >
      {/* trailing body — dimmest to brightest as it approaches the head */}
      <rect x="32" y="32" width="6" height="6" fill="#00ff88" opacity="0.45" />
      <rect x="26" y="26" width="6" height="6" fill="#00ff88" opacity="0.65" />
      <rect x="20" y="20" width="6" height="6" fill="#00ff88" opacity="0.85" />
      {/* head */}
      <rect x="10" y="10" width="10" height="10" fill="#00ff88" />
      {/* eyes */}
      <rect x="12" y="12" width="2" height="2" fill="#ffffff" />
      <rect x="16" y="12" width="2" height="2" fill="#ffffff" />
      {/* tongue */}
      <rect x="6" y="14" width="4" height="1" fill="#ff006e" />
      <rect x="4" y="13" width="2" height="1" fill="#ff006e" />
      <rect x="4" y="15" width="2" height="1" fill="#ff006e" />
    </svg>
  )
}

export function SudokuIcon({ size = 48, ...rest }) {
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      fill="none"
      role="img"
      aria-label="Sudoku"
      {...rest}
    >
      {/* outer 36×36 frame */}
      <rect
        x="6"
        y="6"
        width="36"
        height="36"
        stroke="#00d4ff"
        strokeWidth="2"
        fill="transparent"
      />
      {/* inner grid lines */}
      <rect x="18" y="6" width="2" height="36" fill="#00d4ff" opacity="0.8" />
      <rect x="30" y="6" width="2" height="36" fill="#00d4ff" opacity="0.8" />
      <rect x="6" y="18" width="36" height="2" fill="#00d4ff" opacity="0.8" />
      <rect x="6" y="30" width="36" height="2" fill="#00d4ff" opacity="0.8" />
      {/* dim filled cells */}
      <rect x="20" y="8" width="10" height="10" fill="#00d4ff" opacity="0.15" />
      <rect x="8" y="32" width="10" height="10" fill="#00d4ff" opacity="0.15" />
      <rect x="32" y="20" width="10" height="10" fill="#00d4ff" opacity="0.15" />
      <rect x="20" y="32" width="10" height="10" fill="#00d4ff" opacity="0.15" />
      {/* "1" in top-left cell */}
      <rect x="11" y="8" width="2" height="2" fill="#00d4ff" />
      <rect x="13" y="8" width="2" height="8" fill="#00d4ff" />
      <rect x="11" y="14" width="6" height="2" fill="#00d4ff" />
      {/* "9" in bottom-right cell */}
      <rect x="33" y="33" width="6" height="2" fill="#00d4ff" />
      <rect x="33" y="35" width="2" height="2" fill="#00d4ff" />
      <rect x="37" y="33" width="2" height="6" fill="#00d4ff" />
      <rect x="33" y="37" width="6" height="2" fill="#00d4ff" />
    </svg>
  )
}

export function MinesweeperIcon({ size = 48, ...rest }) {
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      fill="none"
      role="img"
      aria-label="Minesweeper"
      {...rest}
    >
      {/* orthogonal spikes */}
      <rect x="22" y="4" width="4" height="6" fill="#ff006e" />
      <rect x="22" y="38" width="4" height="6" fill="#ff006e" />
      <rect x="4" y="22" width="6" height="4" fill="#ff006e" />
      <rect x="38" y="22" width="6" height="4" fill="#ff006e" />
      {/* diagonal spikes */}
      <rect x="10" y="10" width="4" height="4" fill="#ff006e" />
      <rect x="34" y="10" width="4" height="4" fill="#ff006e" />
      <rect x="10" y="34" width="4" height="4" fill="#ff006e" />
      <rect x="34" y="34" width="4" height="4" fill="#ff006e" />
      {/* central pixel "circle" */}
      <rect x="14" y="14" width="20" height="20" fill="#ff006e" />
      <rect x="12" y="16" width="2" height="16" fill="#ff006e" />
      <rect x="34" y="16" width="2" height="16" fill="#ff006e" />
      <rect x="16" y="12" width="16" height="2" fill="#ff006e" />
      <rect x="16" y="34" width="16" height="2" fill="#ff006e" />
      {/* reflection dots */}
      <rect x="18" y="18" width="3" height="3" fill="#ffffff" />
      <rect x="24" y="20" width="2" height="2" fill="#ffffff" />
    </svg>
  )
}

export function ChessIcon({ size = 48, ...rest }) {
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      fill="none"
      role="img"
      aria-label="Chess"
      {...rest}
    >
      {/* base */}
      <rect x="10" y="38" width="28" height="6" fill="#7000ff" />
      <rect x="12" y="34" width="24" height="4" fill="#7000ff" />
      {/* body / neck */}
      <rect x="18" y="22" width="14" height="12" fill="#7000ff" />
      {/* head profile */}
      <rect x="14" y="18" width="14" height="6" fill="#7000ff" />
      {/* ear */}
      <rect x="26" y="12" width="4" height="6" fill="#7000ff" />
      <rect x="30" y="14" width="2" height="4" fill="#7000ff" />
      {/* mane */}
      <rect x="32" y="22" width="2" height="10" fill="#7000ff" />
      {/* eye dot */}
      <rect x="20" y="20" width="2" height="2" fill="#050508" />
      {/* small cyan crown */}
      <rect x="16" y="8" width="2" height="4" fill="#00d4ff" />
      <rect x="20" y="6" width="2" height="6" fill="#00d4ff" />
      <rect x="24" y="8" width="2" height="4" fill="#00d4ff" />
    </svg>
  )
}

export function SnakeLadderIcon({ size = 48, ...rest }) {
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      fill="none"
      role="img"
      aria-label="Snake and Ladder"
      {...rest}
    >
      {/* dice body */}
      <rect
        x="8"
        y="8"
        width="32"
        height="32"
        fill="#ffd700"
        fillOpacity="0.12"
        stroke="#ffd700"
        strokeWidth="2"
      />
      {/* pixel-clipped corners */}
      <rect x="8" y="8" width="2" height="2" fill="#050508" />
      <rect x="38" y="8" width="2" height="2" fill="#050508" />
      <rect x="8" y="38" width="2" height="2" fill="#050508" />
      <rect x="38" y="38" width="2" height="2" fill="#050508" />
      {/* four dots showing "4" */}
      <rect x="14" y="14" width="6" height="6" fill="#ffd700" />
      <rect x="28" y="14" width="6" height="6" fill="#ffd700" />
      <rect x="14" y="28" width="6" height="6" fill="#ffd700" />
      <rect x="28" y="28" width="6" height="6" fill="#ffd700" />
    </svg>
  )
}

export function WordPuzzleIcon({ size = 48, ...rest }) {
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      fill="none"
      role="img"
      aria-label="Word Puzzle"
      {...rest}
    >
      {/* back tile — "?" */}
      <rect
        x="28"
        y="18"
        width="14"
        height="18"
        fill="#050508"
        stroke="#00d4ff"
        strokeWidth="1.5"
      />
      <rect x="32" y="22" width="6" height="2" fill="#00d4ff" />
      <rect x="36" y="24" width="2" height="2" fill="#00d4ff" />
      <rect x="34" y="26" width="2" height="2" fill="#00d4ff" />
      <rect x="34" y="30" width="2" height="2" fill="#00d4ff" />
      {/* middle tile — "P" */}
      <rect
        x="17"
        y="14"
        width="14"
        height="18"
        fill="#050508"
        stroke="#00d4ff"
        strokeWidth="1.5"
      />
      <rect x="20" y="18" width="2" height="10" fill="#00d4ff" />
      <rect x="20" y="18" width="6" height="2" fill="#00d4ff" />
      <rect x="26" y="20" width="2" height="2" fill="#00d4ff" />
      <rect x="20" y="22" width="6" height="2" fill="#00d4ff" />
      {/* front tile — "W" */}
      <rect
        x="6"
        y="16"
        width="14"
        height="18"
        fill="#050508"
        stroke="#00d4ff"
        strokeWidth="1.5"
      />
      <rect x="8" y="20" width="2" height="10" fill="#00d4ff" />
      <rect x="16" y="20" width="2" height="10" fill="#00d4ff" />
      <rect x="11" y="22" width="2" height="6" fill="#00d4ff" />
      <rect x="10" y="28" width="2" height="2" fill="#00d4ff" />
      <rect x="14" y="28" width="2" height="2" fill="#00d4ff" />
    </svg>
  )
}

// Pixel house — base rectangle + stepped triangular roof + door.
// Tinted via currentColor so the button can drive it.
export function HomeIcon({ size = 16, ...rest }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="currentColor"
      role="img"
      aria-label="Home"
      {...rest}
    >
      {/* roof — staircase of rectangles forming a triangle */}
      <rect x="7" y="2" width="2" height="2" />
      <rect x="5" y="4" width="6" height="1" />
      <rect x="3" y="5" width="10" height="1" />
      <rect x="2" y="6" width="12" height="1" />
      {/* body */}
      <rect x="3" y="7" width="10" height="7" />
      {/* door — punched out via background-tinted overlay */}
      <rect x="7" y="10" width="2" height="4" fill="#050508" />
      {/* window */}
      <rect x="5" y="9" width="1" height="1" fill="#050508" />
      <rect x="10" y="9" width="1" height="1" fill="#050508" />
    </svg>
  )
}

// ===== Side-nav menu icons — 20x20, currentColor =====

export function NavHomeIcon({ size = 20, ...rest }) {
  return (
    <svg
      viewBox="0 0 20 20"
      width={size}
      height={size}
      fill="currentColor"
      role="img"
      aria-label="Home"
      {...rest}
    >
      <rect x="9" y="2" width="2" height="2" />
      <rect x="7" y="4" width="6" height="2" />
      <rect x="5" y="6" width="10" height="2" />
      <rect x="4" y="8" width="12" height="8" />
      <rect x="8" y="12" width="4" height="4" fill="var(--bg-base)" />
    </svg>
  )
}

export function TrophyIcon({ size = 20, ...rest }) {
  return (
    <svg
      viewBox="0 0 20 20"
      width={size}
      height={size}
      fill="currentColor"
      role="img"
      aria-label="Hall of fame"
      {...rest}
    >
      <rect x="6" y="2" width="8" height="6" />
      <rect x="4" y="4" width="2" height="4" />
      <rect x="14" y="4" width="2" height="4" />
      <rect x="8" y="8" width="4" height="3" />
      <rect x="6" y="14" width="8" height="2" />
      <rect x="5" y="16" width="10" height="2" />
    </svg>
  )
}

export function FriendsIcon({ size = 20, ...rest }) {
  return (
    <svg
      viewBox="0 0 20 20"
      width={size}
      height={size}
      fill="currentColor"
      role="img"
      aria-label="Friends"
      {...rest}
    >
      <rect x="2" y="2" width="4" height="4" />
      <rect x="1" y="7" width="6" height="6" />
      <rect x="14" y="2" width="4" height="4" />
      <rect x="13" y="7" width="6" height="6" />
      <rect x="9" y="8" width="2" height="2" opacity="0.5" />
    </svg>
  )
}

export function GearIcon({ size = 20, ...rest }) {
  return (
    <svg
      viewBox="0 0 20 20"
      width={size}
      height={size}
      fill="currentColor"
      role="img"
      aria-label="Settings"
      {...rest}
    >
      <rect x="8" y="8" width="4" height="4" />
      <rect x="8" y="4" width="4" height="3" />
      <rect x="8" y="13" width="4" height="3" />
      <rect x="4" y="8" width="3" height="4" />
      <rect x="13" y="8" width="3" height="4" />
      <rect x="5" y="5" width="2" height="2" />
      <rect x="13" y="5" width="2" height="2" />
      <rect x="5" y="13" width="2" height="2" />
      <rect x="13" y="13" width="2" height="2" />
    </svg>
  )
}

// Pixel doorway with an outline cutout + arrow exiting to the right.
export function SignOutIcon({ size = 20, ...rest }) {
  return (
    <svg
      viewBox="0 0 20 20"
      width={size}
      height={size}
      fill="currentColor"
      role="img"
      aria-label="Sign out"
      {...rest}
    >
      {/* doorway frame */}
      <rect x="3" y="2" width="8" height="2" />
      <rect x="3" y="16" width="8" height="2" />
      <rect x="3" y="2" width="2" height="16" />
      {/* arrow shaft */}
      <rect x="9" y="9" width="8" height="2" />
      {/* arrow head */}
      <rect x="14" y="7" width="2" height="2" />
      <rect x="15" y="8" width="2" height="2" />
      <rect x="14" y="11" width="2" height="2" />
      <rect x="15" y="10" width="2" height="2" />
    </svg>
  )
}

// Lookup by game id — consumers use ICONS_BY_ID[gameId] when they
// don't already have access to the games.js entry.
export const ICONS_BY_ID = {
  snake: SnakeIcon,
  sudoku: SudokuIcon,
  minesweeper: MinesweeperIcon,
  chess: ChessIcon,
  'snake-and-ladder': SnakeLadderIcon,
  'word-puzzle': WordPuzzleIcon,
}
