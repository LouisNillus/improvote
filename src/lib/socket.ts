import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null

export function getSocket(): Socket {
  if (!socket) {
    const serverUrl = import.meta.env.VITE_SERVER_URL || undefined
    socket = io(serverUrl, { autoConnect: true, reconnectionAttempts: Infinity })
  }
  return socket
}
