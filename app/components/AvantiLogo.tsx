import Link from 'next/link'
export default function AvantiLogo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: { text: '24px', px: '24px', py: '8px' }, md: { text: '40px', px: '40px', py: '12px' }, lg: { text: '64px', px: '60px', py: '18px' } }
  const s = sizes[size]
  return (
    <Link href="/dashboard" style={{ textDecoration: 'none', cursor: 'pointer' }}>
      <div style={{ display: 'inline-block', position: 'relative' }}>
        <div style={{ clipPath: 'polygon(4% 0%, 100% 0%, 96% 100%, 0% 100%)', border: '1px solid #083807', padding: `${s.py} ${s.px}` }}>
          <span style={{
            fontSize: s.text,
            fontWeight: 300,
            letterSpacing: '0.3em',
            color: '#083807',
            fontFamily: 'var(--font-cormorant), Georgia, serif',
            textTransform: 'uppercase',
            fontStyle: 'oblique 8deg'
          }}>AVANTI</span>
        </div>
      </div>
    </Link>
  )
}
