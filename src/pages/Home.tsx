import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'

const PALETTE = [
  '#4f8ef7', '#38bdf8', '#818cf8', '#a855f7',
  '#e879f9', '#f472b6', '#f74f6a', '#fb923c',
  '#fbbf24', '#a3e635', '#4fc978', '#34d399',
  '#2dd4bf', '#22d3ee', '#94a3b8', '#e2e8f0',
]

function ColorPicker({ value, onChange, exclude }: { value: string; onChange: (c: string) => void; exclude?: string }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {PALETTE.map(color => {
        const selected = value === color
        const disabled = color === exclude
        return (
          <button
            key={color}
            type="button"
            onClick={() => !disabled && onChange(color)}
            style={{
              width: 30, height: 30,
              borderRadius: '50%',
              background: color,
              border: selected ? '3px solid white' : '2px solid transparent',
              outline: selected ? `3px solid ${color}` : 'none',
              outlineOffset: 1,
              opacity: disabled ? 0.2 : 1,
              cursor: disabled ? 'not-allowed' : 'pointer',
              transition: 'transform 0.1s, outline 0.1s',
              transform: selected ? 'scale(1.15)' : 'scale(1)',
              flexShrink: 0,
            }}
          />
        )
      })}
    </div>
  )
}

export default function Home() {
  const navigate = useNavigate()

  const [teamA, setTeamA] = useState('')
  const [teamB, setTeamB] = useState('')
  const [colorA, setColorA] = useState('#4f8ef7')
  const [colorB, setColorB] = useState('#f74f6a')
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
        body: JSON.stringify({ teamA: teamA.trim(), teamB: teamB.trim(), colorA, colorB })
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
          {joinError && <p className="text-xs" style={{ color: 'var(--team-b)' }}>{joinError}</p>}
        </form>

        {/* Divider */}
        <div className="vs-divider gap-3 mb-4">
          <span className="flex-1" style={{ borderTop: '1px solid var(--border)' }} />
          <span className="text-xs" style={{ color: 'var(--muted)' }}>ou créer un match</span>
          <span className="flex-1" style={{ borderTop: '1px solid var(--border)' }} />
        </div>

        {/* Create match */}
        <form onSubmit={handleCreate} className="card p-5 flex flex-col gap-5">
          <h2 className="font-bold text-sm" style={{ color: 'var(--muted)' }}>Nouveau match</h2>

          {/* Team A */}
          <div className="flex flex-col gap-3">
            <label className="text-xs font-semibold" style={{ color: colorA }}>Équipe A</label>
            <input className="input" placeholder="Nom de l'équipe A" value={teamA}
              onChange={e => setTeamA(e.target.value)} maxLength={40}
              style={{ borderColor: `${colorA}60` }} />
            <ColorPicker value={colorA} onChange={setColorA} exclude={colorB} />
          </div>

          <div className="vs-divider gap-3">
            <span className="flex-1" style={{ borderTop: '1px solid var(--border)' }} />
            VS
            <span className="flex-1" style={{ borderTop: '1px solid var(--border)' }} />
          </div>

          {/* Team B */}
          <div className="flex flex-col gap-3">
            <label className="text-xs font-semibold" style={{ color: colorB }}>Équipe B</label>
            <input className="input" placeholder="Nom de l'équipe B" value={teamB}
              onChange={e => setTeamB(e.target.value)} maxLength={40}
              style={{ borderColor: `${colorB}60` }} />
            <ColorPicker value={colorB} onChange={setColorB} exclude={colorA} />
          </div>

          {createError && (
            <p className="text-xs text-center rounded-lg p-2"
              style={{ background: 'rgba(247,79,106,0.1)', color: 'var(--team-b)', border: '1px solid rgba(247,79,106,0.2)' }}>
              {createError}
            </p>
          )}

          <button type="submit" className="btn btn-primary w-full" style={{ padding: '13px', fontSize: '1rem', background: colorA }} disabled={creating}>
            {creating ? 'Création...' : '🎬 Créer le match'}
          </button>
        </form>
      </div>
    </div>
  )
}
