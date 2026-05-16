import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { getRoom, postScore } from '../../lib/api'
import { socket } from '../../lib/socket'
import Avatar from '../../components/Avatar'
import { DAILY_WORDS, isValidGuess } from './words'
import {
  Board,
  Keyboard,
  ROWS,
  composeDisplayBoard,
  evaluate,
  makeEmptyBoard,
  updateKeyStates,
} from './wordle-ui'

const COLS = 5

function hashCode(s) {
  let h = 0
  const str = String(s ?? '')
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

function wordForRoom(roomCode) {
  return DAILY_WORDS[hashCode(roomCode) % DAILY_WORDS.length]
}

function pick(o, ...keys) {
  for (const k of keys) {
    if (o && o[k] != null) return o[k]
  }
  return undefined
}

export default function WordPuzzleBattle({ roomCode }) {
  const { user, displayName } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()

  const answer = useMemo(() => wordForRoom(roomCode), [roomCode])

  const [room, setRoom] = useState(null)
  const [board, setBoard] = useState(() => makeEmptyBoard(COLS))
  const [currentRow, setCurrentRow] = useState(0)
  const [currentGuess, setCurrentGuess] = useState('')
  const [keyStates, setKeyStates] = useState({})
  const [status, setStatus] = useState('playing') // playing | won | lost
  const [revealing, setRevealing] = useState(false)
  const [shakeRow, setShakeRow] = useState(false)
  const [opponentGuessCount, setOpponentGuessCount] = useState(0)
  const [opponentSolved, setOpponentSolved] = useState(false)
  const [winnerInfo, setWinnerInfo] = useState(null)
  const scoreEmittedRef = useRef(false)

  // Load room for player info
  useEffect(() => {
    let cancelled = false
    getRoom(roomCode)
      .then((data) => {
        if (!cancelled) setRoom(data)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [roomCode])

  const myIdx = useMemo(() => {
    if (!room?.players) return -1
    return room.players.findIndex(
      (p) =>
        (user?.id && (p.userId ?? p.user_id ?? p.id) === user.id) ||
        (p.username ?? p.name)?.toLowerCase() ===
          displayName?.toLowerCase(),
    )
  }, [room, user?.id, displayName])

  const opponent = useMemo(() => {
    if (!room?.players || myIdx < 0) return null
    return room.players.find((_, i) => i !== myIdx) ?? null
  }, [room, myIdx])

  // Socket events
  useEffect(() => {
    const onOpponentAction = (data) => {
      const action = pick(data, 'action') ?? data
      if (action?.type === 'guess') {
        setOpponentGuessCount(action.guessCount ?? 0)
      }
    }
    const onGameOver = (data) => {
      const winnerId = pick(data, 'winnerId', 'winner_id', 'winner')
      const fromUserId =
        user?.id && (winnerId === user.id || winnerId === displayName)
      setWinnerInfo({
        winnerId,
        fromUserId: !!fromUserId,
        score: pick(data, 'score'),
      })
      if (!fromUserId && status === 'playing') {
        setOpponentSolved(true)
      }
    }
    const onOpponentLeft = () => {
      toast.show({ message: 'Opponent left the game.', duration: 4000 })
    }
    socket.on('opponent_action', onOpponentAction)
    socket.on('game_over', onGameOver)
    socket.on('opponent_left', onOpponentLeft)
    return () => {
      socket.off('opponent_action', onOpponentAction)
      socket.off('game_over', onGameOver)
      socket.off('opponent_left', onOpponentLeft)
    }
  }, [user?.id, displayName, status, toast])

  const emitGuessCount = useCallback(
    (count) => {
      socket.emit('game_action', {
        roomCode,
        action: { type: 'guess', guessCount: count },
      })
    },
    [roomCode],
  )

  const emitWin = useCallback(
    (guessCount) => {
      if (scoreEmittedRef.current) return
      scoreEmittedRef.current = true
      const opponentId =
        opponent?.userId ?? opponent?.user_id ?? opponent?.id ?? null
      socket.emit('game_over', {
        roomCode,
        winnerId: user?.id,
        loserId: opponentId,
        score: guessCount,
      })
      // Best-effort direct score save too (backend may also persist
      // from the socket event, but extra is harmless if idempotent)
      if (user?.id) {
        postScore({
          userId: user.id,
          gameId: 'word-puzzle',
          score: guessCount,
        }).catch(() => {})
      }
    },
    [opponent, roomCode, user?.id],
  )

  const submitGuess = useCallback(() => {
    if (status !== 'playing' || revealing) return
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
    setKeyStates((prev) => updateKeyStates(prev, states, currentGuess))
    emitGuessCount(currentRow + 1)

    const revealMs = COLS * 300 + 100
    setTimeout(() => {
      setRevealing(false)
      const won = currentGuess.toLowerCase() === answer.toLowerCase()
      if (won) {
        setStatus('won')
        emitWin(currentRow + 1)
      } else if (currentRow === ROWS - 1) {
        setStatus('lost')
      } else {
        setCurrentRow(currentRow + 1)
      }
      setCurrentGuess('')
    }, revealMs)
  }, [
    answer,
    board,
    currentGuess,
    currentRow,
    emitGuessCount,
    emitWin,
    revealing,
    status,
    toast,
  ])

  const handleKeyInput = useCallback(
    (key) => {
      if (status !== 'playing' || revealing) return
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
    [currentGuess.length, revealing, status, submitGuess],
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

  const displayBoard = useMemo(
    () =>
      status === 'playing'
        ? composeDisplayBoard(board, currentRow, currentGuess, COLS)
        : board,
    [board, currentGuess, currentRow, status],
  )

  const youWon = status === 'won'
  const opponentWonFirst = opponentSolved && status !== 'won'

  return (
    <div className="mx-auto grid max-w-3xl grid-cols-1 gap-6 lg:grid-cols-[1fr_15rem]">
      <div className="flex flex-col items-center gap-5">
        {opponentWonFirst && (
          <div className="lb-slide-in w-full max-w-md rounded-lg border-2 border-neon-pink/60 bg-arcadia-surface/95 px-4 py-3 text-center shadow-neon-pink">
            <p className="font-arcade text-[11px] text-neon-pink">
              OPPONENT SOLVED IT!
            </p>
            <p className="mt-1 text-xs text-white/65">
              You can keep playing, but this round is a loss.
            </p>
          </div>
        )}

        <div className="flex w-full items-center justify-between text-[10px] text-white/45">
          <span className="font-arcade">BATTLE · {roomCode}</span>
          <span className="font-arcade text-neon-cyan">
            VS {opponent?.username ?? '???'}
          </span>
        </div>

        <Board
          board={displayBoard}
          cols={COLS}
          activeRow={currentRow}
          shakeRow={shakeRow}
        />

        {(youWon || status === 'lost' || winnerInfo) && (
          <ResultOverlay
            youWon={youWon}
            opponentWonFirst={opponentWonFirst}
            answer={answer}
            guesses={youWon ? currentRow + 1 : null}
            onLobby={() => navigate('/')}
          />
        )}

        <Keyboard keyStates={keyStates} onKey={handleKeyInput} />
      </div>

      <aside className="flex flex-col gap-4">
        <PlayerCard
          accent="green"
          name={displayName}
          subtitle="YOU"
          guesses={currentRow + (status !== 'playing' || revealing ? 0 : 0)}
          solved={youWon}
        />
        <PlayerCard
          accent="pink"
          name={opponent?.username ?? '???'}
          subtitle="OPPONENT"
          guesses={opponentGuessCount}
          solved={opponentSolved}
        />
        <Link
          to="/"
          className="rounded-md border border-white/15 px-3 py-2 text-center font-arcade text-[10px] text-white/55 hover:border-neon-pink/60 hover:text-neon-pink"
        >
          LEAVE ROOM
        </Link>
      </aside>
    </div>
  )
}

function PlayerCard({ accent, name, subtitle, guesses, solved }) {
  const accentCls =
    accent === 'green'
      ? 'border-neon-green/40'
      : 'border-neon-pink/40'
  const dotCls =
    accent === 'green' ? 'text-neon-green' : 'text-neon-pink'
  return (
    <div
      className={`flex items-center gap-3 rounded-lg border bg-arcadia-surface/70 px-3 py-3 ${accentCls}`}
    >
      <Avatar name={name} size="md" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-arcade text-[10px] text-white">{name}</p>
        <p className="font-arcade text-[9px] text-white/40">{subtitle}</p>
      </div>
      <div className="text-right">
        <p className={`font-arcade text-sm ${dotCls}`}>
          {solved ? '✓' : `${guesses ?? 0}/6`}
        </p>
        <p className="font-arcade text-[8px] text-white/40">
          {solved ? 'SOLVED' : 'GUESSES'}
        </p>
      </div>
    </div>
  )
}

function ResultOverlay({ youWon, opponentWonFirst, answer, guesses, onLobby }) {
  const accent = youWon
    ? 'border-neon-green/60 shadow-neon-green text-neon-green'
    : 'border-neon-pink/60 shadow-neon-pink text-neon-pink'
  return (
    <div
      className={`w-full max-w-md rounded-xl border-2 bg-arcadia-surface/85 px-6 py-5 text-center backdrop-blur ${accent}`}
    >
      <p className="font-arcade text-lg drop-shadow-[0_0_10px_currentColor]">
        ★ {youWon ? 'YOU WIN!' : opponentWonFirst ? 'YOU LOST' : 'OUT OF GUESSES'} ★
      </p>
      <p className="mt-2 text-sm text-white/70">
        {youWon
          ? `Solved in ${guesses}/6`
          : `The word was ${answer.toUpperCase()}`}
      </p>
      <button
        type="button"
        onClick={onLobby}
        className="mt-4 rounded-md border border-neon-cyan/60 bg-neon-cyan/10 px-4 py-2 font-arcade text-[10px] text-neon-cyan hover:bg-neon-cyan/20 hover:shadow-neon-cyan"
      >
        BACK TO LOBBY
      </button>
    </div>
  )
}
