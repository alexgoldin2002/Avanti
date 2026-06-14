/** Shared theme tokens for inline styles across the app */
export const theme = {
  cream: 'var(--cream)',
  ivory: 'var(--ivory)',
  forest: 'var(--forest)',
  forestDeep: 'var(--forest-deep)',
  foreground: 'var(--foreground)',
  muted: 'var(--muted-foreground)',
  border: 'var(--border)',
  accentLight: 'var(--accent-light)',
  destructive: 'var(--destructive)',
  fontSerif: 'var(--font-cormorant), Georgia, serif',
  fontSans: 'var(--font-inter), system-ui, sans-serif',
} as const

/** Common inline style snippets */
export const labelStyle = {
  fontSize: '10px',
  letterSpacing: '0.15em',
  textTransform: 'uppercase' as const,
  color: 'var(--muted-foreground)',
  display: 'block' as const,
  marginBottom: '6px',
  fontFamily: theme.fontSans,
}

export const inputStyle = {
  width: '100%',
  borderBottom: '1px solid var(--border)',
  background: 'transparent',
  padding: '8px 0',
  fontSize: '14px',
  color: 'var(--foreground)',
  outline: 'none',
  fontFamily: theme.fontSerif,
}

export const pageStyle = {
  fontFamily: theme.fontSerif,
  background: theme.cream,
  color: theme.foreground,
}
