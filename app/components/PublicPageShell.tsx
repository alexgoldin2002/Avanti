import AppShell from './AppShell'
import Footer from './Footer'
import { BackLink } from './SubpageShell'

export default function PublicPageShell({
  children,
  maxWidth = 'max-w-3xl',
}: {
  children: React.ReactNode
  maxWidth?: string
}) {
  return (
    <AppShell>
      <div className={`mx-auto w-full ${maxWidth} px-6 sm:px-10 pt-10 pb-16 flex-1`}>
        <BackLink href="/" />
        {children}
      </div>
      <Footer variant="marketing" />
    </AppShell>
  )
}
