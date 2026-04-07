import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Home() {
  const navigate = useNavigate()

  const [teamA, setTeamA] = useState('')
  const [teamB, setTeamB] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  const [code, setCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState('')

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    if (!teamA.trim() || !teamB.trim()) { setCreateError('Entrez les deux noms d\'équipes.'); return }
    setCreateError('')
    setCreating(true)
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamA: teamA.trim(), teamB: teamB.trim() })
      })
      if (!res.ok) throw new Error((await res.json()).error)
      const { session, token } = await res.json()
      navigate(`/admin/${session.id}?token=${token}`)
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : 'Erreur inconnue')
      setCreating(false)
    }
  }

  async function handleJoin(e: FormEvent) {
    e.preventDefault()
    const trimmed = code.trim().toUpperCase()
    if (!trimmed) { setJoinError('Entrez un code.'); return }
    setJoinError('')
    setJoining(true)
    try {
      const res = await fetch(`/api/code/${trimmed}`)
      if (!res.ok) throw new Error((await res.json()).error)
      const { sessionId } = await res.json()
      navigate(`/vote/${sessionId}`)
    } catch (err: unknown) {
      setJoinError(err instanceof Error ? err.message : 'Code invalide.')
      setJoining(false)
    }
  }

  return (
    <div className="min-h-screen spotlight-bg flex flex-col items-center justify-center p-6 gap-6">
      <div className="w-full max-w-md fade-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <div style={{ fontSize: '3.5rem', lineHeight: 1, marginBottom: 12 }}>🎭</div>
          <h1 className="font-black tracking-tight" style={{ fontSize: '2.8rem', lineHeight: 1, letterSpacing: '-0.03em' }}>
            ImproVote
          </h1>
          <p style={{ color: 'var(--muted)', marginTop: 10, fontSize: '1rem' }}>
            Votes en direct pour vos matchs d'improvisation
          </p>
        </div>

        {/* Join with code */}
        <form onSubmit={handleJoin} className="card p-5 flex flex-col gap-3 mb-4">
          <h2 className="font-bold text-sm" style={{ color: 'var(--gold)' }}>Rejoindre un match</h2>
          <div className="flex gap-2">
            <input
              className="input flex-1"
              placeholder="Code ex : AB3Z9"
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              maxLength={5}
              autoCapitalize="characters"
              style={{ letterSpacing: '0.15em', fontWeight: 700, fontSize: '1.1rem', textTransform: 'uppercase' }}
            />
            <button type="submit" className="btn btn-primary" style={{ padding: '12px 20px' }} disabled={joining}>
              {joining ? '...' : '→'}
            </button>
          </div>
          {joinError && (
            <p className="text-xs" style={{ color: 'var(--team-b)' }}>{joinError}</p>
          )}
        </form>

        {/* Divider */}
        <div className="vs-divider gap-3 mb-4" style={{ color: 'var(--muted)' }}>
          <span className="flex-1" style={{ borderTop: '1px solid var(--border)' }} />
          <span className="text-xs">ou créer un match</span>
          <span className="flex-1" style={{ borderTop: '1px solid var(--border)' }} />
        </div>

        {/* Create match */}
        <form onSubmit={handleCreate} className="card p-5 flex flex-col gap-4">
          <h2 className="font-bold text-sm" style={{ color: 'var(--muted)' }}>Nouveau match</h2>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold" style={{ color: 'var(--team-a)' }}>Équipe A</label>
            <input className="input" placeholder="Nom de l'équipe A" value={teamA}
              onChange={e => setTeamA(e.target.value)} maxLength={40} />
          </div>

          <div className="vs-divider gap-3">
            <span className="flex-1" style={{ borderTop: '1px solid var(--border)' }} />
            VS
            <span className="flex-1" style={{ borderTop: '1px solid var(--border)' }} />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold" style={{ color: 'var(--team-b)' }}>Équipe B</label>
            <input className="input" placeholder="Nom de l'équipe B" value={teamB}
              onChange={e => setTeamB(e.target.value)} maxLength={40} />
          </div>

          {createError && (
            <p className="text-xs text-center rounded-lg p-2"
              style={{ background: 'rgba(247,79,106,0.1)', color: 'var(--team-b)', border: '1px solid rgba(247,79,106,0.2)' }}>
              {createError}
            </p>
          )}

          <button type="submit" className="btn btn-primary w-full" style={{ padding: '13px', fontSize: '1rem' }} disabled={creating}>
            {creating ? 'Création...' : '🎬 Créer le match'}
          </button>
        </form>
      </div>
    </div>
  )
}
