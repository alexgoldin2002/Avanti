'use client'
import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import StepLayout from '../step-layout'

const VIBE_TAGS = [
  'Beach', 'Hiking', 'Nightlife', 'Fine dining', 'Street food', 'Culture & museums',
  'Boat days', 'Slow mornings', 'Late nights', 'Local markets', 'Off the beaten path',
  'Wellness & spa', 'Shopping', 'Architecture', 'Photography', 'Adventure sports',
  'Wine & drinks', 'Live music', 'Relaxed pace', 'Packed schedule'
]

const MUST_DOS_BY_DESTINATION: Record<string, string[]> = {
  greece: ['Sunset in Oia', 'Beach club day', 'Fresh fish at a harbor taverna', 'Ferry between islands', 'Explore old town', 'Delos day trip', 'Little Venice (Mykonos)', 'Day trip to Delphi', 'Athens Acropolis'],
  mykonos: ['Beach club day', 'Little Venice sunset', 'Delos day trip', 'Fresh fish at harbor', 'Party on Super Paradise Beach', 'Windmills at sunset'],
  italy: ['Colosseum & Roman Forum', 'Vatican Museums', 'Aperitivo hour', 'Fresh pasta class', 'Amalfi Coast drive', 'Pompeii', 'Cinque Terre', 'Florence Uffizi', 'Venice gondola'],
  paris: ['Eiffel Tower', 'Louvre', 'Montmartre walk', 'Seine river cruise', 'Day trip to Versailles', 'Père Lachaise', 'French pastry tour'],
  japan: ['Tsukiji fish market', 'Shibuya crossing', 'Fushimi Inari hike', 'Bullet train', 'Tea ceremony', 'Onsen experience', 'Mount Fuji day trip'],
  default: ['Local food tour', 'Day trip outside the city', 'Sunset viewpoint', 'Historic old town', 'Local market', 'Cooking class', 'Boat or water activity']
}

function getMustDos(destination: string): string[] {
  const d = destination.toLowerCase()
  for (const key of Object.keys(MUST_DOS_BY_DESTINATION)) {
    if (d.includes(key)) return MUST_DOS_BY_DESTINATION[key]
  }
  return MUST_DOS_BY_DESTINATION.default
}

export default function PreferencesPage() {
  const params = useParams()
  const router = useRouter()
  const tripId = params.tripId as string
  const [trip, setTrip] = useState<any>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [deadline, setDeadline] = useState('')
  const [mustDoOptions, setMustDoOptions] = useState<string[]>([])
  const saveTimer = useRef<any>(null)
  const [autoSaved, setAutoSaved] = useState(false)

  const [form, setForm] = useState({
    departure_city: '',
    available_from: '',
    available_to: '',
    budget_accommodation_comfortable: 100,
    budget_accommodation_ideal: 150,
    budget_accommodation_max: 250,
    budget_dining_comfortable: 50,
    budget_dining_ideal: 75,
    budget_dining_max: 150,
    budget_experience_comfortable: 50,
    budget_experience_ideal: 100,
    budget_experience_max: 200,
    budget_transport_comfortable: 30,
    budget_transport_ideal: 50,
    budget_transport_max: 100,
    vibe_tags: [] as string[],
    vibe_freetext: '',
    must_dos: {} as Record<string, 'yes' | 'no' | 'maybe'>,
  })

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setUserId(user.id)
      const { data: tripData } = await supabase.from('trips').select('*').eq('id', tripId).single()
      if (tripData) {
        setTrip(tripData)
        setMustDoOptions(getMustDos(tripData.destination || ''))
        if (tripData.preferences_deadline) setDeadline(tripData.preferences_deadline.split('T')[0])
      }
      if (user) {
        const { data: existing } = await supabase.from('trip_preferences').select('*').eq('trip_id', tripId).eq('user_id', user.id).maybeSingle()
        if (existing) setForm((f: any) => ({ ...f, ...existing }))
        const { data: profile } = await supabase.from('user_profiles').select('*').eq('user_id', user.id).maybeSingle()
        if (profile && !existing) setForm((f: any) => ({ ...f }))
      }
    }
    load()
  }, [tripId])

  const autoSave = (updatedForm: typeof form, updatedDeadline?: string) => {
    if (!userId) return
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      await supabase.from('trip_preferences').upsert({
        trip_id: tripId,
        user_id: userId,
        ...updatedForm,
      })
      const dl = updatedDeadline ?? deadline
      if (dl) {
        await supabase.from('trips').update({ preferences_deadline: new Date(dl).toISOString() }).eq('id', tripId)
      }
      setAutoSaved(true)
      setTimeout(() => setAutoSaved(false), 2000)
    }, 1500)
  }

  const toggleVibeTag = (tag: string) => {
    const updated = { ...form, vibe_tags: form.vibe_tags.includes(tag) ? form.vibe_tags.filter(t => t !== tag) : [...form.vibe_tags, tag] }
    setForm(updated)
    autoSave(updated)
  }

  const setMustDo = (item: string, val: 'yes' | 'no' | 'maybe') => {
    const updated = { ...form, must_dos: { ...form.must_dos, [item]: val } }
    setForm(updated)
    autoSave(updated)
  }

  const handleSave = async (submit = false) => {
    setSaving(true)
    await supabase.from('trip_preferences').upsert({
      trip_id: tripId, user_id: userId, ...form,
      submitted_at: submit ? new Date().toISOString() : null,
    })
    if (deadline) {
      await supabase.from('trips').update({ preferences_deadline: new Date(deadline).toISOString() }).eq('id', tripId)
    }
    setSaving(false)
    if (submit) { setSaved(true); setTimeout(() => router.push(`/trips/${tripId}`), 1500) }
  }

  const s = { fontFamily: 'var(--font-cormorant), Georgia, serif' }
  const inputStyle = { width: '100%', borderBottom: '1px solid #d4d4c8', background: 'transparent', padding: '8px 0', fontSize: '14px', color: '#1a1a1a', outline: 'none', ...s }
  const labelStyle = { fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase' as const, color: '#9a9a8a', display: 'block', marginBottom: '6px' }
  const sectionStyle = { fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase' as const, color: '#9a9a8a', borderBottom: '1px solid #e8e8e0', paddingBottom: '8px', marginBottom: '16px', marginTop: '8px' }

  if (!trip) return null

  if (saved) return (
    <StepLayout tripId={tripId} stepNumber={2} stepTitle="Preference input">
      <div style={{ textAlign: 'center', padding: '32px 0' }}>
        <p style={{ fontSize: '32px', marginBottom: '16px' }}>✓</p>
        <p style={{ fontSize: '18px', fontWeight: 300, color: '#2d5a18', ...s }}>Preferences submitted</p>
        <p style={{ fontSize: '13px', color: '#9a9a8a', marginTop: '8px' }}>Returning to trip dashboard...</p>
      </div>
    </StepLayout>
  )

  return (
    <StepLayout tripId={tripId} stepNumber={2} stepTitle="Preference input" stepDescription="Tell Avanti what you want from this trip. The more you share, the better the plan." autoSaved={autoSaved}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
        {autoSaved && (
          <p style={{ fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#2d5a18', textAlign: 'right', marginBottom: '8px' }}>✓ Saved</p>
        )}

        <div>
          <p style={sectionStyle}>Your dates & departure</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={labelStyle}>Departure city *</label>
              <input style={inputStyle} value={form.departure_city} onChange={e => { const updated = {...form, departure_city: e.target.value}; setForm(updated); autoSave(updated) }} placeholder="Chicago, IL" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={labelStyle}>Available from *</label>
                <input type="date" style={inputStyle} value={form.available_from} onChange={e => { const updated = {...form, available_from: e.target.value}; setForm(updated); autoSave(updated) }} />
              </div>
              <div>
                <label style={labelStyle}>Available to *</label>
                <input type="date" style={inputStyle} value={form.available_to} onChange={e => { const updated = {...form, available_to: e.target.value}; setForm(updated); autoSave(updated) }} />
              </div>
            </div>
          </div>
        </div>

        <div>
          <p style={sectionStyle}>Budget by category <span style={{ fontSize: '9px', color: '#b4b4a8', textTransform: 'none', letterSpacing: 0 }}>per person · per day</span></p>
          <p style={{ fontSize: '12px', color: '#9a9a8a', marginBottom: '16px', lineHeight: 1.7 }}>Set three levels for each category. Avanti uses these to find options that fit and flag trade-offs.</p>

          {[
            { key: 'accommodation', label: 'Accommodation', unit: 'per night' },
            { key: 'dining', label: 'Dining', unit: 'per day' },
            { key: 'experience', label: 'Experiences', unit: 'per activity' },
            { key: 'transport', label: 'Local transport', unit: 'per day' },
          ].map(cat => (
            <div key={cat.key} style={{ marginBottom: '20px' }}>
              <label style={{ ...labelStyle, marginBottom: '10px' }}>{cat.label} <span style={{ textTransform: 'none', letterSpacing: 0, fontSize: '10px', color: '#b4b4a8' }}>({cat.unit})</span></label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                {[
                  { tier: 'comfortable', label: 'Comfortable', color: '#2d5a18' },
                  { tier: 'ideal', label: 'Ideal', color: '#1a4a3a' },
                  { tier: 'max', label: 'Max ever', color: '#0a2a1e' },
                ].map(tier => (
                  <div key={tier.tier}>
                    <label style={{ fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#b4b4a8', display: 'block', marginBottom: '4px' }}>{tier.label}</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ fontSize: '12px', color: '#9a9a8a' }}>$</span>
                      <input type="number" min="0" max="10000" step="10"
                        value={(form as any)[`budget_${cat.key}_${tier.tier}`]}
                        onChange={e => { const updated = {...form, [`budget_${cat.key}_${tier.tier}`]: parseInt(e.target.value) || 0}; setForm(updated); autoSave(updated) }}
                        style={{ ...inputStyle, width: '100%', fontSize: '15px', fontWeight: 400 }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div>
          <p style={sectionStyle}>Vibe</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
            {VIBE_TAGS.map(tag => (
              <button key={tag} onClick={() => toggleVibeTag(tag)}
                style={{ padding: '6px 14px', fontSize: '12px', border: `1px solid ${form.vibe_tags.includes(tag) ? '#2d5a18' : '#d4d4c8'}`, background: form.vibe_tags.includes(tag) ? '#e8f0e4' : 'transparent', color: form.vibe_tags.includes(tag) ? '#2d5a18' : '#6a6a6a', cursor: 'pointer', borderRadius: '20px', transition: 'all 0.2s', ...s }}>
                {tag}
              </button>
            ))}
          </div>
          <label style={labelStyle}>Describe your ideal day on this trip</label>
          <p style={{ fontSize: '11px', color: '#b4b4a8', marginBottom: '8px', fontStyle: 'italic' }}>The more specific the better — Avanti reads every word.</p>
          <textarea value={form.vibe_freetext} onChange={e => { const updated = {...form, vibe_freetext: e.target.value}; setForm(updated); autoSave(updated) }}
            placeholder="Early morning hike, then beach by noon, fresh fish for lunch, afternoon nap, aperitivo in a piazza, late dinner somewhere local, maybe dancing after..."
            rows={5}
            style={{ width: '100%', border: '1px solid #d4d4c8', background: 'transparent', padding: '12px', fontSize: '14px', color: '#1a1a1a', outline: 'none', resize: 'vertical', lineHeight: 1.7, ...s }} />
        </div>

        <div>
          <p style={sectionStyle}>Must-dos</p>
          <p style={{ fontSize: '12px', color: '#9a9a8a', marginBottom: '16px', lineHeight: 1.7 }}>Based on where you're going. Tap yes, maybe, or no for each.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {mustDoOptions.map(item => (
              <div key={item} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', border: '0.5px solid #e4e4d8', background: '#fff', borderRadius: '8px' }}>
                <p style={{ fontSize: '13px', color: '#1a1a1a', margin: 0 }}>{item}</p>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {(['yes', 'maybe', 'no'] as const).map(val => (
                    <button key={val} onClick={() => setMustDo(item, val)}
                      style={{ padding: '4px 10px', fontSize: '11px', border: `1px solid ${form.must_dos[item] === val ? (val === 'yes' ? '#2d5a18' : val === 'maybe' ? '#ba7517' : '#a32d2d') : '#d4d4c8'}`, background: form.must_dos[item] === val ? (val === 'yes' ? '#e8f0e4' : val === 'maybe' ? '#faeeda' : '#fcebeb') : 'transparent', color: form.must_dos[item] === val ? (val === 'yes' ? '#2d5a18' : val === 'maybe' ? '#854f0b' : '#a32d2d') : '#9a9a8a', cursor: 'pointer', borderRadius: '4px', ...s }}>
                      {val}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p style={sectionStyle}>Preference deadline</p>
          <p style={{ fontSize: '12px', color: '#9a9a8a', marginBottom: '10px', lineHeight: 1.7 }}>Set a date for when preferences close. Once the deadline passes, Avanti builds the options from whatever was submitted.</p>
          <input type="date" style={inputStyle} value={deadline} onChange={e => { setDeadline(e.target.value); autoSave(form, e.target.value) }} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button onClick={() => handleSave(true)} disabled={saving || !form.departure_city || !form.available_from || !form.available_to}
            style={{ width: '100%', border: '1px solid #2d5a18', padding: '16px', fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', color: '#2d5a18', background: 'transparent', cursor: 'pointer', opacity: saving || !form.departure_city || !form.available_from || !form.available_to ? 0.4 : 1, ...s }}>
            {saving ? 'Submitting...' : 'Submit preferences →'}
          </button>
          <button onClick={() => handleSave(false)} disabled={saving}
            style={{ width: '100%', border: '1px solid #d4d4c8', padding: '14px', fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', color: '#9a9a8a', background: 'transparent', cursor: 'pointer', ...s }}>
            Save draft
          </button>
        </div>
      </div>
    </StepLayout>
  )
}
