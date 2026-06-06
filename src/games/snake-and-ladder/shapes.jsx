import { SIZE, squareCenter, squareToCell } from './board'

// Generic bezier control-point helper. `perpAmp` is the magnitude of
// the perpendicular offset from the midpoint of a→b; `sign` flips
// which side the curve bends to (used to alternate snakes/ladders so
// they don't overlap at shared endpoints).
export function bezierBend(a, b, perpAmp, sign) {
  const ddx = b.x - a.x
  const ddy = b.y - a.y
  const len = Math.hypot(ddx, ddy) || 1
  const px = -ddy / len
  const py = ddx / len
  return {
    cx: (a.x + b.x) / 2 + px * perpAmp * sign,
    cy: (a.y + b.y) / 2 + py * perpAmp * sign,
  }
}

export function bezierPoint(a, cp, b, t) {
  const m = 1 - t
  return {
    x: m * m * a.x + 2 * m * t * cp.x + t * t * b.x,
    y: m * m * a.y + 2 * m * t * cp.y + t * t * b.y,
  }
}

export function bezierTangent(a, cp, b, t) {
  const x = 2 * (1 - t) * (cp.x - a.x) + 2 * t * (b.x - cp.x)
  const y = 2 * (1 - t) * (cp.y - a.y) + 2 * t * (b.y - cp.y)
  const len = Math.hypot(x, y) || 1
  return { x: x / len, y: y / len }
}

// Build a CSS offset-path string that takes a token from `fromSq` to
// `toSq` along a quadratic bezier whose amplitude matches the rendered
// snake/ladder shape. The path is expressed in board-pixel space
// relative to (0,0) at the token's starting square center.
export function computeSlidePath({ fromSq, toSq, boardSize, kind }) {
  const startCell = squareToCell(fromSq)
  const endCell = squareToCell(toSq)
  if (!startCell || !endCell) return null
  const unit = boardSize / SIZE
  const sx = (startCell.col + 0.5) * unit
  const sy = (startCell.row + 0.5) * unit
  const ex = (endCell.col + 0.5) * unit
  const ey = (endCell.row + 0.5) * unit
  const ddx = ex - sx
  const ddy = ey - sy
  const len = Math.hypot(ddx, ddy) || 1
  const px = -ddy / len
  const py = ddx / len
  const sign = fromSq % 2 === 0 ? 1 : -1
  const amp = kind === 'snake' ? 32 : 14
  const cpx = ddx / 2 + px * amp * sign
  const cpy = ddy / 2 + py * amp * sign
  return {
    sx,
    sy,
    path: `path("M 0 0 Q ${cpx.toFixed(1)} ${cpy.toFixed(1)} ${ddx.toFixed(1)} ${ddy.toFixed(1)}")`,
  }
}

export function LadderShape({ from, to, unit }) {
  const a = squareCenter(from, unit) // bottom anchor
  const b = squareCenter(to, unit) // top
  if (!a || !b) return null
  const sign = from % 2 === 0 ? 1 : -1
  const { cx, cy } = bezierBend(a, b, 10, sign)
  const cp = { x: cx, y: cy }
  const halfWidth = 8
  const samples = 18
  const pts = []
  for (let i = 0; i <= samples; i++) {
    const t = i / samples
    const p = bezierPoint(a, cp, b, t)
    const tg = bezierTangent(a, cp, b, t)
    const n = { x: -tg.y, y: tg.x }
    pts.push({
      left: { x: p.x + n.x * halfWidth, y: p.y + n.y * halfWidth },
      right: { x: p.x - n.x * halfWidth, y: p.y - n.y * halfWidth },
    })
  }
  const leftRail = pts
    .map((p) => `${p.left.x.toFixed(2)},${p.left.y.toFixed(2)}`)
    .join(' ')
  const rightRail = pts
    .map((p) => `${p.right.x.toFixed(2)},${p.right.y.toFixed(2)}`)
    .join(' ')
  const rungs = []
  let prev = pts[0]
  let acc = 0
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i]
    const midPrev = { x: (prev.left.x + prev.right.x) / 2, y: (prev.left.y + prev.right.y) / 2 }
    const midNow = { x: (p.left.x + p.right.x) / 2, y: (p.left.y + p.right.y) / 2 }
    acc += Math.hypot(midNow.x - midPrev.x, midNow.y - midPrev.y)
    if (acc >= 18 && i > 0 && i < pts.length - 1) {
      rungs.push(
        <line
          key={`r${i}`}
          x1={p.left.x}
          y1={p.left.y}
          x2={p.right.x}
          y2={p.right.y}
          stroke="#ffd700"
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity="0.9"
        />,
      )
      acc = 0
    }
    prev = p
  }
  return (
    <g>
      <polyline
        points={leftRail}
        stroke="#ffd700"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.95"
        fill="none"
      />
      <polyline
        points={rightRail}
        stroke="#ffd700"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.95"
        fill="none"
      />
      {rungs}
      <line
        x1={pts[pts.length - 1].left.x}
        y1={pts[pts.length - 1].left.y}
        x2={pts[pts.length - 1].right.x}
        y2={pts[pts.length - 1].right.y}
        stroke="#ffea4d"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx={pts[0].left.x} cy={pts[0].left.y} r="3" fill="#ffd700" />
      <circle cx={pts[0].right.x} cy={pts[0].right.y} r="3" fill="#ffd700" />
    </g>
  )
}

export function SnakeShape({ from, to, unit }) {
  const a = squareCenter(from, unit) // head (high square)
  const b = squareCenter(to, unit) // tail (low square)
  if (!a || !b) return null
  const sign = from % 2 === 0 ? 1 : -1
  const amp = 22 + (from % 4) * 6
  const { cx, cy } = bezierBend(a, b, amp, sign)
  const cp = { x: cx, y: cy }
  const startTg = bezierTangent(a, cp, b, 0)
  const headDir = { x: -startTg.x, y: -startTg.y }
  const perp = { x: -headDir.y, y: headDir.x }
  const eye1 = { x: a.x + perp.x * 2.8, y: a.y + perp.y * 2.8 }
  const eye2 = { x: a.x - perp.x * 2.8, y: a.y - perp.y * 2.8 }
  const tongueBase = { x: a.x + headDir.x * 7, y: a.y + headDir.y * 7 }
  const fork1 = {
    x: tongueBase.x + (headDir.x + perp.x * 0.45) * 5,
    y: tongueBase.y + (headDir.y + perp.y * 0.45) * 5,
  }
  const fork2 = {
    x: tongueBase.x + (headDir.x - perp.x * 0.45) * 5,
    y: tongueBase.y + (headDir.y - perp.y * 0.45) * 5,
  }
  return (
    <g>
      <path
        d={`M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`}
        stroke="#ff006e"
        strokeOpacity="0.25"
        strokeWidth="10"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d={`M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`}
        stroke="#ff006e"
        strokeWidth="6"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx={b.x} cy={b.y} r="2" fill="#ff006e" />
      <circle cx={a.x} cy={a.y} r="7.5" fill="#ff006e" stroke="#1a0010" strokeWidth="1.5" />
      <circle cx={eye1.x} cy={eye1.y} r="1.4" fill="#ffea4d" />
      <circle cx={eye2.x} cy={eye2.y} r="1.4" fill="#ffea4d" />
      <path
        d={`M ${a.x} ${a.y} L ${tongueBase.x} ${tongueBase.y} M ${tongueBase.x} ${tongueBase.y} L ${fork1.x} ${fork1.y} M ${tongueBase.x} ${tongueBase.y} L ${fork2.x} ${fork2.y}`}
        stroke="#ff006e"
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
      />
    </g>
  )
}
