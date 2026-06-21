'use client'

type BookSearchLinkProps = {
  href: string
  label?: string
  variant?: 'primary' | 'ghost'
  className?: string
}

export default function BookSearchLink({
  href,
  label = 'Search & book →',
  variant = 'ghost',
  className = '',
}: BookSearchLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={
        variant === 'primary'
          ? `avanti-btn avanti-btn-primary inline-flex ${className}`
          : `avanti-btn avanti-btn-ghost inline-flex text-xs ${className}`
      }
    >
      {label}
    </a>
  )
}
