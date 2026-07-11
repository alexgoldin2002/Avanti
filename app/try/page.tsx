'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Footer from '../components/Footer'
import HomeTripPlanner from '../components/HomeTripPlanner'

function TryPageContent() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="bg-forest-deep px-6 md:px-10 py-5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="font-serif tracking-[0.45em] text-cream text-lg" aria-label="Avanti home">
            AVANTI
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/auth?mode=signin" className="eyebrow text-cream/80 hover:text-cream transition">
              Log in
            </Link>
            <Link
              href="/auth?mode=signup"
              className="eyebrow text-cream border border-cream/60 px-4 py-2 hover:bg-cream hover:text-forest-deep transition"
            >
              Create account
            </Link>
          </div>
        </div>
      </header>

      <HomeTripPlanner
        onSignupRequest={() => router.push('/auth?mode=signup&from=try')}
        onSigninRequest={() => router.push('/auth?mode=signin&from=try')}
      />

      <Footer variant="marketing" />
    </div>
  )
}

export default function TryPage() {
  return (
    <Suspense fallback={null}>
      <TryPageContent />
    </Suspense>
  )
}
