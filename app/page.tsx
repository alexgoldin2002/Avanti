'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import Footer from './components/Footer'

const panels = [
  {
    eyebrow: '1',
    title: 'The People',
    body: 'You bring the group. We bring the rhythm that keeps them together.',
    label: 'PEOPLE',
  },
  {
    eyebrow: '2',
    title: 'The Plan',
    body: 'Itineraries, reservations, logistics — quietly handled before you board.',
    label: 'PLAN',
  },
  {
    eyebrow: '3',
    title: 'The Place',
    body: 'Rooms, tables, and corners worth flying for. Booked, confirmed, yours.',
    label: 'PLACE',
  },
]

export default function Home() {
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [authMode, setAuthMode] = useState<'signin' | 'signup' | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [rememberMe, setRememberMe] = useState(true)

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('profile_complete')
          .eq('user_id', session.user.id)
          .maybeSingle()
        if (profile?.profile_complete) router.push('/dashboard')
        else router.push('/profile')
      }
    }
    checkSession()
  }, [router])

  const openAuth = (mode: 'signin' | 'signup') => {
    setAuthMode(mode)
    setError('')
    setMenuOpen(false)
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error: signUpError } = await supabase.auth.signUp({ email, password })
    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }
    router.push('/profile')
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) {
      setError(signInError.message)
      setLoading(false)
      return
    }
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('profile_complete')
      .eq('user_id', data.user.id)
      .maybeSingle()
    if (!profile?.profile_complete) router.push('/profile')
    else router.push('/dashboard')
  }

  const handleGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="relative inset-x-0 top-0 z-30 bg-forest-deep">
        <div className="grid grid-cols-3 items-center px-6 md:px-10 py-6 max-w-[1400px] mx-auto">
          <div className="flex items-center">
            <button
              className="md:hidden flex flex-col gap-1.5 p-2 -ml-2"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Toggle menu"
            >
              <span className="block w-6 h-0.5 bg-cream" />
              <span className="block w-6 h-0.5 bg-cream" />
              <span className="block w-6 h-0.5 bg-cream" />
            </button>
            <nav className="hidden md:flex items-center gap-8 eyebrow text-cream/90">
              <Link href="/how-it-works" className="hover:opacity-70 transition">How it works</Link>
              <Link href="/about" className="hover:opacity-70 transition">About</Link>
              <Link href="/contact" className="hover:opacity-70 transition">Contact</Link>
            </nav>
          </div>

          <div className="flex justify-center">
            <Link href="/" className="font-serif tracking-[0.45em] text-cream text-lg md:text-xl" aria-label="Avanti home">
              AVANTI
            </Link>
          </div>

          <div className="flex justify-end items-center gap-6 eyebrow text-cream/90">
            <button type="button" onClick={() => openAuth('signin')} className="hidden md:inline hover:opacity-70 transition">
              Sign in
            </button>
            <button
              type="button"
              onClick={() => openAuth('signup')}
              className="border border-cream/60 px-4 py-2 hover:bg-cream hover:text-forest-deep transition"
            >
              Create account
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="md:hidden absolute top-full left-0 right-0 bg-forest-deep/95 backdrop-blur-sm border-t border-cream/10 px-6 py-8 z-40">
            <nav className="flex flex-col gap-6 eyebrow text-cream/90 text-lg">
              <Link href="/how-it-works" onClick={() => setMenuOpen(false)}>How it works</Link>
              <Link href="/about" onClick={() => setMenuOpen(false)}>About</Link>
              <Link href="/contact" onClick={() => setMenuOpen(false)}>Contact</Link>
              <button type="button" onClick={() => openAuth('signin')}>Sign in</button>
            </nav>
          </div>
        )}
      </header>

      <section className="relative flex-1 bg-forest-deep">
        <div className="relative z-10 pt-32 md:pt-40 pb-24 md:pb-32 flex flex-col items-center text-center px-6 min-h-[85vh] justify-center overflow-hidden">
          <video
            src="https://res.cloudinary.com/dyzhzd5h2/video/upload/v1781584118/Video_uudexh.mp4"
            autoPlay
            muted
            loop
            playsInline
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            className="absolute inset-0 grayscale"
            aria-hidden
          />
          <div className="absolute inset-0 bg-cream/70" aria-hidden />

          <div className="relative z-10">
            <p className="eyebrow text-forest-deep/70 mb-6">Group travel, Handled · Est. 2026</p>
            <h1
              className="font-serif text-forest-deep leading-[0.9] italic"
              style={{ fontSize: 'clamp(4.5rem, 16vw, 16rem)', letterSpacing: '0.02em', fontWeight: 400 }}
            >
              {'AVANTI'.split('').map((letter, i) => (
                <span key={i} className="animate-letter" style={{ animationDelay: `${i * 0.08}s` }}>
                  {letter}
                </span>
              ))}
            </h1>
            <p className="mt-8 font-serif italic text-forest-deep/85 text-xl md:text-2xl max-w-md leading-snug mx-auto">
              All the dream. None of the nightmare.
            </p>
            <button
              type="button"
              onClick={() => openAuth('signup')}
              className="mt-10 inline-block bg-forest-deep text-cream eyebrow px-10 py-4 hover:opacity-90 transition"
            >
              Let&apos;s get planning
            </button>
          </div>
        </div>

        <div className="relative z-10 border-t border-cream/15 bg-forest-deep">
          <div className="grid grid-cols-1 md:grid-cols-3 max-w-[1400px] mx-auto">
            {panels.map((p, i) => (
              <button
                key={p.label}
                type="button"
                onClick={() => openAuth('signup')}
                className={`group relative flex flex-col justify-between p-8 md:p-10 min-h-[50vh] md:min-h-[60vh] border-cream/15 text-left w-full ${
                  i > 0 ? 'md:border-l' : ''
                } ${i < panels.length - 1 ? 'border-b md:border-b-0' : ''} transition-colors hover:bg-cream/90 hover:text-forest-deep`}
              >
                <div className="flex items-start justify-between text-cream/70 group-hover:text-forest-deep/70 transition-colors">
                  <span className="eyebrow">{p.eyebrow}</span>
                </div>
                <div className="py-12">
                  <h2
                    className="font-serif leading-[0.95] text-cream group-hover:text-forest-deep transition-colors"
                    style={{ fontSize: 'clamp(3rem, 7vw, 6rem)', letterSpacing: '-0.01em' }}
                  >
                    {p.title}
                  </h2>
                  <p className="mt-6 max-w-xs text-cream/80 group-hover:text-forest-deep/80 transition-colors text-base md:text-lg leading-relaxed">
                    {p.body}
                  </p>
                </div>
                <span className="eyebrow text-cream/60 group-hover:text-forest-deep/60 transition-colors">{p.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="relative z-10 border-t border-cream/15 px-6 md:px-10 py-10 flex flex-col md:flex-row items-center justify-between gap-6 bg-forest-deep max-w-[1400px] mx-auto w-full">
          <p className="eyebrow text-cream/70 text-center md:text-left">
            THE ONLY TRAVEL APP THAT THINKS FOR EVERYONE AND OF EVERYTHING
          </p>
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => openAuth('signup')}
              className="bg-cream text-forest-deep eyebrow px-8 py-4 hover:bg-cream/90 transition"
            >
              Create account
            </button>
            <button type="button" onClick={() => openAuth('signin')} className="eyebrow text-cream border-b border-cream/60 pb-1 hover:opacity-70 transition">
              Sign in
            </button>
          </div>
        </div>
      </section>

      <Footer variant="marketing" />

      {authMode && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-forest-deep/80 backdrop-blur-sm p-6"
          onClick={() => setAuthMode(null)}
        >
          <div
            className="w-full max-w-md bg-cream p-8 md:p-10 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="text-center mb-8">
              <p className="font-serif tracking-[0.45em] text-forest-deep text-lg">AVANTI</p>
              <p className="eyebrow text-forest/80 mt-4">
                {authMode === 'signup' ? 'Create your account' : 'Welcome back'}
              </p>
            </div>

            <button
              type="button"
              onClick={handleGoogle}
              className="w-full border border-border px-4 py-3 eyebrow text-muted-foreground hover:bg-ivory transition flex items-center justify-center gap-2 mb-6"
            >
              Continue with Google
            </button>

            <div className="flex items-center gap-4 mb-6">
              <div className="flex-1 h-px bg-border" />
              <span className="eyebrow text-muted-foreground/70">or</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <form onSubmit={authMode === 'signup' ? handleSignUp : handleSignIn} className="flex flex-col gap-5">
              {error && <p className="text-sm text-center" style={{ color: 'var(--destructive)' }}>{error}</p>}
              <div>
                <label className="eyebrow text-muted-foreground block mb-2">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full border-b border-border bg-transparent py-2 font-serif text-foreground outline-none"
                  placeholder="your@email.com"
                />
              </div>
              <div>
                <label className="eyebrow text-muted-foreground block mb-2">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full border-b border-border bg-transparent py-2 font-serif text-foreground outline-none"
                  placeholder="••••••••"
                />
              </div>
              {authMode === 'signin' && (
                <label className="flex items-center gap-2 eyebrow text-muted-foreground cursor-pointer">
                  <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} />
                  Keep me signed in
                </label>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-forest-deep text-cream eyebrow py-4 hover:opacity-90 transition disabled:opacity-50"
              >
                {loading ? 'Please wait...' : authMode === 'signup' ? 'Create account' : 'Sign in'}
              </button>
            </form>

            <button
              type="button"
              onClick={() => setAuthMode(authMode === 'signup' ? 'signin' : 'signup')}
              className="w-full mt-4 eyebrow text-muted-foreground hover:text-foreground transition"
            >
              {authMode === 'signup' ? 'Already have an account? Sign in' : "Don't have an account? Create one"}
            </button>
            <button type="button" onClick={() => setAuthMode(null)} className="w-full mt-2 eyebrow text-muted-foreground/70">
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
