'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import AvantiLogo from '../../../components/AvantiLogo'
import Footer from '../../../components/Footer'

export default function InviteGuests() {
  const params = useParams()
  const router = useRouter()
  const tripId = params.tripId as string
  const [trip, setTrip] = useState<any>(null)
  const [attendees, setAttendees] = useState<any[]>([])
  const [savedTravelers, setSavedTravelers] = useState<any[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [toast, setToast] = useState('')
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  const [showTransferHost, setShowTransferHost] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isOrganizer, setIsOrganizer] = useState(false)
  const [sendInviteEmail, setSendInviteEmail] = useState('')
  const [sendInvitePhone, setSendInvitePhone] = useState('')
  const [sendingInvite, setSendingInvite] = useState(false)
  const [hoveredAttendee, setHoveredAttendee] = useState<string | null>(null)
  const [nudgedAttendees, setNudgedAttendees] = useState<Set<string>>(new Set())
  const [nudgeRateLimited, setNudgeRateLimited] = useState<Set<string>>(new Set())
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([])
  const [showRemoveModal, setShowRemoveModal] = useState<string | null>(null)
  const [invitesClosed, setInvitesClosed] = useState(false)
  const [showCloseConfirm, setShowCloseConfirm] = useState(false)
  const [showMemberConvos, setShowMemberConvos] = useState(true)
  const [addMode, setAddMode] = useState<'new' | 'saved'>('new')
  const [newAttendee, setNewAttendee] = useState({
    nickname: '', full_name: '', email: '',
    fills_own_preferences: true,
    departure_city: '', available_from: '', available_to: '',
    passport_number: '', tsa_known_traveler: '',
  })

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: tripData } = await supabase.from('trips').select('*').eq('id', tripId).single()
    if (tripData) {
      setTrip(tripData)
      setInvitesClosed(!!tripData.invites_closed)
      if (tripData?.show_member_conversations !== undefined) {
        setShowMemberConvos(tripData.show_member_conversations)
      }
    }
    const { data: travelerData } = await supabase.from('travelers').select('*').eq('trip_id', tripId)
    if (travelerData) setAttendees(travelerData)
    const { data: pendingData } = await supabase
      .from('travelers')
      .select('*')
      .eq('trip_id', tripId)
      .eq('status', 'pending')
    setPendingApprovals(pendingData || [])
    if (user) {
      setCurrentUserId(user.id)
      const isOrgByTrip = tripData?.organizer_id === user.id
      const myTraveler = travelerData?.find((t: any) => t.user_id === user.id)
      const isOrgByRole = myTraveler?.role === 'organizer'
      setIsOrganizer(isOrgByTrip || isOrgByRole)
      const { data: saved } = await supabase.from('traveler_profiles').select('*').eq('owner_user_id', user.id)
      setSavedTravelers(saved || [])
    }
  }

  useEffect(() => {
    load()
    const channel = supabase
      .channel('travelers-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'travelers',
        filter: `trip_id=eq.${tripId}`
      }, () => {
        load()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [tripId])

  const inviteUrl = typeof window !== 'undefined' ? `${window.location.origin}/join/${trip?.invite_code}` : ''

  const shareButtons = [
    { label: 'Copy', icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
      </svg>
    ), bg: '#6e6e73', action: () => { navigator.clipboard.writeText(inviteUrl); setCopied(true); setTimeout(() => setCopied(false), 2000) }},
    { label: 'Messages', icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.96 9.96 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z"/></svg>
    ), bg: '#30d158', action: () => window.open(`sms:&body=${encodeURIComponent(`Join ${trip?.name} on Avanti: ${inviteUrl}`)}`) },
    { label: 'WhatsApp', icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
    ), bg: '#25d366', action: () => window.open(`https://wa.me/?text=${encodeURIComponent(`Join ${trip?.name} on Avanti: ${inviteUrl}`)}`) },
    { label: 'Gmail', icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 010 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z"/></svg>
    ), bg: '#ea4335', action: () => window.open(`https://mail.google.com/mail/?view=cm&su=${encodeURIComponent(`Join ${trip?.name}`)}&body=${encodeURIComponent(`Join my trip on Avanti: ${inviteUrl}`)}`) },
    { label: 'Mail', icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>
    ), bg: '#1a7fe8', action: () => window.open(`mailto:?subject=${encodeURIComponent(`Join ${trip?.name}`)}&body=${encodeURIComponent(`Join my trip on Avanti: ${inviteUrl}`)}`) },
  ]

  const addNewAttendee = async () => {
    if (!newAttendee.nickname.trim()) return
    setSaving(true)
    const isDependent = !newAttendee.fills_own_preferences
    await supabase.from('travelers').insert({
      trip_id: tripId,
      nickname: newAttendee.nickname,
      full_name: newAttendee.full_name || newAttendee.nickname,
      email: newAttendee.email || '',
      role: isDependent ? 'dependent' : 'member',
      profile_complete: isDependent,
      passport_number: isDependent ? newAttendee.passport_number : null,
      tsa_known_traveler: isDependent ? newAttendee.tsa_known_traveler : null,
    })
    const { data } = await supabase.from('travelers').select('*').eq('trip_id', tripId)
    if (data) setAttendees(data)
    setNewAttendee({ nickname: '', full_name: '', email: '', fills_own_preferences: true, departure_city: '', available_from: '', available_to: '', passport_number: '', tsa_known_traveler: '' })
    setShowAddForm(false)
    setSaving(false)
    setToast('Guest added ✓')
    setTimeout(() => setToast(''), 2000)
  }

  const addFromSaved = async (saved: any) => {
    setSaving(true)
    await supabase.from('travelers').insert({
      trip_id: tripId,
      full_name: saved.full_name,
      nickname: saved.nickname || saved.full_name.split(' ')[0],
      email: '',
      role: 'dependent',
      profile_complete: false,
      date_of_birth: saved.date_of_birth,
      passport_number: saved.passport_number,
      tsa_known_traveler: saved.tsa_known_traveler,
    })
    const { data } = await supabase.from('travelers').select('*').eq('trip_id', tripId)
    if (data) setAttendees(data)
    setSaving(false)
    setShowAddForm(false)
    setToast('Guest added ✓')
    setTimeout(() => setToast(''), 2000)
  }

  const removeAttendee = async (id: string) => {
    await supabase.from('travelers').delete().eq('id', id)
    setAttendees(a => a.filter(att => att.id !== id))
    setPendingApprovals(p => p.filter(att => att.id !== id))
  }

  const handleApprove = async (travelerId: string) => {
    await supabase.from('travelers').update({
      status: 'approved',
    }).eq('id', travelerId)
    setToast('Accepted ✓')
    setTimeout(() => setToast(''), 2000)
    const { data: pendingData } = await supabase.from('travelers').select('*').eq('trip_id', tripId).eq('status', 'pending')
    setPendingApprovals(pendingData || [])
    const { data } = await supabase.from('travelers').select('*').eq('trip_id', tripId)
    if (data) setAttendees(data)
  }

  const handleCloseInvites = async () => {
    await supabase.from('trips').update({ invites_closed: true }).eq('id', tripId)
    setInvitesClosed(true)
    setTrip((t: any) => t ? { ...t, invites_closed: true } : t)
    setShowCloseConfirm(false)
  }

  const handleLeaveGroup = async () => {
    if (!currentUserId) return
    const members = attendees.filter(a => a.role === 'member' && a.user_id !== currentUserId)
    if (isOrganizer && members.length > 0) {
      const newOrganizer = members[Math.floor(Math.random() * members.length)]
      await supabase.from('travelers').update({ role: 'organizer' }).eq('id', newOrganizer.id)
      await supabase.from('trips').update({ organizer_id: newOrganizer.user_id }).eq('id', tripId)
    }
    await supabase.from('travelers').delete().eq('trip_id', tripId).eq('user_id', currentUserId)
    router.push('/dashboard')
  }

  const handleTransferHost = async (newHostId: string) => {
    const newHost = attendees.find(a => a.id === newHostId)
    if (!newHost) return
    await supabase.from('travelers').update({ role: 'member' }).eq('trip_id', tripId).eq('role', 'organizer')
    await supabase.from('travelers').update({ role: 'organizer' }).eq('id', newHostId)
    await supabase.from('trips').update({ organizer_id: newHost.user_id }).eq('id', tripId)
    setShowTransferHost(false)
    load()
  }

  const handleSendInvite = async () => {
    if (!sendInviteEmail && !sendInvitePhone) return
    setSendingInvite(true)
    if (sendInviteEmail) {
      window.open(`mailto:${sendInviteEmail}?subject=${encodeURIComponent(`Join ${trip?.name} on Avanti`)}&body=${encodeURIComponent(`You've been invited to join ${trip?.name} on Avanti. Click here to join: ${inviteUrl}`)}`)
    }
    if (sendInvitePhone) {
      window.open(`sms:${sendInvitePhone}?body=${encodeURIComponent(`You've been invited to join ${trip?.name} on Avanti: ${inviteUrl}`)}`)
    }
    setSendInviteEmail('')
    setSendInvitePhone('')
    setSendingInvite(false)
    setToast('Invite sent ✓')
    setTimeout(() => setToast(''), 2000)
  }

  const handleNudge = async (att: any) => {
    if (nudgedAttendees.has(att.id)) return
    try {
      const organizer = attendees.find(a => a.role === 'organizer')
      const res = await fetch('/api/send-nudge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tripId,
          travelerId: att.id,
          travelerEmail: att.email,
          travelerName: att.nickname || att.full_name,
          tripName: trip?.name,
          senderName: organizer?.nickname || organizer?.full_name || 'The organizer',
        })
      })
      const data = await res.json()
      if (data.rateLimited) {
        setNudgeRateLimited(prev => new Set([...prev, att.id]))
        setToast('Already nudged in the last 24 hours')
        setTimeout(() => setToast(''), 2500)
        return
      }
      if (data.mailtoLink) {
        window.open(data.mailtoLink)
      }
      setNudgedAttendees(prev => new Set([...prev, att.id]))
      setToast(`Nudge sent to ${att.nickname || att.full_name} ✓`)
      setTimeout(() => setToast(''), 2000)
    } catch (e) {
      console.error('Nudge error:', e)
    }
  }

  const s = { fontFamily: 'var(--font-cormorant), Georgia, serif' }
  const inputStyle = { width: '100%', borderBottom: '1px solid var(--border)', background: 'transparent', padding: '8px 0', fontSize: '14px', color: 'var(--foreground)', outline: 'none', ...s }
  const labelStyle = { fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase' as const, color: 'var(--muted-foreground)', display: 'block', marginBottom: '6px' }

  if (!trip) return null

  const organizer = attendees.find(a => a.role === 'organizer')
  const guests = attendees.filter(a => a.role !== 'organizer' && (a.status === 'approved' || a.status === null))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: '100%', background: 'var(--cream)', ...s }}>
      <div style={{ flex: 1, maxWidth: '560px', margin: '0 auto', padding: '40px 24px 80px', width: '100%' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '36px' }}>
          <AvantiLogo size="sm" />
          <button onClick={() => router.push(`/trips/${tripId}`)} style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--muted-foreground)', background: 'none', border: 'none', cursor: 'pointer', ...s }}>← Back to trip</button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', color: 'var(--forest)', fontWeight: 300, flexShrink: 0, ...s }}>1</div>
          <h1 style={{ fontSize: '32px', fontWeight: 300, color: 'var(--foreground)', margin: 0, ...s }}>Invite guests</h1>
        </div>
        <p style={{ fontSize: '14px', color: 'var(--muted-foreground)', marginBottom: '32px', marginLeft: '44px', lineHeight: 1.6 }}>Let's get the gang together!</p>

        {!invitesClosed && (
        <div style={{ background: '#fff', border: '0.5px solid var(--border)', borderRadius: '14px', padding: '20px', marginBottom: '20px' }}>
          <p style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted-foreground)', margin: '0 0 14px' }}>Share invite link</p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
            {shareButtons.map(btn => (
              <button key={btn.label} onClick={btn.action}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', ...s }}>
                <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: btn.label === 'Copy' && copied ? 'var(--forest-deep)' : btn.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', transition: 'all 0.2s' }}>
                  {btn.icon}
                </div>
                <span style={{ fontSize: '10px', color: '#6e6e73', letterSpacing: '0.03em' }}>{btn.label === 'Copy' && copied ? 'Copied!' : btn.label}</span>
              </button>
            ))}
          </div>
        </div>
        )}

        {!invitesClosed && (
        <div style={{ background: '#fff', border: '0.5px solid var(--border)', borderRadius: '14px', padding: '20px', marginBottom: '20px' }}>
          <p style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted-foreground)', margin: '0 0 14px' }}>Send invite directly</p>
          <p style={{ fontSize: '12px', color: 'var(--muted-foreground)', marginBottom: '12px', lineHeight: 1.6 }}>Enter their email or phone and we'll send the link for you.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="email"
                value={sendInviteEmail}
                onChange={e => setSendInviteEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSendInvite() }}
                placeholder="Email address"
                style={{ flex: 1, borderBottom: '1px solid var(--border)', background: 'transparent', padding: '8px 0', fontSize: '13px', color: 'var(--foreground)', outline: 'none', fontFamily: 'var(--font-cormorant), Georgia, serif' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="tel"
                value={sendInvitePhone}
                onChange={e => setSendInvitePhone(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSendInvite() }}
                placeholder="Phone number"
                style={{ flex: 1, borderBottom: '1px solid var(--border)', background: 'transparent', padding: '8px 0', fontSize: '13px', color: 'var(--foreground)', outline: 'none', fontFamily: 'var(--font-cormorant), Georgia, serif' }}
              />
              <button
                onClick={handleSendInvite}
                disabled={sendingInvite || (!sendInviteEmail && !sendInvitePhone)}
                style={{ padding: '8px 16px', border: '1.5px solid var(--forest)', background: 'var(--forest)', color: '#fff', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '8px', opacity: (!sendInviteEmail && !sendInvitePhone) ? 0.4 : 1, fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
                Send
              </button>
            </div>
          </div>
        </div>
        )}

        {isOrganizer && pendingApprovals.length > 0 && (
          <div style={{ background: '#fff', border: '1.5px solid #854f0b', borderRadius: '14px', padding: '20px', marginBottom: '20px' }}>
            <p style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#854f0b', margin: '0 0 4px' }}>Pending approvals</p>
            <p style={{ fontSize: '12px', color: 'var(--muted-foreground)', margin: '0 0 16px', lineHeight: 1.6 }}>{pendingApprovals.length} {pendingApprovals.length === 1 ? 'person wants' : 'people want'} to join this trip.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {pendingApprovals.map(person => (
                <div key={person.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#faeeda', border: '0.5px solid #e4c88a', borderRadius: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', color: '#854f0b', fontWeight: 300, ...s }}>
                      {person.nickname?.charAt(0).toUpperCase() || person.full_name?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p style={{ fontSize: '14px', color: 'var(--foreground)', margin: 0 }}>{person.nickname || person.full_name}</p>
                      <p style={{ fontSize: '11px', color: 'var(--muted-foreground)', margin: 0 }}>{person.email || 'Awaiting approval'}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleApprove(person.id)}
                    style={{ padding: '8px 16px', border: '1.5px solid var(--forest)', background: 'var(--forest)', color: '#fff', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '8px', flexShrink: 0, ...s }}>
                    Accept
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ background: '#fff', border: '0.5px solid var(--border)', borderRadius: '14px', padding: '20px', marginBottom: '24px' }}>
          {invitesClosed && (
            <div style={{ background: '#f5f5f0', border: '0.5px solid var(--border)', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '14px' }}>🔒</span>
              <div>
                <p style={{ fontSize: '12px', color: '#3a3a3a', margin: '0 0 2px', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>This group is now locked</p>
                <p style={{ fontSize: '11px', color: 'var(--muted-foreground)', margin: 0 }}>No new members can be added to this trip.</p>
              </div>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <p style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted-foreground)', margin: 0 }}>
              Attendees ({attendees.length})
            </p>
            {!invitesClosed && (
              <button onClick={() => setShowAddForm(!showAddForm)}
                style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--forest)', background: 'none', border: '1.5px solid var(--forest)', padding: '6px 12px', cursor: 'pointer', borderRadius: '20px', ...s }}>
                + Add person
              </button>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {organizer && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#f5f5f0', borderRadius: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--forest-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', color: '#fff', fontWeight: 300, ...s }}>
                    {organizer.nickname?.charAt(0).toUpperCase() || organizer.full_name?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p style={{ fontSize: '14px', color: 'var(--foreground)', margin: 0 }}>{organizer.nickname || organizer.full_name}</p>
                    <p style={{ fontSize: '11px', color: 'var(--muted-foreground)', margin: 0 }}>organizer</p>
                  </div>
                </div>
                <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--forest)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: '#fff', fontSize: '12px' }}>✓</span>
                </div>
              </div>
            )}

            {guests.map(att => (
              <div key={att.id}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: '#fff', border: '0.5px solid var(--border)', borderRadius: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--forest-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', color: '#fff', fontWeight: 300, flexShrink: 0, fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
                    {att.nickname?.charAt(0).toUpperCase() || att.full_name?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p style={{ fontSize: '15px', color: 'var(--foreground)', margin: '0 0 2px', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>{att.nickname || att.full_name}</p>
                    <p style={{ fontSize: '11px', color: 'var(--muted-foreground)', margin: 0, letterSpacing: '0.03em' }}>
                      {att.role === 'dependent' ? 'managed by you' : att.profile_complete ? 'ready ✓' : 'profile pending'}
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    style={{ position: 'relative' }}
                    onMouseEnter={() => !att.profile_complete && setHoveredAttendee(att.id)}
                    onMouseLeave={() => setHoveredAttendee(null)}>
                    {att.profile_complete ? (
                      <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--forest-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ color: '#fff', fontSize: '13px' }}>✓</span>
                      </div>
                    ) : (
                      <div
                        onClick={() => handleNudge(att)}
                        style={{ width: '28px', height: '28px', borderRadius: '50%', border: `1.5px solid ${nudgedAttendees.has(att.id) ? 'var(--forest)' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: isOrganizer ? 'pointer' : 'default', background: nudgedAttendees.has(att.id) ? 'var(--accent-light)' : 'transparent' }}>
                        <span style={{ color: nudgedAttendees.has(att.id) ? 'var(--forest)' : 'var(--border)', fontSize: '13px' }}>
                          {nudgedAttendees.has(att.id) ? '✓' : '○'}
                        </span>
                      </div>
                    )}
                    {hoveredAttendee === att.id && isOrganizer && !att.profile_complete && (
                      <div style={{ position: 'absolute', bottom: '36px', left: '50%', transform: 'translateX(-50%)', background: 'var(--foreground)', color: '#fff', padding: '5px 10px', borderRadius: '6px', fontSize: '11px', whiteSpace: 'nowrap', zIndex: 10, fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
                        {nudgedAttendees.has(att.id) ? 'Nudge sent ✓' : 'Send nudge'}
                        <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderTop: '4px solid var(--foreground)' }} />
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => setShowRemoveModal(att.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--border)', fontSize: '18px', padding: '0 4px', lineHeight: 1, fontWeight: 300 }}>
                    ×
                  </button>
                </div>
              </div>
            ))}

            {guests.length === 0 && !showAddForm && (
              <p style={{ fontSize: '13px', color: 'var(--muted-foreground)', textAlign: 'center', padding: '20px 0', fontStyle: 'italic' }}>No guests added yet. Share the link above or add people manually.</p>
            )}
          </div>

          {showAddForm && (
            <div style={{ marginTop: '16px', padding: '18px', background: '#f5f5f0', borderRadius: '10px' }}>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                {[{ key: 'new', label: 'New person' }, { key: 'saved', label: 'From my travelers' }].map(m => (
                  <button key={m.key} onClick={() => setAddMode(m.key as any)}
                    style={{ flex: 1, padding: '7px', fontSize: '11px', letterSpacing: '0.08em', border: `1px solid ${addMode === m.key ? 'var(--forest)' : 'var(--border)'}`, background: addMode === m.key ? 'var(--accent-light)' : 'transparent', color: addMode === m.key ? 'var(--forest)' : 'var(--muted-foreground)', cursor: 'pointer', borderRadius: '6px', ...s }}>
                    {m.label}
                  </button>
                ))}
              </div>

              {addMode === 'saved' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {savedTravelers.length === 0 && <p style={{ fontSize: '13px', color: 'var(--muted-foreground)', textAlign: 'center', padding: '12px 0' }}>No saved travelers. Add them to your profile first.</p>}
                  {savedTravelers.map(saved => (
                    <button key={saved.id} onClick={() => addFromSaved(saved)}
                      style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', border: '0.5px solid var(--border)', background: '#fff', cursor: 'pointer', borderRadius: '8px', textAlign: 'left', ...s }}>
                      <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: 'var(--forest)', flexShrink: 0 }}>
                        {saved.nickname?.charAt(0) || saved.full_name?.charAt(0)}
                      </div>
                      <div>
                        <p style={{ fontSize: '13px', color: 'var(--foreground)', margin: '0 0 1px' }}>{saved.full_name}</p>
                        <p style={{ fontSize: '11px', color: 'var(--muted-foreground)', margin: 0 }}>{saved.relationship}{saved.passport_number ? ' · Passport on file' : ''}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {addMode === 'new' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={labelStyle}>Nickname *</label>
                      <input style={inputStyle} value={newAttendee.nickname} onChange={e => setNewAttendee({...newAttendee, nickname: e.target.value})} placeholder="Pruse, M, Em..." autoFocus />
                    </div>
                    <div>
                      <label style={labelStyle}>Full name</label>
                      <input style={inputStyle} value={newAttendee.full_name} onChange={e => setNewAttendee({...newAttendee, full_name: e.target.value})} placeholder="Sydney Prusan" />
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>Will they fill in their own info?</label>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                      {[{ v: true, l: 'Yes — send them the link' }, { v: false, l: 'No — I manage their info' }].map(opt => (
                        <button key={String(opt.v)} onClick={() => setNewAttendee({...newAttendee, fills_own_preferences: opt.v})}
                          style={{ flex: 1, padding: '8px', fontSize: '11px', border: `1px solid ${newAttendee.fills_own_preferences === opt.v ? 'var(--forest)' : 'var(--border)'}`, background: newAttendee.fills_own_preferences === opt.v ? 'var(--accent-light)' : 'transparent', color: newAttendee.fills_own_preferences === opt.v ? 'var(--forest)' : 'var(--muted-foreground)', cursor: 'pointer', borderRadius: '6px', ...s }}>
                          {opt.l}
                        </button>
                      ))}
                    </div>
                  </div>
                  {newAttendee.fills_own_preferences && (
                    <div>
                      <label style={labelStyle}>Email <span style={{ textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
                      <input type="email" style={inputStyle} value={newAttendee.email} onChange={e => setNewAttendee({...newAttendee, email: e.target.value})} placeholder="sydney@gmail.com" />
                    </div>
                  )}
                  {!newAttendee.fills_own_preferences && (
                    <div style={{ padding: '12px', background: '#fff', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div>
                        <label style={labelStyle}>Passport number</label>
                        <input style={inputStyle} value={newAttendee.passport_number} onChange={e => setNewAttendee({...newAttendee, passport_number: e.target.value})} placeholder="A12345678" />
                      </div>
                      <div>
                        <label style={labelStyle}>TSA PreCheck</label>
                        <input style={inputStyle} value={newAttendee.tsa_known_traveler} onChange={e => setNewAttendee({...newAttendee, tsa_known_traveler: e.target.value})} placeholder="12345678" />
                      </div>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => setShowAddForm(false)} style={{ flex: 1, border: '1px solid var(--border)', padding: '10px', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted-foreground)', background: 'transparent', cursor: 'pointer', borderRadius: '6px', ...s }}>Cancel</button>
                    <button onClick={addNewAttendee} disabled={saving || !newAttendee.nickname.trim()} style={{ flex: 1, border: '1px solid var(--forest)', padding: '10px', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--forest)', background: 'transparent', cursor: 'pointer', opacity: saving || !newAttendee.nickname.trim() ? 0.4 : 1, borderRadius: '6px', ...s }}>
                      {saving ? 'Adding...' : 'Add →'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ textAlign: 'center', marginBottom: '12px' }}>
          <button
            onClick={() => setShowLeaveConfirm(true)}
            style={{ fontSize: '11px', color: 'var(--muted-foreground)', background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '0.1em', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
            Leave this trip
          </button>
        </div>

        {isOrganizer && attendees.filter(a => a.role === 'member').length > 0 && (
          <div style={{ textAlign: 'center', marginBottom: '12px' }}>
            <button
              onClick={() => setShowTransferHost(true)}
              style={{ fontSize: '11px', color: 'var(--muted-foreground)', background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '0.1em', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
              Transfer host role
            </button>
          </div>
        )}

        {isOrganizer && (
          <div style={{ background: '#fff', border: '0.5px solid var(--border)', borderRadius: '14px', padding: '18px 20px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: '13px', color: 'var(--foreground)', margin: '0 0 4px', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>Show member conversations</p>
                <p style={{ fontSize: '11px', color: 'var(--muted-foreground)', margin: 0, lineHeight: 1.5 }}>Allow everyone to read each other's Avanti conversations</p>
              </div>
              <button
                onClick={async () => {
                  const newVal = !showMemberConvos
                  setShowMemberConvos(newVal)
                  await supabase.from('trips').update({ show_member_conversations: newVal }).eq('id', tripId)
                }}
                style={{ width: '44px', height: '24px', borderRadius: '12px', background: showMemberConvos ? 'var(--forest)' : 'var(--border)', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '3px', left: showMemberConvos ? '23px' : '3px', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
              </button>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {isOrganizer && !invitesClosed && (
            <button
              onClick={() => setShowCloseConfirm(true)}
              style={{ width: '100%', border: '1px solid var(--forest-deep)', background: 'var(--forest-deep)', color: '#fff', padding: '16px', fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '10px', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
              Done adding guests — close invite link →
            </button>
          )}

          {isOrganizer && invitesClosed && (
            <div style={{ padding: '16px', background: 'var(--accent-light)', border: '0.5px solid #8aad7a', borderRadius: '10px', textAlign: 'center' }}>
              <p style={{ fontSize: '12px', color: 'var(--forest)', margin: '0 0 4px' }}>✓ Invite link closed</p>
              <p style={{ fontSize: '11px', color: 'var(--muted-foreground)', margin: 0, lineHeight: 1.6 }}>No new guests can join. Step 2 is now unlocked.</p>
            </div>
          )}
          <button
            onClick={() => router.push(`/trips/${tripId}`)}
            style={{ width: '100%', border: '0.5px solid var(--border)', background: 'transparent', color: 'var(--muted-foreground)', padding: '14px', fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '10px', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
            ← Back to trip
          </button>
        </div>

      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', background: 'var(--forest-deep)', color: '#ffffff', padding: '10px 20px', borderRadius: '24px', fontSize: '12px', letterSpacing: '0.1em', zIndex: 100, ...s }}>
          {toast}
        </div>
      )}

      {showLeaveConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '24px' }}>
          <div style={{ background: 'var(--cream)', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '360px', textAlign: 'center', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
            <p style={{ fontSize: '18px', fontWeight: 300, color: 'var(--foreground)', margin: '0 0 8px' }}>Leave this trip?</p>
            {isOrganizer && attendees.filter(a => a.role === 'member').length > 0 && (
              <p style={{ fontSize: '13px', color: 'var(--muted-foreground)', margin: '0 0 20px', lineHeight: 1.6 }}>You're the organizer. A new host will be randomly assigned from your group.</p>
            )}
            {isOrganizer && attendees.filter(a => a.role === 'member').length === 0 && (
              <p style={{ fontSize: '13px', color: 'var(--muted-foreground)', margin: '0 0 20px', lineHeight: 1.6 }}>You're the only person on this trip. The trip will remain but have no organizer.</p>
            )}
            {!isOrganizer && (
              <p style={{ fontSize: '13px', color: 'var(--muted-foreground)', margin: '0 0 20px', lineHeight: 1.6 }}>You'll be removed from the trip and will need a new invite link to rejoin.</p>
            )}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowLeaveConfirm(false)} style={{ flex: 1, border: '1px solid var(--border)', padding: '12px', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted-foreground)', background: 'transparent', cursor: 'pointer', borderRadius: '8px', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>Cancel</button>
              <button onClick={handleLeaveGroup} style={{ flex: 1, border: '1px solid #a32d2d', padding: '12px', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#a32d2d', background: 'transparent', cursor: 'pointer', borderRadius: '8px', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>Leave trip</button>
            </div>
          </div>
        </div>
      )}

      {showTransferHost && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '24px' }}>
          <div style={{ background: 'var(--cream)', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '400px', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
            <p style={{ fontSize: '18px', fontWeight: 300, color: 'var(--foreground)', margin: '0 0 6px' }}>Transfer host role</p>
            <p style={{ fontSize: '13px', color: 'var(--muted-foreground)', margin: '0 0 20px', lineHeight: 1.6 }}>Choose who becomes the new organizer. They'll take over immediately.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              {attendees.filter(a => a.role === 'member').map(member => (
                <button key={member.id} onClick={() => handleTransferHost(member.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', border: '0.5px solid var(--border)', background: '#fff', cursor: 'pointer', borderRadius: '10px', textAlign: 'left', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', color: 'var(--forest)', flexShrink: 0 }}>
                    {member.nickname?.charAt(0).toUpperCase() || member.full_name?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p style={{ fontSize: '14px', color: 'var(--foreground)', margin: 0 }}>{member.nickname || member.full_name}</p>
                    <p style={{ fontSize: '11px', color: 'var(--muted-foreground)', margin: 0 }}>Make organizer →</p>
                  </div>
                </button>
              ))}
            </div>
            <button onClick={() => setShowTransferHost(false)} style={{ width: '100%', border: '1px solid var(--border)', padding: '12px', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted-foreground)', background: 'transparent', cursor: 'pointer', borderRadius: '8px', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>Cancel</button>
          </div>
        </div>
      )}

      {showRemoveModal && (() => {
        const person = attendees.find(a => a.id === showRemoveModal)
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'var(--cream)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '32px', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
            <div style={{ width: '100%', maxWidth: '380px', textAlign: 'center' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#f5f5f0', border: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: '26px', color: 'var(--forest-deep)', fontWeight: 300 }}>
                {person?.nickname?.charAt(0).toUpperCase() || person?.full_name?.charAt(0).toUpperCase()}
              </div>
              <p style={{ fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted-foreground)', margin: '0 0 8px' }}>Remove from trip</p>
              <h2 style={{ fontSize: '28px', fontWeight: 300, color: 'var(--foreground)', margin: '0 0 12px' }}>{person?.nickname || person?.full_name}</h2>
              <p style={{ fontSize: '13px', color: 'var(--muted-foreground)', margin: '0 0 40px', lineHeight: 1.7 }}>
                They'll be removed from {trip?.name}.<br/>
                This can be undone — just send them a new invite link.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button
                  onClick={async () => { await removeAttendee(showRemoveModal); setShowRemoveModal(null) }}
                  style={{ width: '100%', border: '1px solid #c0392b', padding: '14px', fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', color: '#c0392b', background: 'transparent', cursor: 'pointer', borderRadius: '8px', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
                  Remove from trip
                </button>
                <button
                  onClick={() => setShowRemoveModal(null)}
                  style={{ width: '100%', border: '1px solid var(--border)', padding: '14px', fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', color: 'var(--muted-foreground)', background: 'transparent', cursor: 'pointer', borderRadius: '8px', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
                  ← Take me back
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {showCloseConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'var(--cream)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '32px', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
          <div style={{ width: '100%', maxWidth: '400px' }}>
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
              <div style={{ fontSize: '40px', marginBottom: '16px' }}>🔒</div>
              <p style={{ fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted-foreground)', margin: '0 0 10px' }}>Close invite link</p>
              <h2 style={{ fontSize: '28px', fontWeight: 300, color: 'var(--foreground)', margin: '0 0 16px' }}>Ready to lock the group?</h2>
              <p style={{ fontSize: '13px', color: 'var(--muted-foreground)', lineHeight: 1.8, margin: 0 }}>
                Once you close the invite link, no new guests can join.<br/>
                <strong style={{ color: 'var(--foreground)', fontWeight: 400 }}>This cannot be undone.</strong>
              </p>
            </div>

            <div style={{ background: '#faeeda', border: '0.5px solid #ef9f27', borderRadius: '10px', padding: '16px', marginBottom: '28px' }}>
              <p style={{ fontSize: '12px', color: '#854f0b', margin: '0 0 6px', fontWeight: 500 }}>Before you close —</p>
              <p style={{ fontSize: '12px', color: '#633806', margin: 0, lineHeight: 1.7 }}>
                If anyone is on the fence about joining, invite them now. They'll have another chance to remove themselves from the group before final bookings are made — but they can't join after this point.
              </p>
            </div>

            <div style={{ background: '#fff', border: '0.5px solid var(--border)', borderRadius: '10px', padding: '14px 16px', marginBottom: '28px' }}>
              <p style={{ fontSize: '11px', color: 'var(--muted-foreground)', margin: '0 0 8px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Current group — {attendees.filter(a => a.status === 'approved' || a.role === 'organizer').length} confirmed</p>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {attendees.filter(a => a.status === 'approved' || a.role === 'organizer').map(att => (
                  <div key={att.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f5f5f0', padding: '4px 10px', borderRadius: '20px' }}>
                    <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: 'var(--forest-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', color: '#fff' }}>
                      {att.nickname?.charAt(0).toUpperCase() || att.full_name?.charAt(0).toUpperCase()}
                    </div>
                    <span style={{ fontSize: '11px', color: '#3a3a3a' }}>{att.nickname || att.full_name?.split(' ')[0]}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                onClick={handleCloseInvites}
                style={{ width: '100%', border: '1px solid var(--forest-deep)', background: 'var(--forest-deep)', color: '#fff', padding: '15px', fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '8px', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
                Lock the group →
              </button>
              <button
                onClick={() => setShowCloseConfirm(false)}
                style={{ width: '100%', border: '0.5px solid var(--border)', padding: '15px', fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', color: 'var(--muted-foreground)', background: 'transparent', cursor: 'pointer', borderRadius: '8px', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
                ← Not yet, go back
              </button>
            </div>
          </div>
        </div>
      )}
      <Footer />
    </div>
  )
}
