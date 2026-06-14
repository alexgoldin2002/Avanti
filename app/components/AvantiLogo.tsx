import Link from 'next/link'

type LogoVariant = 'light' | 'dark'

export default function AvantiLogo({
  size = 'md',
  variant = 'light',
  href = '/dashboard',
}: {
  size?: 'sm' | 'md' | 'lg'
  variant?: LogoVariant
  href?: string
}) {
  const sizes = { sm: '0.35em', md: '0.42em', lg: '0.45em' }
  const fontSizes = { sm: '14px', md: '18px', lg: '22px' }
  const color = variant === 'dark' ? 'var(--cream)' : 'var(--forest-deep)'

  return (
    <Link
      href={href}
      style={{
        textDecoration: 'none',
        cursor: 'pointer',
        fontFamily: 'var(--font-cormorant), Georgia, serif',
        fontSize: fontSizes[size],
        letterSpacing: sizes[size],
        color,
        fontWeight: 400,
        lineHeight: 1,
      }}
      aria-label="Avanti home"
    >
      AVANTI
    </Link>
  )
}
