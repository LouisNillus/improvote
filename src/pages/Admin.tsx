import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { getSocket } from '../lib/socket'
import { apiFetch } from '../lib/api'
import type { Session, Round, SimulationConfig } from '../lib/types'
import SimulationPanel from '../components/SimulationPanel'
import MatchStats from '../components/MatchStats'

function formatExpiry(lastActivity: number, now: number): string {
  const ms = (lastActivity + 2 * 60 * 60 * 1000) - now
  if (ms <= 0) return 'bientôt'
  const h = Math.floor(ms / 3600000)
  const m = Math.ceil((ms % 3600000) / 60000)
  if (h > 0) return `${h}h${m > 0 ? String(m).padStart(2, '0') : ''}`
  return `${m} min`
}

function copyText(text: string) {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text)
  }
  // Fallback for HTTP
  const el = document.createElement('textarea')
  el.value = text
  el.setAttribute('readonly', '')
  el.style.cssText = 'position:fixed;top:-9999px;left:-9999px'
  document.body.appendChild(el)
  el.select()
  document.execCommand('copy')
  document.body.removeChild(el)
  return Promise.resolve()
}

export default function Admin() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''

  const [session, setSession] = useState<Session | null>(null)
  const [error, setError] = useState('')
  const [duration, setDuration] = useState(30)
  const [allowNeutral, setAllowNeutral] = useState(false)
  const [copied, setCopied] = useState(false)
  const [now, setNow] = useState(Date.now())
  const socketRef = useRef(getSocket())

  const voteUrl = `${window.location.origin}/vote/${id}`

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const socket = socketRef.current
    if (!id) return
    socket.emit('subscribe', { sessionId: id })
    socket.on('sessionUpdate', (data: Session) => setSession(data))
    socket.on('error', (data: { message: string }) => setError(data.message))
    return () => { socket.off('sessionUpdate'); socket.off('error') }
  }, [id])

  useEffect(() => {
    if (!id) return
    apiFetch(`/api/sessions/${id}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(setSession)
      .catch(() => setError('Session introuvable ou expirée.'))
  }, [id])

  const startRound = useCallback(() => {
    socketRef.current.emit('startRound', { sessionId: id, duration, token, allowNeutral })
  }, [id, token, duration, allowNeutral])

  const endRound = useCallback(() => {
    socketRef.current.emit('endRound', { sessionId: id, token })
  }, [id, token])

  const cancelRound = useCallback(() => {
    socketRef.current.emit('cancelRound', { sessionId: id, token })
  }, [id, token])

  const toggleLock = useCallback(() => {
    socketRef.current.emit('toggleLock', { sessionId: id, token })
  }, [id, token])

  const endSession = useCallback(() => {
    if (!confirm('Terminer le match définitivement ?')) return
    socketRef.current.emit('endSession', { sessionId: id, token })
  }, [id, token])

  const runSimulation = useCallback((config: SimulationConfig) => {
    socketRef.current.emit('runSimulation', { sessionId: id, token, voterCount: config.voterCount, values: config.values })
  }, [id, token])

const copyLink = useCallback(() => {
    copyText(voteUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [voteUrl])

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

  const totalVotesActive = isVoting ? currentRound.votesA + currentRound.votesB + currentRound.votesNeutral : 0
  const pctA = totalVotesActive > 0 ? Math.round((currentRound!.votesA / totalVotesActive) * 100) : 0
  const pctB = totalVotesActive > 0 ? Math.round((currentRound!.votesB / totalVotesActive) * 100) : 0
  const pctN = totalVotesActive > 0 ? Math.round((currentRound!.votesNeutral / totalVotesActive) * 100) : 0

  const closedRounds = session.rounds.filter(r => r.status === 'closed')

  return (
    <div className="min-h-screen spotlight-bg p-4 pb-8"
      style={{ maxWidth: 900, margin: '0 auto', '--team-a': session.colorA, '--team-b': session.colorB } as React.CSSProperties}>
      {/* Header */}
      <div className="fade-in pt-4 pb-3 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>Panneau Admin</p>
          <h1 className="text-2xl font-black tracking-tight mt-0.5" style={{ letterSpacing: '-0.02em' }}>
            <span style={{ color: 'var(--team-a)' }}>{session.teamA}</span>
            {' '}<span style={{ color: 'var(--muted)', fontWeight: 400, fontSize: '1rem' }}>vs</span>{' '}
            <span style={{ color: 'var(--team-b)' }}>{session.teamB}</span>
          </h1>
        </div>
        <div className="flex gap-2 flex-wrap">
          {session.status === 'active' && (
            <button className="btn text-sm" onClick={toggleLock} style={{
              background: session.locked ? 'rgba(247,201,79,0.12)' : 'var(--surface-2)',
              border: `1px solid ${session.locked ? 'rgba(247,201,79,0.4)' : 'var(--border)'}`,
              color: session.locked ? 'var(--gold)' : 'var(--muted)'
            }}>
              {session.locked ? '🔒 Accès fermé' : '🔓 Accès ouvert'}
            </button>
          )}
          {session.status === 'active' && (
            <button className="btn text-sm" onClick={endSession} style={{
              background: 'rgba(247,79,106,0.15)',
              border: '1px solid rgba(247,79,106,0.4)',
              color: '#f74f6a'
            }}>Terminer</button>
          )}
          {session.status === 'finished' && (
            <a href="/" className="btn btn-success text-sm">↺ Nouveau match</a>
          )}
        </div>
      </div>

      {/* Score strip — toujours visible dès le 1er tour terminé */}
      {closedRounds.length > 0 && (
        <div className="card-sm px-4 py-2 mb-3 flex items-center gap-3 fade-in">
          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Score</span>
          <span className="font-black text-lg" style={{ color: 'var(--team-a)' }}>{session.scoreA}</span>
          <span style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>–</span>
          <span className="font-black text-lg" style={{ color: 'var(--team-b)' }}>{session.scoreB}</span>
          <span className="text-xs ml-auto" style={{ color: 'var(--muted)' }}>{closedRounds.length} manche{closedRounds.length > 1 ? 's' : ''} jouée{closedRounds.length > 1 ? 's' : ''}</span>
        </div>
      )}

      {session.status === 'finished' && (
        <div className="mb-3 text-sm text-center rounded-xl p-3 font-semibold flex items-center justify-center gap-3"
          style={{ background: 'rgba(247,201,79,0.1)', color: 'var(--gold)', border: '1px solid rgba(247,201,79,0.2)' }}>
          Match terminé
          {session.lastActivity && (
            <span className="font-normal text-xs" style={{ color: 'var(--muted)' }}>
              · Session supprimée dans {formatExpiry(session.lastActivity, now)}
            </span>
          )}
        </div>
      )}

      {/* Main grid */}
      <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>

        {/* QR Code */}
        <div className="card p-5 flex flex-col gap-3">
          <h2 className="font-bold text-xs uppercase tracking-widest" style={{ color: 'var(--muted)' }}>QR Code public</h2>
          <a href={voteUrl} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center rounded-xl p-3" style={{ background: '#fff', display: 'flex', cursor: 'pointer' }}>
            <QRCodeSVG value={voteUrl} size={180} level="M" />
          </a>
          {/* Code d'accès */}
          <div className="flex flex-col items-center gap-1 rounded-xl py-3 px-4"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>Code d'accès</span>
            <span className="font-black tracking-widest" style={{ fontSize: '2rem', color: 'var(--gold)', letterSpacing: '0.2em' }}>
              {session.code}
            </span>
            <span className="text-xs" style={{ color: 'var(--muted)' }}>à saisir sur l'app</span>
          </div>

          <button className="btn btn-ghost w-full text-sm" onClick={copyLink}>
            {copied ? '✅ Copié !' : '📋 Copier le lien de vote'}
          </button>
        </div>

        {/* Round control */}
        <div className="card p-5 flex flex-col gap-4">
          <h2 className="font-bold text-xs uppercase tracking-widest" style={{ color: 'var(--muted)' }}>Contrôle du vote</h2>

          {!isVoting ? (
            <>
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>Durée</label>
                  <span className="font-black text-lg" style={{ color: 'var(--gold)', fontVariantNumeric: 'tabular-nums' }}>{duration}s</span>
                </div>
                <input type="range" min={5} max={60} step={1} value={duration}
                  onChange={e => setDuration(Number(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--gold)', cursor: 'pointer' }} />
                <div className="flex justify-between text-xs" style={{ color: 'var(--muted)' }}>
                  <span>5s</span><span>60s</span>
                </div>
              </div>

              {/* Neutral toggle */}
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <div
                  onClick={() => setAllowNeutral(v => !v)}
                  className="relative"
                  style={{ width: 40, height: 22, borderRadius: 11, background: allowNeutral ? '#6b7280' : 'var(--surface-2)', border: '1px solid var(--border)', transition: 'background 0.2s', cursor: 'pointer', flexShrink: 0 }}>
                  <div style={{
                    position: 'absolute', top: 2, left: allowNeutral ? 20 : 2,
                    width: 16, height: 16, borderRadius: '50%', background: allowNeutral ? '#d1d5db' : 'var(--muted)',
                    transition: 'left 0.2s'
                  }} />
                </div>
                <span className="text-sm" style={{ color: allowNeutral ? 'var(--text)' : 'var(--muted)' }}>
                  Autoriser le vote neutre
                </span>
              </label>

              <button className="btn btn-success w-full" style={{ padding: '14px', fontSize: '1rem' }}
                onClick={startRound} disabled={session.status === 'finished'}>
                ▶ Lancer le vote ({duration}s)
              </button>
            </>
          ) : (
            <>
              {/* Active vote */}
              <div className="flex items-center justify-between">
                <div className="badge-voting"><span className="pulse-dot" />Vote en cours</div>
                <div className="font-black" style={{
                  fontSize: '2.5rem', lineHeight: 1,
                  color: 'var(--gold)',
                  fontVariantNumeric: 'tabular-nums'
                }}>{remainingSec}<span style={{ fontSize: '2.5rem', fontWeight: 900 }}>s</span></div>
              </div>

              {/* Live counts */}
              <div className="flex flex-col gap-2">
                <VoteBar label={session.teamA} votes={currentRound.votesA} pct={pctA} color="var(--team-a)" />
                <VoteBar label={session.teamB} votes={currentRound.votesB} pct={pctB} color="var(--team-b)" />
                {currentRound.allowNeutral && (
                  <VoteBar label="Neutre" votes={currentRound.votesNeutral} pct={pctN} color="var(--muted)" />
                )}
                <p className="text-xs text-center" style={{ color: 'var(--muted)' }}>
                  {totalVotesActive} vote{totalVotesActive !== 1 ? 's' : ''} reçu{totalVotesActive !== 1 ? 's' : ''}
                </p>
              </div>

              <div className="flex gap-2">
                <button className="btn flex-1" onClick={endRound} style={{
                  background: 'rgba(247,79,106,0.15)',
                  border: '1px solid rgba(247,79,106,0.4)',
                  color: '#f74f6a'
                }}>⏹ Stopper</button>
                <button className="btn btn-ghost flex-1 text-sm" onClick={cancelRound}
                  title="Annuler cette manche et l'effacer de l'historique">
                  🗑 Annuler
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Simulation panel */}
      {session.status === 'active' && (
        <SimulationPanel
          onRun={runSimulation}
          hasRounds={session.rounds.length > 0}
          colorA={session.colorA}
          colorB={session.colorB}
          teamA={session.teamA}
          teamB={session.teamB}
        />
      )}

      {/* Stats */}
      {session.rounds.filter(r => r.status === 'closed').length > 0 && (
        <div className="mb-4">
          <MatchStats session={session} />
        </div>
      )}

    </div>
  )
}

function VoteBar({ label, votes, pct, color }: { label: string; votes: number; pct: number; color: string }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-sm">
        <span style={{ color, fontWeight: 600 }}>{label}</span>
        <span style={{ color, fontWeight: 700 }}>{votes} <span style={{ color: 'var(--muted)', fontWeight: 400 }}>({pct}%)</span></span>
      </div>
      <div className="progress-bar-track">
        <div className="progress-bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}
