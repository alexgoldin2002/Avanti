import PublicPageShell from '../components/PublicPageShell'

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return <PublicPageShell maxWidth="max-w-2xl">{children}</PublicPageShell>
}
