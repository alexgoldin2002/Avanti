import PublicPageShell from '../components/PublicPageShell'

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return <PublicPageShell maxWidth="max-w-xl">{children}</PublicPageShell>
}
