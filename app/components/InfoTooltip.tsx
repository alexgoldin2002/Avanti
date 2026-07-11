'use client'

import { useState, type ReactNode } from 'react'

/**
 * Small info-icon that reveals a helpful popup on hover / focus / tap.
 * Styled to match Avanti (serif, forest green) rather than the airline blue.
 */
export default function InfoTooltip({
  title,
  children,
  label = 'More information',
}: {
  title?: string
  children: ReactNode
  label?: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <span
      style={{ position: 'relative', display: 'inline-flex', verticalAlign: 'middle', marginLeft: '6px' }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        style={{
          width: '16px',
          height: '16px',
          borderRadius: '50%',
          border: '1.5px solid #2d6a4f',
          background: 'transparent',
          color: '#2d6a4f',
          fontSize: '11px',
          lineHeight: 1,
          fontStyle: 'italic',
          fontFamily: 'Georgia, serif',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          padding: 0,
        }}
      >
        i
      </button>

      {open && (
        <span
          role="tooltip"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            left: 0,
            zIndex: 40,
            width: '240px',
            maxWidth: '78vw',
            background: 'var(--card, #ffffff)',
            border: '1px solid #e8e8e0',
            borderRadius: '6px',
            boxShadow: '0 8px 24px rgba(24, 45, 9, 0.14)',
            padding: '12px 14px',
            textAlign: 'left',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            textTransform: 'none',
            letterSpacing: 0,
            cursor: 'default',
          }}
        >
          {title && (
            <span style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--foreground)', marginBottom: '4px' }}>
              {title}
            </span>
          )}
          <span style={{ display: 'block', fontSize: '12px', color: 'var(--muted-foreground)', lineHeight: 1.55 }}>
            {children}
          </span>
        </span>
      )}
    </span>
  )
}
