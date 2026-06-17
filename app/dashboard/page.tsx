'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { INSTAGRAM_URL, TIKTOK_URL } from '@/lib/social-links'

// ─── Types ────────────────────────────────────────────────────────────────────

type Trip = {
  id: string
  name: string
  destination: string | null
  start_date: string | null
  end_date: string | null
  cover_image: string | null
  dates_locked: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

// ─── Shared styles ─────────────────────────────────────────────────────────────

const EYEBROW: React.CSSProperties = {
  fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
  fontSize: '0.7rem',
  letterSpacing: '0.28em',
  textTransform: 'uppercase',
  fontWeight: 400,
}

const FOREST_DEEP = 'var(--forest-deep)'
const FOREST     = 'var(--forest)'
const CREAM      = 'var(--cream)'
const CREAM_15   = 'oklch(0.985 0.008 90 / 0.15)'
const CREAM_40   = 'oklch(0.985 0.008 90 / 0.4)'
const CREAM_50   = 'oklch(0.985 0.008 90 / 0.5)'
const CREAM_60   = 'oklch(0.985 0.008 90 / 0.6)'
const CREAM_80   = 'oklch(0.985 0.008 90 / 0.8)'
const CREAM_90   = 'oklch(0.985 0.008 90 / 0.9)'
const CREAM_80_HEX = 'oklch(0.985 0.008 90 / 0.8)'
const FOREST_DEEP_70 = 'oklch(0.22 0.04 150 / 0.7)'
const FOREST_DEEP_80 = 'oklch(0.22 0.04 150 / 0.8)'

const PAGE_X = 56


function Greeting({ firstName }: { firstName: string }) {
  const greeting = getGreeting()

  return (
    <section style={{ padding: `48px ${PAGE_X}px 24px` }}>
      <h1 style={{
        fontFamily: 'Cormorant Garamond, ui-serif, Georgia, serif',
        fontStyle: 'italic',
        fontWeight: 400,
        color: CREAM,
        fontSize: 'clamp(1.25rem, 2vw, 1.5rem)',
        margin: 0,
        letterSpacing: '-0.01em',
      }}>
        {greeting},{' '}
        <span style={{ fontStyle: 'normal', letterSpacing: '0.15em' }}>
          {firstName.toUpperCase()}
        </span>
      </h1>
    </section>
  )
}

function TripCard({ trip }: { trip: Trip }) {
  const [hovered, setHovered] = useState(false)
  const hasImage = !!trip.cover_image

  return (
    <Link
      href={`/trips/${trip.id}`}
      prefetch
      className="relative z-10 block"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        aspectRatio: '16 / 10',
        overflow: 'hidden',
        background: hovered && !hasImage ? CREAM : FOREST,
        borderRight: `1px solid ${CREAM_15}`,
        borderBottom: `1px solid ${CREAM_15}`,
        textDecoration: 'none',
        transition: 'background 0.3s',
        cursor: 'pointer',
      }}
    >
      {hasImage && (
        <>
          <img
            src={trip.cover_image!}
            alt={trip.name}
            style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%',
              objectFit: 'cover',
              filter: hovered ? 'grayscale(0)' : 'grayscale(100%)',
              transition: 'filter 0.3s',
            }}
          />
          <div style={{
            position: 'absolute', inset: 0,
            background: hovered ? CREAM_80_HEX : FOREST_DEEP_70,
            transition: 'background 0.3s',
          }} />
        </>
      )}

      <h3 style={{
        position: 'relative',
        zIndex: 10,
        fontFamily: 'Cormorant Garamond, ui-serif, Georgia, serif',
        fontWeight: 400,
        color: hovered ? FOREST_DEEP : CREAM,
        fontSize: 'clamp(1.5rem, 2.4vw, 2.25rem)',
        letterSpacing: '-0.01em',
        lineHeight: 1.05,
        margin: 0,
        padding: '0 24px',
        textAlign: 'center',
        transition: 'color 0.3s',
      }}>
        {trip.name}
      </h3>
    </Link>
  )
}

function TripGrid({ trips, onNewTrip }: { trips: Trip[]; onNewTrip: () => void }) {
  const [modalHovered, setModalHovered] = useState(false)

  return (
    <section style={{ flex: 1, padding: `40px ${PAGE_X}px 80px` }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 32 }}>
        <span style={{ ...EYEBROW, color: CREAM_80 }}>MY TRIPS</span>
        <button
          onClick={onNewTrip}
          onMouseEnter={() => setModalHovered(true)}
          onMouseLeave={() => setModalHovered(false)}
          style={{
            ...EYEBROW,
            color: modalHovered ? FOREST_DEEP : CREAM,
            background: modalHovered ? CREAM : 'transparent',
            border: `1px solid ${CREAM_40}`,
            padding: '10px 20px',
            cursor: 'pointer',
            transition: 'all 0.2s',
            letterSpacing: '0.28em',
          }}
        >
          + NEW TRIP
        </button>
      </div>

      {trips.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 0' }}>
          <p style={{
            fontFamily: 'Cormorant Garamond, ui-serif, Georgia, serif',
            fontStyle: 'italic',
            color: CREAM_50,
            fontSize: '1.125rem',
          }}>
            No trips yet. Create your first one.
          </p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          borderTop: `1px solid ${CREAM_15}`,
          borderLeft: `1px solid ${CREAM_15}`,
        }}>
          {trips.map(trip => (
            <TripCard key={trip.id} trip={trip} />
          ))}
        </div>
      )}
    </section>
  )
}

function Footer() {
  return (
    <footer style={{
      background: FOREST_DEEP,
      color: CREAM,
      borderTop: `1px solid ${CREAM_15}`,
      fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
    }}>
      <div style={{
        padding: `64px ${PAGE_X}px`,
        display: 'grid',
        gridTemplateColumns: '2fr 1fr 1fr',
        gap: 48,
      }}>
        {/* Brand column */}
        <div>
          <div style={{
            fontFamily: 'Cormorant Garamond, ui-serif, Georgia, serif',
            letterSpacing: '0.45em',
            fontSize: '1.2rem',
            fontStyle: 'oblique 8deg',
          }}>
            AVANTI
          </div>
          <p style={{
            marginTop: 24,
            fontFamily: 'Cormorant Garamond, ui-serif, Georgia, serif',
            fontStyle: 'italic',
            fontSize: 'clamp(1.25rem, 2vw, 1.75rem)',
            maxWidth: 360,
            lineHeight: 1.35,
            color: CREAM_90,
          }}>
            You bring the people. Avanti brings the plan.
          </p>
        </div>

        {/* Explore */}
        <div>
          <div style={{ ...EYEBROW, color: CREAM_60, marginBottom: 16 }}>Explore</div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { label: 'How it works', href: '/how-it-works' },
              { label: 'About', href: '/about' },
              { label: 'Contact', href: '/contact' },
              { label: 'Dashboard', href: '/dashboard' },
            ].map(item => (
              <li key={item.label}>
                <Link href={item.href}
                  style={{ color: CREAM, textDecoration: 'none', fontSize: '0.875rem', opacity: 0.85 }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '0.5')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '0.85')}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Connect */}
        <div>
          <div style={{ ...EYEBROW, color: CREAM_60, marginBottom: 16 }}>Connect</div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { label: 'Instagram', href: INSTAGRAM_URL },
              { label: 'TikTok', href: TIKTOK_URL },
            ].map(item => (
              <li key={item.label}>
                <a
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: CREAM, textDecoration: 'none', fontSize: '0.875rem', opacity: 0.85 }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '0.5')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '0.85')}
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Bottom bar */}
      <div style={{
        padding: `24px ${PAGE_X}px`,
        borderTop: `1px solid ${CREAM_15}`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <p style={{ fontSize: '0.75rem', color: CREAM_60, margin: 0 }}>
          2026 © Avanti. All rights reserved.
        </p>
        <div style={{ display: 'flex', gap: 24 }}>
          {[
            { label: 'Terms', href: '/terms' },
            { label: 'Privacy', href: '/privacy' },
            { label: 'Cookies', href: '/cookies' },
          ].map(item => (
            <Link key={item.label} href={item.href}
              style={{ ...EYEBROW, color: CREAM_60, textDecoration: 'none', fontSize: '0.7rem' }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.5')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  )
}

// ─── Create Trip Modal ─────────────────────────────────────────────────────────

function CreateTripModal({ onClose, onCreated, profile }: {
  onClose: () => void
  onCreated: () => void
  profile: any
}) {
  const GROUP_TYPES = ['Friends', 'Bachelorette', 'Family friendly'] as const
  const EVENT_TYPES = [
    { value: 'none', label: 'No' },
    { value: 'Meeting', label: 'Meeting' },
    { value: 'Wedding', label: 'Wedding' },
    { value: 'Party', label: 'Party' },
  ] as const

  const [form, setForm] = useState({
    name: '',
    groupType: '' as '' | typeof GROUP_TYPES[number],
    eventType: '' as '' | 'none' | 'Meeting' | 'Wedding' | 'Party',
    event_date: '',
    event_location: '',
  })
  const [creating, setCreating] = useState(false)
  const [showErrors, setShowErrors] = useState(false)

  const hasEvent = form.eventType !== '' && form.eventType !== 'none'

  const canCreate = () => {
    if (!form.name.trim()) return false
    if (!form.groupType) return false
    if (!form.eventType) return false
    if (hasEvent && (!form.event_date || !form.event_location.trim())) return false
    return true
  }

  const handleCreate = async () => {
    if (!canCreate()) { setShowErrors(true); return }
    setCreating(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const tripData: Record<string, unknown> = {
      name: form.name.trim(),
      trip_type: form.groupType,
      destination: 'TBD',
      destination_type: 'flexible',
      date_type: 'flexible',
      cover_color: 'oklch(0.22 0.04 150)',
      organizer_id: user.id,
      status: 'planning',
      is_event_centered: hasEvent,
    }

    if (hasEvent) {
      tripData.event_name = form.eventType
      tripData.event_date = form.event_date
      tripData.event_location = form.event_location.trim()
    }

    const { data: trip, error } = await supabase.from('trips').insert(tripData).select().single()
    if (error || !trip) { setCreating(false); alert('Error: ' + error?.message); return }

    await supabase.from('travelers').insert({
      trip_id: trip.id,
      full_name: profile?.full_name || '',
      email: profile?.email || '',
      nickname: profile?.full_name?.split(' ')[0] || '',
      role: 'organizer',
      profile_complete: true,
    })

    setCreating(false)
    onCreated()
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    borderBottom: '1px solid #d4d4c8',
    background: 'transparent',
    padding: '8px 0',
    fontSize: '14px',
    color: FOREST_DEEP,
    outline: 'none',
    fontFamily: 'Cormorant Garamond, ui-serif, Georgia, serif',
    boxSizing: 'border-box',
  }
  const labelStyle: React.CSSProperties = {
    ...EYEBROW,
    color: '#9a9a8a',
    display: 'block',
    marginBottom: 6,
  }
  const optionBtn = (active: boolean): React.CSSProperties => ({
    padding: '10px 14px',
    fontSize: '12px',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    border: `1px solid ${active ? FOREST_DEEP : '#d4d4c8'}`,
    background: active ? '#f5f5f0' : 'transparent',
    color: active ? FOREST_DEEP : '#6a6a6a',
    cursor: 'pointer',
    fontFamily: 'Cormorant Garamond, ui-serif, Georgia, serif',
    textAlign: 'left',
  })

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 50, padding: 24,
    }}>
      <div style={{
        background: '#fafaf8', width: '100%', maxWidth: 520,
        maxHeight: '90vh', overflowY: 'auto', padding: 40,
        position: 'relative',
        fontFamily: 'Cormorant Garamond, ui-serif, Georgia, serif',
      }}>
        <button onClick={onClose} style={{
          position: 'absolute', top: 16, right: 20,
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 22, color: '#9a9a8a',
        }}>×</button>

        <p style={{ ...EYEBROW, color: '#9a9a8a', marginBottom: 8 }}>New trip</p>
        <h2 style={{ fontSize: 28, fontWeight: 300, color: FOREST_DEEP, margin: '0 0 32px' }}>
          Create a trip
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div>
            <label style={labelStyle}>Trip name</label>
            <input
              style={inputStyle}
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              autoFocus
            />
            {showErrors && !form.name.trim() && (
              <p style={{ fontSize: 11, color: '#c0392b', margin: '4px 0 0' }}>Please enter a trip name</p>
            )}
          </div>

          <div>
            <label style={labelStyle}>Who&apos;s traveling?</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {GROUP_TYPES.map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setForm({ ...form, groupType: type })}
                  style={optionBtn(form.groupType === type)}
                >
                  {type}
                </button>
              ))}
            </div>
            {showErrors && !form.groupType && (
              <p style={{ fontSize: 11, color: '#c0392b', margin: '4px 0 0' }}>Please select a group type</p>
            )}
          </div>

          <div>
            <label style={labelStyle}>Does this trip revolve around an event?</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {EVENT_TYPES.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setForm({
                    ...form,
                    eventType: opt.value,
                    ...(opt.value === 'none' ? { event_date: '', event_location: '' } : {}),
                  })}
                  style={optionBtn(form.eventType === opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {showErrors && !form.eventType && (
              <p style={{ fontSize: 11, color: '#c0392b', margin: '4px 0 0' }}>Please select an option</p>
            )}
          </div>

          {hasEvent && (
            <>
              <div>
                <label style={labelStyle}>Event date</label>
                <input
                  type="date"
                  style={inputStyle}
                  value={form.event_date}
                  onChange={e => setForm({ ...form, event_date: e.target.value })}
                />
                {showErrors && !form.event_date && (
                  <p style={{ fontSize: 11, color: '#c0392b', margin: '4px 0 0' }}>Please enter the event date</p>
                )}
              </div>
              <div>
                <label style={labelStyle}>Event location</label>
                <input
                  style={inputStyle}
                  value={form.event_location}
                  onChange={e => setForm({ ...form, event_location: e.target.value })}
                />
                {showErrors && !form.event_location.trim() && (
                  <p style={{ fontSize: 11, color: '#c0392b', margin: '4px 0 0' }}>Please enter the event location</p>
                )}
              </div>
            </>
          )}

          <button
            onClick={handleCreate}
            disabled={creating}
            style={{
              width: '100%',
              border: `1px solid ${FOREST_DEEP}`,
              padding: 16,
              ...EYEBROW,
              fontSize: '10px',
              color: FOREST_DEEP,
              background: 'transparent',
              cursor: canCreate() ? 'pointer' : 'default',
              opacity: canCreate() && !creating ? 1 : 0.4,
              transition: 'all 0.2s',
            }}
          >
            {creating ? 'Creating...' : 'Create trip →'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any>(null)
  const [trips, setTrips] = useState<Trip[]>([])
  const [showModal, setShowModal] = useState(false)

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }

    const { data: prof } = await supabase
      .from('user_profiles').select('*').eq('user_id', user.id).maybeSingle()
    if (!prof?.profile_complete) { router.push('/profile'); return }
    setProfile(prof)

    const { data: tripData } = await supabase
      .from('trips').select('*').eq('organizer_id', user.id)
      .order('created_at', { ascending: false })
    setTrips(tripData || [])
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', background: FOREST_DEEP,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="48" height="40" viewBox="0 0 80 64" fill="none">
          <style>{`
            @keyframes drawCase {
              0%   { stroke-dashoffset: 300; opacity: 0.2; }
              60%  { stroke-dashoffset: 0;   opacity: 1;   }
              100% { stroke-dashoffset: -300; opacity: 0.2; }
            }
            .sc { stroke-dasharray: 300; animation: drawCase 2.4s ease-in-out infinite; }
          `}</style>
          <rect className="sc" x="6" y="18" width="68" height="40" rx="4" stroke={CREAM} strokeWidth="1.5" fill="none"/>
          <rect className="sc" x="26" y="6" width="28" height="14" rx="2" stroke={CREAM} strokeWidth="1.5" fill="none" style={{ animationDelay: '0.2s' }}/>
          <line className="sc" x1="6" y1="32" x2="74" y2="32" stroke={CREAM} strokeWidth="1" style={{ animationDelay: '0.4s' }}/>
          <circle cx="18" cy="62" r="3.5" stroke={CREAM} strokeWidth="1.5" fill="none"/>
          <circle cx="62" cy="62" r="3.5" stroke={CREAM} strokeWidth="1.5" fill="none"/>
        </svg>
      </div>
    )
  }

  const firstName = profile?.full_name?.split(' ')[0] || 'there'

  return (
    <>
      <main style={{ flex: 1, background: FOREST_DEEP, color: CREAM }}>
        <Greeting firstName={firstName} />
        <TripGrid
          trips={trips}
          onNewTrip={() => setShowModal(true)}
        />
      </main>
      <Footer />

      {showModal && (
        <CreateTripModal
          onClose={() => setShowModal(false)}
          onCreated={() => { setShowModal(false); loadData() }}
          profile={profile}
        />
      )}
    </>
  )
}
