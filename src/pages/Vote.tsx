import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { getSocket } from '../lib/socket'
import type { Session, Round } from '../lib/types'

function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

function getOrCreateVoterId(sessionId: string): string {
  const key = `voter_${sessionId}`
  let id = localStorage.getItem(key)
  if (!id) {
    id = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : generateId()
    localStorage.setItem(key, id)
  }
  return id
}

function getVotedTeam(sessionId: string, roundId: string): 'A' | 'B' | null {
  const raw = localStorage.getItem(`vote_${sessionId}_${roundId}`)
  if (raw === 'A' || raw === 'B') return raw
  return null
}

function saveVotedTeam(sessionId: string, roundId: string, team: 'A' | 'B') {
  localStorage.setItem(`vote_${sessionId}_${roundId}`, team)
}

export default function Vote() {
  const { id } = useParams<{ id: string }>()
  const [session, setSession] = useState<Session | null>(null)
  const [error, setError] = useState('')
  const [voteStatus, setVoteStatus] = useState<'idle' | 'voted' | 'already'>('idle')
  const [myTeam, setMyTeam] = useState<'A' | 'B' | null>(null)
  const [now, setNow] = useState(Date.now())
  const socketRef = useRef(getSocket())

  // Tick every 200ms for countdown
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 200)
    return () => clearInterval(interval)
  }, [])

  // Socket setup
  useEffect(() => {
    const socket = socketRef.current
    if (!id) return

    socket.emit('subscribe', { sessionId: id })

    socket.on('sessionUpdate', (data: Session) => {
      setSession(data)
      // Check if we already voted in the latest round
      const round = data.rounds[data.rounds.length - 1]
      if (round) {
        const voted = getVotedTeam(id, round.id)
        if (voted) {
          setMyTeam(voted)
          setVoteStatus('voted')
        } else {
          // Reset vote UI when new round starts
          if (round.status === 'voting') {
            setVoteStatus('idle')
            setMyTeam(null)
          }
        }
      }
    })

    socket.on('voteConfirmed', ({ team }: { team: 'A' | 'B' }) => {
      setMyTeam(team)
      setVoteStatus('voted')
    })

    socket.on('alreadyVoted', () => {
      setVoteStatus('already')
    })

    socket.on('error', (data: { message: string }) => {
      setError(data.message)
    })

    return () => {
      socket.off('sessionUpdate')
      socket.off('voteConfirmed')
      socket.off('alreadyVoted')
      socket.off('error')
    }
  }, [id])

  const castVote = useCallback((team: 'A' | 'B') => {
    if (!id) return
    // Allow changing vote during active round, but not after it closes
    const round = session?.rounds[session.rounds.length - 1]
    if (!round || round.status !== 'voting') return
    if (myTeam === team) return // already voted for this team

    const voterId = getOrCreateVoterId(id)

    // Optimistic local update
    setMyTeam(team)
    setVoteStatus('voted')
    if (round) saveVotedTeam(id, round.id, team)

    socketRef.current.emit('vote', { sessionId: id, team, voterId })
  }, [id, myTeam, session])

  if (error) {
    return (
      <div className="min-h-screen spotlight-bg flex items-center justify-center p-6">
        <div className="card p-8 text-center max-w-sm">
          <div style={{ fontSize: '2rem', marginBottom: 12 }}>⚠️</div>
          <p style={{ color: 'var(--team-b)' }}>{error}</p>
          <a href="/" className="btn btn-ghost mt-4">Retour à l'accueil</a>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen spotlight-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div style={{ fontSize: '2rem' }}>🎭</div>
          <p style={{ color: 'var(--muted)' }}>Connexion en cours...</p>
        </div>
      </div>
    )
  }

  const currentRound = session.rounds[session.rounds.length - 1] as Round | undefined
  const isVoting = currentRound?.status === 'voting'
  const remainingMs = isVoting ? Math.max(0, currentRound.endTime - now) : 0
  const remainingSec = Math.ceil(remainingMs / 1000)
  const progress = isVoting ? Math.min(1, remainingMs / (currentRound.duration * 1000)) : 0

  const totalVotes = currentRound ? currentRound.votesA + currentRound.votesB : 0
  const pctA = totalVotes > 0 ? Math.round((currentRound!.votesA / totalVotes) * 100) : 50
  const pctB = totalVotes > 0 ? Math.round((currentRound!.votesB / totalVotes) * 100) : 50

  const roundWinnerA = currentRound && currentRound.status === 'closed' && currentRound.votesA > currentRound.votesB
  const roundWinnerB = currentRound && currentRound.status === 'closed' && currentRound.votesB > currentRound.votesA

  return (
    <div className="min-h-screen spotlight-bg flex flex-col" style={{ maxWidth: 480, margin: '0 auto' }}>
      {/* Match header */}
      <div className="px-5 pt-6 pb-3 text-center fade-in">
        <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--muted)' }}>
          🎭 Match d'impro
        </p>
        <h1 className="font-black tracking-tight" style={{ fontSize: '1.5rem', lineHeight: 1.2, letterSpacing: '-0.02em' }}>
          <span style={{ color: 'var(--team-a)' }}>{session.teamA}</span>
          {' '}<span style={{ color: 'var(--muted)', fontWeight: 400, fontSize: '1rem' }}>vs</span>{' '}
          <span style={{ color: 'var(--team-b)' }}>{session.teamB}</span>
        </h1>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col px-4 pb-8 gap-4">

        {/* Score du match */}
        {(session.scoreA > 0 || session.scoreB > 0) && (
          <div className="card-sm px-5 py-3 flex items-center justify-center gap-4 fade-in">
            <div className="text-center">
              <div className="font-black text-2xl" style={{ color: 'var(--team-a)' }}>{session.scoreA}</div>
              <div className="text-xs" style={{ color: 'var(--muted)' }}>{session.teamA}</div>
            </div>
            <div className="text-xs font-bold" style={{ color: 'var(--muted)' }}>tours gagnés</div>
            <div className="text-center">
              <div className="font-black text-2xl" style={{ color: 'var(--team-b)' }}>{session.scoreB}</div>
              <div className="text-xs" style={{ color: 'var(--muted)' }}>{session.teamB}</div>
            </div>
          </div>
        )}

        {/* Status bar */}
        <div className="flex justify-center">
          {session.status === 'finished' ? (
            <div className="badge-waiting">Match terminé</div>
          ) : isVoting ? (
            <div className="badge-voting">
              <span className="pulse-dot" />
              Vote en cours !
            </div>
          ) : (
            <div className="badge-waiting">
              <span className="pulse-dot" />
              En attente du vote...
            </div>
          )}
        </div>

        {/* Timer bar */}
        {isVoting && (
          <div className="fade-in">
            <div className="progress-bar-track" style={{ height: 6 }}>
              <div
                className="progress-bar-fill"
                style={{
                  width: `${progress * 100}%`,
                  background: remainingSec <= 10
                    ? 'var(--team-b)'
                    : 'var(--gold)',
                  transition: 'width 0.2s linear, background 0.3s'
                }}
              />
            </div>
            <div className="text-center mt-1">
              <span
                className="font-black"
                style={{
                  fontSize: '2.5rem',
                  color: remainingSec <= 10 ? 'var(--team-b)' : 'var(--gold)',
                  fontVariantNumeric: 'tabular-nums',
                  transition: 'color 0.3s'
                }}
              >
                {remainingSec}
              </span>
              <span className="text-sm ml-1" style={{ color: 'var(--muted)' }}>s</span>
            </div>
          </div>
        )}

        {/* Vote area */}
        {isVoting ? (
          /* Vote buttons — toujours visibles, changement possible */
          <div className="flex flex-col gap-3 flex-1 fade-in">
            <p className="text-center text-sm font-semibold" style={{ color: 'var(--muted)' }}>
              {voteStatus === 'idle' ? 'Tapez pour voter !' : 'Vous pouvez changer votre vote'}
            </p>
            <div className="grid grid-cols-2 gap-3" style={{ flex: '0 0 auto' }}>
              <button
                className={`vote-btn vote-btn-a${myTeam === 'A' ? ' voted' : ''}`}
                onClick={() => castVote('A')}
              >
                {myTeam === 'A' && <span style={{ fontSize: '1.2rem', position: 'absolute', top: 10, right: 12 }}>✅</span>}
                <span style={{ fontSize: '2.5rem', lineHeight: 1, marginBottom: 8 }}>🔵</span>
                <span className="text-center px-2" style={{ fontSize: '1.15rem', lineHeight: 1.2, fontWeight: 800 }}>
                  {session.teamA}
                </span>
              </button>
              <button
                className={`vote-btn vote-btn-b${myTeam === 'B' ? ' voted' : ''}`}
                onClick={() => castVote('B')}
              >
                {myTeam === 'B' && <span style={{ fontSize: '1.2rem', position: 'absolute', top: 10, right: 12 }}>✅</span>}
                <span style={{ fontSize: '2.5rem', lineHeight: 1, marginBottom: 8 }}>🔴</span>
                <span className="text-center px-2" style={{ fontSize: '1.15rem', lineHeight: 1.2, fontWeight: 800 }}>
                  {session.teamB}
                </span>
              </button>
            </div>
            {voteStatus === 'voted' && currentRound && (
              <LiveResults
                session={session}
                round={currentRound}
                pctA={pctA}
                pctB={pctB}
                totalVotes={totalVotes}
                myTeam={myTeam}
              />
            )}
          </div>
        ) : currentRound?.status === 'closed' ? (
          /* Round over */
          <div className="flex-1 flex flex-col gap-4 fade-in">
            <div className="text-center">
              <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--muted)' }}>
                Tour {session.rounds.length} — Résultat
              </p>
              {roundWinnerA && (
                <p className="font-black text-lg" style={{ color: 'var(--team-a)' }}>
                  🏆 {session.teamA} remporte ce tour !
                </p>
              )}
              {roundWinnerB && (
                <p className="font-black text-lg" style={{ color: 'var(--team-b)' }}>
                  🏆 {session.teamB} remporte ce tour !
                </p>
              )}
              {!roundWinnerA && !roundWinnerB && totalVotes > 0 && (
                <p className="font-black text-lg" style={{ color: 'var(--gold)' }}>
                  ⚖️ Égalité parfaite !
                </p>
              )}
            </div>
            <LiveResults
              session={session}
              round={currentRound}
              pctA={pctA}
              pctB={pctB}
              totalVotes={totalVotes}
              myTeam={myTeam}
              showWinner
            />
            {session.status === 'active' && (
              <p className="text-xs text-center mt-2" style={{ color: 'var(--muted)' }}>
                Attendez le prochain vote...
              </p>
            )}
          </div>
        ) : session.status === 'finished' ? (
          <MatchOver session={session} />
        ) : (
          /* Waiting */
          <div className="flex-1 flex flex-col items-center justify-center gap-4 fade-in">
            <div style={{ fontSize: '4rem' }}>🎭</div>
            <p className="text-lg font-bold text-center">
              En attente du vote
            </p>
            <p className="text-sm text-center" style={{ color: 'var(--muted)', maxWidth: 260 }}>
              L'organisateur va lancer une phase de vote. Tenez votre téléphone prêt !
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function LiveResults({
  session, round, pctA, pctB, totalVotes, myTeam, showWinner = false
}: {
  session: Session
  round: Round | undefined
  pctA: number
  pctB: number
  totalVotes: number
  myTeam: 'A' | 'B' | null
  showWinner?: boolean
}) {
  if (!round) return null

  const winnerA = showWinner && round.votesA > round.votesB
  const winnerB = showWinner && round.votesB > round.votesA

  return (
    <div className="card p-4 flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        {/* Team A */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between items-center text-sm">
            <div className="flex items-center gap-2">
              <span style={{ color: 'var(--team-a)', fontWeight: 700 }}>{session.teamA}</span>
              {myTeam === 'A' && <span className="text-xs" style={{ color: 'var(--team-a)', opacity: 0.7 }}>← votre vote</span>}
              {winnerA && <span>🏆</span>}
            </div>
            <span style={{ color: 'var(--team-a)', fontWeight: 800, fontSize: '1.1rem' }}>{pctA}%</span>
          </div>
          <div className="progress-bar-track">
            <div
              className="progress-bar-fill"
              style={{
                width: `${pctA}%`,
                background: 'var(--team-a)',
                boxShadow: myTeam === 'A' ? '0 0 8px var(--team-a)' : 'none'
              }}
            />
          </div>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>{round.votesA} vote{round.votesA !== 1 ? 's' : ''}</p>
        </div>

        {/* Team B */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between items-center text-sm">
            <div className="flex items-center gap-2">
              <span style={{ color: 'var(--team-b)', fontWeight: 700 }}>{session.teamB}</span>
              {myTeam === 'B' && <span className="text-xs" style={{ color: 'var(--team-b)', opacity: 0.7 }}>← votre vote</span>}
              {winnerB && <span>🏆</span>}
            </div>
            <span style={{ color: 'var(--team-b)', fontWeight: 800, fontSize: '1.1rem' }}>{pctB}%</span>
          </div>
          <div className="progress-bar-track">
            <div
              className="progress-bar-fill"
              style={{
                width: `${pctB}%`,
                background: 'var(--team-b)',
                boxShadow: myTeam === 'B' ? '0 0 8px var(--team-b)' : 'none'
              }}
            />
          </div>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>{round.votesB} vote{round.votesB !== 1 ? 's' : ''}</p>
        </div>
      </div>

      <p className="text-xs text-center" style={{ color: 'var(--muted)' }}>
        {totalVotes} vote{totalVotes !== 1 ? 's' : ''} au total
      </p>
    </div>
  )
}

function MatchOver({ session }: { session: Session }) {
  const closed = session.rounds.filter(r => r.status === 'closed')
  let scoreA = 0, scoreB = 0
  for (const r of closed) {
    if (r.votesA > r.votesB) scoreA++
    else if (r.votesB > r.votesA) scoreB++
  }
  const teamWon = scoreA > scoreB ? session.teamA : scoreB > scoreA ? session.teamB : null
  const winColor = scoreA > scoreB ? 'var(--team-a)' : scoreB > scoreA ? 'var(--team-b)' : 'var(--gold)'

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-5 fade-in text-center">
      <div style={{ fontSize: '4rem' }}>🎭</div>
      <div>
        <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--muted)' }}>
          Match terminé
        </p>
        {teamWon ? (
          <p className="font-black text-2xl" style={{ color: winColor }}>
            🏆 {teamWon} gagne !
          </p>
        ) : (
          <p className="font-black text-2xl" style={{ color: 'var(--gold)' }}>
            ⚖️ Égalité !
          </p>
        )}
        <p className="text-sm mt-2" style={{ color: 'var(--muted)' }}>
          Score final : {scoreA} – {scoreB}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 w-full max-w-xs">
        <div className="card-sm p-3 text-center">
          <div className="font-black text-3xl" style={{ color: 'var(--team-a)' }}>{scoreA}</div>
          <div className="text-xs mt-1" style={{ color: 'var(--team-a)' }}>{session.teamA}</div>
        </div>
        <div className="card-sm p-3 text-center">
          <div className="font-black text-3xl" style={{ color: 'var(--team-b)' }}>{scoreB}</div>
          <div className="text-xs mt-1" style={{ color: 'var(--team-b)' }}>{session.teamB}</div>
        </div>
      </div>
    </div>
  )
}
