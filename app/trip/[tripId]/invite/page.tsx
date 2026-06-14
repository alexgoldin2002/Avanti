'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import AvantiLogo from '../../../components/AvantiLogo'

export default function InvitePage() {
  const params = useParams()
  const router = useRouter()
  const tripId = params.tripId as string
  const [trip, setTrip] = useState<any>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    supabase.from('trips').select('*').eq('id', tripId).single().then(({ data }) => {
      if (data) setTrip(data)
    })
  }, [tripId])

  if (!trip) return null

  const inviteUrl = typeof window !== 'undefined' ? `${window.location.origin}/join/${trip.invite_code}` : ''
  const message = `You are invited to ${trip.name} on Avanti. Join here: ${inviteUrl}`
  const joinCode = trip.join_code ? ` Your join code is: ${trip.join_code}` : ''
  const fullMessage = message + joinCode

  const copyLink = () => {
    navigator.clipboard.writeText(inviteUrl + (trip.join_code ? ` — code: ${trip.join_code}` : ''))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const nativeShare = async () => {
    if (navigator.share) {
      await navigator.share({ title: trip.name, text: fullMessage, url: inviteUrl })
    } else {
      copyLink()
    }
  }

  const shareOptions = [
    {
      label: 'Share',
      sublabel: 'Messages, WhatsApp, AirDrop...',
      icon: '↑',
      action: nativeShare,
      primary: true,
    },
    {
      label: 'Copy link',
      sublabel: copied ? 'Copied!' : 'Copy to clipboard',
      icon: copied ? '✓' : '⎘',
      action: copyLink,
      primary: false,
    },
    {
      label: 'WhatsApp',
      sublabel: 'Send via WhatsApp',
      icon: 'W',
      action: () => window.open(`https://wa.me/?text=${encodeURIComponent(fullMessage)}`),
      primary: false,
    },
    {
      label: 'Gmail',
      sublabel: 'Send via Gmail',
      icon: 'G',
      action: () => window.open(`https://mail.google.com/mail/?view=cm&body=${encodeURIComponent(fullMessage)}&su=${encodeURIComponent('Join me on Avanti — ' + trip.name)}`),
      primary: false,
    },
    {
      label: 'Email',
      sublabel: 'Open in Mail app',
      icon: '✉',
      action: () => window.open(`mailto:?subject=${encodeURIComponent('Join me on Avanti — ' + trip.name)}&body=${encodeURIComponent(fullMessage)}`),
      primary: false,
    },
    {
      label: 'SMS',
      sublabel: 'Send a text message',
      icon: '✆',
      action: () => window.open(`sms:?body=${encodeURIComponent(fullMessage)}`),
      primary: false,
    },
  ]

  const s = { fontFamily: 'var(--font-cormorant), Georgia, serif' }

  return (
    <main style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', ...s }}>
      <div style={{ width: '100%', maxWidth: '480px' }}>
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <AvantiLogo size="sm" />
          <p style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted-foreground)', marginTop: '16px' }}>Your trip is ready</p>
          <h2 style={{ fontSize: '32px', fontWeight: 300, color: 'var(--foreground)', margin: '8px 0 0' }}>{trip.name}</h2>
          <p style={{ fontSize: '13px', color: 'var(--muted-foreground)', margin: '6px 0 0' }}>{trip.destination}</p>
        </div>

        {trip.join_code && (
          <div style={{ background: '#f0f0e8', padding: '20px 24px', marginBottom: '24px', textAlign: 'center' }}>
            <p style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted-foreground)', marginBottom: '8px' }}>Join code</p>
            <p style={{ fontSize: '32px', fontWeight: 300, color: 'var(--foreground)', margin: '0 0 6px', letterSpacing: '0.4em' }}>{trip.join_code}</p>
            <p style={{ fontSize: '11px', color: 'var(--muted-foreground)', margin: 0 }}>Share this with your group along with the invite link</p>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
          {shareOptions.map(opt => (
            <button key={opt.label} onClick={opt.action}
              style={{
                display: 'flex', alignItems: 'center', gap: '16px',
                padding: '16px 20px',
                border: `1px solid ${opt.primary ? 'var(--foreground)' : 'var(--border)'}`,
                background: opt.primary ? 'var(--foreground)' : '#fff',
                cursor: 'pointer', textAlign: 'left', ...s,
                transition: 'all 0.2s',
              }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '50%',
                background: opt.primary ? 'rgba(255,255,255,0.15)' : '#f5f5f0',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '16px', color: opt.primary ? 'var(--cream)' : 'var(--foreground)',
                flexShrink: 0,
              }}>{opt.icon}</div>
              <div>
                <p style={{ fontSize: '13px', fontWeight: 500, color: opt.primary ? 'var(--cream)' : 'var(--foreground)', margin: '0 0 2px', letterSpacing: '0.05em' }}>{opt.label}</p>
                <p style={{ fontSize: '11px', color: opt.primary ? 'rgba(255,255,255,0.6)' : 'var(--muted-foreground)', margin: 0 }}>{opt.sublabel}</p>
              </div>
            </button>
          ))}
        </div>

        <button onClick={() => router.push(`/trip/${tripId}/dashboard`)}
          style={{ width: '100%', border: '1px solid var(--border)', padding: '14px', fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', color: 'var(--muted-foreground)', background: 'transparent', cursor: 'pointer', ...s }}>
          Go to trip dashboard →
        </button>
      </div>
    </main>
  )
}
