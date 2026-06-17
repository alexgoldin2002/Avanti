'use client'
import AppNav from './AppNav'

export default function AppShell({
  children,
  userName,
  dark,
}: {
  children: React.ReactNode
  userName?: string
  dark?: boolean
}) {
  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        background: dark ? 'var(--forest-deep)' : 'var(--background)',
        color: dark ? 'var(--cream)' : 'var(--foreground)',
      }}
    >
      <AppNav userName={userName} />
      {children}
    </div>
  )
}
