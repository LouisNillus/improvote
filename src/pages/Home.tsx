import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Home() {
  const navigate = useNavigate()
  const [teamA, setTeamA] = useState('')
  const [teamB, setTeamB] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!teamA.trim() || !teamB.trim()) {
      setError('Entrez les deux noms d\'équipes.')
      return
    }
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamA: teamA.trim(), teamB: teamB.trim() })
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Erreur serveur')
      }
      const { session, token } = await res.json()
      navigate(`/admin/${session.id}?token=${token}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen spotlight-bg flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md fade-in">
        {/* Logo */}
        <div className="text-center mb-10">
          <div style={{ fontSize: '3.5rem', lineHeight: 1, marginBottom: 12 }}>🎭</div>
          <h1
            className="font-black tracking-tight"
            style={{ fontSize: '2.8rem', lineHeight: 1, letterSpacing: '-0.03em' }}
          >
            ImproVote
          </h1>
          <p style={{ color: 'var(--muted)', marginTop: 10, fontSize: '1rem' }}>
            Votes en direct pour vos matchs d'improvisation
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="card p-6 flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label
              htmlFor="teamA"
              className="text-sm font-semibold"
              style={{ color: 'var(--team-a)' }}
            >
              Équipe A
            </label>
            <input
              id="teamA"
              className="input"
              placeholder="Nom de l'équipe A"
              value={teamA}
              onChange={e => setTeamA(e.target.value)}
              maxLength={40}
              autoFocus
            />
          </div>

          {/* VS divider */}
          <div className="vs-divider gap-3">
            <span className="flex-1" style={{ borderTop: '1px solid var(--border)' }} />
            VS
            <span className="flex-1" style={{ borderTop: '1px solid var(--border)' }} />
          </div>

          <div className="flex flex-col gap-2">
            <label
              htmlFor="teamB"
              className="text-sm font-semibold"
              style={{ color: 'var(--team-b)' }}
            >
              Équipe B
            </label>
            <input
              id="teamB"
              className="input"
              placeholder="Nom de l'équipe B"
              value={teamB}
              onChange={e => setTeamB(e.target.value)}
              maxLength={40}
            />
          </div>

          {error && (
            <p
              className="text-sm text-center rounded-lg p-3"
              style={{ background: 'rgba(247,79,106,0.1)', color: 'var(--team-b)', border: '1px solid rgba(247,79,106,0.2)' }}
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            className="btn btn-primary w-full"
            style={{ padding: '14px', fontSize: '1.05rem', marginTop: 4 }}
            disabled={loading}
          >
            {loading ? 'Création...' : '🎬 Créer le match'}
          </button>
        </form>

        <p className="text-center mt-6 text-xs" style={{ color: 'var(--muted)' }}>
          Un QR code sera généré pour que le public puisse voter
        </p>
      </div>
    </div>
  )
}
