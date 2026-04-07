import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { getSocket } from '../lib/socket'
import type { Session, Round } from '../lib/types'

const DURATION_PRESETS = [30, 60, 90, 120]

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
  const [duration, setDuration] = useState(60)
  const [customDuration, setCustomDuration] = useState('')
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
    fetch(`/api/sessions/${id}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(setSession)
      .catch(() => setError('Session introuvable ou expirée.'))
  }, [id])

  const startRound = useCallback(() => {
    const d = customDuration ? Number(customDuration) : duration
    if (!d || d < 5) return
    socketRef.current.emit('startRound', { sessionId: id, duration: d, token, allowNeutral })
  }, [id, token, duration, customDuration, allowNeutral])

  const endRound = useCallback(() => {
    socketRef.current.emit('endRound', { sessionId: id, token })
  }, [id, token])

  const cancelRound = useCallback(() => {
    socketRef.current.emit('cancelRound', { sessionId: id, token })
  }, [id, token])

  const endSession = useCallback(() => {
    if (!confirm('Terminer le match définitivement ?')) return
    socketRef.current.emit('endSession', { sessionId: id, token })
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

  const activeDuration = customDuration ? Number(customDuration) : duration
  const closedRounds = session.rounds.filter(r => r.status === 'closed')

  return (
    <div className="min-h-screen spotlight-bg p-4 pb-8" style={{ maxWidth: 900, margin: '0 auto' }}>
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
            <button className="btn btn-danger text-sm" onClick={endSession}>Terminer le match</button>
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
          <span className="text-xs ml-auto" style={{ color: 'var(--muted)' }}>{closedRounds.length} tour{closedRounds.length > 1 ? 's' : ''} joué{closedRounds.length > 1 ? 's' : ''}</span>
        </div>
      )}

      {session.status === 'finished' && (
        <div className="mb-3 text-sm text-center rounded-xl p-3 font-semibold"
          style={{ background: 'rgba(247,201,79,0.1)', color: 'var(--gold)', border: '1px solid rgba(247,201,79,0.2)' }}>
          Match terminé
        </div>
      )}

      {/* Main grid */}
      <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>

        {/* QR Code */}
        <div className="card p-5 flex flex-col gap-3">
          <h2 className="font-bold text-xs uppercase tracking-widest" style={{ color: 'var(--muted)' }}>QR Code public</h2>
          <div className="flex items-center justify-center rounded-xl p-3" style={{ background: '#fff' }}>
            <QRCodeSVG value={voteUrl} size={180} level="M" />
          </div>
          <div className="text-xs text-center rounded-lg px-3 py-2 truncate"
            style={{ background: 'var(--surface-2)', color: 'var(--muted)', border: '1px solid var(--border)' }}>
            {voteUrl}
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
                <label className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>Durée</label>
                <div className="grid grid-cols-4 gap-2">
                  {DURATION_PRESETS.map(d => (
                    <button key={d} className="btn text-sm"
                      style={{
                        padding: '8px 4px',
                        background: !customDuration && duration === d ? 'var(--team-a)' : 'var(--surface-2)',
                        color: !customDuration && duration === d ? '#fff' : 'var(--muted)',
                        border: '1px solid var(--border)', borderRadius: 8
                      }}
                      onClick={() => { setDuration(d); setCustomDuration('') }}>
                      {d}s
                    </button>
                  ))}
                </div>
                <input className="input text-sm" style={{ padding: '8px 12px' }}
                  placeholder="Durée personnalisée (s)" type="number" min={5} max={600}
                  value={customDuration} onChange={e => setCustomDuration(e.target.value)} />
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
                onClick={startRound} disabled={session.status === 'finished' || activeDuration < 5}>
                ▶ Lancer le vote ({activeDuration}s)
              </button>
            </>
          ) : (
            <>
              {/* Active vote */}
              <div className="flex items-center justify-between">
                <div className="badge-voting"><span className="pulse-dot" />Vote en cours</div>
                <div className="font-black" style={{
                  fontSize: '2.5rem', lineHeight: 1,
                  color: remainingSec <= 10 ? 'var(--team-b)' : 'var(--gold)',
                  fontVariantNumeric: 'tabular-nums'
                }}>{remainingSec}<span className="text-sm font-normal ml-1" style={{ color: 'var(--muted)' }}>s</span></div>
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
                <button className="btn btn-danger flex-1" onClick={endRound}>⏹ Stopper</button>
                <button className="btn btn-ghost flex-1 text-sm" onClick={cancelRound}
                  title="Annuler ce tour et l'effacer de l'historique">
                  🗑 Annuler
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Round history — compact */}
      {session.rounds.length > 0 && (
        <div className="card p-4 fade-in">
          <h2 className="font-bold text-xs uppercase tracking-widest mb-3" style={{ color: 'var(--muted)' }}>
            Historique
          </h2>
          <div className="flex flex-col gap-1">
            {[...session.rounds].reverse().map((round, i) => {
              const idx = session.rounds.length - i
              const total = round.votesA + round.votesB + round.votesNeutral
              const rPctA = total > 0 ? Math.round((round.votesA / total) * 100) : 0
              const rPctB = total > 0 ? Math.round((round.votesB / total) * 100) : 0
              const rPctN = total > 0 ? Math.round((round.votesNeutral / total) * 100) : 0
              const winA = round.votesA > round.votesB
              const winB = round.votesB > round.votesA

              return (
                <div key={round.id} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm flex-wrap"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                  <span className="font-bold text-xs w-12 shrink-0" style={{ color: 'var(--muted)' }}>Tour {idx}</span>
                  <span className="text-xs shrink-0" style={{ color: 'var(--muted)' }}>{round.duration}s · {total}v</span>
                  <div className="flex-1 flex items-center gap-2 min-w-0">
                    <span style={{ color: 'var(--team-a)', fontWeight: winA ? 800 : 400 }}>
                      {winA ? '🏆 ' : ''}{rPctA}%
                    </span>
                    <div className="flex-1 flex gap-0.5 h-2 rounded overflow-hidden" style={{ background: 'var(--bg)' }}>
                      <div style={{ width: `${rPctA}%`, background: 'var(--team-a)', transition: 'width 0.4s' }} />
                      {round.allowNeutral && <div style={{ width: `${rPctN}%`, background: 'var(--muted)', transition: 'width 0.4s' }} />}
                      <div style={{ width: `${rPctB}%`, background: 'var(--team-b)', transition: 'width 0.4s' }} />
                    </div>
                    <span style={{ color: 'var(--team-b)', fontWeight: winB ? 800 : 400 }}>
                      {rPctB}%{winB ? ' 🏆' : ''}
                    </span>
                  </div>
                  {round.status === 'voting' && (
                    <span className="badge-voting text-xs" style={{ padding: '2px 8px' }}>
                      <span className="pulse-dot" style={{ width: 6, height: 6 }} /> En cours
                    </span>
                  )}
                </div>
              )
            })}
          </div>
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
