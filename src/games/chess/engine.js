// Stockfish wrapper. We load the lite single-threaded WASM build from
// /public/stockfish/ so it works without COOP/COEP headers on Vercel.
// Calls fall back to a random legal move if the engine fails to init.

import { Chess } from 'chess.js'

const ENGINE_URL = '/stockfish/stockfish-18-lite-single.js'

let workerPromise = null
let pendingMove = null

// Engine state subscribers: 'idle' → 'loading' → 'ready' | 'fallback'
let engineState = 'idle'
const stateListeners = new Set()

export function subscribeEngineState(fn) {
  stateListeners.add(fn)
  fn(engineState)
  return () => stateListeners.delete(fn)
}

function setEngineState(s) {
  if (engineState === s) return
  engineState = s
  for (const fn of stateListeners) fn(s)
}

function loadWorker() {
  if (workerPromise) return workerPromise
  setEngineState('loading')
  workerPromise = new Promise((resolve) => {
    let worker
    try {
      worker = new Worker(ENGINE_URL)
    } catch (err) {
      console.warn('[chess] Stockfish worker construction failed', err)
      setEngineState('fallback')
      resolve(null)
      return
    }

    let initialized = false
    const timeout = setTimeout(() => {
      if (!initialized) {
        console.warn('[chess] Stockfish init timeout, falling back to random AI')
        try {
          worker.terminate()
        } catch {}
        setEngineState('fallback')
        resolve(null)
      }
    }, 15000)

    const onMessage = (e) => {
      const line = typeof e.data === 'string' ? e.data : ''
      if (line === 'readyok') {
        initialized = true
        clearTimeout(timeout)
        worker.removeEventListener('message', onMessage)
        // Wire the main message listener for move responses
        worker.addEventListener('message', (ev) => {
          const l = typeof ev.data === 'string' ? ev.data : ''
          if (l.startsWith('bestmove') && pendingMove) {
            const move = l.split(' ')[1]
            const resolver = pendingMove
            pendingMove = null
            resolver(move === '(none)' ? null : move)
          }
        })
        worker.addEventListener('error', (err) => {
          console.warn('[chess] Stockfish worker error', err)
        })
        setEngineState('ready')
        resolve(worker)
      }
    }
    worker.addEventListener('message', onMessage)
    worker.addEventListener('error', (err) => {
      if (!initialized) {
        console.warn('[chess] Stockfish errored during init', err)
        clearTimeout(timeout)
        setEngineState('fallback')
        resolve(null)
      }
    })
    worker.postMessage('uci')
    worker.postMessage('isready')
  })
  return workerPromise
}

// Eagerly load the engine so the loading indicator shows up early.
export function preloadEngine() {
  loadWorker()
}

export async function getBestMove(fen, depth) {
  const worker = await loadWorker()
  if (!worker) return randomMoveFor(fen)
  // Serialize: cancel any prior request before issuing new one
  if (pendingMove) {
    worker.postMessage('stop')
    pendingMove(null)
    pendingMove = null
  }
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      if (pendingMove) {
        pendingMove = null
        resolve(randomMoveFor(fen))
      }
    }, 15000)
    pendingMove = (move) => {
      clearTimeout(timeout)
      resolve(move ?? randomMoveFor(fen))
    }
    worker.postMessage(`position fen ${fen}`)
    worker.postMessage(`go depth ${depth}`)
  })
}

export function randomMoveFor(fen) {
  try {
    const chess = new Chess(fen)
    const moves = chess.moves({ verbose: true })
    if (moves.length === 0) return null
    const m = moves[Math.floor(Math.random() * moves.length)]
    return `${m.from}${m.to}${m.promotion ?? ''}`
  } catch {
    return null
  }
}

export const DIFFICULTY_DEPTH = {
  easy: 2,
  medium: 6,
  hard: 14,
}
