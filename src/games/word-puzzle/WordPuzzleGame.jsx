import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { createRoom, postScore } from '../../lib/api'
import Leaderboard from '../../components/Leaderboard'
import {
  getDailyDateKey,
  getDailyWord,
  getRandomWord,
  isValidGuess,
  loadDictionary,
} from './words'

const ROWS = 6
const KEY_ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', '⌫'],
]
const STATE_PRIORITY = { correct: 3, present: 2, absent: 1 }

function makeEmptyBoard(cols) {
  return Array.from({ length: ROWS }, () =>
    Array.from({ length: cols }, () => ({ letter: '', state: 'empty' })),
  )
}

function evaluate(guess, answer) {
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

function loadSavedState(dateKey) {
  if (!dateKey) return null
  try {
    const raw = localStorage.getItem(`arcadia:wordpuzzle:${dateKey}`)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function persistState(dateKey, state) {
  if (!dateKey) return
  try {
    localStorage.setItem(
      `arcadia:wordpuzzle:${dateKey}`,
      JSON.stringify(state),
    )
  } catch {
    // out of storage — fine
  }
}

function timeUntilMidnight() {
  const now = new Date()
  const next = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  )
  const ms = Math.max(0, next - now)
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function WordPuzzleGame({ mode = 'daily', length = 5 }) {
  const isDaily = mode === 'daily'
  const isFree = mode === 'free'
  const COLS = length

  const { user, displayName, openLogin } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()

  const dateKey = useMemo(
    () => (isDaily ? getDailyDateKey() : null),
    [isDaily],
  )
  const saved = useMemo(
    () => (isDaily ? loadSavedState(dateKey) : null),
    [isDaily, dateKey],
  )

  // Dictionary readiness — lazy load 4/6 letter dicts
  const [dictReady, setDictReady] = useState(length === 5)
  useEffect(() => {
    if (length === 5) {
      setDictReady(true)
      return
    }
    let cancelled = false
    setDictReady(false)
    loadDictionary(length)
      .then(() => {
        if (!cancelled) setDictReady(true)
      })
      .catch(() => {
        if (!cancelled) {
          toast.show({
            message: 'Could not load dictionary.',
            duration: 3000,
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [length, toast])

  const [answer, setAnswer] = useState(() => {
    if (isDaily) return getDailyWord()
    if (length === 5) return getRandomWord(5)
    return null
  })

  // Once dict is ready in free mode, pick an answer if we don't have one
  useEffect(() => {
    if (isFree && dictReady && !answer) {
      setAnswer(getRandomWord(length))
    }
  }, [isFree, dictReady, answer, length])

  const [board, setBoard] = useState(
    () => saved?.board ?? makeEmptyBoard(COLS),
  )
  const [currentRow, setCurrentRow] = useState(saved?.currentRow ?? 0)
  const [currentGuess, setCurrentGuess] = useState('')
  const [status, setStatus] = useState(saved?.status ?? 'playing')
  const [keyStates, setKeyStates] = useState(saved?.keyStates ?? {})
  const [shakeRow, setShakeRow] = useState(false)
  const [revealing, setRevealing] = useState(false)
  const [revealed, setRevealed] = useState(saved?.revealed ?? false)
  const [countdown, setCountdown] = useState(timeUntilMidnight)

  // Countdown when finished (daily only)
  useEffect(() => {
    if (!isDaily || status === 'playing') return
    setCountdown(timeUntilMidnight())
    const id = setInterval(() => setCountdown(timeUntilMidnight()), 1000)
    return () => clearInterval(id)
  }, [isDaily, status])

  // Day rollover check (daily only)
  useEffect(() => {
    if (!isDaily) return
    const id = setInterval(() => {
      if (getDailyDateKey() !== dateKey) window.location.reload()
    }, 60000)
    return () => clearInterval(id)
  }, [isDaily, dateKey])

  const updateKeyStates = useCallback((states, guess) => {
    setKeyStates((prev) => {
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
    })
  }, [])

  const finishGame = useCallback(
    (finalBoard, row, won) => {
      const finalStatus = won ? 'won' : 'lost'
      setStatus(finalStatus)

      if (isDaily) {
        setKeyStates((current) => {
          persistState(dateKey, {
            board: finalBoard,
            currentRow: row,
            status: finalStatus,
            keyStates: current,
            revealed: false,
            answer,
          })
          return current
        })
        if (user) {
          postScore({
            userId: user.id,
            gameId: 'word-puzzle',
            score: won ? row + 1 : 7,
          }).catch(() => {})
        }
      }
    },
    [answer, dateKey, isDaily, user],
  )

  const submitGuess = useCallback(() => {
    if (status !== 'playing' || revealing) return
    if (!answer) return
    if (currentGuess.length !== COLS) {
      toast.show({ message: `NEED ${COLS} LETTERS`, duration: 1500 })
      setShakeRow(true)
      setTimeout(() => setShakeRow(false), 450)
      return
    }
    if (!isValidGuess(currentGuess, COLS)) {
      toast.show({ message: 'NOT IN DICTIONARY', duration: 1500 })
      setShakeRow(true)
      setTimeout(() => setShakeRow(false), 450)
      return
    }

    const states = evaluate(currentGuess, answer)
    const nextBoard = board.map((row) => row.map((cell) => ({ ...cell })))
    for (let i = 0; i < COLS; i++) {
      nextBoard[currentRow][i] = {
        letter: currentGuess[i].toUpperCase(),
        state: states[i],
      }
    }

    setBoard(nextBoard)
    setRevealing(true)
    updateKeyStates(states, currentGuess)

    const revealMs = COLS * 300 + 100
    setTimeout(() => {
      setRevealing(false)
      const won = currentGuess.toLowerCase() === answer.toLowerCase()
      if (won) {
        finishGame(nextBoard, currentRow, true)
      } else if (currentRow === ROWS - 1) {
        finishGame(nextBoard, currentRow, false)
      } else {
        setCurrentRow(currentRow + 1)
        if (isDaily) {
          setKeyStates((current) => {
            persistState(dateKey, {
              board: nextBoard,
              currentRow: currentRow + 1,
              status: 'playing',
              keyStates: current,
              revealed: false,
              answer,
            })
            return current
          })
        }
      }
      setCurrentGuess('')
    }, revealMs)
  }, [
    answer,
    board,
    COLS,
    currentGuess,
    currentRow,
    dateKey,
    finishGame,
    isDaily,
    revealing,
    status,
    toast,
    updateKeyStates,
  ])

  const handleKeyInput = useCallback(
    (key) => {
      if (status !== 'playing' || revealing) return
      if (!dictReady) return
      if (key === 'ENTER') {
        submitGuess()
        return
      }
      if (key === '⌫' || key === 'BACKSPACE') {
        setCurrentGuess((g) => g.slice(0, -1))
        return
      }
      if (/^[a-z]$/i.test(key) && currentGuess.length < COLS) {
        setCurrentGuess((g) => g + key.toUpperCase())
      }
    },
    [COLS, currentGuess.length, dictReady, revealing, status, submitGuess],
  )

  useEffect(() => {
    const handler = (e) => {
      const tag = e.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'Enter') {
        e.preventDefault()
        handleKeyInput('ENTER')
      } else if (e.key === 'Backspace') {
        e.preventDefault()
        handleKeyInput('⌫')
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        e.preventDefault()
        handleKeyInput(e.key)
      }
    }
    window.addEventListener('keydown', handler, { passive: false })
    return () => window.removeEventListener('keydown', handler)
  }, [handleKeyInput])

  const newWord = useCallback(() => {
    if (!isFree) return
    setAnswer(getRandomWord(length))
    setBoard(makeEmptyBoard(COLS))
    setCurrentRow(0)
    setCurrentGuess('')
    setKeyStates({})
    setStatus('playing')
    setRevealed(false)
  }, [isFree, length, COLS])

  const handleReveal = useCallback(() => {
    if (!isDaily) return
    const ok = window.confirm(
      'Are you sure? This will end today’s challenge.',
    )
    if (!ok) return
    setRevealed(true)
    setKeyStates((current) => {
      persistState(dateKey, {
        board,
        currentRow,
        status: 'lost',
        keyStates: current,
        revealed: true,
        answer,
      })
      return current
    })
  }, [isDaily, dateKey, board, currentRow, answer])

  const handleShare = useCallback(async () => {
    if (!isDaily) return
    const guessCount = status === 'won' ? currentRow + 1 : 'X'
    const lines = [
      `Arcadia Word Puzzle · ${dateKey} · ${guessCount}/6`,
      '',
    ]
    for (let r = 0; r <= currentRow; r++) {
      if (board[r][0].state === 'empty') break
      const line = board[r]
        .map((tile) => {
          if (tile.state === 'correct') return '🟩'
          if (tile.state === 'present') return '🟨'
          return '⬛'
        })
        .join('')
      lines.push(line)
    }
    const text = lines.join('\n')
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
        toast.show({ message: 'COPIED TO CLIPBOARD', duration: 2000 })
      } else {
        throw new Error('no clipboard')
      }
    } catch {
      toast.show({
        message: 'COPY FAILED — SELECT MANUALLY',
        duration: 2500,
      })
    }
  }, [board, currentRow, dateKey, isDaily, status, toast])

  const handleBattle = useCallback(async () => {
    if (!user) {
      toast.show({
        message: 'Login required for multiplayer.',
        action: { label: 'LOGIN', onClick: openLogin },
      })
      return
    }
    try {
      const res = await createRoom({
        gameId: 'word-puzzle',
        username: displayName,
      })
      const code = res?.roomCode ?? res?.room_code ?? res?.code
      if (!code) {
        toast.show({ message: 'Could not create room.', duration: 2500 })
        return
      }
      navigate(`/room/${code}`)
    } catch (err) {
      toast.show({
        message: `Could not create room — ${err?.message ?? 'unknown error'}`,
        duration: 4500,
      })
    }
  }, [displayName, navigate, openLogin, toast, user])

  // Compose display board: overlay current guess into the active row
  const displayBoard = useMemo(() => {
    if (status !== 'playing') return board
    const b = board.map((row) => row.map((cell) => ({ ...cell })))
    for (let i = 0; i < COLS; i++) {
      const ch = currentGuess[i]
      b[currentRow][i] = {
        letter: ch ? ch.toUpperCase() : '',
        state: ch ? 'typed' : 'empty',
      }
    }
    return b
  }, [board, currentGuess, currentRow, status, COLS])

  if (!dictReady || (isFree && !answer)) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-3 py-16 text-center">
        <p className="font-arcade text-[11px] text-neon-cyan">
          LOADING DICTIONARY…
        </p>
        <p className="text-xs text-white/50">
          Fetching {length}-letter words.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-6">
      <div className="flex w-full items-center justify-between text-[10px] text-white/45">
        <span className="font-arcade">
          {isDaily ? `DAILY · ${dateKey}` : `FREE PLAY · ${COLS} LETTERS`}
        </span>
        {isDaily && (
          <button
            type="button"
            onClick={handleBattle}
            className="rounded-md border border-neon-pink/60 bg-neon-pink/10 px-3 py-1.5 font-arcade text-[10px] text-neon-pink transition hover:bg-neon-pink/20 hover:shadow-neon-pink"
          >
            ⚔ 2P BATTLE
          </button>
        )}
      </div>

      <Board
        board={displayBoard}
        cols={COLS}
        activeRow={currentRow}
        shakeRow={shakeRow}
      />

      {status === 'won' && (
        <Overlay
          tone="green"
          title="GENIUS!"
          subtitle={`Solved in ${currentRow + 1} / 6`}
          isDaily={isDaily}
          countdown={countdown}
          onShare={handleShare}
          onNewWord={newWord}
        />
      )}

      {status === 'lost' && (
        <Overlay
          tone="pink"
          title="GAME OVER"
          subtitle={
            isDaily
              ? revealed
                ? `The word was ${answer.toUpperCase()}`
                : null
              : `The word was ${answer.toUpperCase()}`
          }
          isDaily={isDaily}
          revealed={revealed}
          onReveal={isDaily && !revealed ? handleReveal : null}
          countdown={countdown}
          onShare={handleShare}
          onNewWord={newWord}
        />
      )}

      <Keyboard keyStates={keyStates} onKey={handleKeyInput} cols={COLS} />

      {isDaily && (status === 'won' || status === 'lost') && (
        <div className="lb-slide-in w-full max-w-md">
          <Leaderboard
            gameId="word-puzzle"
            scoreFormat="guesses"
            lowerIsBetter
            title="WORD PUZZLE · DAILY"
          />
        </div>
      )}

      {isDaily && !user && status === 'playing' && (
        <p className="text-center text-[10px] text-white/40">
          Log in to save your daily score.
        </p>
      )}

      {isFree && status === 'playing' && (
        <p className="text-center text-[10px] text-white/40">
          Free play is unranked — scores aren&rsquo;t saved.
        </p>
      )}
    </div>
  )
}

function Board({ board, cols, activeRow, shakeRow }) {
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

  // Scale tile size slightly down when cols=6 to keep the row from
  // overflowing on narrow viewports
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

function Keyboard({ keyStates, onKey }) {
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

function Overlay({
  tone,
  title,
  subtitle,
  isDaily,
  revealed,
  onReveal,
  countdown,
  onShare,
  onNewWord,
}) {
  const accent =
    tone === 'green'
      ? 'border-neon-green/60 shadow-neon-green text-neon-green'
      : 'border-neon-pink/60 shadow-neon-pink text-neon-pink'

  return (
    <div
      className={`w-full max-w-md rounded-xl border-2 bg-arcadia-surface/85 px-6 py-5 text-center backdrop-blur ${accent}`}
    >
      <p className="font-arcade text-base drop-shadow-[0_0_10px_currentColor] md:text-lg">
        ★ {title} ★
      </p>
      {subtitle && <p className="mt-2 text-sm text-white/70">{subtitle}</p>}

      {isDaily && onReveal && (
        <button
          type="button"
          onClick={onReveal}
          className="mt-4 rounded-md border border-neon-cyan/60 bg-neon-cyan/10 px-4 py-2 font-arcade text-[10px] text-neon-cyan transition hover:bg-neon-cyan/20 hover:shadow-neon-cyan"
        >
          👁 REVEAL ANSWER
        </button>
      )}

      {isDaily && (
        <>
          <p className="mt-4 font-arcade text-[10px] text-white/50">
            NEXT WORD IN
          </p>
          <p className="font-arcade text-base text-neon-cyan">{countdown}</p>
        </>
      )}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
        {isDaily ? (
          <button
            type="button"
            onClick={onShare}
            className="rounded-md border border-neon-cyan/60 bg-neon-cyan/10 px-4 py-2 font-arcade text-[10px] text-neon-cyan transition hover:bg-neon-cyan/20 hover:shadow-neon-cyan"
          >
            📋 SHARE RESULT
          </button>
        ) : (
          <button
            type="button"
            onClick={onNewWord}
            className="rounded-md border border-neon-green/60 bg-neon-green/10 px-4 py-2 font-arcade text-[10px] text-neon-green transition hover:bg-neon-green/20 hover:shadow-neon-green"
          >
            ▶ NEW WORD
          </button>
        )}
        <Link
          to="/"
          className="rounded-md border border-white/20 px-4 py-2 text-center font-arcade text-[10px] text-white/70 transition hover:border-neon-cyan/60 hover:text-neon-cyan"
        >
          BACK TO LOBBY
        </Link>
      </div>
      {isDaily && (
        <p className="mt-3 text-[10px] text-white/35">Come back tomorrow.</p>
      )}
    </div>
  )
}
