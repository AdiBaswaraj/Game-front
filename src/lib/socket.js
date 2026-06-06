import { io } from 'socket.io-client'

const backendUrl = import.meta.env.VITE_BACKEND_URL

export const socket = io(backendUrl, {
  autoConnect: false,
  // Default to polling first then upgrade to WebSocket. Restricting to
  // ['websocket'] used to break the game for any user whose network
  // blocks or rewrites raw WS frames — corporate firewalls, some
  // Indian ISPs, several mobile carriers, antivirus proxies, etc. —
  // which is what was bricking new-account sessions with "creating
  // room failed" / endless "loading" loops. socket.io upgrades to
  // WebSocket automatically once the polling handshake establishes,
  // so this isn't a perf regression for the happy path.
  transports: ['polling', 'websocket'],
  // Long-lived gameplay sockets should auto-recover after transient
  // network blips instead of bricking the room until the user
  // refreshes.
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 500,
  reconnectionDelayMax: 5000,
  timeout: 20000,
})
