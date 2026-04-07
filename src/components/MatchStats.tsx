import type { Session, Round } from '../lib/types'

interface MatchStatsProps {
  session: Session
}

export default function MatchStats({ session }: MatchStatsProps) {
  const rounds = session.rounds.filter(r => r.status === 'closed')
  if (rounds.length === 0) return null

  const colorA = session.colorA
  const colorB = session.colorB

  return (
    <div className="card p-4 flex flex-col gap-5 fade-in">
      <h2 className="font-bold text-xs uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
        Statistiques du match
      </h2>

      {/* Bar chart — vote distribution per round */}
      <div>
        <p className="text-xs mb-2" style={{ color: 'var(--muted)' }}>Répartition des votes par manche</p>
        <BarChart rounds={rounds} colorA={colorA} colorB={colorB} teamA={session.teamA} teamB={session.teamB} />
      </div>

      {/* Round winner timeline */}
      <div>
        <p className="text-xs mb-2" style={{ color: 'var(--muted)' }}>Résultats par manche</p>
        <WinnerTimeline rounds={rounds} colorA={colorA} colorB={colorB} teamA={session.teamA} teamB={session.teamB} />
      </div>

      {/* Momentum line chart */}
      {rounds.length > 1 && (
        <div>
          <p className="text-xs mb-2" style={{ color: 'var(--muted)' }}>Évolution du score</p>
          <MomentumChart rounds={rounds} colorA={colorA} colorB={colorB} teamA={session.teamA} teamB={session.teamB} />
        </div>
      )}
    </div>
  )
}

function BarChart({ rounds, colorA, colorB, teamA, teamB }: {
  rounds: Round[]; colorA: string; colorB: string; teamA: string; teamB: string
}) {
  const LEGEND_H = 28
  const W = 500, H = 200 + LEGEND_H, MARGIN_LEFT = 8, MARGIN_BOTTOM = 24, MARGIN_TOP = LEGEND_H + 12
  const chartH = H - MARGIN_BOTTOM - MARGIN_TOP
  const n = rounds.length
  const gap = 4
  const barW = Math.max(8, (W - MARGIN_LEFT * 2 - gap * (n - 1)) / n)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ overflow: 'visible' }}>
      {/* Legend above bars */}
      <g transform="translate(0, 4)">
        <rect width={10} height={10} fill={colorA} rx={2} />
        <text x={14} y={9} fontSize={9} fill="var(--muted)" fontFamily="system-ui">{teamA}</text>
        <rect x={W / 2} width={10} height={10} fill={colorB} rx={2} />
        <text x={W / 2 + 14} y={9} fontSize={9} fill="var(--muted)" fontFamily="system-ui">{teamB}</text>
      </g>

      {rounds.map((r, i) => {
        const total = r.votesA + r.votesB + r.votesNeutral || 1
        const hA = (r.votesA / total) * chartH
        const hB = (r.votesB / total) * chartH
        const pctA = Math.round((r.votesA / total) * 100)
        const pctB = Math.round((r.votesB / total) * 100)
        const x = MARGIN_LEFT + i * (barW + gap)
        const winA = r.votesA > r.votesB
        const winB = r.votesB > r.votesA
        const labelX = x + barW / 2
        const labelColor = winA ? colorA : winB ? colorB : 'var(--gold)'
        const showInner = barW >= 20

        return (
          <g key={r.id}>
            {/* Team B bar (top) */}
            <rect x={x} y={MARGIN_TOP + chartH - hA - hB} width={barW} height={hB}
              fill={colorB} rx={1} />
            {/* Team A bar (bottom) */}
            <rect x={x} y={MARGIN_TOP + chartH - hA} width={barW} height={hA}
              fill={colorA} rx={1} />
            {/* % inside bars if tall enough */}
            {showInner && hA > 16 && (
              <text x={labelX} y={MARGIN_TOP + chartH - hA / 2 + 4} textAnchor="middle"
                fontSize={8} fill="rgba(255,255,255,0.85)" fontWeight={700} fontFamily="system-ui">
                {pctA}%
              </text>
            )}
            {showInner && hB > 16 && (
              <text x={labelX} y={MARGIN_TOP + chartH - hA - hB / 2 + 4} textAnchor="middle"
                fontSize={8} fill="rgba(255,255,255,0.85)" fontWeight={700} fontFamily="system-ui">
                {pctB}%
              </text>
            )}
            {/* vote counts above bars */}
            <text x={labelX} y={MARGIN_TOP + chartH - hA - hB - 3} textAnchor="middle"
              fontSize={8} fill="var(--muted)" fontFamily="system-ui">
              {total}v
            </text>
            {/* X label colored by winner */}
            <text x={labelX} y={H - 4} textAnchor="middle"
              fontSize={9} fill={labelColor} fontWeight={700} fontFamily="system-ui">
              M{i + 1}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

function WinnerTimeline({ rounds, colorA, colorB, teamA, teamB }: {
  rounds: Round[]; colorA: string; colorB: string; teamA: string; teamB: string
}) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {rounds.map((r, i) => {
        const winA = r.votesA > r.votesB
        const winB = r.votesB > r.votesA
        const color = winA ? colorA : winB ? colorB : 'var(--gold)'
        const total = r.votesA + r.votesB + r.votesNeutral || 1
        const pctWinner = Math.round((Math.max(r.votesA, r.votesB) / total) * 100)
        return (
          <div key={r.id} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
            minWidth: 40,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8,
              background: `color-mix(in srgb, ${color} 20%, transparent)`,
              border: `2px solid ${color}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.75rem', fontWeight: 800, color,
            }}>
              {winA ? 'A' : winB ? 'B' : '='}
            </div>
            <span style={{ fontSize: 9, color: 'var(--muted)' }}>M{i + 1}</span>
            <span style={{ fontSize: 9, color, fontWeight: 700 }}>{pctWinner}%</span>
          </div>
        )
      })}
    </div>
  )
}

function MomentumChart({ rounds, colorA, colorB, teamA, teamB }: {
  rounds: Round[]; colorA: string; colorB: string; teamA: string; teamB: string
}) {
  const W = 500, H = 120
  const MARGIN = { top: 16, bottom: 20, left: 28, right: 16 }
  const chartW = W - MARGIN.left - MARGIN.right
  const chartH = H - MARGIN.top - MARGIN.bottom

  // Build cumulative score delta points: [0, after M1, after M2, ...]
  const points: number[] = [0]
  let sA = 0, sB = 0
  for (const r of rounds) {
    if (r.votesA > r.votesB) sA++
    else if (r.votesB > r.votesA) sB++
    points.push(sA - sB)
  }

  const maxAbs = Math.max(1, ...points.map(Math.abs))
  const yScale = (chartH / 2) / maxAbs
  const xStep = chartW / (points.length - 1)
  const yCenter = MARGIN.top + chartH / 2

  const toX = (i: number) => MARGIN.left + i * xStep
  const toY = (v: number) => yCenter - v * yScale

  const polylinePoints = points.map((v, i) => `${toX(i)},${toY(v)}`).join(' ')

  // Area fill — split above/below center
  const areaAbove = points.map((v, i) => `${toX(i)},${toY(Math.max(0, v))}`).join(' ')
  const areaBelow = points.map((v, i) => `${toX(i)},${toY(Math.min(0, v))}`).join(' ')

  const areaPathAbove = `M${toX(0)},${yCenter} ` +
    points.map((v, i) => `L${toX(i)},${toY(Math.max(0, v))}`).join(' ') +
    ` L${toX(points.length - 1)},${yCenter} Z`

  const areaPathBelow = `M${toX(0)},${yCenter} ` +
    points.map((v, i) => `L${toX(i)},${toY(Math.min(0, v))}`).join(' ') +
    ` L${toX(points.length - 1)},${yCenter} Z`

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%">
      {/* Y axis ticks */}
      {Array.from({ length: maxAbs * 2 + 1 }, (_, k) => k - maxAbs).map(v => (
        <g key={v}>
          <line x1={MARGIN.left - 4} y1={toY(v)} x2={MARGIN.left} y2={toY(v)}
            stroke="var(--border)" strokeWidth={1} />
          <text x={MARGIN.left - 6} y={toY(v) + 4} textAnchor="end"
            fontSize={8} fill="var(--muted)" fontFamily="system-ui">{v}</text>
        </g>
      ))}

      {/* Area fills */}
      <path d={areaPathAbove} fill={colorA} fillOpacity={0.18} />
      <path d={areaPathBelow} fill={colorB} fillOpacity={0.18} />

      {/* Center line */}
      <line x1={MARGIN.left} y1={yCenter} x2={W - MARGIN.right} y2={yCenter}
        stroke="var(--border)" strokeWidth={1} strokeDasharray="4 3" />

      {/* Curve */}
      <polyline points={polylinePoints} fill="none"
        stroke="var(--text)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

      {/* Dots */}
      {points.map((v, i) => (
        <circle key={i} cx={toX(i)} cy={toY(v)} r={i === 0 ? 0 : 3.5}
          fill={v > 0 ? colorA : v < 0 ? colorB : 'var(--muted)'}
          stroke="var(--bg)" strokeWidth={1.5} />
      ))}

      {/* X labels */}
      {points.slice(1).map((_, i) => (
        <text key={i} x={toX(i + 1)} y={H - 4} textAnchor="middle"
          fontSize={9} fill="var(--muted)" fontFamily="system-ui">M{i + 1}</text>
      ))}

      {/* Legend */}
      <text x={MARGIN.left + 4} y={MARGIN.top - 4} fontSize={9} fill={colorA} fontFamily="system-ui" fontWeight={700}>{teamA}</text>
      <text x={W - MARGIN.right} y={H - MARGIN.bottom + 4} fontSize={9} fill={colorB} fontFamily="system-ui" fontWeight={700} textAnchor="end">{teamB}</text>
    </svg>
  )
}
