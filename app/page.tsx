'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import AvantiLogo from './components/AvantiLogo'
import Footer from './components/Footer'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        const { data: profile } = await supabase.from('user_profiles').select('profile_complete').eq('user_id', session.user.id).maybeSingle()
        if (profile?.profile_complete) {
          router.push('/dashboard')
        } else {
          router.push('/profile')
        }
      }
    }
    checkSession()
  }, [router])

  const [mode, setMode] = useState<'landing' | 'signin' | 'signup'>('landing')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [rememberMe, setRememberMe] = useState(true)

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) { setError(error.message); setLoading(false); return }
    router.push('/profile')
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false); return }
    const { data: profile } = await supabase.from('user_profiles').select('profile_complete').eq('user_id', data.user.id).maybeSingle()
    if (!profile?.profile_complete) { router.push('/profile') } else { router.push('/dashboard') }
  }

  const handleSubmit = () => {
    const e = { preventDefault: () => {} } as React.FormEvent
    if (mode === 'signup') handleSignUp(e)
    else handleSignIn(e)
  }

  const handleGoogle = async () => {
    await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/auth/callback` } })
  }

  const inputStyle = { width: '100%', borderBottom: '1px solid #d4d4c8', background: 'transparent', padding: '10px 0', fontSize: '14px', color: '#1a1a1a', outline: 'none', fontFamily: 'var(--font-cormorant), Georgia, serif' }
  const labelStyle = { fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase' as const, color: '#9a9a8a', display: 'block', marginBottom: '8px' }

  if (mode === 'landing') return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: '100%', background: '#fafaf8' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
      <div style={{ marginBottom: '64px' }}><AvantiLogo size="lg" /></div>
      <p style={{ fontSize: '11px', letterSpacing: '0.25em', textTransform: 'uppercase', color: '#9a9a8a', marginBottom: '6px' }}>Avanti handles it.</p>
      <p style={{ fontSize: '11px', letterSpacing: '0.25em', textTransform: 'uppercase', color: '#9a9a8a', marginBottom: '64px' }}>You just show up.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', maxWidth: '280px' }}>
        <button onClick={() => setMode('signup')} style={{ width: '100%', border: '1px solid #1a1a1a', padding: '14px', fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', color: '#1a1a1a', background: 'transparent', cursor: 'pointer', fontFamily: 'var(--font-cormorant), Georgia, serif', transition: 'all 0.3s' }}
          onMouseEnter={e => { (e.target as HTMLButtonElement).style.background = '#1a1a1a'; (e.target as HTMLButtonElement).style.color = '#fafaf8' }}
          onMouseLeave={e => { (e.target as HTMLButtonElement).style.background = 'transparent'; (e.target as HTMLButtonElement).style.color = '#1a1a1a' }}>
          Create account
        </button>
        <button onClick={() => setMode('signin')} style={{ width: '100%', border: '1px solid #d4d4c8', padding: '14px', fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', color: '#9a9a8a', background: 'transparent', cursor: 'pointer', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
          Sign in
        </button>
      </div>
      </div>
      <Footer />
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: '100%', background: '#fafaf8' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
      <div style={{ width: '100%', maxWidth: '320px' }}>
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <AvantiLogo size="md" />
          <p style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#083807', marginTop: '20px' }}>{mode === 'signup' ? 'Create your account' : 'Welcome back'}</p>
        </div>
        <button onClick={handleGoogle} style={{ width: '100%', border: '1px solid #d4d4c8', padding: '14px', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#6a6a6a', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '24px', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
          <svg width="14" height="14" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
          Continue with Google
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
          <div style={{ flex: 1, height: '1px', background: '#e4e4d8' }}></div>
          <span style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#c4c4b8' }}>or</span>
          <div style={{ flex: 1, height: '1px', background: '#e4e4d8' }}></div>
        </div>
        <form onSubmit={mode === 'signup' ? handleSignUp : handleSignIn} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {error && <p style={{ fontSize: '12px', color: '#c0392b', textAlign: 'center' }}>{error}</p>}
          <div><label style={labelStyle}>Email</label><input type="email" required value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} placeholder="your@email.com" /></div>
          <div><label style={labelStyle}>Password</label><input type="password" required value={password} onChange={e => setPassword(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit() }} style={inputStyle} placeholder="••••••••" /></div>
          {mode === 'signin' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
              <input type="checkbox" id="remember" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} style={{ cursor: 'pointer' }} />
              <label htmlFor="remember" style={{ fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9a9a8a', cursor: 'pointer', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>Keep me signed in</label>
            </div>
          )}
          <button type="submit" disabled={loading} style={{ width: '100%', border: '1px solid #083807', padding: '14px', fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', color: '#ffffff', background: '#083807', cursor: 'pointer', marginTop: '8px', fontFamily: 'var(--font-cormorant), Georgia, serif', opacity: loading ? 0.5 : 1 }}>
            {loading ? 'Please wait...' : mode === 'signup' ? 'Create account' : 'Sign in'}
          </button>
        </form>
        <button onClick={() => setMode(mode === 'signup' ? 'signin' : 'signup')} style={{ width: '100%', textAlign: 'center', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#9a9a8a', background: 'none', border: 'none', cursor: 'pointer', marginTop: '20px' }}>
          {mode === 'signup' ? 'Already have an account? Sign in' : "Don't have an account? Create one"}
        </button>
        <button onClick={() => setMode('landing')} style={{ width: '100%', textAlign: 'center', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#c4c4b8', background: 'none', border: 'none', cursor: 'pointer', marginTop: '8px' }}>← Back</button>
      </div>
      </div>
      <Footer />
    </div>
  )
}
