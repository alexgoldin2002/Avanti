'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import AvantiLogo from '../../../../components/AvantiLogo'
import SuitcaseLoader from '../../../../components/SuitcaseLoader'

export default function DestinationDeepDive() {
  const { tripId, destinationName } = useParams() as { tripId: string; destinationName: string }
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [card, setCard] = useState<any>(null)
  const [trip, setTrip] = useState<any>(null)

  const s = { fontFamily: 'var(--font-cormorant), Georgia, serif' }
  const name = decodeURIComponent(destinationName)

  useEffect(() => {
    const load = async () => {
      const { data: tripData } = await supabase.from('trips').select('*').eq('id', tripId).single()
      if (tripData) setTrip(tripData)
      const { data } = await supabase.from('trip_destinations').select('cards').eq('trip_id', tripId).single()
      if (data?.cards) {
        const found = data.cards.find((c: any) =>
          c.name?.toLowerCase() === name.toLowerCase() ||
          c.name?.toLowerCase().includes(name.toLowerCase().split(',')[0].toLowerCase())
        )
        if (found) setCard(found)
      }
      setLoading(false)
    }
    load()
  }, [tripId, name])

  if (loading) return <SuitcaseLoader message="Loading" />
  if (!card) return (
    <main style={{ minHeight: '100vh', background: '#fafaf8', ...s }}>
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '48px 24px' }}>
        <button onClick={() => router.back()} style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#9a9a8a', background: 'none', border: 'none', cursor: 'pointer', ...s }}>← Back</button>
        <p style={{ marginTop: '32px', color: '#9a9a8a' }}>Destination not found.</p>
      </div>
    </main>
  )

  const parseBullets = (text: string): string[] => {
    if (!text) return []
    return text.split('\n').map((l: string) => l.replace(/^[-•*]\s*/, '').trim()).filter((l: string) => l.length > 2)
  }

  const sections = [
    { label: 'Getting there', content: card.logistics },
    { label: 'Cost breakdown', content: card.cost },
    { label: 'Weather', content: card.weather },
    { label: 'Activities', content: card.activities },
    { label: 'Group fit', content: card.groupFit },
    { label: 'Vibe check', content: card.vibeCheck },
    ...(card.tradeoff ? [{ label: 'Honest tradeoff', content: card.tradeoff }] : []),
    ...(card.footnotes ? [{ label: 'Things to know', content: card.footnotes }] : []),
  ].filter(sec => sec.content?.trim())

  return (
    <main style={{ minHeight: '100vh', background: '#fafaf8', ...s }}>
      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '48px 24px 80px' }}>

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

        <div style={{ display: 'flex', gap: '8px', margin: '0 0 12px', flexWrap: 'wrap' }}>
          {card.highlight && (
            <span style={{ fontSize: '11px', padding: '4px 12px', borderRadius: '20px', background: '#e8f5ee', color: '#1a3a2a', border: '0.5px solid #a8d4b8', ...s }}>
              {card.highlight}
            </span>
          )}
          {card.consider && (
            <span style={{ fontSize: '11px', padding: '4px 12px', borderRadius: '20px', background: '#fef9ec', color: '#8a6a10', border: '0.5px solid #f0c040', ...s }}>
              {card.consider}
            </span>
          )}
        </div>

        <h1 style={{ fontSize: '40px', fontWeight: 300, color: '#1a1a1a', margin: '0 0 6px', lineHeight: 1.15 }}>{card.name}</h1>
        {card.cost && (
          <p style={{ fontSize: '15px', color: '#9a9a8a', margin: '0 0 20px' }}>
            {card.cost.match(/\$[\d,]+[–\-]\$?[\d,]+/)?.[0] || card.cost.split('\n')[0].slice(0, 40)} / person
          </p>
        )}
        <p style={{ fontSize: '16px', color: '#3a3a3a', lineHeight: 1.8, margin: '0 0 40px' }}>{card.synopsis}</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {sections.map((section, i) => (
            <div key={i}>
              <p style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#9a9a8a', margin: '0 0 12px' }}>{section.label}</p>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {parseBullets(section.content).map((bullet, bi) => (
                  <li key={bi} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <span style={{ fontSize: '12px', color: '#c4c4b8', flexShrink: 0, marginTop: '3px' }}>—</span>
                    <span style={{ fontSize: '15px', color: '#1a1a1a', lineHeight: 1.7 }}>{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '48px' }}>
          <button
            onClick={() => router.push(`/trips/${tripId}/vote`)}
            style={{ width: '100%', padding: '16px', border: 'none', background: '#1a3a2a', color: '#fafaf8', fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', cursor: 'pointer', ...s }}
          >
            Go to voting →
          </button>
          <button
            onClick={() => router.push(`/trips/${tripId}/destinations/reasoning`)}
            style={{ width: '100%', padding: '14px', border: '0.5px solid #d4d4c8', background: 'transparent', color: '#9a9a8a', fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', cursor: 'pointer', ...s }}
          >
            Why Avanti passed on others
          </button>
        </div>

      </div>
    </main>
  )
}
