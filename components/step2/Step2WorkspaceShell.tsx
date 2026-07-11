'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { BackLink } from '@/app/components/SubpageShell'

type Step2WorkspaceShellProps = {
  tripId: string
  tripName?: string | null
  backHref?: string
  backLabel?: string
  eyebrow?: string
  stepLabel?: string
  subtitle?: string
  changePathLabel?: string
  onChangePath?: () => void
  startOverLabel?: string
  onStartOver?: () => void
  maxWidth?: string
  children: ReactNode
  footer?: ReactNode
}

export default function Step2WorkspaceShell({
  tripId,
  tripName,
  backHref,
  backLabel = 'Back',
  eyebrow,
  stepLabel,
  subtitle,
  changePathLabel,
  onChangePath,
  startOverLabel,
  onStartOver,
  maxWidth = 'max-w-xl',
  children,
  footer,
}: Step2WorkspaceShellProps) {
  const eyebrowText =
    eyebrow ?? (stepLabel ? `Step ${stepLabel} · Your trip` : undefined)

  return (
    <main className="min-h-[calc(100vh-4.5rem)] bg-cream pb-40 font-serif">
      <div className={`mx-auto px-6 pt-6 sm:pt-8 ${maxWidth}`}>
        <BackLink
          href={backHref ?? `/trips/${tripId}`}
          label={backLabel}
          wrapperClassName="mb-6 sm:mb-8 flex justify-end"
        />

        {(eyebrowText || tripName || subtitle || onChangePath || onStartOver) && (
          <header className="text-center mb-10 sm:mb-12">
            {eyebrowText && (
              <p className="text-[8px] uppercase tracking-[0.22em] text-muted-foreground/80 font-sans mb-2">{eyebrowText}</p>
            )}
            {tripName && (
              <Link
                href={`/trips/${tripId}`}
                className="font-serif text-[36px] sm:text-[44px] font-light text-foreground hover:opacity-70 transition-opacity inline-block leading-[1.1] tracking-[0.01em]"
              >
                {tripName}
              </Link>
            )}
            {subtitle && (
              <p className="text-sm sm:text-[15px] text-muted-foreground mt-4 mb-0 leading-relaxed max-w-md mx-auto font-serif">
                {subtitle}
              </p>
            )}
            {onChangePath && changePathLabel && (
              <button
                type="button"
                onClick={onChangePath}
                className="block mx-auto mt-3 bg-transparent border-0 p-0 cursor-pointer text-[8px] uppercase tracking-[0.12em] text-muted-foreground/80 hover:text-foreground transition-colors font-serif"
              >
                {changePathLabel}
              </button>
            )}
            {onStartOver && startOverLabel && (
              <button
                type="button"
                onClick={onStartOver}
                className="block mx-auto mt-2 bg-transparent border-0 p-0 cursor-pointer text-[8px] uppercase tracking-[0.12em] text-destructive/70 hover:text-destructive transition-colors font-serif"
              >
                {startOverLabel}
              </button>
            )}
          </header>
        )}

        <div className="text-left">{children}</div>
      </div>
      {footer}
    </main>
  )
}
