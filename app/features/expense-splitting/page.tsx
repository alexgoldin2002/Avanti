'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import AvantiLogo from '../../components/AvantiLogo'
import SuitcaseLoader from '../../components/SuitcaseLoader'

export default function ExpenseSplittingHome() {
  const router = useRouter()
  const [trips, setTrips] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const s = { fontFamily: 'var(--font-cormorant), Georgia, serif' }

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      const { data: profile } = await supabase.from('user_profiles').select('email').eq('user_id', user.id).single()
      const { data: travelerRows } = await supabase
        .from('travelers')
        .select('trip_id')
        .eq('email', profile?.email || '')
      const tripIds = travelerRows?.map(t => t.trip_id) || []
      if (tripIds.length === 0) { setLoading(false); return }
      const { data: tripData } = await supabase
        .from('trips')
        .select('*')
        .in('id', tripIds)
        .order('created_at', { ascending: false })
      setTrips(tripData || [])
      setLoading(false)
    }
    load()
  }, [router])

  const STEP_COLORS = [
    '#1a6a3e','#2a7a1e','#3a7a14','#4a7a10','#5a7a0a','#6a7a0a','#7a7a14','#8a7a18'
  ]

  if (loading) return <SuitcaseLoader message="Loading your trips" />

  return (
    <main style={{ minHeight: '100vh', background: '#fafaf8', ...s }}>
      <div style={{ maxWidth: '480px', margin: '0 auto', padding: '48px 24px 80px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
          <AvantiLogo size="sm" />
          <button onClick={() => router.back()} style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#9a9a8a', background: 'none', border: 'none', cursor: 'pointer', ...s }}>← Back</button>
        </div>
        <p style={{ fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', color: '#9a9a8a', margin: '0 0 8px' }}>Expenses</p>
        <h1 style={{ fontSize: '36px', fontWeight: 300, color: '#1a1a1a', margin: '0 0 8px' }}>Split bills</h1>
        <p style={{ fontSize: '13px', color: '#9a9a8a', margin: '0 0 32px', lineHeight: 1.6 }}>Each trip has its own expense group. All travelers are added automatically.</p>
        {trips.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <p style={{ fontSize: '14px', color: '#b4b4a8', fontStyle: 'italic', marginBottom: '8px' }}>No trips yet.</p>
            <p style={{ fontSize: '12px', color: '#b4b4a8' }}>Create a trip first and your expense group will appear here.</p>
            <button onClick={() => router.push('/dashboard')} style={{ marginTop: '24px', border: '1px solid #1a1a1a', padding: '12px 24px', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#1a1a1a', background: 'transparent', cursor: 'pointer', ...s }}>
              Go to dashboard →
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {trips.map((trip, i) => (
              <button key={trip.id} onClick={() => router.push(`/features/expense-splitting/${trip.id}`)}
                style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '18px 20px', background: '#fff', border: '0.5px solid #e4e4d8', borderRadius: '14px', cursor: 'pointer', textAlign: 'left', width: '100%' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: STEP_COLORS[i % STEP_COLORS.length], display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '15px', fontWeight: 400, color: '#1a1a1a', margin: '0 0 3px', ...s }}>{trip.name}</p>
                  <p style={{ fontSize: '11px', color: '#9a9a8a', margin: 0 }}>{trip.destination} {trip.start_date ? `· ${trip.start_date}` : ''}</p>
                </div>
                <span style={{ fontSize: '18px', color: '#9a9a8a' }}>›</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
