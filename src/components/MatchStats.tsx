import type { Session, Round } from '../lib/types'

interface MatchStatsProps {
  session: Session
  onReplay?: (round: Round) => void
}

export default function MatchStats({ session, onReplay }: MatchStatsProps) {
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
        <BarChart rounds={rounds} colorA={colorA} colorB={colorB} teamA={session.teamA} teamB={session.teamB} onReplay={onReplay} />
      </div>

      {/* Momentum line chart */}
      {rounds.length > 1 && (
        <div>
          <p className="text-xs mb-2" style={{ color: 'var(--muted)' }}>Évolution du score</p>
          <MomentumChart rounds={rounds} colorA={colorA} colorB={colorB} teamA={session.teamA} teamB={session.teamB} />
        </div>
      )}

      {/* Cumulative vote totals */}
      <CumulativeVotes rounds={rounds} colorA={colorA} colorB={colorB} teamA={session.teamA} teamB={session.teamB} />
    </div>
  )
}

// Estimate luminance from hex color to pick readable text color
function textColorFor(hex: string): string {
  const c = hex.replace('#', '')
  const r = parseInt(c.slice(0, 2), 16) / 255
  const g = parseInt(c.slice(2, 4), 16) / 255
  const b = parseInt(c.slice(4, 6), 16) / 255
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return lum > 0.45 ? 'rgba(0,0,0,0.75)' : 'rgba(255,255,255,0.9)'
}

export const BAR_LAYOUT = {
  W: 500,
  LEGEND_H: 52,
  MARGIN_LEFT: 8,
  MARGIN_BOTTOM: 24,
  get MARGIN_TOP() { return this.LEGEND_H + 12 },
  gap: 4,
  barW(n: number) {
    return Math.max(8, (this.W - this.MARGIN_LEFT * 2 - this.gap * (n - 1)) / n)
  },
  barX(i: number, n: number) {
    return this.MARGIN_LEFT + i * (this.barW(n) + this.gap)
  },
  barCenterX(i: number, n: number) {
    return this.barX(i, n) + this.barW(n) / 2
  },
}

function BarChart({ rounds, colorA, colorB, teamA, teamB, onReplay }: {
  rounds: Round[]; colorA: string; colorB: string; teamA: string; teamB: string
  onReplay?: (round: Round) => void
}) {
  const { W, LEGEND_H, MARGIN_LEFT, MARGIN_BOTTOM, MARGIN_TOP, gap } = BAR_LAYOUT
  const H = 200 + LEGEND_H
  const chartH = H - MARGIN_BOTTOM - MARGIN_TOP
  const n = rounds.length
  const barW = BAR_LAYOUT.barW(n)

  const textA = textColorFor(colorA)
  const textB = textColorFor(colorB)

  const hasNeutral = rounds.some(r => r.votesNeutral > 0)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ overflow: 'visible' }}>
      <defs>
        <pattern id="neutral-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="5" stroke="rgba(160,160,160,0.7)" strokeWidth="2" />
        </pattern>
      </defs>

      {/* Légende — teamA, teamB, neutre (si applicable) */}
      <g transform="translate(0, 2)">
        <rect width={10} height={10} fill={colorA} rx={2} />
        <text x={14} y={9} fontSize={9} fill={colorA} fontWeight={700} fontFamily="system-ui">{teamA}</text>
        <rect y={14} width={10} height={10} fill={colorB} rx={2} />
        <text x={14} y={23} fontSize={9} fill={colorB} fontWeight={700} fontFamily="system-ui">{teamB}</text>
        {hasNeutral && (
          <>
            <rect y={28} width={10} height={10} fill="url(#neutral-hatch)" rx={2}
              style={{ outline: '1px solid rgba(160,160,160,0.4)' }} />
            <rect y={28} width={10} height={10} fill="none" stroke="rgba(160,160,160,0.4)" rx={2} />
            <text x={14} y={37} fontSize={9} fill="var(--muted)" fontWeight={700} fontFamily="system-ui">Neutre</text>
          </>
        )}
      </g>

      {rounds.map((r, i) => {
        const total = r.votesA + r.votesB + r.votesNeutral || 1
        const hA = (r.votesA / total) * chartH
        const hN = (r.votesNeutral / total) * chartH
        const hB = (r.votesB / total) * chartH
        const pctA = Math.round((r.votesA / total) * 100)
        const pctN = Math.round((r.votesNeutral / total) * 100)
        const pctB = Math.round((r.votesB / total) * 100)
        const x = MARGIN_LEFT + i * (barW + gap)
        const winA = r.votesA > r.votesB
        const winB = r.votesB > r.votesA
        const labelX = x + barW / 2
        const labelColor = winA ? colorA : winB ? colorB : 'var(--gold)'
        const showInner = barW >= 20

        // y positions: A (top) → N (middle) → B (bottom)
        const yA = MARGIN_TOP + chartH - hA - hN - hB
        const yN = MARGIN_TOP + chartH - hN - hB
        const yB = MARGIN_TOP + chartH - hB

        return (
          <g key={r.id}>
            {/* Team A bar (top) */}
            <rect x={x} y={yA} width={barW} height={hA}
              fill={!winA && !winB ? 'var(--gold)' : colorA} rx={1} />
            {/* Neutral bar (middle) */}
            {hN > 0 && (
              <rect x={x} y={yN} width={barW} height={hN}
                fill="url(#neutral-hatch)" />
            )}
            {/* Team B bar (bottom) */}
            <rect x={x} y={yB} width={barW} height={hB}
              fill={!winA && !winB ? 'var(--gold)' : colorB} rx={1} />
            {/* Tie: divider lines at A/N and N/B junctions */}
            {!winA && !winB && (
              <>
                <line x1={x} y1={yN} x2={x + barW} y2={yN}
                  stroke="rgba(0,0,0,0.55)" strokeWidth={2.5} />
                {hN > 0 && (
                  <line x1={x} y1={yB} x2={x + barW} y2={yB}
                    stroke="rgba(0,0,0,0.55)" strokeWidth={2.5} />
                )}
              </>
            )}
            {/* % inside bars if tall enough */}
            {showInner && hA > 16 && (
              <text x={labelX} y={yA + hA / 2 + 4} textAnchor="middle"
                fontSize={8} fill={!winA && !winB ? 'rgba(0,0,0,0.7)' : textA} fontWeight={700} fontFamily="system-ui">
                {pctA}%
              </text>
            )}
            {showInner && hN > 16 && (
              <text x={labelX} y={yN + hN / 2 + 4} textAnchor="middle"
                fontSize={8} fill="rgba(200,200,200,0.9)" fontWeight={700} fontFamily="system-ui">
                {pctN}%
              </text>
            )}
            {showInner && hB > 16 && (
              <text x={labelX} y={yB + hB / 2 + 4} textAnchor="middle"
                fontSize={8} fill={!winA && !winB ? 'rgba(0,0,0,0.7)' : textB} fontWeight={700} fontFamily="system-ui">
                {pctB}%
              </text>
            )}
            {/* vote counts above bars */}
            <text x={labelX} y={yA - 3} textAnchor="middle"
              fontSize={8} fill="var(--muted)" fontFamily="system-ui">
              {total}v
            </text>
            {/* X label colored by winner */}
            <text x={labelX} y={H - 4} textAnchor="middle"
              fontSize={9} fill={labelColor} fontWeight={700} fontFamily="system-ui">
              M{i + 1}
            </text>
            {/* Replay button — shown if voteHistory available */}
            {onReplay && (r.voteHistory?.length ?? 0) > 0 && barW >= 16 && (
              <text x={labelX} y={yA - 14} textAnchor="middle"
                fontSize={11} style={{ cursor: 'pointer' }}
                onClick={() => onReplay(r)}>
                🎬
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

function WinnerTimeline({ rounds, colorA, colorB }: {
  rounds: Round[]; colorA: string; colorB: string; teamA: string; teamB: string
}) {
  const n = rounds.length
  const { W, MARGIN_LEFT, gap } = BAR_LAYOUT
  const barW = BAR_LAYOUT.barW(n)
  const PILL_R = Math.min(18, barW / 2)
  const H = PILL_R * 2 + 24

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ overflow: 'visible' }}>
      {rounds.map((r, i) => {
        const winA = r.votesA > r.votesB
        const winB = r.votesB > r.votesA
        const color = winA ? colorA : winB ? colorB : 'var(--gold)'
        const total = r.votesA + r.votesB + r.votesNeutral || 1
        const pctWinner = Math.round((Math.max(r.votesA, r.votesB) / total) * 100)
        const cx = MARGIN_LEFT + i * (barW + gap) + barW / 2
        const cy = PILL_R

        return (
          <g key={r.id}>
            <rect x={cx - PILL_R} y={0} width={PILL_R * 2} height={PILL_R * 2}
              rx={6} fill={color} fillOpacity={0.18}
              stroke={color} strokeWidth={1.5} />
            <text x={cx} y={cy + 4} textAnchor="middle"
              fontSize={Math.max(8, PILL_R * 0.7)} fill={color} fontWeight={800} fontFamily="system-ui">
              {winA ? 'A' : winB ? 'B' : '='}
            </text>
            <text x={cx} y={PILL_R * 2 + 10} textAnchor="middle"
              fontSize={8} fill={color} fontWeight={700} fontFamily="system-ui">
              {pctWinner}%
            </text>
          </g>
        )
      })}
    </svg>
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

function CumulativeVotes({ rounds, colorA, colorB, teamA, teamB }: {
  rounds: Round[]; colorA: string; colorB: string; teamA: string; teamB: string
}) {
  const totalA = rounds.reduce((s, r) => s + r.votesA, 0)
  const totalB = rounds.reduce((s, r) => s + r.votesB, 0)
  const totalNeutral = rounds.reduce((s, r) => s + r.votesNeutral, 0)
  const grand = totalA + totalB + totalNeutral || 1

  return (
    <div>
      <p className="text-xs mb-2" style={{ color: 'var(--muted)' }}>Votes cumulés</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {[
          { label: teamA, value: totalA, color: colorA },
          { label: teamB, value: totalB, color: colorB },
          ...(totalNeutral > 0 ? [{ label: 'Neutres', value: totalNeutral, color: 'var(--gold)' }] : []),
        ].map(({ label, value, color }) => (
          <div key={label} style={{
            flex: '1 1 80px',
            background: `color-mix(in srgb, ${color} 12%, transparent)`,
            border: `1.5px solid color-mix(in srgb, ${color} 40%, transparent)`,
            borderRadius: 10, padding: '10px 12px',
            display: 'flex', flexDirection: 'column', gap: 2,
          }}>
            <span style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
            <span style={{ fontSize: '1.25rem', fontWeight: 900, color, lineHeight: 1 }}>{value}</span>
            <span style={{ fontSize: 9, color: 'var(--muted)' }}>{Math.round((value / grand) * 100)}% du total</span>
          </div>
        ))}
      </div>
    </div>
  )
}
