'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import AvantiLogo from '../../../components/AvantiLogo'
import SuitcaseLoader from '../../../components/SuitcaseLoader'

export default function TripSettings() {
  const { tripId } = useParams() as { tripId: string }
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [trip, setTrip] = useState<any>(null)
  const [maxVotes, setMaxVotes] = useState(2)
  const [travelerCount, setTravelerCount] = useState(0)

  const s = { fontFamily: 'var(--font-cormorant), Georgia, serif' }
  const labelStyle = { fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase' as const, color: '#9a9a8a', display: 'block', marginBottom: '6px' }

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }

      const { data: tripData } = await supabase.from('trips').select('*').eq('id', tripId).single()
      if (tripData) {
        setTrip(tripData)
        const { count } = await supabase.from('travelers').select('*', { count: 'exact', head: true }).eq('trip_id', tripId)
        const tc = count || 0
        setTravelerCount(tc)
        setMaxVotes(tripData.max_votes ?? (tc <= 8 ? 2 : 1))
      }
      setLoading(false)
    }
    load()
  }, [tripId, router])

  const save = async () => {
    setSaving(true)
    await supabase.from('trips').update({ max_votes: maxVotes }).eq('id', tripId)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) return <SuitcaseLoader message="Loading settings" />

  return (
    <main style={{ minHeight: '100vh', background: '#fafaf8', ...s }}>
      <div style={{ maxWidth: '560px', margin: '0 auto', padding: '48px 24px 80px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
          <AvantiLogo size="sm" />
          <button onClick={() => router.push(`/trips/${tripId}`)} style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#9a9a8a', background: 'none', border: 'none', cursor: 'pointer', ...s }}>
            ← Back
          </button>
        </div>

        <p style={{ fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', color: '#9a9a8a', margin: '0 0 6px' }}>
          {trip?.name}
        </p>
        <h1 style={{ fontSize: '36px', fontWeight: 300, color: '#1a1a1a', margin: '0 0 40px' }}>Trip settings</h1>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          <div style={{ background: '#fff', border: '0.5px solid #e4e4d8', borderRadius: '12px', padding: '24px' }}>
            <label style={labelStyle}>Max votes per traveler</label>
            <p style={{ fontSize: '12px', color: '#9a9a8a', margin: '0 0 16px', lineHeight: 1.6 }}>
              How many destination cards each traveler can vote for.
              {travelerCount > 0 && ` Auto-set to ${travelerCount <= 8 ? '2' : '1'} based on your group size of ${travelerCount}.`}
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[1, 2, 3, 4].map(n => (
                <button
                  key={n}
                  onClick={() => setMaxVotes(n)}
                  style={{
                    width: '48px', height: '48px', borderRadius: '50%', fontSize: '16px',
                    border: `1.5px solid ${maxVotes === n ? '#1a3a2a' : '#d4d4c8'}`,
                    background: maxVotes === n ? '#e8f5ee' : 'transparent',
                    color: maxVotes === n ? '#1a3a2a' : '#6a6a6a',
                    cursor: 'pointer', fontWeight: maxVotes === n ? 500 : 400, ...s,
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div style={{ padding: '20px', border: '0.5px dashed #d4d4c8', borderRadius: '12px', textAlign: 'center' }}>
            <p style={{ fontSize: '13px', color: '#b4b4a8', margin: 0, fontStyle: 'italic' }}>More settings coming soon</p>
          </div>

          <button
            onClick={save}
            disabled={saving}
            style={{
              width: '100%', border: '1px solid #1a3a2a', padding: '16px',
              fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase',
              color: '#fafaf8', background: saved ? '#2d6a4f' : '#1a3a2a',
              cursor: 'pointer', opacity: saving ? 0.6 : 1, transition: 'background 0.3s', ...s,
            }}
          >
            {saving ? 'Saving...' : saved ? 'Saved ✓' : 'Save settings →'}
          </button>
        </div>
      </div>
    </main>
  )
}
