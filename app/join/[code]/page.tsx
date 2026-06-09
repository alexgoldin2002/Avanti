'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import AvantiLogo from '../../components/AvantiLogo'
import SuitcaseLoader from '../../components/SuitcaseLoader'

export default function JoinTrip() {
  const params = useParams()
  const router = useRouter()
  const code = params.code as string
  const [trip, setTrip] = useState<any>(null)
  const [organizer, setOrganizer] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [nickname, setNickname] = useState('')
  const [step, setStep] = useState<'landing' | 'nickname'>('landing')
  const [user, setUser] = useState<any>(null)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signup')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState('')
  const [linkClosed, setLinkClosed] = useState(false)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      const { data: tripData } = await supabase.from('trips').select('*').eq('invite_code', code).maybeSingle()
      if (tripData?.invites_closed) {
        setLinkClosed(true)
        setLoading(false)
        return
      }
      if (tripData) {
        setTrip(tripData)
        const { data: orgData } = await supabase.from('travelers').select('*').eq('trip_id', tripData.id).eq('role', 'organizer').single()
        if (orgData) setOrganizer(orgData)
      }
      setLoading(false)
    }
    init()
  }, [code])

  const handleAccept = async () => {
    if (linkClosed) return
    if (!user) {
      localStorage.setItem('pending_join_code', code)
      setShowAuthModal(true)
      return
    }
    setStep('nickname')
  }

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthLoading(true)
    setAuthError('')
    if (authMode === 'signup') {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) { setAuthError(error.message); setAuthLoading(false); return }
      if (data.user) {
        setUser(data.user)
        setShowAuthModal(false)
        localStorage.setItem('pending_join_code', code)
        router.push('/profile?fromInvite=true&code=' + code)
      }
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) { setAuthError(error.message); setAuthLoading(false); return }
      if (data.user) {
        setUser(data.user)
        setShowAuthModal(false)
        setStep('nickname')
      }
    }
    setAuthLoading(false)
  }

  const handleJoin = async () => {
    setJoining(true)
    console.log('Joining trip:', trip?.id, 'user:', user?.id, 'nickname:', nickname)
    const { data: profile } = await supabase.from('user_profiles').select('*').eq('user_id', user.id).maybeSingle()
    console.log('Profile found:', profile)
    const { data: existing } = await supabase.from('travelers').select('id').eq('trip_id', trip.id).eq('email', profile?.email || '').maybeSingle()
    console.log('Existing traveler:', existing)
    if (!existing) {
      const { error } = await supabase.from('travelers').insert({
        trip_id: trip.id,
        full_name: profile?.full_name || '',
        email: profile?.email || user?.email || '',
        nickname: nickname || profile?.full_name?.split(' ')[0] || '',
        role: 'member',
        profile_complete: !!profile?.profile_complete,
        status: 'pending',
        user_id: user.id,
      })
      console.log('Insert error:', error)
    }
    localStorage.removeItem('pending_join_code')
    window.location.href = `/join/pending?trip=${encodeURIComponent(trip.name)}&tripId=${trip.id}`
  }

  const s = { fontFamily: 'var(--font-cormorant), Georgia, serif' }
  const inputStyle = { width: '100%', borderBottom: '1px solid #d4d4c8', background: 'transparent', padding: '10px 0', fontSize: '15px', color: '#1a1a1a', outline: 'none', ...s }
  const labelStyle = { fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase' as const, color: '#9a9a8a', display: 'block', marginBottom: '6px' }

  if (loading) return <SuitcaseLoader message="Loading invitation" />
  if (linkClosed) return (
    <main style={{ minHeight: '100vh', background: '#fafaf8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
      <div style={{ textAlign: 'center', padding: '24px', maxWidth: '360px' }}>
        <div style={{ marginBottom: '24px' }}><AvantiLogo size="sm" /></div>
        <div style={{ fontSize: '32px', marginBottom: '16px' }}>🔒</div>
        <h2 style={{ fontSize: '24px', fontWeight: 300, color: '#1a1a1a', margin: '0 0 10px' }}>Invite link closed</h2>
        <p style={{ fontSize: '13px', color: '#9a9a8a', lineHeight: 1.7 }}>The organizer has closed this trip to new guests. If you think this is a mistake, reach out to the trip organizer directly.</p>
      </div>
    </main>
  )
  if (!trip) return (
    <main style={{ minHeight: '100vh', background: '#fafaf8', display: 'flex', alignItems: 'center', justifyContent: 'center', ...s }}>
      <div style={{ textAlign: 'center', padding: '24px' }}>
        <AvantiLogo size="sm" />
        <p style={{ fontSize: '14px', color: '#9a9a8a', marginTop: '24px' }}>This invite link is invalid or has expired.</p>
      </div>
    </main>
  )

  const organizerName = organizer?.nickname || organizer?.full_name?.split(' ')[0] || 'Someone'

  return (
    <main style={{ minHeight: '100vh', background: '#fafaf8', ...s }}>
      <div style={{ position: 'relative', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>

        <div style={{ width: '100%', maxWidth: '420px', filter: showAuthModal ? 'blur(2px)' : 'none', transition: 'filter 0.2s' }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <AvantiLogo size="md" />
          </div>

          {step === 'landing' && (
            <>
              <div style={{ background: trip.cover_color || '#182D09', borderRadius: '12px', padding: '28px 24px', marginBottom: '24px', position: 'relative', overflow: 'hidden' }}>
                {trip.cover_image && <img src={trip.cover_image} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.4 }} />}
                <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
                  <p style={{ fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', margin: '0 0 10px' }}>{organizerName} has invited you to join</p>
                  <h2 style={{ fontSize: '28px', fontWeight: 300, color: '#ffffff', margin: '0 0 6px', ...s }}>{trip.name}</h2>
                  <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.65)', margin: '0 0 4px' }}>{trip.destination}</p>
                  <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)', margin: 0 }}>
                    {trip.start_date ? `${trip.start_date} → ${trip.end_date}` : 'Dates TBD'}
                  </p>
                </div>
              </div>

              {user ? (
                <p style={{ fontSize: '13px', color: '#9a9a8a', marginBottom: '20px', textAlign: 'center', lineHeight: 1.6 }}>
                  Signed in as {user.email}
                </p>
              ) : (
                <p style={{ fontSize: '13px', color: '#9a9a8a', marginBottom: '20px', textAlign: 'center', lineHeight: 1.6 }}>
                  Create an account or sign in to accept this invitation.
                </p>
              )}

              <button onClick={handleAccept}
                style={{ width: '100%', border: '1px solid #182D09', background: '#182D09', color: '#fff', padding: '16px', fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '8px', ...s }}>
                Accept invitation →
              </button>
            </>
          )}

          {step === 'nickname' && (
            <div style={{ textAlign: 'center' }}>
              <h2 style={{ fontSize: '28px', fontWeight: 300, color: '#1a1a1a', margin: '0 0 8px', ...s }}>One last thing</h2>
              <p style={{ fontSize: '13px', color: '#9a9a8a', marginBottom: '8px', lineHeight: 1.7 }}>What should the group call you on this trip?</p>
              <p style={{ fontSize: '11px', color: '#b4b4a8', marginBottom: '28px', fontStyle: 'italic' }}>Your legal name is used for reservations. This is just your nickname for the group.</p>
              <input value={nickname} onChange={e => setNickname(e.target.value)} placeholder="M, Em, Alex..."
                style={{ ...inputStyle, fontSize: '20px', textAlign: 'center', letterSpacing: '0.1em', marginBottom: '24px' }} />
              <button onClick={handleJoin} disabled={joining}
                style={{ width: '100%', border: '1px solid #182D09', background: '#182D09', color: '#fff', padding: '16px', fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '8px', opacity: joining ? 0.5 : 1, ...s }}>
                {joining ? 'Joining...' : `Join ${trip.name} →`}
              </button>
            </div>
          )}
        </div>

        {showAuthModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '24px' }}>
            <div style={{ background: '#fafaf8', borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '380px', ...s }}>
              <p style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#9a9a8a', margin: '0 0 6px' }}>
                {authMode === 'signup' ? 'Create your account' : 'Welcome back'}
              </p>
              <h3 style={{ fontSize: '24px', fontWeight: 300, color: '#1a1a1a', margin: '0 0 24px', ...s }}>
                {authMode === 'signup' ? 'Join Avanti to accept' : 'Sign in to continue'}
              </h3>
              {authError && <p style={{ fontSize: '12px', color: '#c0392b', marginBottom: '16px' }}>{authError}</p>}
              <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={labelStyle}>Email</label>
                  <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Password</label>
                  <input type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" style={inputStyle} />
                </div>
                <button type="submit" disabled={authLoading}
                  style={{ width: '100%', border: '1px solid #182D09', background: '#182D09', color: '#fff', padding: '14px', fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '8px', opacity: authLoading ? 0.6 : 1, marginTop: '8px', ...s }}>
                  {authLoading ? 'Please wait...' : authMode === 'signup' ? 'Create account →' : 'Sign in →'}
                </button>
              </form>
              <button onClick={() => setAuthMode(authMode === 'signup' ? 'signin' : 'signup')}
                style={{ width: '100%', textAlign: 'center', fontSize: '11px', color: '#9a9a8a', background: 'none', border: 'none', cursor: 'pointer', marginTop: '14px', ...s }}>
                {authMode === 'signup' ? 'Already have an account? Sign in' : "Don't have an account? Create one"}
              </button>
              <button onClick={() => setShowAuthModal(false)}
                style={{ width: '100%', textAlign: 'center', fontSize: '11px', color: '#b4b4a8', background: 'none', border: 'none', cursor: 'pointer', marginTop: '6px', ...s }}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
