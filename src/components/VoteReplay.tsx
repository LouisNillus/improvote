import { useState, useEffect, useRef, useMemo } from 'react'
import type { Round } from '../lib/types'

interface Props {
  round: Round
  teamA: string
  teamB: string
  colorA: string
  colorB: string
  onClose: () => void
}

const SPEEDS = [1, 2, 5, 10]

export default function VoteReplay({ round, teamA, teamB, colorA, colorB, onClose }: Props) {
  const duration = round.duration * 1000
  const [replayTime, setReplayTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(5)
  const rafRef = useRef<number>()
  const lastTimeRef = useRef<number | null>(null)

  const history = useMemo(() => {
    return [...(round.voteHistory || [])].sort((a, b) => a.t - b.t)
  }, [round.voteHistory])

  useEffect(() => {
    if (!playing) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      lastTimeRef.current = null
      return
    }
    const tick = (now: number) => {
      if (lastTimeRef.current === null) lastTimeRef.current = now
      const delta = (now - lastTimeRef.current) * speed
      lastTimeRef.current = now
      setReplayTime(prev => {
        const next = prev + delta
        if (next >= duration) {
          setPlaying(false)
          return duration
        }
        return next
      })
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      lastTimeRef.current = null
    }
  }, [playing, speed, duration])

  const counts = useMemo(() => {
    let a = 0, b = 0, n = 0
    for (const ev of history) {
      if (ev.t > replayTime) break
      a += ev.dA; b += ev.dB; n += ev.dN
    }
    return { a, b, n }
  }, [history, replayTime])

  const finalTotal = round.votesA + round.votesB + round.votesNeutral || 1
  const progress = replayTime / duration
  const done = replayTime >= duration
  const winA = round.votesA > round.votesB
  const winB = round.votesB > round.votesA

  function restart() {
    setReplayTime(0)
    lastTimeRef.current = null
    setPlaying(true)
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(10px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="card p-6 flex flex-col gap-5 fade-in"
        style={{ width: '100%', maxWidth: 480 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-xs uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
            Replay du vote
          </h2>
          <div className="flex items-center gap-1">
            {SPEEDS.map(s => (
              <button key={s} onClick={() => setSpeed(s)}
                style={{
                  padding: '3px 9px', borderRadius: 6, fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer',
                  background: speed === s ? 'rgba(247,201,79,0.15)' : 'transparent',
                  border: speed === s ? '1px solid rgba(247,201,79,0.4)' : '1px solid transparent',
                  color: speed === s ? 'var(--gold)' : 'var(--muted)',
                }}>
                {s}x
              </button>
            ))}
          </div>
        </div>

        {/* Timeline */}
        <div>
          <div className="progress-bar-track" style={{ height: 5 }}>
            <div style={{
              height: '100%', width: `${progress * 100}%`,
              background: 'var(--gold)', borderRadius: 4,
              transition: playing ? 'none' : 'width 0.2s',
              boxShadow: playing ? '0 0 8px var(--gold)' : 'none',
            }} />
          </div>
          <div className="flex justify-between text-xs mt-1" style={{ color: 'var(--muted)' }}>
            <span>{Math.round(replayTime / 1000)}s</span>
            <span>{round.duration}s</span>
          </div>
        </div>

        {/* Bars */}
        <div className="flex flex-col gap-4">
          <ReplayBar label={teamA} votes={counts.a} finalTotal={finalTotal}
            color={colorA} isWinner={done && winA} />
          <ReplayBar label={teamB} votes={counts.b} finalTotal={finalTotal}
            color={colorB} isWinner={done && winB} />
          {round.allowNeutral && (
            <ReplayBar label="Neutre" votes={counts.n} finalTotal={finalTotal}
              color="var(--muted)" isWinner={false} />
          )}
          <p className="text-xs text-center" style={{ color: 'var(--muted)' }}>
            {counts.a + counts.b + counts.n} vote{counts.a + counts.b + counts.n !== 1 ? 's' : ''} comptabilisés
          </p>
        </div>

        {/* Controls */}
        <div className="flex gap-2">
          <button onClick={restart} className="btn flex-1" style={{
            background: 'rgba(247,201,79,0.12)',
            border: '1px solid rgba(247,201,79,0.4)',
            color: 'var(--gold)', padding: '12px',
          }}>
            {replayTime === 0 ? '▶ Lancer' : '↺ Rejouer'}
          </button>
          {playing && (
            <button onClick={() => setPlaying(false)} className="btn btn-ghost" style={{ padding: '12px 16px' }}>⏸</button>
          )}
          {!playing && replayTime > 0 && !done && (
            <button onClick={() => setPlaying(true)} className="btn btn-ghost" style={{ padding: '12px 16px' }}>▶</button>
          )}
          <button onClick={onClose} className="btn btn-ghost" style={{ padding: '12px 16px', color: 'var(--muted)' }}>✕</button>
        </div>
      </div>
    </div>
  )
}

function ReplayBar({ label, votes, finalTotal, color, isWinner }: {
  label: string; votes: number; finalTotal: number; color: string; isWinner: boolean
}) {
  const pct = Math.round((votes / finalTotal) * 100)
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between items-center">
        <span style={{ color, fontWeight: 700, fontSize: '0.95rem' }}>
          {label}{isWinner ? ' 🏆' : ''}
        </span>
        <span style={{ color, fontWeight: 800, fontSize: '1.1rem' }}>
          {votes} <span style={{ color: 'var(--muted)', fontWeight: 400, fontSize: '0.8em' }}>({pct}%)</span>
        </span>
      </div>
      <div className="progress-bar-track" style={{ height: 12 }}>
        <div style={{
          height: '100%', width: `${pct}%`,
          background: color, borderRadius: 4,
          transition: 'width 0.06s linear',
          boxShadow: votes > 0 ? `0 0 10px ${color}60` : 'none',
        }} />
      </div>
    </div>
  )
}
