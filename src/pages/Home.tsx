import { useState, useEffect, useRef, useCallback, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'

const PALETTE = [
  '#4f8ef7', '#38bdf8', '#818cf8', '#a855f7',
  '#e879f9', '#f472b6', '#f74f6a', '#fb923c',
  '#fbbf24', '#a3e635', '#4fc978', '#34d399',
  '#2dd4bf', '#22d3ee', '#94a3b8', '#e2e8f0',
]

const RADIUS = 62

interface Country {
  code: string
  name: string
  flag: string       // emoji ou chemin image
  flagImg?: boolean  // true = <img>, false = emoji
  primary: string
  secondary: string
}

const COUNTRIES: Country[] = [
  { code: 'FR', name: 'France',     flag: '🇫🇷', primary: '#4f8ef7', secondary: '#e84139' },
  { code: 'BE', name: 'Belgique',   flag: '🇧🇪', primary: '#f5c400', secondary: '#e84139' },
  { code: 'LU', name: 'Luxembourg', flag: '🇱🇺', primary: '#ef4135', secondary: '#38bdf8' },
  { code: 'MC', name: 'Monaco',     flag: '🇲🇨', primary: '#ce1126', secondary: '#94a3b8' },
  { code: 'CH', name: 'Suisse',     flag: '🇨🇭', primary: '#ff3333', secondary: '#94a3b8' },
  { code: 'QC', name: 'Québec',     flag: '/flags/quebec.jpg', flagImg: true, primary: '#3B5BC8', secondary: '#ce1126' },
  { code: 'MA', name: 'Maroc',      flag: '🇲🇦', primary: '#c1272d', secondary: '#22c55e' },
]

function colorDistance(a: string, b: string): number {
  const parse = (h: string) => [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)]
  const [r1,g1,b1] = parse(a), [r2,g2,b2] = parse(b)
  return Math.sqrt((r1-r2)**2 + (g1-g2)**2 + (b1-b2)**2)
}

function FlagDisplay({ country, size = 20 }: { country: Country; size?: number }) {
  if (country.flagImg) {
    const w = Math.round(size * 1.15)
    const h = Math.round(w * 0.67)
    return <img src={country.flag} alt={country.name} style={{ width: w, height: h, objectFit: 'cover', borderRadius: 5, flexShrink: 0 }} />
  }
  return <span style={{ fontSize: size * 0.075 + 'rem' }}>{country.flag}</span>
}

function RadialColorPicker({ value, onChange, exclude }: {
  value: string; onChange: (c: string) => void; exclude?: string
}) {
  const [open, setOpen] = useState(false)
  const [closing, setClosing] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const close = useCallback(() => {
    setClosing(true)
    setTimeout(() => { setOpen(false); setClosing(false) }, 220)
  }, [])

  const toggle = useCallback(() => {
    if (open) close(); else setOpen(true)
  }, [open, close])

  useEffect(() => {
    if (!open || closing) return
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) close()
    }
    setTimeout(() => document.addEventListener('mousedown', handler), 0)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, closing, close])

  return (
    <div ref={containerRef} style={{ position: 'relative', width: 36, height: 36, flexShrink: 0, zIndex: open ? 50 : 1 }}>
      <button
        type="button"
        onClick={toggle}
        style={{
          width: 36, height: 36,
          borderRadius: '50%',
          background: value,
          border: open ? '3px solid rgba(255,255,255,0.95)' : '2px solid rgba(255,255,255,0.25)',
          cursor: 'pointer',
          boxShadow: `0 0 ${open ? 22 : 8}px ${value}${open ? 'dd' : '70'}`,
          transition: 'box-shadow 0.25s, border 0.2s, transform 0.2s',
          transform: open ? 'scale(1.15)' : 'scale(1)',
          position: 'relative',
          zIndex: 20,
        }}
      />

      {open && !closing && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 1, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)', transition: 'opacity 0.2s' }}
          onMouseDown={close}
        />
      )}

      {(open || closing) && PALETTE.map((color, i) => {
        const selectedIdx = PALETTE.indexOf(value)
        const angle = Math.PI + ((i - selectedIdx) / PALETTE.length) * 2 * Math.PI
        const sx = RADIUS + Math.cos(angle) * RADIUS
        const sy = Math.sin(angle) * RADIUS
        const isExcluded = color === exclude
        const isSelected = color === value
        const size = isSelected ? 32 : 28

        return (
          <div
            key={color}
            className={closing ? 'swatch-out' : 'swatch-in'}
            data-excluded={isExcluded ? '' : undefined}
            style={{
              position: 'absolute',
              top: '50%', left: '50%',
              width: size, height: size,
              zIndex: PALETTE.length - i,
              '--sx': `${sx}px`,
              '--sy': `${sy}px`,
              animationDelay: closing
                ? `${(PALETTE.length - 1 - i) * 10}ms`
                : `${i * 20}ms`,
              opacity: 1,
              pointerEvents: isExcluded ? 'none' : 'auto',
            } as React.CSSProperties}
          >
            <button
              type="button"
              className="swatch-inner"
              onMouseDown={e => { e.stopPropagation(); onChange(color); close() }}
              style={{
                background: isExcluded
                  ? `repeating-linear-gradient(45deg, ${color} 0px, ${color} 4px, #1a1f2e 4px, #1a1f2e 8px)`
                  : color,
                border: isSelected ? '3px solid white' : '2px solid rgba(255,255,255,0.18)',
                boxShadow: isSelected ? `0 0 12px ${color}cc, 0 0 4px white` : `0 2px 8px rgba(0,0,0,0.4)`,
                cursor: isExcluded ? 'not-allowed' : 'pointer',
              }}
            />
          </div>
        )
      })}
    </div>
  )
}

function CountryPicker({ value, onChange }: {
  value: string | null
  onChange: (code: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const selected = value ? COUNTRIES.find(c => c.code === value) : null

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    setTimeout(() => document.addEventListener('mousedown', handler), 0)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={containerRef} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        title="Choisir un pays"
        style={{
          width: 36, height: 36,
          borderRadius: 8,
          border: `1px solid ${open ? 'rgba(255,255,255,0.2)' : 'var(--border)'}`,
          background: 'var(--surface-2)',
          cursor: 'pointer',
          fontSize: selected ? '1.25rem' : '0.9rem',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'border-color 0.15s',
        }}
      >
        {selected ? <FlagDisplay country={selected} size={20} /> : <span style={{ fontSize: '0.9rem' }}>🌍</span>}
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          right: 0,
          bottom: 44,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: 6,
          zIndex: 100,
          minWidth: 160,
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}>
          {value && (
            <button
              type="button"
              onMouseDown={() => { onChange(null); setOpen(false) }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 10px', borderRadius: 8,
                border: 'none', background: 'transparent',
                color: 'var(--muted)', cursor: 'pointer',
                fontSize: '0.85rem', textAlign: 'left',
              }}
            >
              ✕ Aucun pays
            </button>
          )}
          {COUNTRIES.map(c => (
            <button
              key={c.code}
              type="button"
              onMouseDown={() => { onChange(c.code); setOpen(false) }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 10px', borderRadius: 8,
                border: 'none',
                background: c.code === value ? 'var(--surface-2)' : 'transparent',
                color: 'var(--text)', cursor: 'pointer',
                fontSize: '0.9rem', textAlign: 'left',
              }}
            >
              <FlagDisplay country={c} size={20} />
              <span>{c.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Home() {
  const navigate = useNavigate()

  const [teamA, setTeamA] = useState('')
  const [teamB, setTeamB] = useState('')
  const [colorA, setColorA] = useState('#4f8ef7')
  const [colorB, setColorB] = useState('#f74f6a')
  const [countryA, setCountryA] = useState<string | null>(null)
  const [countryB, setCountryB] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  const [code, setCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState('')

  function selectCountry(team: 'A' | 'B', code: string | null) {
    if (team === 'A') {
      setCountryA(code)
      if (!code) return
      const c = COUNTRIES.find(x => x.code === code)!
      setTeamA(c.name)
      setColorA(colorDistance(c.primary, colorB) < 80 ? c.secondary : c.primary)
    } else {
      setCountryB(code)
      if (!code) return
      const c = COUNTRIES.find(x => x.code === code)!
      setTeamB(c.name)
      setColorB(colorDistance(c.primary, colorA) < 80 ? c.secondary : c.primary)
    }
  }

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
        <form onSubmit={handleCreate} className="card p-5 flex flex-col gap-5" style={{ overflow: 'visible' }}>
          <h2 className="font-bold text-sm" style={{ color: 'var(--muted)' }}>Nouveau match</h2>

          {/* Team A */}
          <div className="flex flex-col gap-2" style={{ position: 'relative' }}>
            <label className="text-xs font-semibold" style={{ color: colorA }}>Équipe A</label>
            <div className="flex items-center gap-3">
              <RadialColorPicker value={colorA} onChange={setColorA} exclude={colorB} />
              <input className="input flex-1" placeholder="Nom de l'équipe A" value={teamA}
                onChange={e => {
                  setTeamA(e.target.value)
                  if (countryA && e.target.value !== COUNTRIES.find(c => c.code === countryA)?.name) setCountryA(null)
                }}
                maxLength={40}
                style={{ borderColor: `${colorA}55` }} />
              <CountryPicker value={countryA} onChange={code => selectCountry('A', code)} />
            </div>
          </div>

          <div className="vs-divider gap-3">
            <span className="flex-1" style={{ borderTop: '1px solid var(--border)' }} />
            VS
            <span className="flex-1" style={{ borderTop: '1px solid var(--border)' }} />
          </div>

          {/* Team B */}
          <div className="flex flex-col gap-2" style={{ position: 'relative' }}>
            <label className="text-xs font-semibold" style={{ color: colorB }}>Équipe B</label>
            <div className="flex items-center gap-3">
              <RadialColorPicker value={colorB} onChange={setColorB} exclude={colorA} />
              <input className="input flex-1" placeholder="Nom de l'équipe B" value={teamB}
                onChange={e => {
                  setTeamB(e.target.value)
                  if (countryB && e.target.value !== COUNTRIES.find(c => c.code === countryB)?.name) setCountryB(null)
                }}
                maxLength={40}
                style={{ borderColor: `${colorB}55` }} />
              <CountryPicker value={countryB} onChange={code => selectCountry('B', code)} />
            </div>
          </div>

          {createError && (
            <p className="text-xs text-center rounded-lg p-2"
              style={{ background: 'rgba(247,79,106,0.1)', color: 'var(--team-b)', border: '1px solid rgba(247,79,106,0.2)' }}>
              {createError}
            </p>
          )}

          <button type="submit" className="btn btn-primary w-full"
            style={{ padding: '13px', fontSize: '1rem' }}
            disabled={creating}>
            {creating ? 'Création...' : '🎬 Créer le match'}
          </button>
        </form>

      </div>
    </div>
  )
}
