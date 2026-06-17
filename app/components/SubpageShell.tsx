'use client'
import Link from 'next/link'

export function BackLink({
  href,
  label = 'Back',
  className = '',
  wrapperClassName = 'mb-6 flex justify-end',
}: {
  href: string
  label?: string
  className?: string
  wrapperClassName?: string
}) {
  return (
    <div className={wrapperClassName}>
      <Link
        href={href}
        className={`group/back flex items-center gap-1.5 text-[10px] tracking-[0.15em] uppercase text-muted-foreground/60 transition-all duration-200 hover:text-foreground ${className}`}
      >
        <i className="ti ti-arrow-left text-sm transition-transform duration-200 group-hover/back:-translate-x-0.5" aria-hidden />
        {label}
      </Link>
    </div>
  )
}

export function PageEyebrow({ children }: { children: React.ReactNode }) {
  return <p className="eyebrow text-muted-foreground mb-2">{children}</p>
}

export function PageTitle({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <h1 className={`font-serif text-4xl font-light text-foreground mb-2 ${className}`}>{children}</h1>
}

export default function SubpageShell({
  children,
  backHref,
  backLabel = 'Back',
  eyebrow,
  title,
  subtitle,
  maxWidth = 'max-w-2xl',
  className = '',
}: {
  children: React.ReactNode
  backHref?: string
  backLabel?: string
  eyebrow?: string
  title?: string
  subtitle?: string
  maxWidth?: string
  className?: string
}) {
  return (
    <main className={`mx-auto w-full ${maxWidth} px-6 sm:px-10 pt-10 pb-24 flex-1 ${className}`}>
      {backHref && <BackLink href={backHref} label={backLabel} />}
      {eyebrow && <PageEyebrow>{eyebrow}</PageEyebrow>}
      {title && <PageTitle>{title}</PageTitle>}
      {subtitle && <p className="text-sm text-muted-foreground mb-8 font-serif italic">{subtitle}</p>}
      {children}
    </main>
  )
}
