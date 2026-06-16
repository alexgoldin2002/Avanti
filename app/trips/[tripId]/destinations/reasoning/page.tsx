'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import AvantiLogo from '../../../../components/AvantiLogo'
import SuitcaseLoader from '../../../../components/SuitcaseLoader'

export default function ReasoningPage() {
  const { tripId } = useParams() as { tripId: string }
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [whyNot, setWhyNot] = useState<{ name: string; reasons: string[] }[]>([])
  const [trip, setTrip] = useState<any>(null)

  const s = { fontFamily: 'var(--font-cormorant), Georgia, serif' }

  useEffect(() => {
    const load = async () => {
      const { data: tripData } = await supabase.from('trips').select('*').eq('id', tripId).single()
      if (tripData) setTrip(tripData)
      const { data } = await supabase.from('trip_destinations').select('why_not').eq('trip_id', tripId).single()
      if (data?.why_not) setWhyNot(data.why_not)
      setLoading(false)
    }
    load()
  }, [tripId])

  if (loading) return <SuitcaseLoader message="Loading" />

  return (
    <main style={{ minHeight: '100vh', background: '#fafaf8', ...s }}>
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '48px 24px 80px' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
          <AvantiLogo size="sm" />
          <button
            onClick={() => router.back()}
            style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#9a9a8a', background: 'none', border: 'none', cursor: 'pointer', ...s }}
          >
            ← Back
          </button>
        </div>

        <p style={{ fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', color: '#9a9a8a', margin: '0 0 6px' }}>{trip?.name}</p>
        <h1 style={{ fontSize: '36px', fontWeight: 300, color: '#1a1a1a', margin: '0 0 8px' }}>Why not these?</h1>
        <p style={{ fontSize: '14px', color: '#9a9a8a', margin: '0 0 40px', lineHeight: 1.6 }}>
          Destinations Avanti seriously considered for your group — and why they didn&apos;t make the cut.
        </p>

        {whyNot.length === 0 ? (
          <p style={{ fontSize: '13px', color: '#b4b4a8', fontStyle: 'italic' }}>No reasoning available yet. Generate destinations first.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {whyNot.map((item, i) => (
              <div key={i} style={{ borderBottom: '0.5px solid #e4e4d8', paddingBottom: '24px' }}>
                <h3 style={{ fontSize: '22px', fontWeight: 400, color: '#1a1a1a', margin: '0 0 12px', ...s }}>{item.name}</h3>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {item.reasons.map((reason, ri) => (
                    <li key={ri} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                      <span style={{ fontSize: '12px', color: '#c4c4b8', flexShrink: 0, marginTop: '2px' }}>—</span>
                      <span style={{ fontSize: '14px', color: '#3a3a3a', lineHeight: 1.6 }}>{reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: '40px' }}>
          <button
            onClick={() => router.push(`/trips/${tripId}/vote`)}
            style={{ width: '100%', padding: '16px', border: '1px solid #1a3a2a', background: '#1a3a2a', color: '#fafaf8', fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', cursor: 'pointer', ...s }}
          >
            Go to voting →
          </button>
        </div>

      </div>
    </main>
  )
}
