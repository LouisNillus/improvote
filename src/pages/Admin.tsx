import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { getSocket } from '../lib/socket'
import type { Session, Round } from '../lib/types'

const DURATION_PRESETS = [30, 60, 90, 120]

export default function Admin() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token') || ''

  const [session, setSession] = useState<Session | null>(null)
  const [error, setError] = useState('')
  const [duration, setDuration] = useState(60)
  const [customDuration, setCustomDuration] = useState('')
  const [copied, setCopied] = useState(false)
  const [now, setNow] = useState(Date.now())
  const socketRef = useRef(getSocket())

  const voteUrl = `${window.location.origin}/vote/${id}`
  const adminUrl = `${window.location.origin}/admin/${id}?token=${token}`

  // Tick every second for countdown
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(interval)
  }, [])

  // Socket setup
  useEffect(() => {
    const socket = socketRef.current
    if (!id) return

    socket.emit('subscribe', { sessionId: id })

    socket.on('sessionUpdate', (data: Session) => {
      setSession(data)
    })

    socket.on('error', (data: { message: string }) => {
      setError(data.message)
    })

    return () => {
      socket.off('sessionUpdate')
      socket.off('error')
    }
  }, [id])

  // Load session on mount (fallback for page reload)
  useEffect(() => {
    if (!id) return
    fetch(`/api/sessions/${id}`)
      .then(r => r.ok ? r.json() : Promise.reject('Session introuvable'))
      .then(setSession)
      .catch(() => setError('Session introuvable ou expirée.'))
  }, [id])

  const startRound = useCallback(() => {
    const finalDuration = customDuration ? Number(customDuration) : duration
    if (!finalDuration || finalDuration < 5) return
    socketRef.current.emit('startRound', { sessionId: id, duration: finalDuration, token })
  }, [id, token, duration, customDuration])

  const endRound = useCallback(() => {
    socketRef.current.emit('endRound', { sessionId: id, token })
  }, [id, token])

  const endSession = useCallback(() => {
    if (!confirm('Terminer le match définitivement ?')) return
    socketRef.current.emit('endSession', { sessionId: id, token })
  }, [id, token])

  const copyLink = useCallback(() => {
    navigator.clipboard.writeText(voteUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [voteUrl])

  const copyAdminLink = useCallback(() => {
    navigator.clipboard.writeText(adminUrl).then(() => {
      alert('Lien admin copié ! Sauvegardez-le pour pouvoir revenir gérer ce match.')
    })
  }, [adminUrl])

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
        <div style={{ color: 'var(--muted)' }}>Chargement...</div>
      </div>
    )
  }

  const currentRound = session.rounds[session.rounds.length - 1] as Round | undefined
  const isVoting = currentRound?.status === 'voting'
  const remainingMs = isVoting ? Math.max(0, currentRound.endTime - now) : 0
  const remainingSec = Math.ceil(remainingMs / 1000)

  const totalVotesActive = isVoting ? currentRound.votesA + currentRound.votesB : 0
  const pctA = totalVotesActive > 0 ? Math.round((currentRound!.votesA / totalVotesActive) * 100) : 50
  const pctB = totalVotesActive > 0 ? Math.round((currentRound!.votesB / totalVotesActive) * 100) : 50

  const activeDuration = customDuration ? Number(customDuration) : duration

  return (
    <div className="min-h-screen spotlight-bg p-4 pb-8" style={{ maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div className="fade-in pt-4 pb-6 flex flex-col gap-1">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
              Panneau Admin
            </p>
            <h1 className="text-2xl font-black tracking-tight mt-1" style={{ letterSpacing: '-0.02em' }}>
              <span style={{ color: 'var(--team-a)' }}>{session.teamA}</span>
              {' '}
              <span style={{ color: 'var(--muted)', fontWeight: 400, fontSize: '1rem' }}>vs</span>
              {' '}
              <span style={{ color: 'var(--team-b)' }}>{session.teamB}</span>
            </h1>
          </div>
          <div className="flex gap-2 flex-wrap">
            {session.status === 'active' && (
              <button className="btn btn-danger text-sm" onClick={endSession}>
                Terminer le match
              </button>
            )}
            <button className="btn btn-ghost text-xs" onClick={copyAdminLink}>
              🔑 Lien admin
            </button>
          </div>
        </div>

        {session.status === 'finished' && (
          <div
            className="mt-3 text-sm text-center rounded-xl p-3 font-semibold"
            style={{ background: 'rgba(247,201,79,0.1)', color: 'var(--gold)', border: '1px solid rgba(247,201,79,0.2)' }}
          >
            Match terminé
          </div>
        )}
      </div>

      {/* Main grid */}
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>

        {/* QR Code card */}
        <div className="card p-5 flex flex-col gap-4">
          <h2 className="font-bold text-sm uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
            QR Code public
          </h2>
          <div
            className="flex items-center justify-center rounded-xl p-4"
            style={{ background: '#fff', aspectRatio: '1/1' }}
          >
            <QRCodeSVG value={voteUrl} size={200} level="M" />
          </div>
          <div
            className="text-xs text-center rounded-lg px-3 py-2 truncate"
            style={{ background: 'var(--surface-2)', color: 'var(--muted)', border: '1px solid var(--border)' }}
          >
            {voteUrl}
          </div>
          <button className="btn btn-ghost w-full" onClick={copyLink}>
            {copied ? '✅ Copié !' : '📋 Copier le lien de vote'}
          </button>
        </div>

        {/* Round control card */}
        <div className="card p-5 flex flex-col gap-4">
          <h2 className="font-bold text-sm uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
            Contrôle du vote
          </h2>

          {!isVoting ? (
            <>
              {/* Duration selector */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>
                  Durée du vote
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {DURATION_PRESETS.map(d => (
                    <button
                      key={d}
                      className="btn text-sm"
                      style={{
                        padding: '8px 4px',
                        background: !customDuration && duration === d ? 'var(--team-a)' : 'var(--surface-2)',
                        color: !customDuration && duration === d ? '#fff' : 'var(--muted)',
                        border: '1px solid var(--border)',
                        borderRadius: 8
                      }}
                      onClick={() => { setDuration(d); setCustomDuration('') }}
                    >
                      {d}s
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    className="input text-sm"
                    style={{ padding: '8px 12px' }}
                    placeholder="Durée personnalisée (s)"
                    type="number"
                    min={5}
                    max={600}
                    value={customDuration}
                    onChange={e => setCustomDuration(e.target.value)}
                  />
                  {customDuration && (
                    <span className="text-xs" style={{ color: 'var(--team-a)', whiteSpace: 'nowrap' }}>
                      = {customDuration}s
                    </span>
                  )}
                </div>
              </div>

              <button
                className="btn btn-success w-full"
                style={{ padding: '14px', fontSize: '1rem' }}
                onClick={startRound}
                disabled={session.status === 'finished' || activeDuration < 5}
              >
                ▶ Lancer le vote ({activeDuration}s)
              </button>

              {currentRound && currentRound.status === 'closed' && (
                <p className="text-xs text-center" style={{ color: 'var(--muted)' }}>
                  Tour précédent terminé — vous pouvez en lancer un nouveau
                </p>
              )}
            </>
          ) : (
            <>
              {/* Active vote */}
              <div className="flex flex-col items-center gap-2">
                <div className="badge-voting">
                  <span className="pulse-dot" />
                  Vote en cours
                </div>
                <div
                  className="font-black"
                  style={{
                    fontSize: '4rem',
                    lineHeight: 1,
                    color: remainingSec <= 10 ? 'var(--team-b)' : 'var(--gold)',
                    fontVariantNumeric: 'tabular-nums',
                    transition: 'color 0.3s'
                  }}
                >
                  {remainingSec}
                </div>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>secondes restantes</p>
              </div>

              {/* Live counts */}
              <div className="flex flex-col gap-3 mt-1">
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-sm">
                    <span style={{ color: 'var(--team-a)', fontWeight: 600 }}>{session.teamA}</span>
                    <span style={{ color: 'var(--team-a)', fontWeight: 700 }}>{currentRound.votesA} <span style={{ color: 'var(--muted)', fontWeight: 400 }}>({pctA}%)</span></span>
                  </div>
                  <div className="progress-bar-track">
                    <div className="progress-bar-fill" style={{ width: `${pctA}%`, background: 'var(--team-a)' }} />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-sm">
                    <span style={{ color: 'var(--team-b)', fontWeight: 600 }}>{session.teamB}</span>
                    <span style={{ color: 'var(--team-b)', fontWeight: 700 }}>{currentRound.votesB} <span style={{ color: 'var(--muted)', fontWeight: 400 }}>({pctB}%)</span></span>
                  </div>
                  <div className="progress-bar-track">
                    <div className="progress-bar-fill" style={{ width: `${pctB}%`, background: 'var(--team-b)' }} />
                  </div>
                </div>

                <p className="text-xs text-center" style={{ color: 'var(--muted)' }}>
                  {totalVotesActive} vote{totalVotesActive !== 1 ? 's' : ''} reçu{totalVotesActive !== 1 ? 's' : ''}
                </p>
              </div>

              <button className="btn btn-danger w-full" onClick={endRound}>
                ⏹ Stopper le vote maintenant
              </button>
            </>
          )}
        </div>
      </div>

      {/* Rounds history */}
      {session.rounds.length > 0 && (
        <div className="card p-5 mt-4 fade-in">
          <h2 className="font-bold text-sm uppercase tracking-widest mb-4" style={{ color: 'var(--muted)' }}>
            Historique des tours
          </h2>
          <div className="flex flex-col gap-3">
            {[...session.rounds].reverse().map((round, i) => {
              const idx = session.rounds.length - i
              const total = round.votesA + round.votesB
              const rPctA = total > 0 ? Math.round((round.votesA / total) * 100) : 50
              const rPctB = total > 0 ? Math.round((round.votesB / total) * 100) : 50
              const winnerA = round.votesA > round.votesB
              const winnerB = round.votesB > round.votesA
              const tie = round.votesA === round.votesB && total > 0

              return (
                <div key={round.id} className="card-sm p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold" style={{ color: 'var(--muted)' }}>
                      Tour {idx}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--muted)' }}>
                      {round.duration}s · {total} vote{total !== 1 ? 's' : ''}
                    </span>
                    {round.status === 'voting' && (
                      <span className="badge-voting text-xs" style={{ padding: '2px 8px' }}>
                        <span className="pulse-dot" style={{ width: 6, height: 6 }} /> En cours
                      </span>
                    )}
                    {tie && <span style={{ color: 'var(--gold)', fontSize: '0.75rem', fontWeight: 700 }}>ÉGALITÉ</span>}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div
                      className="rounded-lg p-2 text-center"
                      style={{
                        background: winnerA ? 'rgba(79,142,247,0.12)' : 'var(--bg)',
                        border: `1px solid ${winnerA ? 'rgba(79,142,247,0.4)' : 'var(--border)'}`,
                        color: 'var(--team-a)'
                      }}
                    >
                      <div className="font-black text-xl">{rPctA}%</div>
                      <div className="text-xs" style={{ color: 'var(--muted)' }}>{round.votesA} vote{round.votesA !== 1 ? 's' : ''}</div>
                      {winnerA && <div className="text-xs mt-1">🏆</div>}
                    </div>
                    <div
                      className="rounded-lg p-2 text-center"
                      style={{
                        background: winnerB ? 'rgba(247,79,106,0.12)' : 'var(--bg)',
                        border: `1px solid ${winnerB ? 'rgba(247,79,106,0.4)' : 'var(--border)'}`,
                        color: 'var(--team-b)'
                      }}
                    >
                      <div className="font-black text-xl">{rPctB}%</div>
                      <div className="text-xs" style={{ color: 'var(--muted)' }}>{round.votesB} vote{round.votesB !== 1 ? 's' : ''}</div>
                      {winnerB && <div className="text-xs mt-1">🏆</div>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Score tally */}
      {session.rounds.filter(r => r.status === 'closed').length > 0 && (
        <ScoreTally session={session} />
      )}
    </div>
  )
}

function ScoreTally({ session }: { session: Session }) {
  const closed = session.rounds.filter(r => r.status === 'closed')
  const scoreA = session.scoreA ?? 0
  const scoreB = session.scoreB ?? 0

  return (
    <div className="card p-5 mt-4 fade-in">
      <h2 className="font-bold text-sm uppercase tracking-widest mb-4" style={{ color: 'var(--muted)' }}>
        Score général ({closed.length} tour{closed.length > 1 ? 's' : ''})
      </h2>
      <div className="grid grid-cols-2 gap-4">
        <div
          className="rounded-xl p-4 text-center"
          style={{
            background: scoreA > scoreB ? 'rgba(79,142,247,0.1)' : 'var(--surface-2)',
            border: `2px solid ${scoreA > scoreB ? 'var(--team-a)' : 'var(--border)'}`,
          }}
        >
          <div className="font-black" style={{ fontSize: '3rem', color: 'var(--team-a)' }}>{scoreA}</div>
          <div className="text-sm font-semibold" style={{ color: 'var(--team-a)' }}>{session.teamA}</div>
          {scoreA > scoreB && <div className="text-xs mt-1" style={{ color: 'var(--gold)' }}>🏆 En tête</div>}
        </div>
        <div
          className="rounded-xl p-4 text-center"
          style={{
            background: scoreB > scoreA ? 'rgba(247,79,106,0.1)' : 'var(--surface-2)',
            border: `2px solid ${scoreB > scoreA ? 'var(--team-b)' : 'var(--border)'}`,
          }}
        >
          <div className="font-black" style={{ fontSize: '3rem', color: 'var(--team-b)' }}>{scoreB}</div>
          <div className="text-sm font-semibold" style={{ color: 'var(--team-b)' }}>{session.teamB}</div>
          {scoreB > scoreA && <div className="text-xs mt-1" style={{ color: 'var(--gold)' }}>🏆 En tête</div>}
        </div>
      </div>
    </div>
  )
}
