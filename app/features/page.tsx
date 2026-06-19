'use client'
import { useRouter } from 'next/navigation'
import AvantiLogo from '../components/AvantiLogo'

const FEATURE_COLORS = [
  { bg: '#e8f5ee', border: '#9fd4b8', numBg: '#1a6a3e', numText: '#e8f5ee' },
  { bg: '#eaf5e8', border: '#a8d49a', numBg: '#2a7a1e', numText: '#eaf5e8' },
  { bg: '#ecf5e5', border: '#b0d492', numBg: '#327a18', numText: '#ecf5e5' },
  { bg: '#eef5e4', border: '#b8d492', numBg: '#3a7a14', numText: '#eef5e4' },
  { bg: '#f0f5e0', border: '#c8d880', numBg: '#4a7a10', numText: '#f0f5e0' },
  { bg: '#f0f5de', border: '#c8d878', numBg: '#527a0e', numText: '#f0f5de' },
  { bg: '#f1f5dc', border: '#ced87a', numBg: '#5a7a0c', numText: '#f1f5dc' },
  { bg: '#f2f5dc', border: '#d4d878', numBg: '#627a0a', numText: '#f2f5dc' },
  { bg: '#f3f5da', border: '#d8d870', numBg: '#6a7a0a', numText: '#f3f5da' },
  { bg: '#f4f4d8', border: '#dcd870', numBg: '#727a0e', numText: '#f4f4d8' },
  { bg: '#f4f4d6', border: '#dcd468', numBg: '#787810', numText: '#f4f4d6' },
  { bg: '#f5f4d4', border: '#e0d468', numBg: '#7e7812', numText: '#f5f4d4' },
  { bg: '#f5f3d2', border: '#e0d060', numBg: '#827814', numText: '#f5f3d2' },
  { bg: '#f5f2d0', border: '#e0cc58', numBg: '#867616', numText: '#f5f2d0' },
  { bg: '#f5f2ce', border: '#e2cc54', numBg: '#8a7618', numText: '#f5f2ce' },
  { bg: '#f5f2d4', border: '#e0d068', numBg: '#8a7a18', numText: '#f5f2d4' },
]

const FEATURES = [
  { href: '/features/expense-splitting', title: 'Split expenses', live: true },
  { href: '/features/travel-benefits', title: 'Travel benefits', live: true },
  { href: '/features/saved-places', title: 'Saved places', live: true },
  { href: '/features/bookings', title: 'Bookings vault', live: true },
  { href: '/features/game-time', title: 'Game time', live: true },
  { href: '/features/essentials', title: 'Destination essentials', live: true },
  { href: '/features/briefings', title: 'Daily briefings', live: true },
] as const

function FeatureIcon({ index, stroke }: { index: number; stroke: string }) {
  switch (index) {
    case 0:
      return (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 3v18M3 12h18" />
          <circle cx="7" cy="7" r="2" />
          <circle cx="17" cy="7" r="2" />
          <circle cx="7" cy="17" r="2" />
          <circle cx="17" cy="17" r="2" />
        </svg>
      )
    case 1:
      return (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <path d="M2 10h20" />
          <path d="M6 15h3" />
        </svg>
      )
    case 2:
      return (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.5" aria-hidden>
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        </svg>
      )
    case 3:
      return (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.5" aria-hidden>
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <path d="M2 10h20" />
          <path d="M6 15h4" />
        </svg>
      )
    case 4:
      return (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.5" aria-hidden>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </svg>
      )
    case 5:
      return (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.5" aria-hidden>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      )
    case 6:
      return (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.5" aria-hidden>
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      )
    default:
      return null
  }
}

export default function Features() {
  const router = useRouter()
  const s = { fontFamily: 'var(--font-cormorant), Georgia, serif' }

  return (
    <main style={{ minHeight: '100vh', background: '#fafaf8', ...s }}>
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '48px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '48px' }}>
          <AvantiLogo size="sm" />
          <button
            type="button"
            onClick={() => router.push('/dashboard')}
            style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#9a9a8a', background: 'none', border: 'none', cursor: 'pointer', ...s }}
          >
            ← Back
          </button>
        </div>
        <p style={{ fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', color: '#9a9a8a', margin: '0 0 8px' }}>Tools for your trips</p>
        <h1 style={{ fontSize: '40px', fontWeight: 300, color: '#1a1a1a', margin: '0 0 12px', letterSpacing: '-0.5px' }}>Features</h1>
        <p style={{ fontSize: '14px', color: '#9a9a8a', margin: '0 0 40px', lineHeight: 1.6, maxWidth: '520px' }}>
          Pick a feature, then choose a trip. Game-time tools also live on each trip under the <strong style={{ color: '#1a1a1a', fontWeight: 500 }}>Game time</strong> tab.
        </p>

        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', width: '100%', maxWidth: '480px' }}>
            {FEATURE_COLORS.map((colors, i) => {
              const feature = FEATURES[i]
              const clickable = Boolean(feature?.href)

              return (
                <button
                  key={i}
                  type="button"
                  title={feature?.title || ''}
                  onClick={() => feature?.href && router.push(feature.href)}
                  disabled={!clickable}
                  style={{
                    background: colors.bg,
                    border: `0.5px solid ${colors.border}`,
                    borderRadius: '12px',
                    aspectRatio: '1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    cursor: clickable ? 'pointer' : 'default',
                    padding: 0,
                    transition: 'transform 0.15s, box-shadow 0.15s',
                  }}
                  onMouseEnter={e => {
                    if (!clickable) return
                    e.currentTarget.style.transform = 'scale(1.04)'
                    e.currentTarget.style.boxShadow = '0 4px 16px rgba(26,58,42,0.15)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'scale(1)'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                >
                  {feature ? (
                    <FeatureIcon index={i} stroke={colors.numBg} />
                  ) : (
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      background: colors.numBg,
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '16px',
                      fontWeight: 600,
                      fontFamily: 'var(--font-cormorant), Georgia, serif',
                    }}>
                      {i + 1}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ marginTop: '48px', maxWidth: '480px', marginLeft: 'auto', marginRight: 'auto' }}>
          <p style={{ fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', color: '#9a9a8a', margin: '0 0 16px' }}>Available now</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {FEATURES.map((f, i) => (
              <button
                key={f.href}
                type="button"
                onClick={() => router.push(f.href)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '14px 16px',
                  background: '#fff',
                  border: '0.5px solid #e4e4d8',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  width: '100%',
                }}
              >
                <span style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <FeatureIcon index={i} stroke="#1a6a3e" />
                </span>
                <span style={{ fontSize: '15px', color: '#1a1a1a', ...s }}>{f.title}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
