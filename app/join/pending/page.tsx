'use client'
import { useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import AvantiLogo from '../../components/AvantiLogo'

function PendingContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const tripName = searchParams.get('trip') || 'the trip'
  const tripId = searchParams.get('tripId')
  const [checking, setChecking] = useState(false)
  const s = { fontFamily: 'var(--font-cormorant), Georgia, serif' }

  useEffect(() => {
    const checkApproval = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      let query = supabase
        .from('travelers')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'approved')

      if (tripId) {
        query = query.eq('trip_id', tripId)
      }

      const { data: traveler } = await query.maybeSingle()

      if (traveler) {
        router.push(`/trips/${traveler.trip_id}`)
      }
    }

    checkApproval()
    const interval = setInterval(checkApproval, 3000)
    return () => clearInterval(interval)
  }, [router, tripId])

  return (
    <main style={{ minHeight: '100vh', background: '#fafaf8', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', ...s }}>
      <div style={{ width: '100%', maxWidth: '400px', textAlign: 'center' }}>
        <div style={{ marginBottom: '40px' }}><AvantiLogo size="sm" /></div>
        <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#faeeda', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: '24px' }}>⏳</div>
        <h2 style={{ fontSize: '28px', fontWeight: 300, color: '#1a1a1a', margin: '0 0 10px', ...s }}>Waiting for approval</h2>
        <p style={{ fontSize: '14px', color: '#9a9a8a', lineHeight: 1.7, margin: '0 0 8px' }}>
          You've requested to join <strong style={{ color: '#1a1a1a', fontWeight: 400 }}>{tripName}</strong>.
        </p>
        <p style={{ fontSize: '13px', color: '#b4b4a8', lineHeight: 1.7 }}>
          The trip organizer will approve your request shortly.
        </p>
        <div style={{ marginTop: '32px', padding: '16px', background: '#f5f5f0', borderRadius: '10px' }}>
          <p style={{ fontSize: '12px', color: '#9a9a8a', margin: 0, lineHeight: 1.6 }}>
            Checking for approval automatically — this page will update the moment you're approved.
          </p>
        </div>
        <div style={{ marginTop: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#2d5a18', animation: 'pulse 1.5s infinite' }} />
          <p style={{ fontSize: '11px', color: '#9a9a8a', margin: 0, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Waiting...</p>
        </div>
      </div>
      <style>{`@keyframes pulse { 0%, 100% { opacity: 0.3; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1.2); } }`}</style>
    </main>
  )
}

export default function PendingPage() {
  return (
    <Suspense fallback={null}>
      <PendingContent />
    </Suspense>
  )
}
