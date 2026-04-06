const express = require('express')
const { createServer } = require('http')
const { Server } = require('socket.io')
const { randomUUID } = require('crypto')
const path = require('path')

const app = express()
app.use(express.json())

const server = createServer(app)
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
})

// ─── In-memory store ─────────────────────────────────────────────────────────
const sessions = new Map()  // sessionId → session object
const tokens = new Map()    // sessionId → admin token

function createRound(duration) {
  const now = Date.now()
  return {
    id: randomUUID().slice(0, 8),
    votesA: 0,
    votesB: 0,
    voters: new Set(),
    status: 'voting',
    duration,
    startTime: now,
    endTime: now + duration * 1000,
    timerHandle: null
  }
}

function serializeSession(session) {
  return {
    ...session,
    rounds: session.rounds.map(({ timerHandle, voters, ...r }) => ({
      ...r,
      voterCount: voters.size
    }))
  }
}

function broadcastSession(sessionId) {
  const session = sessions.get(sessionId)
  if (session) {
    io.to(sessionId).emit('sessionUpdate', serializeSession(session))
  }
}

function closeRound(session, round) {
  if (round.status !== 'voting') return
  round.status = 'closed'
  if (round.timerHandle) {
    clearTimeout(round.timerHandle)
    round.timerHandle = null
  }
}

// ─── REST API ────────────────────────────────────────────────────────────────
app.post('/api/sessions', (req, res) => {
  const { teamA, teamB } = req.body
  if (!teamA?.trim() || !teamB?.trim()) {
    return res.status(400).json({ error: 'Les deux noms d\'équipes sont requis.' })
  }

  const id = randomUUID().slice(0, 8)
  const token = randomUUID()

  const session = {
    id,
    teamA: teamA.trim(),
    teamB: teamB.trim(),
    rounds: [],
    status: 'active',
    createdAt: Date.now()
  }

  sessions.set(id, session)
  tokens.set(id, token)

  res.json({ session: serializeSession(session), token })
})

app.get('/api/sessions/:id', (req, res) => {
  const session = sessions.get(req.params.id)
  if (!session) return res.status(404).json({ error: 'Session introuvable.' })
  res.json(serializeSession(session))
})

// ─── Socket.io ───────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  // Subscribe to a session room
  socket.on('subscribe', ({ sessionId }) => {
    const session = sessions.get(sessionId)
    if (!session) {
      socket.emit('error', { message: 'Session introuvable.' })
      return
    }
    socket.join(sessionId)
    socket.emit('sessionUpdate', serializeSession(session))
  })

  // Admin: start a new voting round
  socket.on('startRound', ({ sessionId, duration, token }) => {
    const session = sessions.get(sessionId)
    if (!session) return
    if (tokens.get(sessionId) !== token) {
      socket.emit('error', { message: 'Non autorisé.' })
      return
    }
    if (session.status !== 'active') return

    // Close any active round
    const last = session.rounds[session.rounds.length - 1]
    if (last && last.status === 'voting') {
      closeRound(session, last)
    }

    const round = createRound(Number(duration) || 60)
    session.rounds.push(round)

    // Auto-close when time expires
    round.timerHandle = setTimeout(() => {
      closeRound(session, round)
      broadcastSession(sessionId)
    }, round.duration * 1000)

    broadcastSession(sessionId)
  })

  // Admin: manually end the current round
  socket.on('endRound', ({ sessionId, token }) => {
    const session = sessions.get(sessionId)
    if (!session) return
    if (tokens.get(sessionId) !== token) return

    const round = session.rounds[session.rounds.length - 1]
    if (round && round.status === 'voting') {
      closeRound(session, round)
      broadcastSession(sessionId)
    }
  })

  // Audience: cast a vote
  socket.on('vote', ({ sessionId, team, voterId }) => {
    const session = sessions.get(sessionId)
    if (!session) return

    const round = session.rounds[session.rounds.length - 1]
    if (!round || round.status !== 'voting') {
      socket.emit('voteError', { message: 'Aucun vote en cours.' })
      return
    }
    if (round.voters.has(voterId)) {
      socket.emit('alreadyVoted', {})
      return
    }

    round.voters.add(voterId)
    if (team === 'A') round.votesA++
    else if (team === 'B') round.votesB++

    socket.emit('voteConfirmed', { team })
    broadcastSession(sessionId)
  })

  // Admin: end the entire session
  socket.on('endSession', ({ sessionId, token }) => {
    const session = sessions.get(sessionId)
    if (!session) return
    if (tokens.get(sessionId) !== token) return

    const round = session.rounds[session.rounds.length - 1]
    if (round && round.status === 'voting') {
      closeRound(session, round)
    }
    session.status = 'finished'
    broadcastSession(sessionId)
  })
})

// ─── Static files (production) ───────────────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')))
  app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'))
  })
}

const PORT = process.env.PORT || 3000
server.listen(PORT, () => {
  console.log(`ImproVote server running on http://localhost:${PORT}`)
})
