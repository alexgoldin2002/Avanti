'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import AvantiLogo from '../../components/AvantiLogo'
import SuitcaseLoader from '../../components/SuitcaseLoader'
import Footer from '../../components/Footer'
import { BackLink } from '../../components/SubpageShell'
import PhoneAuthForm from '../../components/PhoneAuthForm'
import DateOfBirthSelect from '../../components/DateOfBirthSelect'
import { syncUserPhoneToProfile } from '@/lib/auth/sync-user-phone'
import {
  listAccountCompanions,
  type AccountCompanion,
} from '@/lib/account-companions'
import { addCompanionToTrip } from '@/lib/add-companion-to-trip'

type JoinStep = 'landing' | 'nickname' | 'travel_party' | 'companion'
type TravelMode = 'self' | 'manage'

export default function JoinTrip() {
  const params = useParams()
  const router = useRouter()
  const code = params.code as string
  const [trip, setTrip] = useState<any>(null)
  const [organizer, setOrganizer] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [nickname, setNickname] = useState('')
  const [step, setStep] = useState<JoinStep>('landing')
  const [travelMode, setTravelMode] = useState<TravelMode>('self')
  const [savedCompanions, setSavedCompanions] = useState<AccountCompanion[]>([])
  const [selectedCompanionId, setSelectedCompanionId] = useState<string | null>(null)
  const [companionForm, setCompanionForm] = useState({
    full_name: '',
    relationship: '',
    passport_number: '',
    tsa_known_traveler: '',
    date_of_birth: '',
  })
  const [pendingCompanions, setPendingCompanions] = useState<Array<{
    full_name: string
    relationship: string
    passport_number: string
    tsa_known_traveler: string
    date_of_birth: string
    linked_user_id: string | null
    savedCompanionId?: string
  }>>([])
  const [linkEmail, setLinkEmail] = useState('')
  const [linkedUserId, setLinkedUserId] = useState<string | null>(null)
  const [linkLookupMsg, setLinkLookupMsg] = useState('')
  const [linkLoading, setLinkLoading] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signup')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState('')
  const [authChannel, setAuthChannel] = useState<'email' | 'phone'>('email')
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
    const rows = await listAccountCompanions(supabase, user.id)
    setSavedCompanions(rows)
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

  const finishPhoneAuth = async () => {
    setAuthLoading(true)
    setAuthError('')
    const { data: { user: authedUser } } = await supabase.auth.getUser()
    if (!authedUser) {
      setAuthError('Could not verify your session. Try again.')
      setAuthLoading(false)
      return
    }
    if (authedUser.phone) {
      await syncUserPhoneToProfile(authedUser.id, authedUser.phone)
    }
    setUser(authedUser)
    setShowAuthModal(false)
    if (authMode === 'signup') {
      localStorage.setItem('pending_join_code', code)
      router.push('/profile?fromInvite=true&code=' + code)
    } else {
      setStep('nickname')
    }
    setAuthLoading(false)
  }

  const lookupLinkedProfile = async () => {
    if (!linkEmail.trim()) return
    setLinkLoading(true)
    setLinkLookupMsg('')
    setLinkedUserId(null)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setLinkLookupMsg('Please sign in again.')
      setLinkLoading(false)
      return
    }
    try {
      const res = await fetch('/api/account-companions/link-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ email: linkEmail.trim() }),
      })
      const data = await res.json()
      if (data.found) {
        setLinkedUserId(data.linkedUserId)
        setCompanionForm(f => ({
          ...f,
          full_name: data.full_name || f.full_name,
          passport_number: data.passport_number || f.passport_number,
          tsa_known_traveler: data.tsa_known_traveler || f.tsa_known_traveler,
          date_of_birth: data.date_of_birth || f.date_of_birth,
        }))
        setLinkLookupMsg(`Found ${data.full_name} — details pulled from their Avanti profile.`)
      } else if (data.error) {
        setLinkLookupMsg(data.error)
      } else {
        setLinkLookupMsg('No Avanti account for that email. Enter their details below.')
      }
    } catch {
      setLinkLookupMsg('Could not look up that email.')
    }
    setLinkLoading(false)
  }

  const resetCompanionForm = () => {
    setCompanionForm({ full_name: '', relationship: '', passport_number: '', tsa_known_traveler: '', date_of_birth: '' })
    setSelectedCompanionId(null)
    setLinkEmail('')
    setLinkedUserId(null)
    setLinkLookupMsg('')
  }

  const queueCurrentCompanion = () => {
    if (selectedCompanionId) {
      const saved = savedCompanions.find(c => c.id === selectedCompanionId)
      if (!saved) return
      setPendingCompanions(p => [...p, {
        full_name: saved.full_name,
        relationship: saved.relationship || '',
        passport_number: saved.passport_number || '',
        tsa_known_traveler: saved.tsa_known_traveler || '',
        date_of_birth: saved.date_of_birth || '',
        linked_user_id: saved.linked_user_id,
        savedCompanionId: saved.id,
      }])
      resetCompanionForm()
      return
    }
    if (!companionForm.full_name.trim()) return
    setPendingCompanions(p => [...p, { ...companionForm, linked_user_id: linkedUserId }])
    resetCompanionForm()
  }

  const handleJoin = async () => {
    setJoining(true)
    const { data: profile } = await supabase.from('user_profiles').select('*').eq('user_id', user.id).maybeSingle()
    const { data: existing } = await supabase.from('travelers').select('id').eq('trip_id', trip.id).eq('user_id', user.id).maybeSingle()

    if (!existing) {
      const { data: inserted, error } = await supabase.from('travelers').insert({
        trip_id: trip.id,
        full_name: profile?.full_name || '',
        email: profile?.email || user?.email || '',
        nickname: nickname || profile?.full_name?.split(' ')[0] || '',
        role: 'member',
        profile_complete: !!profile?.profile_complete,
        status: 'pending',
        user_id: user.id,
      }).select('id').single()
      if (error) {
        console.error('Insert error:', error)
        setJoining(false)
        return
      }
    }

    if (travelMode === 'manage') {
      const queue = [...pendingCompanions]
      if (selectedCompanionId || companionForm.full_name.trim()) {
        queue.push({
          ...companionForm,
          linked_user_id: linkedUserId,
          savedCompanionId: selectedCompanionId || undefined,
        })
      }

      for (const item of queue) {
        if (item.savedCompanionId) {
          await addCompanionToTrip(trip.id, { savedCompanionId: item.savedCompanionId })
        } else {
          await addCompanionToTrip(trip.id, {
            companion: {
              full_name: item.full_name,
              relationship: item.relationship,
              passport_number: item.passport_number,
              tsa_known_traveler: item.tsa_known_traveler,
              date_of_birth: item.date_of_birth || undefined,
              linked_user_id: item.linked_user_id,
            },
          })
        }
      }
    }

    localStorage.removeItem('pending_join_code')
    window.location.href = `/join/pending?trip=${encodeURIComponent(trip.name)}&tripId=${trip.id}`
  }

  const s = { fontFamily: 'var(--font-cormorant), Georgia, serif' }
  const inputStyle = { width: '100%', borderBottom: '1px solid var(--border)', background: 'transparent', padding: '10px 0', fontSize: '15px', color: 'var(--foreground)', outline: 'none', ...s }
  const labelStyle = { fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase' as const, color: 'var(--muted-foreground)', display: 'block', marginBottom: '6px' }

  if (loading) return <SuitcaseLoader message="Loading invitation" />
  if (linkClosed) return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: '100%', background: 'var(--cream)', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
      <div style={{ maxWidth: '420px', margin: '0 auto', padding: '24px 24px 0', width: '100%' }}>
        <BackLink href="/" wrapperClassName="flex justify-end" />
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', padding: '24px', maxWidth: '360px' }}>
        <div style={{ marginBottom: '24px' }}><AvantiLogo size="sm" /></div>
        <div style={{ fontSize: '32px', marginBottom: '16px' }}>🔒</div>
        <h2 style={{ fontSize: '24px', fontWeight: 300, color: 'var(--foreground)', margin: '0 0 10px' }}>Invite link closed</h2>
        <p style={{ fontSize: '13px', color: 'var(--muted-foreground)', lineHeight: 1.7 }}>The organizer has closed this trip to new guests. If you think this is a mistake, reach out to the trip organizer directly.</p>
      </div>
      </div>
      <Footer />
    </div>
  )
  if (!trip) return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: '100%', background: 'var(--cream)', ...s }}>
      <div style={{ maxWidth: '420px', margin: '0 auto', padding: '24px 24px 0', width: '100%' }}>
        <BackLink href="/" wrapperClassName="flex justify-end" />
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', padding: '24px' }}>
        <AvantiLogo size="sm" />
        <p style={{ fontSize: '14px', color: 'var(--muted-foreground)', marginTop: '24px' }}>This invite link is invalid or has expired.</p>
      </div>
      </div>
      <Footer />
    </div>
  )

  const organizerName = organizer?.nickname || organizer?.full_name?.split(' ')[0] || 'Someone'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: '100%', background: 'var(--cream)', ...s }}>
      <div style={{ maxWidth: '420px', margin: '0 auto', padding: '24px 24px 0', width: '100%' }}>
        <BackLink href="/" wrapperClassName="flex justify-end" />
      </div>
      <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>

        <div style={{ width: '100%', maxWidth: '420px', filter: showAuthModal ? 'blur(2px)' : 'none', transition: 'filter 0.2s' }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <AvantiLogo size="md" />
          </div>

          {step === 'landing' && (
            <>
              <div style={{ background: trip.cover_color || 'var(--forest-deep)', borderRadius: '0', padding: '28px 24px', marginBottom: '24px', position: 'relative', overflow: 'hidden' }}>
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
                <p style={{ fontSize: '13px', color: 'var(--muted-foreground)', marginBottom: '20px', textAlign: 'center', lineHeight: 1.6 }}>
                  Signed in as {user.email || user.phone}
                </p>
              ) : (
                <p style={{ fontSize: '13px', color: 'var(--muted-foreground)', marginBottom: '20px', textAlign: 'center', lineHeight: 1.6 }}>
                  Create an account or sign in to accept this invitation.
                </p>
              )}

              <button onClick={handleAccept}
                style={{ width: '100%', border: '1px solid var(--forest-deep)', background: 'var(--forest-deep)', color: '#fff', padding: '16px', fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '0', ...s }}>
                Accept invitation →
              </button>
            </>
          )}

          {step === 'nickname' && (
            <div style={{ textAlign: 'center' }}>
              <h2 style={{ fontSize: '28px', fontWeight: 300, color: 'var(--foreground)', margin: '0 0 8px', ...s }}>One last thing</h2>
              <p style={{ fontSize: '13px', color: 'var(--muted-foreground)', marginBottom: '8px', lineHeight: 1.7 }}>What should the group call you on this trip?</p>
              <p style={{ fontSize: '11px', color: 'var(--muted-foreground)', marginBottom: '28px', fontStyle: 'italic' }}>Your legal name is used for reservations. This is just your nickname for the group.</p>
              <input value={nickname} onChange={e => setNickname(e.target.value)} placeholder="M, Em, Alex..."
                style={{ ...inputStyle, fontSize: '20px', textAlign: 'center', letterSpacing: '0.1em', marginBottom: '24px' }} />
              <button onClick={() => setStep('travel_party')} disabled={!nickname.trim()}
                style={{ width: '100%', border: '1px solid var(--forest-deep)', background: 'var(--forest-deep)', color: '#fff', padding: '16px', fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '0', opacity: !nickname.trim() ? 0.5 : 1, ...s }}>
                Continue →
              </button>
            </div>
          )}

          {step === 'travel_party' && (
            <div>
              <h2 style={{ fontSize: '28px', fontWeight: 300, color: 'var(--foreground)', margin: '0 0 8px', textAlign: 'center', ...s }}>Who&apos;s traveling?</h2>
              <p style={{ fontSize: '13px', color: 'var(--muted-foreground)', marginBottom: '24px', lineHeight: 1.7, textAlign: 'center' }}>
                You speak for your group — one invite, one vote. Add anyone else who needs a passport or headcount (partner, kids, etc.).
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
                {[
                  { id: 'self' as TravelMode, title: 'Just me', desc: 'Only I’m on this trip.' },
                  { id: 'manage' as TravelMode, title: 'Me + others I’m booking for', desc: 'Spouse, kids, etc. — I fill in their travel details; they count toward the group but don’t vote separately.' },
                ].map(opt => (
                  <button key={opt.id} type="button" onClick={() => setTravelMode(opt.id)}
                    style={{
                      textAlign: 'left',
                      padding: '14px 16px',
                      border: `1px solid ${travelMode === opt.id ? 'var(--forest-deep)' : 'var(--border)'}`,
                      background: travelMode === opt.id ? 'rgba(24, 45, 9, 0.06)' : 'var(--card)',
                      cursor: 'pointer',
                      ...s,
                    }}>
                    <p style={{ fontSize: '14px', color: 'var(--foreground)', margin: '0 0 4px' }}>{opt.title}</p>
                    <p style={{ fontSize: '12px', color: 'var(--muted-foreground)', margin: 0, lineHeight: 1.5 }}>{opt.desc}</p>
                  </button>
                ))}
              </div>
              <button
                onClick={() => {
                  if (travelMode === 'manage') setStep('companion')
                  else handleJoin()
                }}
                disabled={joining}
                style={{ width: '100%', border: '1px solid var(--forest-deep)', background: 'var(--forest-deep)', color: '#fff', padding: '16px', fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '0', opacity: joining ? 0.5 : 1, ...s }}>
                {joining ? 'Joining...' : travelMode === 'manage' ? 'Add traveler →' : `Join ${trip.name} →`}
              </button>
            </div>
          )}

          {step === 'companion' && (
            <div>
              <h2 style={{ fontSize: '24px', fontWeight: 300, color: 'var(--foreground)', margin: '0 0 8px', ...s }}>Who else is coming?</h2>
              <p style={{ fontSize: '12px', color: 'var(--muted-foreground)', marginBottom: '20px', lineHeight: 1.6 }}>
                They count toward group size and trip planning. You fill passport, birthday, and travel details — or link their Avanti profile so you don&apos;t re-type everything.
              </p>

              {pendingCompanions.length > 0 && (
                <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {pendingCompanions.map((c, i) => (
                    <div key={i} style={{ padding: '10px 12px', border: '1px solid var(--border)', background: 'var(--card)', fontSize: '13px', ...s }}>
                      {c.full_name}{c.relationship ? ` · ${c.relationship}` : ''}
                    </div>
                  ))}
                </div>
              )}

              {savedCompanions.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                  <p style={{ ...labelStyle, marginBottom: '4px' }}>Saved travelers</p>
                  {savedCompanions.map(c => (
                    <button key={c.id} type="button" onClick={() => {
                      setSelectedCompanionId(c.id)
                      setCompanionForm({
                        full_name: c.full_name,
                        relationship: c.relationship || '',
                        passport_number: c.passport_number || '',
                        tsa_known_traveler: c.tsa_known_traveler || '',
                      })
                    }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '10px 12px',
                        border: `1px solid ${selectedCompanionId === c.id ? 'var(--forest-deep)' : 'var(--border)'}`,
                        background: selectedCompanionId === c.id ? 'rgba(24, 45, 9, 0.06)' : 'var(--card)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        ...s,
                      }}>
                      <span style={{ fontSize: '13px', color: 'var(--foreground)' }}>{c.full_name}</span>
                      {c.relationship && <span style={{ fontSize: '11px', color: 'var(--muted-foreground)' }}>· {c.relationship}</span>}
                    </button>
                  ))}
                </div>
              )}

              <div style={{ marginBottom: '20px', padding: '14px', background: '#f5f5f0' }}>
                <p style={{ ...labelStyle, marginBottom: '8px' }}>They have an Avanti account?</p>
                <p style={{ fontSize: '11px', color: 'var(--muted-foreground)', marginBottom: '10px', lineHeight: 1.5 }}>
                  Enter their email to pull passport and travel details from their profile.
                </p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input style={{ ...inputStyle, flex: 1, borderBottom: '1px solid #d4d4c8' }} type="email" value={linkEmail}
                    onChange={e => { setLinkEmail(e.target.value); setLinkLookupMsg(''); setLinkedUserId(null) }}
                    placeholder="partner@email.com" />
                  <button type="button" onClick={lookupLinkedProfile} disabled={linkLoading || !linkEmail.trim()}
                    style={{ padding: '8px 12px', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', border: '1px solid var(--forest-deep)', background: 'transparent', color: 'var(--forest-deep)', cursor: 'pointer', whiteSpace: 'nowrap', ...s }}>
                    {linkLoading ? '…' : 'Link'}
                  </button>
                </div>
                {linkLookupMsg && <p style={{ fontSize: '11px', color: linkedUserId ? '#2d5a18' : 'var(--muted-foreground)', marginTop: '8px', marginBottom: 0 }}>{linkLookupMsg}</p>}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '16px' }}>
                <div>
                  <label style={labelStyle}>Full legal name *</label>
                  <input style={inputStyle} value={companionForm.full_name}
                    onChange={e => { setSelectedCompanionId(null); setCompanionForm({ ...companionForm, full_name: e.target.value }) }}
                    placeholder="Partner, child, parent…" />
                </div>
                <div>
                  <label style={labelStyle}>Relationship</label>
                  <input style={inputStyle} value={companionForm.relationship}
                    onChange={e => setCompanionForm({ ...companionForm, relationship: e.target.value })}
                    placeholder="Partner, spouse, child…" />
                </div>
                <div>
                  <label style={labelStyle}>Passport number</label>
                  <input style={inputStyle} value={companionForm.passport_number}
                    onChange={e => setCompanionForm({ ...companionForm, passport_number: e.target.value })}
                    placeholder="For bookings later" />
                </div>
                <div>
                  <label style={labelStyle}>TSA PreCheck / Known Traveler</label>
                  <input style={inputStyle} value={companionForm.tsa_known_traveler}
                    onChange={e => setCompanionForm({ ...companionForm, tsa_known_traveler: e.target.value })}
                    placeholder="Optional" />
                </div>
                <div>
                  <label style={labelStyle}>Date of birth</label>
                  <DateOfBirthSelect
                    value={companionForm.date_of_birth}
                    onChange={date_of_birth => {
                      setSelectedCompanionId(null)
                      setCompanionForm({ ...companionForm, date_of_birth })
                    }}
                    selectStyle={{
                      ...inputStyle,
                      borderBottom: '1px solid var(--border)',
                      padding: '10px 24px 10px 0',
                      fontSize: '14px',
                    }}
                  />
                </div>
              </div>

              <button type="button" onClick={queueCurrentCompanion}
                disabled={!selectedCompanionId && !companionForm.full_name.trim()}
                style={{ width: '100%', border: '1px dashed var(--border)', background: 'transparent', color: 'var(--foreground)', padding: '12px', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', cursor: 'pointer', marginBottom: '10px', opacity: (!selectedCompanionId && !companionForm.full_name.trim()) ? 0.5 : 1, ...s }}>
                + Add another traveler
              </button>

              <button onClick={handleJoin}
                disabled={joining || (pendingCompanions.length === 0 && !selectedCompanionId && !companionForm.full_name.trim())}
                style={{ width: '100%', border: '1px solid var(--forest-deep)', background: 'var(--forest-deep)', color: '#fff', padding: '16px', fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '0', opacity: (joining || (pendingCompanions.length === 0 && !selectedCompanionId && !companionForm.full_name.trim())) ? 0.5 : 1, ...s }}>
                {joining ? 'Joining...' : `Join ${trip.name} →`}
              </button>
              <button type="button" onClick={() => setStep('travel_party')}
                style={{ width: '100%', marginTop: '10px', background: 'none', border: 'none', fontSize: '11px', color: 'var(--muted-foreground)', cursor: 'pointer', ...s }}>
                ← Back
              </button>
            </div>
          )}
        </div>

        {showAuthModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '24px' }}>
            <div style={{ background: 'var(--cream)', borderRadius: '0', padding: '32px', width: '100%', maxWidth: '380px', ...s }}>
              <p style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted-foreground)', margin: '0 0 6px' }}>
                {authMode === 'signup' ? 'Create your account' : 'Welcome back'}
              </p>
              <h3 style={{ fontSize: '24px', fontWeight: 300, color: 'var(--foreground)', margin: '0 0 24px', ...s }}>
                {authMode === 'signup' ? 'Join Avanti to accept' : 'Sign in to continue'}
              </h3>
              {authError && <p style={{ fontSize: '12px', color: '#c0392b', marginBottom: '16px' }}>{authError}</p>}
              <div style={{ display: 'flex', border: '1px solid var(--border)', marginBottom: '16px' }}>
                <button
                  type="button"
                  onClick={() => { setAuthChannel('email'); setAuthError('') }}
                  style={{
                    flex: 1,
                    padding: '10px 0',
                    fontSize: '10px',
                    letterSpacing: '0.15em',
                    textTransform: 'uppercase',
                    border: 'none',
                    cursor: 'pointer',
                    background: authChannel === 'email' ? 'var(--forest-deep)' : 'transparent',
                    color: authChannel === 'email' ? '#fff' : 'var(--muted-foreground)',
                    ...s,
                  }}
                >
                  Email
                </button>
                <button
                  type="button"
                  onClick={() => { setAuthChannel('phone'); setAuthError('') }}
                  style={{
                    flex: 1,
                    padding: '10px 0',
                    fontSize: '10px',
                    letterSpacing: '0.15em',
                    textTransform: 'uppercase',
                    border: 'none',
                    cursor: 'pointer',
                    background: authChannel === 'phone' ? 'var(--forest-deep)' : 'transparent',
                    color: authChannel === 'phone' ? '#fff' : 'var(--muted-foreground)',
                    ...s,
                  }}
                >
                  Phone
                </button>
              </div>
              {authChannel === 'email' ? (
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
                  style={{ width: '100%', border: '1px solid var(--forest-deep)', background: 'var(--forest-deep)', color: '#fff', padding: '14px', fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '0', opacity: authLoading ? 0.6 : 1, marginTop: '8px', ...s }}>
                  {authLoading ? 'Please wait...' : authMode === 'signup' ? 'Create account →' : 'Sign in →'}
                </button>
              </form>
              ) : (
                <PhoneAuthForm
                  variant="legacy"
                  onSuccess={finishPhoneAuth}
                  loading={authLoading}
                  setLoading={setAuthLoading}
                  error={authError}
                  setError={setAuthError}
                />
              )}
              <button onClick={() => setAuthMode(authMode === 'signup' ? 'signin' : 'signup')}
                style={{ width: '100%', textAlign: 'center', fontSize: '11px', color: 'var(--muted-foreground)', background: 'none', border: 'none', cursor: 'pointer', marginTop: '14px', ...s }}>
                {authMode === 'signup' ? 'Already have an account? Sign in' : "Don't have an account? Create one"}
              </button>
              <button onClick={() => setShowAuthModal(false)}
                style={{ width: '100%', textAlign: 'center', fontSize: '11px', color: 'var(--muted-foreground)', background: 'none', border: 'none', cursor: 'pointer', marginTop: '6px', ...s }}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
      <Footer />
    </div>
  )
}
