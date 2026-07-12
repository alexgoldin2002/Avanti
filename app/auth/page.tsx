'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Footer from '../components/Footer'
import PhoneAuthForm from '../components/PhoneAuthForm'
import { resolvePostAuthPath } from '@/lib/preview-trip-storage'
import { authCallbackUrl } from '@/lib/auth/oauth'
import { syncUserPhoneToProfile } from '@/lib/auth/sync-user-phone'
import { SIGNUP_PASSWORD_HINT, validateSignupPassword } from '@/lib/auth/password-strength'

function AuthPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialMode = searchParams.get('mode') === 'signin' ? 'signin' : 'signup'
  const nextParam = searchParams.get('next')

  const [authMode, setAuthMode] = useState<'signin' | 'signup'>(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [rememberMe, setRememberMe] = useState(true)
  const [authChannel, setAuthChannel] = useState<'email' | 'phone'>('email')

  useEffect(() => {
    const oauthError = searchParams.get('error')
    if (oauthError) {
      setError(decodeURIComponent(oauthError))
    }
  }, [searchParams])

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('profile_complete')
          .eq('user_id', session.user.id)
          .maybeSingle()
        router.replace(resolvePostAuthPath(Boolean(profile?.profile_complete), nextParam))
      }
    }
    void checkSession()
  }, [router, nextParam])

  const finishAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    if (user.phone) await syncUserPhoneToProfile(user.id, user.phone)
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('profile_complete')
      .eq('user_id', user.id)
      .maybeSingle()
    router.push(resolvePostAuthPath(Boolean(profile?.profile_complete), nextParam))
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const passwordError = validateSignupPassword(password, email)
    if (passwordError) {
      setError(passwordError)
      setLoading(false)
      return
    }
    const { error: signUpError } = await supabase.auth.signUp({ email, password })
    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }
    router.push(resolvePostAuthPath(false, nextParam))
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
    router.push(resolvePostAuthPath(Boolean(profile?.profile_complete), nextParam))
  }

  const handleGoogle = async () => {
    setError('')
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: authCallbackUrl(nextParam) },
    })
    if (oauthError) {
      setError(oauthError.message)
    }
  }

  return (
    <div className="min-h-screen bg-forest-deep text-cream flex flex-col">
      <header className="px-6 md:px-10 py-6">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <Link href="/" className="font-serif tracking-[0.45em] text-cream text-lg">
            AVANTI
          </Link>
          <Link href="/#try-it" className="eyebrow text-cream/70 hover:text-cream transition">
            Try it first
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md bg-cream text-forest-deep p-8 md:p-10 shadow-2xl">
          <div className="text-center mb-8">
            <p className="font-serif tracking-[0.45em] text-forest-deep text-lg">AVANTI</p>
            <p className="eyebrow text-forest/80 mt-4">
              {authMode === 'signup' ? 'Create your account' : 'Welcome back'}
            </p>
            <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
              Sign in to create a trip, invite your group, and unlock voting.
            </p>
          </div>

          {error && authChannel === 'email' && (
            <p className="text-sm text-center text-destructive mb-4">{error}</p>
          )}

          <button
            type="button"
            onClick={() => void handleGoogle()}
            className="w-full border border-border px-4 py-3 eyebrow text-muted-foreground hover:bg-ivory transition flex items-center justify-center gap-2 mb-6"
          >
            Continue with Google
          </button>

          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 h-px bg-border" />
            <span className="eyebrow text-muted-foreground/70">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <div className="flex border border-border mb-6">
            <button
              type="button"
              onClick={() => { setAuthChannel('email'); setError('') }}
              className={`flex-1 py-2.5 eyebrow transition ${authChannel === 'email' ? 'bg-forest-deep text-cream' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Email
            </button>
            <button
              type="button"
              onClick={() => { setAuthChannel('phone'); setError('') }}
              className={`flex-1 py-2.5 eyebrow transition ${authChannel === 'phone' ? 'bg-forest-deep text-cream' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Phone
            </button>
          </div>

          {authChannel === 'email' ? (
            <form onSubmit={authMode === 'signup' ? handleSignUp : handleSignIn} className="flex flex-col gap-5">
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
                  minLength={authMode === 'signup' ? 10 : undefined}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full border-b border-border bg-transparent py-2 font-serif text-foreground outline-none"
                  placeholder="••••••••"
                />
                {authMode === 'signup' && (
                  <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{SIGNUP_PASSWORD_HINT}</p>
                )}
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
          ) : (
            <PhoneAuthForm
              onSuccess={finishAuth}
              loading={loading}
              setLoading={setLoading}
              error={error}
              setError={setError}
            />
          )}

          <button
            type="button"
            onClick={() => setAuthMode(authMode === 'signup' ? 'signin' : 'signup')}
            className="w-full mt-4 eyebrow text-muted-foreground hover:text-foreground transition"
          >
            {authMode === 'signup' ? 'Already have an account? Sign in' : "Don't have an account? Create one"}
          </button>
        </div>
      </main>

      <Footer variant="marketing" />
    </div>
  )
}

export default function AuthPage() {
  return (
    <Suspense fallback={null}>
      <AuthPageContent />
    </Suspense>
  )
}
