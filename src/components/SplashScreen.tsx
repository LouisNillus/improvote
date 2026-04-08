import { useEffect, useState } from 'react'

export default function SplashScreen({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<'in' | 'hold' | 'out'>('in')

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('hold'), 600)
    const t2 = setTimeout(() => setPhase('out'), 2200)
    const t3 = setTimeout(() => onDone(), 2900)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [onDone])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: '#070a12',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20,
      opacity: phase === 'out' ? 0 : 1,
      transition: phase === 'in' ? 'opacity 0.6s ease' : phase === 'out' ? 'opacity 0.7s ease' : 'none',
      pointerEvents: 'none',
    }}>
      <img
        src="/cameleons-logo.png"
        alt="Caméléons Créations"
        style={{
          width: 100,
          opacity: phase === 'in' ? 0 : 1,
          transform: phase === 'in' ? 'scale(0.8)' : 'scale(1)',
          transition: 'opacity 0.6s ease, transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
          filter: 'brightness(0) invert(1)',
        }}
      />
      <p style={{
        fontFamily: 'system-ui, sans-serif',
        fontSize: '0.85rem',
        fontWeight: 600,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        color: 'rgba(255,255,255,0.5)',
        opacity: phase === 'in' ? 0 : 1,
        transform: phase === 'in' ? 'translateY(8px)' : 'translateY(0)',
        transition: 'opacity 0.6s ease 0.15s, transform 0.6s ease 0.15s',
      }}>
        Caméléons Créations
      </p>
    </div>
  )
}
