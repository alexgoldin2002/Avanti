import PublicPageShell from '../components/PublicPageShell'

export default function HowItWorksLayout({ children }: { children: React.ReactNode }) {
  return <PublicPageShell maxWidth="max-w-3xl">{children}</PublicPageShell>
}
