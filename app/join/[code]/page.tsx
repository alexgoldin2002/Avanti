'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import AvantiLogo from '../../components/AvantiLogo'

export default function JoinTrip() {
  const params = useParams()
  const router = useRouter()
  const code = params.code as string
  const [trip, setTrip] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [codeError, setCodeError] = useState('')
  const [nickname, setNickname] = useState('')
  const [step, setStep] = useState<'verify' | 'nickname' | 'joined'>('verify')

  useEffect(() => {
    const findTrip = async () => {
      const { data } = await supabase.from('trips').select('*').eq('invite_code', code).maybeSingle()
      if (data) {
        setTrip(data)
        if (data.visibility !== 'invite_only') setStep('nickname')
      }
      setLoading(false)
    }
    findTrip()
  }, [code])

  const verifyCode = () => {
    if (joinCode.toLowerCase() === trip?.join_code?.toLowerCase()) {
      setStep('nickname')
      setCodeError('')
    } else {
      setCodeError('Incorrect code. Check with your trip organizer.')
    }
  }

  const handleJoin = async () => {
    setJoining(true)
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      router.push(`/?redirect=/join/${code}`)
      return
    }

    const { data: profile } = await supabase.from('user_profiles').select('*').eq('user_id', user.id).maybeSingle()
    const existing = await supabase.from('travelers').select('id').eq('trip_id', trip.id).eq('email', profile?.email || '').maybeSingle()

    if (!existing.data) {
      await supabase.from('travelers').insert({
        trip_id: trip.id,
        full_name: profile?.full_name || '',
        email: profile?.email || '',
        nickname: nickname || profile?.full_name?.split(' ')[0] || '',
        role: 'member',
        profile_complete: !!profile?.profile_complete,
      })
    }

    router.push(`/trip/${trip.id}/dashboard`)
  }

  const s = { fontFamily: 'var(--font-cormorant), Georgia, serif' }

  if (loading) return null

  if (!trip) return (
    <main style={{ minHeight: '100vh', background: '#fafaf8', display: 'flex', alignItems: 'center', justifyContent: 'center', ...s }}>
      <div style={{ textAlign: 'center' }}>
        <AvantiLogo size="sm" />
        <p style={{ fontSize: '14px', color: '#9a9a8a', marginTop: '24px' }}>This invite link is invalid or has expired.</p>
      </div>
    </main>
  )

  return (
    <main style={{ minHeight: '100vh', background: '#fafaf8', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', ...s }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <AvantiLogo size="sm" />
          <p style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#9a9a8a', marginTop: '16px' }}>You have been invited to</p>
          <h2 style={{ fontSize: '32px', fontWeight: 300, color: '#1a1a1a', margin: '8px 0 4px' }}>{trip.name}</h2>
          <p style={{ fontSize: '13px', color: '#9a9a8a', margin: 0 }}>{trip.destination} · {trip.trip_type}</p>
        </div>

        {step === 'verify' && (
          <div>
            <p style={{ fontSize: '13px', color: '#6a6a6a', marginBottom: '24px', lineHeight: 1.7, textAlign: 'center' }}>This trip is invite only. Enter the join code from your organizer.</p>
            {codeError && <p style={{ fontSize: '12px', color: '#c0392b', textAlign: 'center', marginBottom: '12px' }}>{codeError}</p>}
            <div style={{ marginBottom: '16px' }}>
              <input value={joinCode} onChange={e => setJoinCode(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && verifyCode()}
                placeholder="Enter join code"
                style={{ width: '100%', borderBottom: '1px solid #d4d4c8', background: 'transparent', padding: '10px 0', fontSize: '24px', color: '#1a1a1a', outline: 'none', textAlign: 'center', letterSpacing: '0.3em', ...s }} />
            </div>
            <button onClick={verifyCode}
              style={{ width: '100%', border: '1px solid #1a1a1a', padding: '14px', fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', color: '#1a1a1a', background: 'transparent', cursor: 'pointer', ...s }}>
              Verify code →
            </button>
          </div>
        )}

        {step === 'nickname' && (
          <div>
            <p style={{ fontSize: '13px', color: '#6a6a6a', marginBottom: '8px', lineHeight: 1.7, textAlign: 'center' }}>What should the group call you on this trip?</p>
            <p style={{ fontSize: '11px', color: '#b4b4a8', marginBottom: '24px', textAlign: 'center', fontStyle: 'italic' }}>Your legal name from your profile is used for reservations. This is just for the group.</p>
            <div style={{ marginBottom: '24px' }}>
              <input value={nickname} onChange={e => setNickname(e.target.value)}
                placeholder="M, Em, Alex..."
                style={{ width: '100%', borderBottom: '1px solid #d4d4c8', background: 'transparent', padding: '10px 0', fontSize: '20px', color: '#1a1a1a', outline: 'none', textAlign: 'center', letterSpacing: '0.1em', ...s }} />
            </div>
            <button onClick={handleJoin} disabled={joining}
              style={{ width: '100%', border: '1px solid #1a1a1a', padding: '14px', fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', color: '#1a1a1a', background: 'transparent', cursor: 'pointer', opacity: joining ? 0.5 : 1, ...s }}>
              {joining ? 'Joining...' : 'Join trip →'}
            </button>
          </div>
        )}
      </div>
    </main>
  )
}
