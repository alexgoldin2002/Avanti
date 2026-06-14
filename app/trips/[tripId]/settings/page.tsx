'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import AvantiLogo from '../../../components/AvantiLogo'
import Footer from '../../../components/Footer'

export default function TripSettings() {
  const params = useParams()
  const router = useRouter()
  const tripId = params.tripId as string
  const [trip, setTrip] = useState<any>(null)
  const [settings, setSettings] = useState({
    max_vote_options_per_person: 3,
    show_member_conversations: true,
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [isOrganizer, setIsOrganizer] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: tripData } = await supabase.from('trips').select('*').eq('id', tripId).single()
      if (tripData) {
        setTrip(tripData)
        if (user) setIsOrganizer(tripData.organizer_id === user.id)
      }
      const { data: settingsData } = await supabase.from('trip_settings').select('*').eq('trip_id', tripId).maybeSingle()
      if (settingsData) setSettings({ max_vote_options_per_person: settingsData.max_vote_options_per_person, show_member_conversations: settingsData.show_member_conversations })
    }
    load()
  }, [tripId])

  const handleSave = async () => {
    setSaving(true)
    await supabase.from('trip_settings').upsert({ trip_id: tripId, ...settings, updated_at: new Date().toISOString() }, { onConflict: 'trip_id' })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const s = { fontFamily: 'var(--font-cormorant), Georgia, serif' }

  if (!trip) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: '100%', background: 'var(--cream)', ...s }}>
      <div style={{ flex: 1, maxWidth: '560px', margin: '0 auto', padding: '40px 24px', width: '100%' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '36px' }}>
          <AvantiLogo size="sm" />
          <button onClick={() => router.push(`/trips/${tripId}`)} style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--muted-foreground)', background: 'none', border: 'none', cursor: 'pointer', ...s }}>← Back to trip</button>
        </div>

        <h1 style={{ fontSize: '32px', fontWeight: 300, color: 'var(--foreground)', margin: '0 0 32px', ...s }}>Trip settings</h1>

        {!isOrganizer && (
          <div style={{ padding: '16px', background: '#faeeda', border: '0.5px solid #ef9f27', borderRadius: '10px', marginBottom: '24px' }}>
            <p style={{ fontSize: '13px', color: '#854f0b', margin: 0 }}>Only the trip organizer can change these settings.</p>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          <div style={{ background: '#fff', border: '0.5px solid var(--border)', borderRadius: '14px', padding: '20px' }}>
            <p style={{ fontSize: '13px', color: 'var(--foreground)', margin: '0 0 4px', ...s }}>Options per person per vote</p>
            <p style={{ fontSize: '11px', color: 'var(--muted-foreground)', margin: '0 0 14px', lineHeight: 1.6 }}>How many options can each member add to a group vote</p>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[1, 2, 3, 5, 99].map(n => (
                <button key={n} onClick={() => isOrganizer && setSettings(s => ({ ...s, max_vote_options_per_person: n }))}
                  style={{ flex: 1, padding: '10px 6px', border: `1.5px solid ${settings.max_vote_options_per_person === n ? 'var(--forest-deep)' : 'var(--border)'}`, background: settings.max_vote_options_per_person === n ? 'var(--accent-light)' : 'transparent', color: settings.max_vote_options_per_person === n ? 'var(--forest-deep)' : 'var(--muted-foreground)', fontSize: '13px', cursor: isOrganizer ? 'pointer' : 'default', borderRadius: '8px', ...s }}>
                  {n === 99 ? '∞' : n}
                </button>
              ))}
            </div>
          </div>

          <div style={{ background: '#fff', border: '0.5px solid var(--border)', borderRadius: '14px', padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: '13px', color: 'var(--foreground)', margin: '0 0 4px', ...s }}>Show member conversations</p>
                <p style={{ fontSize: '11px', color: 'var(--muted-foreground)', margin: 0, lineHeight: 1.5 }}>Allow everyone to read each other's Avanti planning conversations</p>
              </div>
              <button onClick={() => isOrganizer && setSettings(s => ({ ...s, show_member_conversations: !s.show_member_conversations }))}
                style={{ width: '44px', height: '24px', borderRadius: '12px', background: settings.show_member_conversations ? 'var(--forest)' : 'var(--border)', border: 'none', cursor: isOrganizer ? 'pointer' : 'default', position: 'relative', transition: 'background 0.2s', flexShrink: 0, marginLeft: '20px' }}>
                <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '3px', left: settings.show_member_conversations ? '23px' : '3px', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
              </button>
            </div>
          </div>

        </div>

        {isOrganizer && (
          <button onClick={handleSave} disabled={saving}
            style={{ width: '100%', border: '1px solid var(--forest-deep)', background: 'var(--forest-deep)', color: '#fff', padding: '16px', fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '10px', marginTop: '24px', opacity: saving ? 0.6 : 1, ...s }}>
            {saved ? 'Saved ✓' : saving ? 'Saving...' : 'Save settings'}
          </button>
        )}

      </div>
      <Footer />
    </div>
  )
}
