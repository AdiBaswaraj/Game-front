import { useEffect, useState } from 'react'
import { socket } from '../lib/socket'

function pick(o, ...keys) {
  for (const k of keys) if (o && o[k] != null) return o[k]
  return undefined
}

// Shared subscription for opponent_disconnected / opponent_reconnected.
// Used by Chess, Snake & Ladder, and Word Puzzle Battle so the grace-
// period banner behaves the same across multiplayer games.
export function useOpponentDisconnect(roomCode) {
  const [state, setState] = useState(null)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!roomCode) return
    const code = String(roomCode).toUpperCase()

    const onDisconnect = (data) => {
      const rc = pick(data, 'roomCode', 'room_code', 'code')
      if (rc && String(rc).toUpperCase() !== code) return
      const deadlineRaw = pick(
        data,
        'reconnectDeadline',
        'reconnect_deadline',
        'deadline',
      )
      const deadline =
        typeof deadlineRaw === 'number' && Number.isFinite(deadlineRaw)
          ? deadlineRaw
          : Date.now() + 60_000
      setState({
        username: pick(data, 'username', 'name'),
        deadline,
      })
      setNow(Date.now())
    }
    const onReconnect = (data) => {
      const rc = pick(data, 'roomCode', 'room_code', 'code')
      if (rc && String(rc).toUpperCase() !== code) return
      setState(null)
    }

    socket.on('opponent_disconnected', onDisconnect)
    socket.on('opponent_reconnected', onReconnect)
    return () => {
      socket.off('opponent_disconnected', onDisconnect)
      socket.off('opponent_reconnected', onReconnect)
    }
  }, [roomCode])

  useEffect(() => {
    if (!state) return
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [state])

  if (!state) return { disconnected: false }
  const secondsRemaining = Math.max(0, Math.ceil((state.deadline - now) / 1000))
  return {
    disconnected: true,
    username: state.username,
    secondsRemaining,
    deadline: state.deadline,
  }
}
