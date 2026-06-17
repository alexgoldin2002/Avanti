'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import SubpageShell from '../components/SubpageShell'
import { applyPreviewToTrip } from '@/lib/apply-preview-to-trip'
import { getCreateFormDefaultsFromPreview, isPendingShare, loadPreviewTrip } from '@/lib/preview-trip-storage'

const COLORS = [
  { name: 'Midnight', value: 'var(--foreground)' },
  { name: 'Forest', value: '#2d4a3e' },
  { name: 'Navy', value: '#1e3a5f' },
  { name: 'Burgundy', value: '#4a1a2c' },
  { name: 'Sand', value: '#8b7355' },
  { name: 'Slate', value: '#4a5568' },
  { name: 'Terracotta', value: '#8b4513' },
  { name: 'Sage', value: '#4a5e4a' },
]

const TRIP_TYPES = [
  'Vacation', 'Bachelorette', 'Bachelor', 'Birthday trip',
  'Girls trip', 'Boys trip', 'Family', 'Honeymoon',
  'Adventure', 'Cultural', 'Wellness', 'Other'
]

export default function CreateTrip() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const totalSteps = 5

  const [form, setForm] = useState({
    name: '',
    trip_type: '',
    cover_color: 'var(--foreground)',
    group_type: 'group',
    date_type: 'exact',
    start_date: '',
    end_date: '',
    date_range_start: '',
    date_range_end: '',
    date_flexibility_nights: 5,
    destination_type: 'set',
    destinations: [] as string[],
    destination_input: '',
    visibility: 'invite_only',
  })
  const [fromPreview, setFromPreview] = useState(false)

  useEffect(() => {
    if (!isPendingShare()) return
    const { answers } = loadPreviewTrip()
    if (!answers?.q1) return
    const defaults = getCreateFormDefaultsFromPreview(answers)
    setFromPreview(true)
    setForm(f => ({
      ...f,
      name: defaults.name,
      trip_type: defaults.trip_type,
      destination_type: defaults.destination_type,
      date_type: defaults.date_type,
      start_date: defaults.start_date,
      end_date: defaults.end_date,
      date_range_start: defaults.date_range_start,
      date_range_end: defaults.date_range_end,
      date_flexibility_nights: defaults.date_flexibility_nights,
    }))
  }, [])

  const addDestination = () => {
    if (!form.destination_input.trim()) return
    setForm(f => ({ ...f, destinations: [...f.destinations, f.destination_input.trim()], destination_input: '' }))
  }

  const removeDestination = (i: number) => {
    setForm(f => ({ ...f, destinations: f.destinations.filter((_, idx) => idx !== i) }))
  }

  const handleCreate = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }

    const { data: profile } = await supabase.from('user_profiles').select('*').eq('user_id', user.id).maybeSingle()
    const travelerEmail = profile?.email || user.email || ''

    const tripData: any = {
      name: form.name,
      trip_type: form.trip_type,
      cover_color: form.cover_color,
      destination: form.destinations.join(' + ') || 'TBD',
      destination_type: form.destination_type,
      destinations: form.destinations,
      date_type: form.date_type,
      visibility: form.visibility,
      organizer_id: user.id,
    }

    if (form.date_type === 'exact') {
      tripData.start_date = form.start_date
      tripData.end_date = form.end_date
      tripData.dates_locked = true
    } else {
      tripData.date_range_start = form.date_range_start
      tripData.date_range_end = form.date_range_end
      tripData.date_flexibility_nights = form.date_flexibility_nights
      tripData.dates_locked = false
    }

    const { data: trip, error } = await supabase.from('trips').insert(tripData).select().single()
    if (error || !trip) { setLoading(false); alert('Error: ' + error?.message); return }

    await supabase.from('travelers').insert({
      trip_id: trip.id,
      full_name: profile?.full_name || '',
      email: travelerEmail,
      nickname: profile?.full_name?.split(' ')[0] || '',
      role: 'organizer',
      profile_complete: true,
    })

    if (travelerEmail) {
      await applyPreviewToTrip(trip.id, travelerEmail)
    }

    router.push(`/trips/${trip.id}/invite`)
  }

  const s = { fontFamily: 'var(--font-cormorant), Georgia, serif' }
  const inputStyle = { width: '100%', borderBottom: '1px solid var(--border)', background: 'transparent', padding: '10px 0', fontSize: '15px', color: 'var(--foreground)', outline: 'none', ...s }
  const labelStyle = { fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase' as const, color: 'var(--muted-foreground)', display: 'block', marginBottom: '8px' }
  const btnPrimary = { width: '100%', border: '1px solid var(--foreground)', padding: '14px', fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase' as const, color: 'var(--foreground)', background: 'transparent', cursor: 'pointer', ...s }
  const btnSecondary = { width: '100%', border: '1px solid var(--border)', padding: '14px', fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase' as const, color: 'var(--muted-foreground)', background: 'transparent', cursor: 'pointer', ...s }

  const canAdvance = () => {
    if (step === 1) return form.name.trim().length > 0 && form.trip_type.length > 0
    if (step === 2) return true
    if (step === 3) {
      if (form.date_type === 'exact') return form.start_date && form.end_date
      return form.date_range_start && form.date_range_end
    }
    if (step === 4) return form.destinations.length > 0 || form.destination_type === 'open'
    return true
  }

  return (
    <SubpageShell backHref="/dashboard" maxWidth="max-w-xl" className="!pt-6">
        {fromPreview && (
          <div className="mb-8 border border-forest-deep/20 bg-ivory px-5 py-4 text-sm leading-relaxed text-muted-foreground" style={s}>
            Your trip ideas from the homepage are saved — after you invite your group, step 2 will already be filled in with your destinations.
          </div>
        )}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '40px' }}>
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div key={i} style={{ flex: 1, height: '2px', background: i < step ? 'var(--foreground)' : 'var(--border)', transition: 'background 0.3s' }} />
          ))}
        </div>

        {step === 1 && (
          <div>
            <p style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted-foreground)', marginBottom: '8px' }}>Step 1 of {totalSteps}</p>
            <h2 style={{ fontSize: '32px', fontWeight: 300, color: 'var(--foreground)', marginBottom: '40px' }}>Name your trip</h2>

            <div style={{ marginBottom: '28px' }}>
              <label style={labelStyle}>Trip name</label>
              <input style={inputStyle} value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Mama Mia Summer" autoFocus />
            </div>

            <div style={{ marginBottom: '28px' }}>
              <label style={labelStyle}>Trip type</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {TRIP_TYPES.map(t => (
                  <button key={t} onClick={() => setForm({...form, trip_type: t})}
                    style={{ padding: '7px 14px', fontSize: '11px', letterSpacing: '0.05em', border: `1px solid ${form.trip_type === t ? 'var(--foreground)' : 'var(--border)'}`, background: form.trip_type === t ? 'var(--foreground)' : 'transparent', color: form.trip_type === t ? 'var(--cream)' : 'var(--muted-foreground)', cursor: 'pointer', transition: 'all 0.2s', ...s }}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '28px' }}>
              <label style={labelStyle}>Is this a group trip or solo?</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {['Group', 'Solo'].map(t => (
                  <button key={t} onClick={() => setForm({...form, group_type: t.toLowerCase()})}
                    style={{ flex: 1, padding: '12px', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', border: `1px solid ${form.group_type === t.toLowerCase() ? 'var(--foreground)' : 'var(--border)'}`, background: form.group_type === t.toLowerCase() ? 'var(--foreground)' : 'transparent', color: form.group_type === t.toLowerCase() ? 'var(--cream)' : 'var(--muted-foreground)', cursor: 'pointer', transition: 'all 0.2s', ...s }}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '40px' }}>
              <label style={labelStyle}>Trip card color</label>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {COLORS.map(c => (
                  <button key={c.value} onClick={() => setForm({...form, cover_color: c.value})}
                    title={c.name}
                    style={{ width: '36px', height: '36px', borderRadius: '50%', background: c.value, border: form.cover_color === c.value ? '3px solid var(--foreground)' : '3px solid transparent', cursor: 'pointer', outline: form.cover_color === c.value ? '2px solid var(--cream)' : 'none', outlineOffset: '-4px' }} />
                ))}
              </div>
            </div>

            <button onClick={() => setStep(2)} disabled={!canAdvance()} style={{ ...btnPrimary, opacity: canAdvance() ? 1 : 0.4 }}>Continue →</button>
          </div>
        )}

        {step === 2 && (
          <div>
            <p style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted-foreground)', marginBottom: '8px' }}>Step 2 of {totalSteps}</p>
            <h2 style={{ fontSize: '32px', fontWeight: 300, color: 'var(--foreground)', marginBottom: '12px' }}>Invite your group</h2>
            <p style={{ fontSize: '13px', color: 'var(--muted-foreground)', marginBottom: '40px', lineHeight: 1.7 }}>You can always add more people later. Skip this step if you want to set up the trip first.</p>

            <div style={{ marginBottom: '28px' }}>
              <label style={labelStyle}>Link visibility</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[
                  { value: 'invite_only', label: 'Invite only', desc: 'Only people with the link AND a join code can access' },
                  { value: 'link', label: 'Anyone with the link', desc: 'Anyone who has the link can join' },
                ].map(opt => (
                  <button key={opt.value} onClick={() => setForm({...form, visibility: opt.value})}
                    style={{ textAlign: 'left', padding: '14px 16px', border: `1px solid ${form.visibility === opt.value ? 'var(--foreground)' : 'var(--border)'}`, background: form.visibility === opt.value ? '#f5f5f0' : 'transparent', cursor: 'pointer', ...s }}>
                    <p style={{ fontSize: '12px', fontWeight: 500, color: 'var(--foreground)', margin: '0 0 2px', letterSpacing: '0.05em' }}>{opt.label}</p>
                    <p style={{ fontSize: '11px', color: 'var(--muted-foreground)', margin: 0 }}>{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ background: '#f0f0e8', padding: '20px', marginBottom: '28px' }}>
              <p style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--muted-foreground)', marginBottom: '8px' }}>About nicknames</p>
              <p style={{ fontSize: '12px', color: 'var(--muted-foreground)', lineHeight: 1.7, margin: 0 }}>When your friends join, they will set a nickname for the trip (like "M" or "Em") that shows up in the app. Their legal name from their profile is used automatically for all reservations and bookings. You never have to think about it.</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ marginBottom: '28px' }}>
                <label style={labelStyle}>Invite by email</label>
                <p style={{ fontSize: '11px', color: 'var(--muted-foreground)', marginBottom: '8px' }}>Enter emails separated by commas. They will get an invitation with the join link.</p>
                <textarea placeholder="emily@gmail.com, mia@gmail.com, talia@gmail.com"
                  style={{ width: '100%', border: '1px solid var(--border)', background: 'transparent', padding: '12px', fontSize: '13px', color: 'var(--foreground)', outline: 'none', resize: 'none', height: '80px', ...s }} />
              </div>
              <button onClick={() => setStep(3)} style={btnPrimary}>Continue →</button>
              <button onClick={() => setStep(3)} style={btnSecondary}>Skip for now</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <p style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted-foreground)', marginBottom: '8px' }}>Step 3 of {totalSteps}</p>
            <h2 style={{ fontSize: '32px', fontWeight: 300, color: 'var(--foreground)', marginBottom: '12px' }}>When are you going?</h2>
            <p style={{ fontSize: '13px', color: 'var(--muted-foreground)', marginBottom: '32px', lineHeight: 1.7 }}>Nothing gets booked until dates are locked in.</p>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '28px' }}>
              {[
                { value: 'exact', label: 'Exact dates' },
                { value: 'range', label: 'Date range' },
              ].map(opt => (
                <button key={opt.value} onClick={() => setForm({...form, date_type: opt.value})}
                  style={{ flex: 1, padding: '12px', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', border: `1px solid ${form.date_type === opt.value ? 'var(--foreground)' : 'var(--border)'}`, background: form.date_type === opt.value ? 'var(--foreground)' : 'transparent', color: form.date_type === opt.value ? 'var(--cream)' : 'var(--muted-foreground)', cursor: 'pointer', transition: 'all 0.2s', ...s }}>
                  {opt.label}
                </button>
              ))}
            </div>

            {form.date_type === 'exact' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '28px' }}>
                <div>
                  <label style={labelStyle}>Start date</label>
                  <input type="date" style={inputStyle} value={form.start_date} onChange={e => setForm({...form, start_date: e.target.value})} />
                </div>
                <div>
                  <label style={labelStyle}>End date</label>
                  <input type="date" style={inputStyle} value={form.end_date} onChange={e => setForm({...form, end_date: e.target.value})} />
                </div>
              </div>
            )}

            {form.date_type === 'range' && (
              <div style={{ marginBottom: '28px' }}>
                <p style={{ fontSize: '12px', color: 'var(--muted-foreground)', marginBottom: '16px', lineHeight: 1.7 }}>Set the window you are working within. Everyone in your group will mark their available days and Avanti will find the best overlap.</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                  <div>
                    <label style={labelStyle}>Earliest possible start</label>
                    <input type="date" style={inputStyle} value={form.date_range_start} onChange={e => setForm({...form, date_range_start: e.target.value})} />
                  </div>
                  <div>
                    <label style={labelStyle}>Latest possible end</label>
                    <input type="date" style={inputStyle} value={form.date_range_end} onChange={e => setForm({...form, date_range_end: e.target.value})} />
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>How many nights are you thinking? <span style={{ color: 'var(--foreground)', fontWeight: 500 }}>{form.date_flexibility_nights} nights</span></label>
                  <input type="range" min="2" max="21" step="1" value={form.date_flexibility_nights}
                    onChange={e => setForm({...form, date_flexibility_nights: parseInt(e.target.value)})}
                    style={{ width: '100%', marginTop: '8px' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                    <span style={{ fontSize: '10px', color: 'var(--muted-foreground)' }}>2 nights</span>
                    <span style={{ fontSize: '10px', color: 'var(--muted-foreground)' }}>3 weeks</span>
                  </div>
                </div>
                <div style={{ background: '#f0f0e8', padding: '16px', marginTop: '20px' }}>
                  <p style={{ fontSize: '11px', color: 'var(--muted-foreground)', margin: 0, lineHeight: 1.7 }}>Once everyone marks their availability, Avanti will show you the best dates and you lock them in. Nothing gets booked until you confirm.</p>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button onClick={() => setStep(4)} disabled={!canAdvance()} style={{ ...btnPrimary, opacity: canAdvance() ? 1 : 0.4 }}>Continue →</button>
              <button onClick={() => setStep(2)} style={btnSecondary}>← Back</button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div>
            <p style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted-foreground)', marginBottom: '8px' }}>Step 4 of {totalSteps}</p>
            <h2 style={{ fontSize: '32px', fontWeight: 300, color: 'var(--foreground)', marginBottom: '12px' }}>Where are you going?</h2>
            <p style={{ fontSize: '13px', color: 'var(--muted-foreground)', marginBottom: '32px', lineHeight: 1.7 }}>You can add multiple destinations for a multi-city trip.</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '28px' }}>
              {[
                { value: 'set', label: 'We know where we are going', desc: 'Destination is decided' },
                { value: 'considering', label: 'Still deciding', desc: 'Add the places we are considering and the group can vote' },
                { value: 'open', label: 'Wide open', desc: 'No idea yet — let Avanti suggest based on our preferences and budget' },
              ].map(opt => (
                <button key={opt.value} onClick={() => setForm({...form, destination_type: opt.value})}
                  style={{ textAlign: 'left', padding: '14px 16px', border: `1px solid ${form.destination_type === opt.value ? 'var(--foreground)' : 'var(--border)'}`, background: form.destination_type === opt.value ? '#f5f5f0' : 'transparent', cursor: 'pointer', ...s }}>
                  <p style={{ fontSize: '12px', fontWeight: 500, color: 'var(--foreground)', margin: '0 0 2px', letterSpacing: '0.05em' }}>{opt.label}</p>
                  <p style={{ fontSize: '11px', color: 'var(--muted-foreground)', margin: 0 }}>{opt.desc}</p>
                </button>
              ))}
            </div>

            {form.destination_type !== 'open' && (
              <div style={{ marginBottom: '28px' }}>
                <label style={labelStyle}>
                  {form.destination_type === 'set' ? 'Add destinations' : 'Add places you are considering'}
                </label>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                  <input style={{ ...inputStyle, flex: 1 }}
                    value={form.destination_input}
                    onChange={e => setForm({...form, destination_input: e.target.value})}
                    onKeyDown={e => e.key === 'Enter' && addDestination()}
                    placeholder={form.destination_type === 'set' ? 'Mykonos, Greece' : 'Mykonos or Santorini?'} />
                  <button onClick={addDestination}
                    style={{ padding: '10px 16px', border: '1px solid var(--foreground)', background: 'var(--foreground)', color: 'var(--cream)', cursor: 'pointer', fontSize: '13px', ...s }}>
                    +
                  </button>
                </div>
                {form.destinations.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {form.destinations.map((d, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: 'var(--foreground)', color: 'var(--cream)', fontSize: '12px' }}>
                        {d}
                        <button onClick={() => removeDestination(i)} style={{ background: 'none', border: 'none', color: 'var(--cream)', cursor: 'pointer', padding: 0, fontSize: '14px', lineHeight: 1 }}>×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {form.destination_type === 'open' && (
              <div style={{ background: '#f0f0e8', padding: '20px', marginBottom: '28px' }}>
                <p style={{ fontSize: '12px', color: 'var(--muted-foreground)', lineHeight: 1.7, margin: 0 }}>After everyone fills in their preferences and budget, Avanti will suggest 3 destinations that work for the whole group — with estimated costs, weather, and what makes each one right for you.</p>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button onClick={() => setStep(5)} disabled={!canAdvance()} style={{ ...btnPrimary, opacity: canAdvance() ? 1 : 0.4 }}>Continue →</button>
              <button onClick={() => setStep(3)} style={btnSecondary}>← Back</button>
            </div>
          </div>
        )}

        {step === 5 && (
          <div>
            <p style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted-foreground)', marginBottom: '8px' }}>Step 5 of {totalSteps}</p>
            <h2 style={{ fontSize: '32px', fontWeight: 300, color: 'var(--foreground)', marginBottom: '12px' }}>Review & create</h2>
            <p style={{ fontSize: '13px', color: 'var(--muted-foreground)', marginBottom: '32px', lineHeight: 1.7 }}>Everything looks good? Create your trip and start planning.</p>

            <div style={{ border: '1px solid var(--border)', marginBottom: '32px', overflow: 'hidden' }}>
              <div style={{ background: form.cover_color, padding: '32px 24px' }}>
                <p style={{ fontSize: '24px', fontWeight: 300, color: 'var(--cream)', margin: '0 0 4px', letterSpacing: '0.02em' }}>{form.name}</p>
                <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', margin: 0, letterSpacing: '0.15em', textTransform: 'uppercase' }}>{form.trip_type}</p>
              </div>
              <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {[
                  { label: 'Type', value: form.group_type === 'group' ? 'Group trip' : 'Solo' },
                  {
                    label: 'Dates',
                    value: form.date_type === 'exact'
                      ? `${form.start_date} → ${form.end_date}`
                      : `${form.date_range_start} – ${form.date_range_end} · ${form.date_flexibility_nights} nights`
                  },
                  {
                    label: 'Destination',
                    value: form.destination_type === 'open'
                      ? 'Open — Avanti will suggest'
                      : form.destinations.join(' + ') || 'TBD'
                  },
                  { label: 'Invites', value: form.visibility === 'invite_only' ? 'Invite only with join code' : 'Anyone with the link' },
                ].map(row => (
                  <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: '12px', borderBottom: '1px solid #f0f0e8' }}>
                    <span style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>{row.label}</span>
                    <span style={{ fontSize: '13px', color: 'var(--foreground)', textAlign: 'right', maxWidth: '60%' }}>{row.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button onClick={handleCreate} disabled={loading}
                style={{ ...btnPrimary, opacity: loading ? 0.5 : 1 }}>
                {loading ? 'Creating your trip...' : 'Create trip →'}
              </button>
              <button onClick={() => setStep(4)} style={btnSecondary}>← Back</button>
            </div>
          </div>
        )}
    </SubpageShell>
  )
}
