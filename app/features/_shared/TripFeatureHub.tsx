'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { fetchUserTrips, filterTripsWithDestination } from '@/lib/user-trips'
import AvantiLogo from '../../components/AvantiLogo'
import SuitcaseLoader from '../../components/SuitcaseLoader'

const STEP_COLORS = [
  '#1a6a3e', '#2a7a1e', '#3a7a14', '#4a7a10', '#5a7a0a', '#6a7a0a', '#7a7a14', '#8a7a18',
]

type TripFeatureHubProps = {
  eyebrow: string
  title: string
  description: string
  /** Path after trip id, e.g. `/trips/${id}/saves` or `/trips/${id}?tab=gametime` */
  tripPath: (tripId: string) => string
  icon?: React.ReactNode
  /** Only show trips with a locked destination */
  requireDestination?: boolean
}

export default function TripFeatureHub({
  eyebrow,
  title,
  description,
  tripPath,
  icon,
  requireDestination = false,
}: TripFeatureHubProps) {
  const router = useRouter()
  const [trips, setTrips] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const s = { fontFamily: 'var(--font-cormorant), Georgia, serif' }

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/')
        return
      }
      const all = await fetchUserTrips(supabase, user.id)
      const filtered = requireDestination ? filterTripsWithDestination(all) : all
      setTrips(filtered)
      setLoading(false)
    }
    load()
  }, [router, requireDestination])

  if (loading) return <SuitcaseLoader message="Loading your trips" />

  return (
    <main style={{ minHeight: '100vh', background: '#ffffff', ...s }}>
      <div style={{ maxWidth: '480px', margin: '0 auto', padding: '48px 24px 80px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
          <AvantiLogo size="sm" />
          <button
            type="button"
            onClick={() => router.push('/features')}
            style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#9a9a8a', background: 'none', border: 'none', cursor: 'pointer', ...s }}
          >
            ← Features
          </button>
        </div>
        <p style={{ fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', color: '#9a9a8a', margin: '0 0 8px' }}>{eyebrow}</p>
        <h1 style={{ fontSize: '36px', fontWeight: 300, color: '#1a1a1a', margin: '0 0 8px' }}>{title}</h1>
        <p style={{ fontSize: '13px', color: '#9a9a8a', margin: '0 0 32px', lineHeight: 1.6 }}>{description}</p>

        {trips.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <p style={{ fontSize: '14px', color: '#b4b4a8', fontStyle: 'italic', marginBottom: '8px' }}>
              {requireDestination ? 'No trips with a locked destination yet.' : 'No trips yet.'}
            </p>
            <p style={{ fontSize: '12px', color: '#b4b4a8' }}>
              {requireDestination
                ? 'Complete Choose destination on a trip first — then it appears here.'
                : 'Create or join a trip from your dashboard.'}
            </p>
            <button
              type="button"
              onClick={() => router.push('/dashboard')}
              style={{ marginTop: '24px', border: '1px solid #1a1a1a', padding: '12px 24px', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#1a1a1a', background: 'transparent', cursor: 'pointer', ...s }}
            >
              Go to dashboard →
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {trips.map((trip, i) => (
              <button
                key={trip.id}
                type="button"
                onClick={() => router.push(tripPath(trip.id))}
                style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '18px 20px', background: '#fff', border: '0.5px solid #e4e4d8', borderRadius: '14px', cursor: 'pointer', textAlign: 'left', width: '100%' }}
              >
                <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: STEP_COLORS[i % STEP_COLORS.length], display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#fff' }}>
                  {icon || (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    </svg>
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '15px', fontWeight: 400, color: '#1a1a1a', margin: '0 0 3px', ...s }}>{trip.name}</p>
                  <p style={{ fontSize: '11px', color: '#9a9a8a', margin: 0 }}>
                    {trip.destination || 'Destination TBD'}
                    {trip.start_date ? ` · ${trip.start_date}` : ''}
                  </p>
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
