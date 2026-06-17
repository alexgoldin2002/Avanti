import AppShell from '../components/AppShell'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <AppShell dark>{children}</AppShell>
}
