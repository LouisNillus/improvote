import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { getSocket } from '../lib/socket'
import type { Session, Round, VoteTeam } from '../lib/types'

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

function getLocalVote(sessionId: string, roundId: string): VoteTeam {
  const raw = localStorage.getItem(`vote_${sessionId}_${roundId}`)
  if (raw === 'A' || raw === 'B' || raw === 'neutral') return raw
  return null
}

function saveLocalVote(sessionId: string, roundId: string, team: VoteTeam) {
  if (team === null) {
    localStorage.removeItem(`vote_${sessionId}_${roundId}`)
  } else {
    localStorage.setItem(`vote_${sessionId}_${roundId}`, team)
  }
}

export default function Vote() {
  const { id } = useParams<{ id: string }>()
  const [session, setSession] = useState<Session | null>(null)
  const [error, setError] = useState('')
  const [myTeam, setMyTeam] = useState<VoteTeam>(null)
  const [now, setNow] = useState(Date.now())
  const socketRef = useRef(getSocket())
  const hasAccessRef = useRef(!!id && localStorage.getItem(`access_${id}`) === '1')

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 200)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const socket = socketRef.current
    if (!id) return

    socket.emit('subscribe', { sessionId: id })

    socket.on('sessionUpdate', (data: Session) => {
      if (!data.locked) {
        hasAccessRef.current = true
        if (id) localStorage.setItem(`access_${id}`, '1')
      }
      setSession(data)
      const round = data.rounds[data.rounds.length - 1]
      if (round) {
        const saved = getLocalVote(id, round.id)
        if (saved) {
          setMyTeam(saved)
        } else if (round.status === 'voting') {
          // New round — reset
          setMyTeam(null)
        }
      } else {
        setMyTeam(null)
      }
    })

    socket.on('voteConfirmed', ({ team }: { team: VoteTeam }) => {
      setMyTeam(team)
    })

    socket.on('error', (data: { message: string }) => {
      setError(data.message)
    })

    return () => {
      socket.off('sessionUpdate')
      socket.off('voteConfirmed')
      socket.off('error')
    }
  }, [id])

  const sendVote = useCallback((team: VoteTeam) => {
    if (!id) return
    const round = session?.rounds[session.rounds.length - 1]
    if (!round || round.status !== 'voting') return
    if (myTeam === team) return // no change

    const voterId = getOrCreateVoterId(id)
    setMyTeam(team)
    saveLocalVote(id, round.id, team)
    socketRef.current.emit('vote', { sessionId: id, team, voterId })
  }, [id, myTeam, session])

  const cancelVote = useCallback(() => {
    sendVote(null)
  }, [sendVote])

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

  if (session.locked && !hasAccessRef.current) {
    return (
      <div className="min-h-screen spotlight-bg flex flex-col items-center justify-center gap-4 p-6 text-center">
        <div style={{ fontSize: '3rem' }}>🔒</div>
        <h2 className="text-xl font-black">Accès fermé</h2>
        <p style={{ color: 'var(--muted)', maxWidth: 260 }}>
          L'organisateur a temporairement fermé l'accès au vote. Revenez dans un moment.
        </p>
      </div>
    )
  }

  const currentRound = session.rounds[session.rounds.length - 1] as Round | undefined
  const isVoting = currentRound?.status === 'voting'
  const remainingMs = isVoting ? Math.max(0, currentRound.endTime - now) : 0
  const remainingSec = Math.ceil(remainingMs / 1000)
  const progress = isVoting ? Math.min(1, remainingMs / (currentRound.duration * 1000)) : 0

  const total = currentRound ? currentRound.votesA + currentRound.votesB + currentRound.votesNeutral : 0
  const pctA = total > 0 ? Math.round((currentRound!.votesA / total) * 100) : 0
  const pctB = total > 0 ? Math.round((currentRound!.votesB / total) * 100) : 0
  const pctN = total > 0 ? Math.round((currentRound!.votesNeutral / total) * 100) : 0

  const roundWinnerA = currentRound?.status === 'closed' && currentRound.votesA > currentRound.votesB
  const roundWinnerB = currentRound?.status === 'closed' && currentRound.votesB > currentRound.votesA

  return (
    <div className="min-h-screen spotlight-bg flex flex-col"
      style={{ maxWidth: 480, margin: '0 auto', '--team-a': session.colorA, '--team-b': session.colorB } as React.CSSProperties}>
      {/* Header */}
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

      <div className="flex-1 flex flex-col px-4 pb-8 gap-4">

        {/* Score */}
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

        {/* Status */}
        <div className="flex justify-center">
          {session.status === 'finished' ? (
            <div className="badge-waiting">Match terminé</div>
          ) : isVoting ? (
            <div className="badge-voting"><span className="pulse-dot" />Vote en cours !</div>
          ) : (
            <div className="badge-waiting"><span className="pulse-dot" />En attente du vote...</div>
          )}
        </div>

        {/* Timer */}
        {isVoting && (
          <div className="fade-in">
            <div className="progress-bar-track" style={{ height: 6 }}>
              <div className="progress-bar-fill" style={{
                width: `${progress * 100}%`,
                background: remainingSec <= 10 ? 'var(--team-b)' : 'var(--gold)',
                transition: 'width 0.2s linear, background 0.3s'
              }} />
            </div>
            <div className="text-center mt-1">
              <span className="font-black" style={{
                fontSize: '2.5rem',
                color: remainingSec <= 10 ? 'var(--team-b)' : 'var(--gold)',
                fontVariantNumeric: 'tabular-nums',
                transition: 'color 0.3s'
              }}>{remainingSec}</span>
              <span className="text-sm ml-1" style={{ color: 'var(--muted)' }}>s</span>
            </div>
          </div>
        )}

        {/* Vote buttons */}
        {isVoting ? (
          <div className="flex flex-col gap-3 fade-in">
            <p className="text-center text-sm font-semibold" style={{ color: 'var(--muted)' }}>
              {myTeam === null ? 'Tapez pour voter !' : 'Vous pouvez changer votre vote'}
            </p>

            {/* Team buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button className={`vote-btn vote-btn-a${myTeam === 'A' ? ' voted' : ''}`} onClick={() => sendVote('A')}>
                <span style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--team-a)', marginBottom: 8, flexShrink: 0, boxShadow: '0 0 12px var(--team-a)' }} />
                <span className="text-center px-2" style={{ fontSize: '1.1rem', lineHeight: 1.2, fontWeight: 800 }}>
                  {session.teamA}
                </span>
              </button>
              <button className={`vote-btn vote-btn-b${myTeam === 'B' ? ' voted' : ''}`} onClick={() => sendVote('B')}>
                <span style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--team-b)', marginBottom: 8, flexShrink: 0, boxShadow: '0 0 12px var(--team-b)' }} />
                <span className="text-center px-2" style={{ fontSize: '1.1rem', lineHeight: 1.2, fontWeight: 800 }}>
                  {session.teamB}
                </span>
              </button>
            </div>

            {/* Neutral button */}
            {currentRound.allowNeutral && (
              <button
                className="vote-btn"
                style={{
                  minHeight: 64,
                  borderRadius: 14,
                  border: `2px solid ${myTeam === 'neutral' ? 'rgba(123,133,160,0.8)' : 'rgba(123,133,160,0.25)'}`,
                  background: myTeam === 'neutral' ? 'rgba(123,133,160,0.15)' : 'rgba(123,133,160,0.06)',
                  color: 'var(--muted)',
                  flexDirection: 'row',
                  gap: 10,
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  boxShadow: myTeam === 'neutral' ? '0 0 20px rgba(123,133,160,0.2)' : 'none'
                }}
                onClick={() => sendVote('neutral')}
              >
                <span>⚪</span>
                <span>Vote neutre</span>
              </button>
            )}

            {/* Cancel vote */}
            {myTeam !== null && (
              <button className="btn btn-ghost w-full text-sm" onClick={cancelVote}>
                ✕ Annuler mon vote
              </button>
            )}

            {/* Confirmation discrète — pas de résultats avant la fin */}
            {myTeam !== null && (
              <p className="text-center text-xs" style={{ color: 'var(--muted)' }}>
                Les résultats seront affichés à la fin du vote.
              </p>
            )}
          </div>

        ) : currentRound?.status === 'closed' ? (
          <div className="flex-1 flex flex-col gap-4 fade-in">
            <div className="text-center">
              <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--muted)' }}>
                Tour {session.rounds.length} — Résultat
              </p>
              {roundWinnerA && <p className="font-black text-lg" style={{ color: 'var(--team-a)' }}>🏆 {session.teamA} remporte ce tour !</p>}
              {roundWinnerB && <p className="font-black text-lg" style={{ color: 'var(--team-b)' }}>🏆 {session.teamB} remporte ce tour !</p>}
              {!roundWinnerA && !roundWinnerB && total > 0 && <p className="font-black text-lg" style={{ color: 'var(--gold)' }}>⚖️ Égalité parfaite !</p>}
            </div>
            <LiveResults session={session} round={currentRound}
              pctA={pctA} pctB={pctB} pctN={pctN} total={total} myTeam={myTeam} showWinner />
          </div>

        ) : session.status === 'finished' ? (
          <MatchOver session={session} />

        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 fade-in">
            <div style={{ fontSize: '4rem' }}>🎭</div>
            <p className="text-lg font-bold text-center">En attente du vote</p>
            <p className="text-sm text-center" style={{ color: 'var(--muted)', maxWidth: 260 }}>
              L'organisateur va lancer une phase de vote. Tenez votre téléphone prêt !
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function LiveResults({ session, round, pctA, pctB, pctN, total, myTeam, showWinner = false }: {
  session: Session
  round: Round
  pctA: number; pctB: number; pctN: number; total: number
  myTeam: VoteTeam
  showWinner?: boolean
}) {
  const winnerA = showWinner && round.votesA > round.votesB
  const winnerB = showWinner && round.votesB > round.votesA

  return (
    <div className="card p-4 flex flex-col gap-3">
      <ResultBar label={session.teamA} votes={round.votesA} pct={pctA} color="var(--team-a)"
        isMyVote={myTeam === 'A'} isWinner={winnerA} />
      <ResultBar label={session.teamB} votes={round.votesB} pct={pctB} color="var(--team-b)"
        isMyVote={myTeam === 'B'} isWinner={winnerB} />
      {round.allowNeutral && (
        <ResultBar label="Neutre" votes={round.votesNeutral} pct={pctN} color="var(--muted)"
          isMyVote={myTeam === 'neutral'} isWinner={false} />
      )}
      <p className="text-xs text-center" style={{ color: 'var(--muted)' }}>
        {total} vote{total !== 1 ? 's' : ''} au total
      </p>
    </div>
  )
}

function ResultBar({ label, votes, pct, color, isMyVote, isWinner }: {
  label: string; votes: number; pct: number; color: string
  isMyVote: boolean; isWinner: boolean
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between items-center text-sm">
        <div className="flex items-center gap-2">
          <span style={{ color, fontWeight: 700 }}>{label}</span>
          {isMyVote && <span className="text-xs" style={{ color, opacity: 0.7 }}>← votre vote</span>}
          {isWinner && <span>🏆</span>}
        </div>
        <span style={{ color, fontWeight: 800, fontSize: '1.05rem' }}>{pct}%</span>
      </div>
      <div className="progress-bar-track">
        <div className="progress-bar-fill" style={{
          width: `${pct}%`, background: color,
          boxShadow: isMyVote ? `0 0 8px ${color}` : 'none'
        }} />
      </div>
      <p className="text-xs" style={{ color: 'var(--muted)' }}>{votes} vote{votes !== 1 ? 's' : ''}</p>
    </div>
  )
}

function MatchOver({ session }: { session: Session }) {
  const scoreA = session.scoreA ?? 0
  const scoreB = session.scoreB ?? 0
  const teamWon = scoreA > scoreB ? session.teamA : scoreB > scoreA ? session.teamB : null
  const winColor = scoreA > scoreB ? 'var(--team-a)' : scoreB > scoreA ? 'var(--team-b)' : 'var(--gold)'

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-5 fade-in text-center">
      <div style={{ fontSize: '4rem' }}>🎭</div>
      <div>
        <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--muted)' }}>Match terminé</p>
        {teamWon
          ? <p className="font-black text-2xl" style={{ color: winColor }}>🏆 {teamWon} gagne !</p>
          : <p className="font-black text-2xl" style={{ color: 'var(--gold)' }}>⚖️ Égalité !</p>
        }
        <p className="text-sm mt-2" style={{ color: 'var(--muted)' }}>Score final : {scoreA} – {scoreB}</p>
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
