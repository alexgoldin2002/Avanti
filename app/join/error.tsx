'use client'

export default function JoinError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div
      style={{
        minHeight: '60vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        fontFamily: 'var(--font-cormorant), Georgia, serif',
        background: 'var(--cream)',
      }}
    >
      <div style={{ maxWidth: '420px', textAlign: 'center' }}>
        <p style={{ fontSize: '32px', margin: '0 0 16px' }}>⚠️</p>
        <h1 style={{ fontSize: '28px', fontWeight: 300, margin: '0 0 12px', color: 'var(--foreground)' }}>
          Something went wrong
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--muted-foreground)', lineHeight: 1.7, margin: '0 0 24px' }}>
          We couldn&apos;t finish joining this trip. Please reload and try again.
        </p>
        {error.message && (
          <p style={{ fontSize: '12px', color: '#c0392b', margin: '0 0 24px', lineHeight: 1.6 }}>
            {error.message}
          </p>
        )}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
          <button
            type="button"
            onClick={reset}
            style={{
              border: '1px solid var(--forest-deep)',
              background: 'var(--forest-deep)',
              color: '#fff',
              padding: '12px 18px',
              fontSize: '10px',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() => { window.location.href = '/' }}
            style={{
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--foreground)',
              padding: '12px 18px',
              fontSize: '10px',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            Go home
          </button>
        </div>
      </div>
    </div>
  )
}
