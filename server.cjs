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
const codes = new Map()     // accessCode → sessionId

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no I/O/0/1 to avoid confusion
  let code
  do {
    code = Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  } while (codes.has(code))
  return code
}

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
    session.lastActivity = Date.now()
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
  const { teamA, teamB, colorA, colorB } = req.body
  if (!teamA?.trim() || !teamB?.trim()) {
    return res.status(400).json({ error: 'Les deux noms d\'équipes sont requis.' })
  }

  const id = randomUUID().slice(0, 8)
  const token = randomUUID()
  const code = generateCode()

  const session = {
    id,
    teamA: teamA.trim(),
    teamB: teamB.trim(),
    colorA: colorA || '#4f8ef7',
    colorB: colorB || '#f74f6a',
    rounds: [],
    status: 'active',
    locked: false,
    code,
    createdAt: Date.now()
  }

  sessions.set(id, session)
  tokens.set(id, token)
  codes.set(code, id)

  res.json({ session: serializeSession(session), token })
})

app.get('/health', (_req, res) => res.json({ ok: true }))

app.get('/api/sessions/:id', (req, res) => {
  const session = sessions.get(req.params.id)
  if (!session) return res.status(404).json({ error: 'Session introuvable.' })
  res.json(serializeSession(session))
})

app.get('/api/code/:code', (req, res) => {
  const sessionId = codes.get(req.params.code.toUpperCase())
  if (!sessionId) return res.status(404).json({ error: 'Code invalide.' })
  res.json({ sessionId })
})

// ─── Simulation ──────────────────────────────────────────────────────────────
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)) }

function getDistribution(i, total, pattern) {
  const noise = () => (Math.random() - 0.5) * 0.08
  const mid = Math.floor(total / 2)
  switch (pattern) {
    case 'teamA_dominant': {
      const base = clamp(0.65 + noise(), 0.54, 0.82)
      return { pctA: base, pctB: 1 - base }
    }
    case 'teamB_dominant': {
      const base = clamp(0.65 + noise(), 0.54, 0.82)
      return { pctA: 1 - base, pctB: base }
    }
    case 'teamA_comeback': {
      const base = clamp(0.63 + noise(), 0.54, 0.78)
      return i < mid
        ? { pctA: 1 - base, pctB: base }
        : { pctA: base, pctB: 1 - base }
    }
    case 'teamB_comeback': {
      const base = clamp(0.63 + noise(), 0.54, 0.78)
      return i < mid
        ? { pctA: base, pctB: 1 - base }
        : { pctA: 1 - base, pctB: base }
    }
    case 'tight': {
      const base = clamp(0.50 + noise() * 0.4, 0.44, 0.56)
      return { pctA: base, pctB: 1 - base }
    }
    case 'balanced':
    default: {
      const base = clamp(0.60 + noise(), 0.53, 0.70)
      return i % 2 === 0
        ? { pctA: base, pctB: 1 - base }
        : { pctA: 1 - base, pctB: base }
    }
  }
}

function generateSimulatedRounds(voterCount, roundCount, pattern) {
  const rounds = []
  for (let i = 0; i < roundCount; i++) {
    const { pctA, pctB } = getDistribution(i, roundCount, pattern)
    const votesA = Math.round(voterCount * pctA)
    const votesB = voterCount - votesA
    const voters = new Map()
    for (let v = 0; v < voterCount; v++) {
      voters.set(`sim_${i}_${v}`, v < votesA ? 'A' : 'B')
    }
    const ts = Date.now() - (roundCount - i) * 90_000
    rounds.push({
      id: randomUUID().slice(0, 8),
      votesA, votesB, votesNeutral: 0,
      allowNeutral: false,
      voters,
      status: 'closed',
      duration: 30,
      startTime: ts,
      endTime: ts + 30_000,
      timerHandle: null
    })
  }
  return rounds
}

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

  // Admin: toggle session lock
  socket.on('toggleLock', ({ sessionId, token }) => {
    const session = sessions.get(sessionId)
    if (!session) return
    if (tokens.get(sessionId) !== token) return
    session.locked = !session.locked
    broadcastSession(sessionId)
  })

  // Admin: run a simulation
  socket.on('runSimulation', ({ sessionId, token, voterCount, roundCount, pattern }) => {
    const session = sessions.get(sessionId)
    if (!session) return
    if (tokens.get(sessionId) !== token) return

    // Close any active round first
    const last = session.rounds[session.rounds.length - 1]
    if (last && last.status === 'voting') closeRound(session, last)

    // Replace all rounds with simulated ones
    session.rounds = generateSimulatedRounds(
      Math.max(1, Math.min(100, voterCount || 20)),
      Math.max(1, Math.min(10, roundCount || 5)),
      pattern || 'balanced'
    )
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

// ─── Session cleanup ─────────────────────────────────────────────────────────
const FINISHED_TTL = 2 * 60 * 60 * 1000   // 2h après la fin
const ACTIVE_TTL   = 24 * 60 * 60 * 1000  // 24h sans activité

setInterval(() => {
  const now = Date.now()
  for (const [id, session] of sessions) {
    const lastActivity = session.lastActivity || session.createdAt
    const isStale =
      (session.status === 'finished' && now - lastActivity > FINISHED_TTL) ||
      (now - lastActivity > ACTIVE_TTL)
    if (isStale) {
      codes.delete(session.code)
      tokens.delete(id)
      sessions.delete(id)
    }
  }
}, 60 * 60 * 1000) // toutes les heures

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
