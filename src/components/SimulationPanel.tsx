import { useState } from 'react'
import type { SimulationPattern, SimulationConfig } from '../lib/types'

const PATTERNS: { value: SimulationPattern; label: string; desc: string }[] = [
  { value: 'balanced',      label: 'Équilibré',    desc: 'Les équipes alternent les manches' },
  { value: 'tight',         label: 'Serré',        desc: 'Chaque manche se joue à 50/50' },
  { value: 'teamA_dominant',label: 'Dom. A',       desc: 'Équipe A domine toute la partie' },
  { value: 'teamB_dominant',label: 'Dom. B',       desc: 'Équipe B domine toute la partie' },
  { value: 'teamA_comeback',label: 'Remontée A',   desc: 'B démarre fort, A remonte' },
  { value: 'teamB_comeback',label: 'Remontée B',   desc: 'A démarre fort, B remonte' },
]

interface Props {
  onRun: (config: SimulationConfig) => void
  hasRounds: boolean
}

export default function SimulationPanel({ onRun, hasRounds }: Props) {
  const [open, setOpen] = useState(false)
  const [voterCount, setVoterCount] = useState(20)
  const [roundCount, setRoundCount] = useState(5)
  const [pattern, setPattern] = useState<SimulationPattern>('balanced')
  const [running, setRunning] = useState(false)

  function run() {
    setRunning(true)
    onRun({ voterCount, roundCount, pattern })
    setTimeout(() => { setRunning(false); setOpen(false) }, 800)
  }

  return (
    <div className="card p-4 mb-4 fade-in">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex items-center justify-between w-full"
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
      >
        <h2 className="font-bold text-xs uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
          🎲 Mode simulation
        </h2>
        <span style={{ color: 'var(--muted)', fontSize: '0.75rem', transition: 'transform 0.2s',
          display: 'inline-block', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
      </button>

      {open && (
        <div className="flex flex-col gap-4 mt-4">
          {/* Voters */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between">
              <label className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>Votants</label>
              <span className="font-black text-sm" style={{ color: 'var(--gold)' }}>{voterCount}</span>
            </div>
            <input type="range" min={5} max={100} step={5} value={voterCount}
              onChange={e => setVoterCount(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--gold)', cursor: 'pointer' }} />
            <div className="flex justify-between text-xs" style={{ color: 'var(--muted)' }}>
              <span>5</span><span>100</span>
            </div>
          </div>

          {/* Rounds */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between">
              <label className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>Manches</label>
              <span className="font-black text-sm" style={{ color: 'var(--gold)' }}>{roundCount}</span>
            </div>
            <input type="range" min={1} max={10} step={1} value={roundCount}
              onChange={e => setRoundCount(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--gold)', cursor: 'pointer' }} />
            <div className="flex justify-between text-xs" style={{ color: 'var(--muted)' }}>
              <span>1</span><span>10</span>
            </div>
          </div>

          {/* Pattern */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>Scénario</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
              {PATTERNS.map(p => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPattern(p.value)}
                  title={p.desc}
                  style={{
                    padding: '7px 4px',
                    borderRadius: 8,
                    border: `1px solid ${pattern === p.value ? 'var(--gold)' : 'var(--border)'}`,
                    background: pattern === p.value ? 'rgba(247,201,79,0.1)' : 'var(--surface-2)',
                    color: pattern === p.value ? 'var(--gold)' : 'var(--muted)',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    fontWeight: pattern === p.value ? 700 : 400,
                    transition: 'all 0.15s',
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              {PATTERNS.find(p => p.value === pattern)?.desc}
            </p>
          </div>

          {hasRounds && (
            <p className="text-xs text-center" style={{ color: 'var(--muted)' }}>
              ⚠️ Remplacera les manches existantes
            </p>
          )}
          <button
            type="button"
            className="btn w-full"
            onClick={run}
            disabled={running}
            style={{
              background: 'rgba(247,201,79,0.12)',
              border: '1px solid rgba(247,201,79,0.4)',
              color: 'var(--gold)',
              padding: '12px',
            }}
          >
            {running ? '⏳ Génération...' : '▶ Lancer la simulation'}
          </button>
        </div>
      )}
    </div>
  )
}
