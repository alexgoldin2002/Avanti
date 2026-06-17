import AppShell from '../components/AppShell'

export default function CreateLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>
}
