'use client'
import { useEffect, useState } from 'react'
export default function SuitcaseLoader({ message = 'Loading' }: { message?: string }) {
  const [dots, setDots] = useState('')
  useEffect(() => {
    const i = setInterval(() => setDots(d => d.length >= 3 ? '' : d + '.'), 400)
    return () => clearInterval(i)
  }, [])
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#fafaf8', gap: '32px' }}>
      <svg width="80" height="64" viewBox="0 0 80 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <style>{`
          @keyframes drawCase {
            0% { stroke-dashoffset: 300; opacity: 0.2; }
            60% { stroke-dashoffset: 0; opacity: 1; }
            100% { stroke-dashoffset: -300; opacity: 0.2; }
          }
          .suitcase-path { stroke-dasharray: 300; animation: drawCase 2.4s ease-in-out infinite; }
        `}</style>
        <rect className="suitcase-path" x="6" y="18" width="68" height="40" rx="4" stroke="#2d5a18" strokeWidth="1.5" fill="none"/>
        <rect className="suitcase-path" x="26" y="6" width="28" height="14" rx="2" stroke="#2d5a18" strokeWidth="1.5" fill="none" style={{ animationDelay: '0.2s' }}/>
        <line className="suitcase-path" x1="6" y1="32" x2="74" y2="32" stroke="#2d5a18" strokeWidth="1" style={{ animationDelay: '0.4s' }}/>
        <line x1="38" y1="18" x2="38" y2="58" stroke="#2d5a18" strokeWidth="0.5" strokeDasharray="3 3" opacity="0.4"/>
        <circle cx="18" cy="62" r="3.5" stroke="#2d5a18" strokeWidth="1.5" fill="none"/>
        <circle cx="62" cy="62" r="3.5" stroke="#2d5a18" strokeWidth="1.5" fill="none"/>
      </svg>
      <p style={{ fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#2d5a18' }}>{message}{dots}</p>
    </div>
  )
}
