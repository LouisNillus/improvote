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

function createRound(duration, allowNeutral) {
  const now = Date.now()
  return {
    id: randomUUID().slice(0, 8),
    votesA: 0,
    votesB: 0,
    votesNeutral: 0,
    allowNeutral: !!allowNeutral,
    voters: new Map(), // voterId → 'A' | 'B' | 'neutral'
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
    })),
    scoreA: session.rounds.filter(r => r.status === 'closed' && r.votesA >= r.votesB && (r.votesA + r.votesB + r.votesNeutral) > 0).length,
    scoreB: session.rounds.filter(r => r.status === 'closed' && r.votesB >= r.votesA && (r.votesA + r.votesB + r.votesNeutral) > 0).length
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
  socket.on('startRound', ({ sessionId, duration, token, allowNeutral }) => {
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

    const round = createRound(Number(duration) || 60, allowNeutral)
    session.rounds.push(round)

    // Auto-close when time expires
    round.timerHandle = setTimeout(() => {
      closeRound(session, round)
      broadcastSession(sessionId)
    }, round.duration * 1000)

    broadcastSession(sessionId)
  })

  // Admin: manually close the current round (keep in history)
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

  // Admin: cancel the current round entirely (remove from history)
  socket.on('cancelRound', ({ sessionId, token }) => {
    const session = sessions.get(sessionId)
    if (!session) return
    if (tokens.get(sessionId) !== token) return

    const round = session.rounds[session.rounds.length - 1]
    if (round && round.status === 'voting') {
      if (round.timerHandle) {
        clearTimeout(round.timerHandle)
        round.timerHandle = null
      }
      session.rounds.pop()
      broadcastSession(sessionId)
    }
  })

  // Audience: cast, change, or remove a vote
  socket.on('vote', ({ sessionId, team, voterId }) => {
    const session = sessions.get(sessionId)
    if (!session) return

    const round = session.rounds[session.rounds.length - 1]
    if (!round || round.status !== 'voting') {
      socket.emit('voteError', { message: 'Aucun vote en cours.' })
      return
    }

    // team === null means unvote
    if (team === 'neutral' && !round.allowNeutral) return

    const previous = round.voters.get(voterId)
    if (previous === team) return // no change

    // Remove previous vote
    if (previous === 'A') round.votesA--
    else if (previous === 'B') round.votesB--
    else if (previous === 'neutral') round.votesNeutral--

    if (team === null) {
      round.voters.delete(voterId)
    } else {
      round.voters.set(voterId, team)
      if (team === 'A') round.votesA++
      else if (team === 'B') round.votesB++
      else if (team === 'neutral') round.votesNeutral++
    }

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
