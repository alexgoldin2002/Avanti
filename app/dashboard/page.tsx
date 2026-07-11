'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { fetchUserTrips } from '@/lib/user-trips'
import { PLACEHOLDERS } from '@/lib/form-placeholders'
import { applyPreviewToTrip } from '@/lib/apply-preview-to-trip'
import {
  hasPreviewTrip,
  isPendingShare,
  loadPreviewTrip,
  getCreateFormDefaultsFromPreviewWithMeta,
} from '@/lib/preview-trip-storage'
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
const CREAM_15   = 'rgba(255,255,255,0.15)'
const CREAM_40   = 'rgba(255,255,255,0.4)'
const CREAM_50   = 'rgba(255,255,255,0.5)'
const CREAM_60   = 'rgba(255,255,255,0.6)'
const CREAM_80   = 'rgba(255,255,255,0.8)'
const CREAM_90   = 'rgba(255,255,255,0.9)'
const CREAM_80_HEX = 'rgba(255,255,255,0.8)'
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
          <Link
            href="/"
            style={{
              textDecoration: 'none',
              color: 'inherit',
              fontFamily: 'Cormorant Garamond, ui-serif, Georgia, serif',
              letterSpacing: '0.45em',
              fontSize: '1.2rem',
              fontStyle: 'oblique 8deg',
            }}
            aria-label="Avanti home"
          >
            AVANTI
          </Link>
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
              { label: 'Why us?', href: '/why-us' },
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
  const router = useRouter()
  const GROUP_TYPES = [
    'Friends',
    'Couples',
    'Family without kids',
    'Multigenerational',
    'Family with kids',
    'Bachelorette',
    'Bachelor party',
    'Girls trip',
    'Guys trip',
    'Reunion',
    'Coworkers',
    'Organization',
  ] as const

  const EVENT_KINDS = [
    'Wedding',
    'Bachelorette',
    'Bachelor party',
    'Birthday',
    'Anniversary',
    'Graduation',
    'Reunion',
    'Conference',
    'Meeting',
    'Festival',
    'Concert',
    'Sporting event',
    'Retreat',
    'Party',
    'Other',
  ] as const

  const [form, setForm] = useState({
    name: '',
    groupType: '' as '' | typeof GROUP_TYPES[number],
    eventCentered: '' as '' | 'no' | 'yes',
    eventKind: '' as '' | typeof EVENT_KINDS[number],
    eventOther: '',
    eventDateMode: 'single' as 'single' | 'range',
    event_date: '',
    event_date_end: '',
    event_location: '',
  })
  const [creating, setCreating] = useState(false)
  const [showErrors, setShowErrors] = useState(false)
  const [showNameHelper, setShowNameHelper] = useState(false)
  const [nameHelperInput, setNameHelperInput] = useState('')
  const [nameSuggestions, setNameSuggestions] = useState<string[]>([])
  const [loadingNames, setLoadingNames] = useState(false)

  useEffect(() => {
    if (!isPendingShare()) return
    const { answers, meta } = loadPreviewTrip()
    if (!answers?.q1) return
    const defaults = getCreateFormDefaultsFromPreviewWithMeta(answers, meta)
    const groupType = GROUP_TYPES.find(t => t.toLowerCase() === defaults.trip_type.toLowerCase()) || ''
    setForm(prev => ({
      ...prev,
      name: prev.name || defaults.name,
      groupType: prev.groupType || (groupType as typeof prev.groupType),
    }))
  }, [])

  const hasEvent = form.eventCentered === 'yes'
  const eventName = form.eventKind === 'Other' ? form.eventOther.trim() : form.eventKind

  const canCreate = () => {
    if (!form.name.trim()) return false
    if (!form.groupType) return false
    if (!form.eventCentered) return false
    if (!hasEvent) return true
    if (!form.eventKind) return false
    if (form.eventKind === 'Other' && !form.eventOther.trim()) return false
    if (!form.event_date || !form.event_location.trim()) return false
    if (form.eventDateMode === 'range' && !form.event_date_end) return false
    return true
  }

  const getNameSuggestions = async () => {
    if (!nameHelperInput.trim()) return
    setLoadingNames(true)
    setNameSuggestions([])
    try {
      const res = await fetch('/api/suggest-names', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: nameHelperInput.trim() }),
      })
      const data = await res.json()
      if (Array.isArray(data.names)) {
        setNameSuggestions(data.names)
      }
    } catch {
      // ignore — user can retry
    } finally {
      setLoadingNames(false)
    }
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
      tripData.event_name = eventName
      tripData.event_date = form.event_date
      tripData.event_date_end = form.eventDateMode === 'range' ? form.event_date_end : null
      tripData.event_location = form.event_location.trim()
    }

    const { data: trip, error } = await supabase.from('trips').insert(tripData).select().single()
    if (error || !trip) { setCreating(false); alert('Error: ' + error?.message); return }

    await supabase.from('travelers').insert({
      trip_id: trip.id,
      user_id: user.id,
      full_name: profile?.full_name || '',
      email: profile?.email || '',
      nickname: profile?.full_name?.split(' ')[0] || '',
      role: 'organizer',
      profile_complete: true,
    })

    if (isPendingShare()) {
      await applyPreviewToTrip(trip.id, profile?.email || user.email || '')
    }

    setCreating(false)
    onCreated()
    router.push(`/trips/${trip.id}`)
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
  const chipBtn = (active: boolean): React.CSSProperties => ({
    padding: '7px 11px',
    fontSize: '10px',
    letterSpacing: '0.07em',
    textTransform: 'uppercase',
    border: `1px solid ${active ? FOREST_DEEP : '#d4d4c8'}`,
    background: active ? '#e8f5ee' : '#fff',
    color: active ? FOREST_DEEP : '#6a6a6a',
    cursor: 'pointer',
    fontFamily: 'Cormorant Garamond, ui-serif, Georgia, serif',
    borderRadius: '6px',
    lineHeight: 1.2,
  })
  const chipWrap: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
  }

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 50, padding: 24,
    }}>
      <div style={{
        background: '#ffffff', width: '100%', maxWidth: 520,
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>Trip name</label>
              <button
                type="button"
                onClick={() => setShowNameHelper(v => !v)}
                aria-label={showNameHelper ? 'Hide name suggestions' : 'Get AI name suggestions'}
                title="Need help naming it?"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 28,
                  height: 28,
                  border: `1px solid ${showNameHelper ? FOREST_DEEP : '#d4d4c8'}`,
                  background: showNameHelper ? '#e8f5ee' : 'transparent',
                  color: showNameHelper ? FOREST_DEEP : '#9a9a8a',
                  cursor: 'pointer',
                  borderRadius: '50%',
                  padding: 0,
                }}
              >
                <i className="ti ti-sparkles" style={{ fontSize: 14 }} aria-hidden />
              </button>
            </div>
            <input
              style={inputStyle}
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              autoFocus
            />
            {showErrors && !form.name.trim() && (
              <p style={{ fontSize: 11, color: '#c0392b', margin: '4px 0 0' }}>Please enter a trip name</p>
            )}
            {showNameHelper && (
              <div style={{ background: '#f5f5f0', padding: 16, marginTop: 8 }}>
                <p style={{ fontSize: 11, color: '#9a9a8a', margin: '0 0 8px' }}>
                  Describe your trip in a few words — we&apos;ll suggest something clever.
                </p>
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  <input
                    value={nameHelperInput}
                    onChange={e => setNameHelperInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') void getNameSuggestions() }}
                    placeholder={PLACEHOLDERS.tripNameHelper}
                    style={{
                      flex: 1,
                      borderBottom: '1px solid #d4d4c8',
                      background: 'transparent',
                      padding: '8px 0',
                      fontSize: 13,
                      color: FOREST_DEEP,
                      outline: 'none',
                      fontFamily: 'Cormorant Garamond, ui-serif, Georgia, serif',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => void getNameSuggestions()}
                    disabled={loadingNames || !nameHelperInput.trim()}
                    style={{
                      padding: '6px 12px',
                      border: `1px solid ${FOREST_DEEP}`,
                      background: FOREST_DEEP,
                      color: '#ffffff',
                      cursor: loadingNames || !nameHelperInput.trim() ? 'default' : 'pointer',
                      opacity: loadingNames || !nameHelperInput.trim() ? 0.5 : 1,
                      fontSize: 11,
                      fontFamily: 'Cormorant Garamond, ui-serif, Georgia, serif',
                    }}
                  >
                    {loadingNames ? '…' : 'Go'}
                  </button>
                </div>
                {nameSuggestions.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {nameSuggestions.map(name => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => {
                          setForm(prev => ({ ...prev, name }))
                          setShowNameHelper(false)
                          setNameSuggestions([])
                          setNameHelperInput('')
                        }}
                        style={{
                          textAlign: 'left',
                          padding: '8px 12px',
                          border: '1px solid #d4d4c8',
                          background: '#fff',
                          cursor: 'pointer',
                          fontSize: 13,
                          color: FOREST_DEEP,
                          fontFamily: 'Cormorant Garamond, ui-serif, Georgia, serif',
                        }}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <label style={labelStyle}>Who&apos;s traveling?</label>
            <div style={chipWrap}>
              {GROUP_TYPES.map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setForm({ ...form, groupType: type })}
                  style={chipBtn(form.groupType === type)}
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
            <div style={chipWrap}>
              {(['no', 'yes'] as const).map(value => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setForm({
                    ...form,
                    eventCentered: value,
                    ...(value === 'no'
                      ? { eventKind: '', eventOther: '', eventDateMode: 'single', event_date: '', event_date_end: '', event_location: '' }
                      : {}),
                  })}
                  style={chipBtn(form.eventCentered === value)}
                >
                  {value === 'no' ? 'No' : 'Yes'}
                </button>
              ))}
            </div>
            {showErrors && !form.eventCentered && (
              <p style={{ fontSize: 11, color: '#c0392b', margin: '4px 0 0' }}>Please select an option</p>
            )}
          </div>

          {hasEvent && (
            <>
              <div>
                <label style={labelStyle}>What kind of event?</label>
                <div style={chipWrap}>
                  {EVENT_KINDS.map(kind => (
                    <button
                      key={kind}
                      type="button"
                      onClick={() => setForm({
                        ...form,
                        eventKind: kind,
                        ...(kind !== 'Other' ? { eventOther: '' } : {}),
                      })}
                      style={chipBtn(form.eventKind === kind)}
                    >
                      {kind}
                    </button>
                  ))}
                </div>
                {showErrors && !form.eventKind && (
                  <p style={{ fontSize: 11, color: '#c0392b', margin: '4px 0 0' }}>Please select an event type</p>
                )}
              </div>

              {form.eventKind === 'Other' && (
                <div>
                  <label style={labelStyle}>Describe the event</label>
                  <input
                    style={inputStyle}
                    value={form.eventOther}
                    onChange={e => setForm({ ...form, eventOther: e.target.value })}
                    placeholder="e.g. Product launch, family reunion dinner..."
                  />
                  {showErrors && !form.eventOther.trim() && (
                    <p style={{ fontSize: 11, color: '#c0392b', margin: '4px 0 0' }}>Please describe the event</p>
                  )}
                </div>
              )}

              {form.eventKind && (form.eventKind !== 'Other' || form.eventOther.trim()) && (
                <>
                  <div>
                    <label style={labelStyle}>Event date or range</label>
                    <div style={{ ...chipWrap, marginBottom: 10 }}>
                      {(['single', 'range'] as const).map(mode => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setForm({
                            ...form,
                            eventDateMode: mode,
                            ...(mode === 'single' ? { event_date_end: '' } : {}),
                          })}
                          style={chipBtn(form.eventDateMode === mode)}
                        >
                          {mode === 'single' ? 'Single date' : 'Date range'}
                        </button>
                      ))}
                    </div>
                    {form.eventDateMode === 'single' ? (
                      <input
                        type="date"
                        style={inputStyle}
                        value={form.event_date}
                        onChange={e => setForm({ ...form, event_date: e.target.value })}
                      />
                    ) : (
                      <div style={{ display: 'flex', gap: 16 }}>
                        <div style={{ flex: 1 }}>
                          <span style={{ ...labelStyle, fontSize: '9px', marginBottom: 4 }}>Start</span>
                          <input
                            type="date"
                            style={inputStyle}
                            value={form.event_date}
                            onChange={e => setForm({ ...form, event_date: e.target.value })}
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <span style={{ ...labelStyle, fontSize: '9px', marginBottom: 4 }}>End</span>
                          <input
                            type="date"
                            style={inputStyle}
                            min={form.event_date || undefined}
                            value={form.event_date_end}
                            onChange={e => setForm({ ...form, event_date_end: e.target.value })}
                          />
                        </div>
                      </div>
                    )}
                    {showErrors && !form.event_date && (
                      <p style={{ fontSize: 11, color: '#c0392b', margin: '4px 0 0' }}>
                        {form.eventDateMode === 'single' ? 'Please enter the event date' : 'Please enter the start date'}
                      </p>
                    )}
                    {showErrors && form.eventDateMode === 'range' && form.event_date && !form.event_date_end && (
                      <p style={{ fontSize: 11, color: '#c0392b', margin: '4px 0 0' }}>Please enter the end date</p>
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

function DashboardContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any>(null)
  const [trips, setTrips] = useState<Trip[]>([])
  const [showModal, setShowModal] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/')
        return
      }

      const { data: prof } = await supabase
        .from('user_profiles').select('*').eq('user_id', user.id).maybeSingle()
      if (!prof?.profile_complete) {
        router.push('/profile')
        return
      }
      setProfile(prof)

      const tripData = await fetchUserTrips(supabase, user.id)
      setTrips(tripData as Trip[])
    } catch (e) {
      console.error('Dashboard load failed:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  useEffect(() => {
    if (searchParams.get('share') === '1' && hasPreviewTrip()) {
      setShowModal(true)
    }
  }, [searchParams])

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

export default function Dashboard() {
  return (
    <Suspense fallback={null}>
      <DashboardContent />
    </Suspense>
  )
}
