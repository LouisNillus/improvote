import { useEffect, useState } from 'react'

type Phase = 'in' | 'hold' | 'out-content' | 'out-bg'

export default function SplashScreen({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<Phase>('in')

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('hold'), 600)
    const t2 = setTimeout(() => setPhase('out-content'), 2400)
    const t3 = setTimeout(() => setPhase('out-bg'), 3400)
    const t4 = setTimeout(() => onDone(), 4600)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4) }
  }, [onDone])

  const contentOut = phase === 'out-content' || phase === 'out-bg'
  const bgOut = phase === 'out-bg'

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: '#070a12',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20,
      opacity: bgOut ? 0 : 1,
      transition: bgOut ? 'opacity 1.2s ease' : 'none',
      pointerEvents: 'none',
    }}>
      <img
        src="/cameleons-logo.png"
        alt="Caméléons Créations"
        style={{
          width: 100,
          opacity: phase === 'in' || contentOut ? 0 : 1,
          transform: phase === 'in' ? 'scale(0.8)' : contentOut ? 'scale(0.95)' : 'scale(1)',
          transition: contentOut
            ? 'opacity 0.9s ease, transform 0.9s ease'
            : 'opacity 0.6s ease, transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
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
        opacity: phase === 'in' || contentOut ? 0 : 1,
        transform: phase === 'in' ? 'translateY(8px)' : contentOut ? 'translateY(-4px)' : 'translateY(0)',
        transition: contentOut
          ? 'opacity 0.9s ease 0.05s, transform 0.9s ease 0.05s'
          : 'opacity 0.6s ease 0.15s, transform 0.6s ease 0.15s',
      }}>
        Caméléons Créations
      </p>
    </div>
  )
}
