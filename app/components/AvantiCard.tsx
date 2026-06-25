'use client'

type AvantiCardProps = {
  children: React.ReactNode
  className?: string
  hover?: boolean
  shade?: 'cream' | 'ivory' | 'forest-soft' | 'forest' | 'forest-outlined'
  onClick?: () => void
  as?: 'div' | 'button'
}

const shadeMap = {
  cream: 'bg-card border-border',
  ivory: 'bg-secondary border-border',
  'forest-soft': 'bg-forest-soft/10 border-forest-soft/30 text-foreground',
  forest: 'bg-forest-deep text-cream border-forest-deep',
  'forest-outlined': 'bg-forest-pale/50 border-forest-deep text-foreground',
}

export default function AvantiCard({
  children,
  className = '',
  hover = false,
  shade = 'cream',
  onClick,
  as = 'div',
}: AvantiCardProps) {
  const base = `avanti-box rounded-none border px-5 py-4 ${shadeMap[shade]} ${
    hover ? 'transition-all duration-200 ease-out hover:-translate-y-px hover:[box-shadow:var(--shadow-box-hover)] cursor-pointer group' : ''
  } ${className}`

  if (as === 'button') {
    return (
      <button type="button" onClick={onClick} className={`${base} w-full text-left`}>
        {children}
      </button>
    )
  }

  return <div className={base}>{children}</div>
}
