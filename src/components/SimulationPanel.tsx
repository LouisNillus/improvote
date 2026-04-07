import { useState, useRef, useCallback, useEffect } from 'react'
import type { SimulationConfig } from '../lib/types'

const DEFAULT_ROUNDS = 5
const W = 500
const H = 200
const PAD_X = 24
const PAD_Y = 20
const CHART_W = W - PAD_X * 2
const CHART_H = H - PAD_Y * 2

// value ∈ [-1, 1] → SVG y
function toY(v: number) {
  return PAD_Y + ((1 - v) / 2) * CHART_H
}
// SVG y → value ∈ [-1, 1]
function fromY(y: number) {
  return Math.max(-1, Math.min(1, 1 - ((y - PAD_Y) / CHART_H) * 2))
}
// index → SVG x
function toX(i: number, n: number) {
  if (n <= 1) return PAD_X + CHART_W / 2
  return PAD_X + (i / (n - 1)) * CHART_W
}

function buildPath(values: number[]) {
  if (values.length === 0) return ''
  const n = values.length
  const pts = values.map((v, i) => [toX(i, n), toY(v)] as [number, number])

  if (n === 1) return `M${pts[0][0]},${pts[0][1]}`

  // Catmull-Rom to cubic bezier
  let d = `M${pts[0][0]},${pts[0][1]}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[Math.min(pts.length - 1, i + 2)]
    const cp1x = p1[0] + (p2[0] - p0[0]) / 6
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6
    d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2[0]},${p2[1]}`
  }
  return d
}

interface Props {
  onRun: (config: SimulationConfig) => void
  hasRounds: boolean
  colorA: string
  colorB: string
  teamA: string
  teamB: string
}

export default function SimulationPanel({ onRun, hasRounds, colorA, colorB, teamA, teamB }: Props) {
  const [open, setOpen] = useState(false)
  const [voterCount, setVoterCount] = useState(20)
  const [values, setValues] = useState<number[]>(() => Array(DEFAULT_ROUNDS).fill(0))
  const [running, setRunning] = useState(false)
  const [dragging, setDragging] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const roundCount = values.length

  function setRoundCount(n: number) {
    setValues(prev => {
      if (n > prev.length) return [...prev, ...Array(n - prev.length).fill(0)]
      return prev.slice(0, n)
    })
  }

  function getSVGY(clientY: number) {
    if (!svgRef.current) return 0
    const rect = svgRef.current.getBoundingClientRect()
    const scaleY = H / rect.height
    return (clientY - rect.top) * scaleY
  }

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (dragging === null) return
    const y = getSVGY(e.clientY)
    setValues(prev => {
      const next = [...prev]
      next[dragging] = fromY(y)
      return next
    })
  }, [dragging])

  const onMouseUp = useCallback(() => setDragging(null), [])

  useEffect(() => {
    if (dragging === null) return
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [dragging, onMouseMove, onMouseUp])

  // Touch support
  const onTouchMove = useCallback((e: TouchEvent) => {
    if (dragging === null) return
    e.preventDefault()
    const y = getSVGY(e.touches[0].clientY)
    setValues(prev => {
      const next = [...prev]
      next[dragging] = fromY(y)
      return next
    })
  }, [dragging])

  useEffect(() => {
    if (dragging === null) return
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('touchend', onMouseUp)
    return () => {
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onMouseUp)
    }
  }, [dragging, onTouchMove, onMouseUp])

  function run() {
    setRunning(true)
    onRun({ voterCount, values })
    setTimeout(() => { setRunning(false); setOpen(false) }, 800)
  }

  const path = buildPath(values)
  const n = values.length

  // Area fill path
  const areaPath = n > 0
    ? path + ` L${toX(n - 1, n)},${toY(0)} L${toX(0, n)},${toY(0)} Z`
    : ''

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
            <div className="flex justify-between text-xs" style={{ color: 'var(--muted)' }}><span>5</span><span>100</span></div>
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
            <div className="flex justify-between text-xs" style={{ color: 'var(--muted)' }}><span>1</span><span>10</span></div>
          </div>

          {/* Editable curve */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>Répartition par manche</label>
              <button type="button" onClick={() => setValues(Array(roundCount).fill(0))}
                style={{ fontSize: '0.7rem', color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}>
                Reset
              </button>
            </div>

            <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--surface-2)' }}>
              {/* Y axis labels */}
              <div style={{ position: 'absolute', left: 4, top: PAD_Y / H * 100 + '%', fontSize: 9, color: colorA, fontWeight: 700, transform: 'translateY(-50%)', pointerEvents: 'none', lineHeight: 1 }}>
                100%<br/>{teamA}
              </div>
              <div style={{ position: 'absolute', left: 4, top: '50%', fontSize: 9, color: 'var(--muted)', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                50/50
              </div>
              <div style={{ position: 'absolute', left: 4, bottom: PAD_Y / H * 100 + '%', fontSize: 9, color: colorB, fontWeight: 700, transform: 'translateY(50%)', pointerEvents: 'none', lineHeight: 1 }}>
                100%<br/>{teamB}
              </div>

              <svg
                ref={svgRef}
                viewBox={`0 0 ${W} ${H}`}
                width="100%"
                style={{ display: 'block', cursor: dragging !== null ? 'grabbing' : 'default', touchAction: 'none' }}
              >
                {/* Grid lines */}
                <line x1={PAD_X} y1={PAD_Y} x2={W - PAD_X} y2={PAD_Y} stroke={colorA} strokeWidth={0.5} strokeOpacity={0.3} />
                <line x1={PAD_X} y1={H / 2} x2={W - PAD_X} y2={H / 2} stroke="var(--border)" strokeWidth={1} strokeDasharray="4 3" />
                <line x1={PAD_X} y1={H - PAD_Y} x2={W - PAD_X} y2={H - PAD_Y} stroke={colorB} strokeWidth={0.5} strokeOpacity={0.3} />

                {/* Area fill above/below center */}
                {n > 1 && (
                  <>
                    <clipPath id="clip-above">
                      <rect x={0} y={0} width={W} height={H / 2} />
                    </clipPath>
                    <clipPath id="clip-below">
                      <rect x={0} y={H / 2} width={W} height={H / 2} />
                    </clipPath>
                    <path d={areaPath} fill={colorA} fillOpacity={0.15} clipPath="url(#clip-above)" />
                    <path d={areaPath} fill={colorB} fillOpacity={0.15} clipPath="url(#clip-below)" />
                  </>
                )}

                {/* Curve */}
                {n > 1 && (
                  <path d={path} fill="none" stroke="white" strokeWidth={2}
                    strokeLinejoin="round" strokeLinecap="round" strokeOpacity={0.7} />
                )}

                {/* Handles */}
                {values.map((v, i) => {
                  const cx = toX(i, n)
                  const cy = toY(v)
                  const color = v < 0 ? colorA : v > 0 ? colorB : 'var(--muted)'
                  return (
                    <g key={i}
                      onMouseDown={e => { e.preventDefault(); setDragging(i) }}
                      onTouchStart={e => { e.preventDefault(); setDragging(i) }}
                      style={{ cursor: 'grab' }}
                    >
                      {/* vertical guide */}
                      <line x1={cx} y1={PAD_Y} x2={cx} y2={H - PAD_Y}
                        stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
                      {/* handle circle */}
                      <circle cx={cx} cy={cy} r={dragging === i ? 10 : 8}
                        fill={color} fillOpacity={0.9}
                        stroke="white" strokeWidth={dragging === i ? 2.5 : 1.5} />
                      {/* M label */}
                      <text x={cx} y={H - 4} textAnchor="middle"
                        fontSize={9} fill="var(--muted)" fontFamily="system-ui">
                        M{i + 1}
                      </text>
                      {/* % label */}
                      <text x={cx} y={cy - (dragging === i ? 14 : 12)} textAnchor="middle"
                        fontSize={8} fill="white" fontFamily="system-ui" fontWeight={700}>
                        {v < 0
                          ? `${Math.round(Math.abs(v) * 50 + 50)}% A`
                          : v > 0
                          ? `${Math.round(v * 50 + 50)}% B`
                          : '50/50'}
                      </text>
                    </g>
                  )
                })}
              </svg>
            </div>
            <p className="text-xs text-center" style={{ color: 'var(--muted)' }}>
              Faites glisser les poignées vers le haut pour favoriser {teamA}, vers le bas pour {teamB}
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
