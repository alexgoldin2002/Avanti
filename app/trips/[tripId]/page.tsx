'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import SuitcaseLoader from '../../components/SuitcaseLoader'
import { BackLink } from '../../components/SubpageShell'

type StepState = 'done' | 'active' | 'locked' | 'open'

type StepDef = {
  key: string
  number: number
  title: string
  subtitle: string
  icon: string
  path: string
  badge?: string | number
}

function StepCard({
  step,
  index,
  state,
  onClick,
}: {
  step: StepDef
  index: number
  state: StepState
  onClick: () => void
}) {
  const isDone = state === 'done'
  const isActive = state === 'active'
  const isLocked = state === 'locked'

  return (
    <button
      type="button"
      disabled={isLocked}
      onClick={onClick}
      className={`group avanti-box relative flex h-32 flex-col justify-between rounded-none border px-5 py-4 text-left transition-all duration-200 ease-out hover:[box-shadow:var(--shadow-box-hover)] ${
        isActive
          ? 'border-forest-deep bg-card [box-shadow:var(--shadow-box-hover)]'
          : isDone
          ? 'border-border bg-card hover:-translate-y-px hover:border-forest-deep/30 cursor-pointer'
          : isLocked
          ? 'border-border bg-card/60 opacity-60 cursor-not-allowed shadow-none'
          : 'border-border bg-card hover:-translate-y-0.5 cursor-pointer'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          {isActive && <span className="h-2 w-2 rounded-full bg-forest-deep transition-transform duration-200 group-hover:scale-125" />}
          <span className={`font-serif text-lg leading-tight transition-colors duration-200 ${!isLocked ? 'group-hover:text-forest-deep' : ''}`}>{step.title}</span>
        </div>
        <span
          className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] transition-transform duration-200 ${!isLocked ? 'group-hover:scale-110' : ''} ${
            isDone || isActive
              ? 'bg-forest-deep text-cream'
              : 'bg-secondary text-muted-foreground'
          }`}
        >
          {isDone ? (
            <i className="ti ti-check text-xs" aria-hidden />
          ) : step.badge !== undefined ? (
            step.badge
          ) : (
            <i className={`ti ${step.icon} text-xs`} aria-hidden />
          )}
        </span>
      </div>
      <div className="flex items-end justify-between">
        <span className={`text-xs text-muted-foreground transition-colors duration-200 ${!isLocked ? 'group-hover:text-foreground/70' : ''}`}>{step.subtitle}</span>
        {isLocked && <i className="ti ti-lock text-sm text-muted-foreground" aria-hidden />}
      </div>
      <span className="absolute left-5 top-1/2 -translate-y-1/2 text-[10px] tracking-widest text-muted-foreground/40">
        {String(index + 1).padStart(2, '0')}
      </span>
    </button>
  )
}

export default function TripDashboard() {
  const params = useParams()
  const router = useRouter()
  const tripId = params.tripId as string
  const [trip, setTrip] = useState<any>(null)
  const [travelers, setTravelers] = useState<any[]>([])
  const [votes, setVotes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'prep' | 'gametime'>('prep')
  const [userId, setUserId] = useState<string | null>(null)
  const [showEditCover, setShowEditCover] = useState(false)
  const [extractingColors, setExtractingColors] = useState(false)
  const [imagePosition, setImagePosition] = useState({ x: 50, y: 50, scale: 1 })
  const [showCropModal, setShowCropModal] = useState(false)
  const [tempPosition, setTempPosition] = useState({ x: 50, y: 50, scale: 1 })
  const [tempDragStart, setTempDragStart] = useState({ x: 0, y: 0, startPosX: 50, startPosY: 50 })
  const [isTempDragging, setIsTempDragging] = useState(false)
  const [urlInput, setUrlInput] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [showWelcome, setShowWelcome] = useState(false)
  const [welcomeName, setWelcomeName] = useState('')
  const [isOrganizer, setIsOrganizer] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setUserId(user.id)
      const { data: tripData } = await supabase.from('trips').select('*').eq('id', tripId).single()
      if (user && tripData) {
        setIsOrganizer(tripData.organizer_id === user.id)
        const { data: myTraveler } = await supabase
          .from('travelers')
          .select('*')
          .eq('trip_id', tripId)
          .eq('user_id', user.id)
          .maybeSingle()

        if (myTraveler && myTraveler.status === 'pending') {
          router.push(`/join/pending?trip=${encodeURIComponent(tripData?.name || 'your trip')}&tripId=${tripId}`)
          return
        }

        if (myTraveler && myTraveler.role === 'member') {
          const justWelcomed = sessionStorage.getItem(`welcomed_${tripId}`)
          if (!justWelcomed) {
            setWelcomeName(myTraveler.nickname || myTraveler.full_name?.split(' ')[0] || '')
            setShowWelcome(true)
            sessionStorage.setItem(`welcomed_${tripId}`, 'true')
          }
        }
      }
      const { data: travelerData } = await supabase.from('travelers').select('*').eq('trip_id', tripId)
      const { data: voteData } = await supabase
        .from('group_votes')
        .select('id, vote_type, options, status, submission_deadline, voting_deadline, deadline, created_at')
        .eq('trip_id', tripId)
        .neq('status', 'closed')
        .order('created_at', { ascending: false })
      if (tripData) {
        setTrip(tripData)
        if (tripData.image_position) setImagePosition(tripData.image_position)
      }
      if (travelerData) setTravelers(travelerData)
      if (voteData) setVotes(voteData)
      setLoading(false)
    }
    load()
  }, [tripId, router])

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setExtractingColors(true)
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const MAX_SIZE = 800
      let width = img.width, height = img.height
      if (width > height) { if (width > MAX_SIZE) { height = height * MAX_SIZE / width; width = MAX_SIZE } }
      else { if (height > MAX_SIZE) { width = width * MAX_SIZE / height; height = MAX_SIZE } }
      canvas.width = width; canvas.height = height
      const ctx = canvas.getContext('2d')
      ctx?.drawImage(img, 0, 0, width, height)
      const base64 = canvas.toDataURL('image/jpeg', 0.85)
      URL.revokeObjectURL(objectUrl)
      setImagePosition({ x: 50, y: 50, scale: 1 })
      setTempPosition({ x: 50, y: 50, scale: 1 })
      handleImageChange(base64)
    }
    img.src = objectUrl
  }

  const handleImageChange = async (imageBase64: string) => {
    await supabase.from('trips').update({ cover_image: imageBase64 }).eq('id', tripId)
    setTrip((t: any) => ({ ...t, cover_image: imageBase64 }))
    try {
      const res = await fetch('/api/extract-colors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageBase64 }) })
      const data = await res.json()
      if (data.colors && Array.isArray(data.colors) && data.colors.length >= 6) {
        await supabase.from('trips').update({ step_colors: data.colors }).eq('id', tripId)
      }
    } catch { /* optional */ }
    setExtractingColors(false)
    setShowEditCover(false)
  }

  const handleUrlImage = async () => {
    if (!urlInput.trim()) return
    setExtractingColors(true)
    setShowEditCover(false)
    await supabase.from('trips').update({ cover_image: urlInput }).eq('id', tripId)
    setTrip((t: any) => ({ ...t, cover_image: urlInput }))
    try {
      const res = await fetch('/api/extract-colors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageUrl: urlInput }) })
      const data = await res.json()
      if (data.colors && Array.isArray(data.colors) && data.colors.length >= 6) {
        await supabase.from('trips').update({ step_colors: data.colors }).eq('id', tripId)
      }
    } catch { /* optional */ }
    setExtractingColors(false)
    setUrlInput('')
  }

  const handleRemoveImage = async () => {
    await supabase.from('trips').update({ cover_image: null, step_colors: null }).eq('id', tripId)
    setTrip((t: any) => ({ ...t, cover_image: null }))
    setShowEditCover(false)
  }

  const saveImagePosition = async (pos: typeof imagePosition) => {
    await supabase.from('trips').update({ image_position: pos }).eq('id', tripId)
  }

  const handleSaveName = async () => {
    if (!nameInput.trim()) { setEditingName(false); return }
    await supabase.from('trips').update({ name: nameInput }).eq('id', tripId)
    setTrip((t: any) => ({ ...t, name: nameInput }))
    setEditingName(false)
  }

  const getActiveStep = () => {
    if (!trip?.invites_closed) return 1
    if (!trip?.destination || trip?.destination === 'TBD') return 2
    if (!trip?.options_generated) return 2
    return 3
  }

  const getStepState = (stepNum: number): StepState => {
    const active = getActiveStep()
    if (stepNum < active) return 'done'
    if (stepNum === active) return 'active'
    if (stepNum === active + 1 && stepNum <= 3) return 'open'
    return 'locked'
  }

  const guestCount = travelers.filter(t => t.role !== 'organizer').length

  const steps: StepDef[] = [
    {
      key: 'invite',
      number: 1,
      title: 'Invite guests',
      subtitle: trip?.invites_closed ? `${guestCount} guests · closed` : `${guestCount} guests added`,
      icon: 'ti-users',
      path: `/trips/${tripId}/invite`,
    },
    {
      key: 'brainstorm',
      number: 2,
      title: 'Brainstorm',
      subtitle: 'Plan with Avanti AI',
      icon: 'ti-brain',
      path: `/trips/${tripId}/step2`,
      badge: votes.length > 0 ? votes.length : undefined,
    },
    { key: 'itinerary', number: 3, title: 'Itinerary & flights', subtitle: 'Routes and transport', icon: 'ti-map', path: `/trips/${tripId}/itinerary` },
    { key: 'stay', number: 4, title: 'Accommodation', subtitle: 'Hotels and Airbnbs', icon: 'ti-building', path: `/trips/${tripId}/accommodation` },
    { key: 'activities', number: 5, title: 'Activities', subtitle: 'Things to do', icon: 'ti-compass', path: `/trips/${tripId}/activities` },
    { key: 'dining', number: 6, title: 'Dining', subtitle: 'Restaurants and reservations', icon: 'ti-tools-kitchen-2', path: `/trips/${tripId}/dining` },
  ]

  const getDaysLeft = (deadline: string) => {
    const diff = new Date(deadline).getTime() - Date.now()
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
    if (days <= 0) return 'Closing today'
    if (days === 1) return '1 day left'
    return `${days} days left`
  }

  if (loading) return <SuitcaseLoader message="Loading your trip" />
  if (!trip) return null

  const formatDates = () => {
    if (trip.start_date && trip.end_date) {
      const start = new Date(trip.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      const end = new Date(trip.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      return `${start} – ${end}`
    }
    if (trip.date_range_start && trip.date_range_end) return `${trip.date_range_start} – ${trip.date_range_end}`
    return 'Dates TBD'
  }

  const activeStep = getActiveStep()
  const readyCount = travelers.filter(t => t.profile_complete).length

  return (
    <>
      <main className="mx-auto w-full max-w-3xl px-6 sm:px-10 pt-24 sm:pt-32 pb-24 flex-1">
        <BackLink href="/dashboard" />

        {/* Hero card */}
        <section
          className="relative overflow-hidden rounded-none px-7 py-8 sm:px-10 sm:py-10 bg-forest-deep text-cream transition-shadow duration-300 hover:[box-shadow:var(--shadow-box-hover)]"
          style={{ boxShadow: 'var(--shadow-elegant)' }}
        >
          {trip.cover_image && (
            <>
              <img
                src={trip.cover_image}
                alt=""
                draggable={false}
                className="absolute inset-0 h-full w-full object-cover pointer-events-none"
                style={{
                  transform: `translate(${(50 - imagePosition.x) * 0.5}%, ${(50 - imagePosition.y) * 0.5}%) scale(${imagePosition.scale})`,
                  transformOrigin: 'center center',
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-forest-deep/90 via-forest-deep/40 to-forest-deep/20" />
            </>
          )}

          {extractingColors && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-forest-deep/80">
              <svg width="40" height="34" viewBox="0 0 80 64" fill="none" aria-hidden>
                <style>{`@keyframes dc{0%{stroke-dashoffset:300;opacity:.3}60%{stroke-dashoffset:0;opacity:1}100%{stroke-dashoffset:-300;opacity:.3}}.sc{stroke-dasharray:300;animation:dc 2.4s ease-in-out infinite}`}</style>
                <rect className="sc" x="6" y="18" width="68" height="40" rx="4" stroke="white" strokeWidth="2" fill="none"/>
                <rect className="sc" x="26" y="6" width="28" height="14" rx="2" stroke="white" strokeWidth="2" fill="none" style={{ animationDelay: '0.2s' }}/>
              </svg>
            </div>
          )}

          <div className="relative flex items-start justify-between gap-6">
            <div className="min-w-0">
              <div className="text-[10px] tracking-[0.35em] uppercase text-cream/60">
                {trip.trip_type || 'Friend group'}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
                {editingName ? (
                  <input
                    value={nameInput}
                    onChange={e => setNameInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditingName(false) }}
                    onBlur={handleSaveName}
                    autoFocus
                    className="font-serif text-4xl sm:text-5xl text-cream leading-[1.05] bg-transparent border-b border-cream/50 outline-none w-full max-w-md"
                  />
                ) : (
                  <>
                    <h1 className="font-serif text-4xl sm:text-5xl text-cream leading-[1.05]">
                      {trip.name}
                    </h1>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => { setEditingName(true); setNameInput(trip.name) }}
                        className="grid h-8 w-8 place-items-center rounded-full bg-cream/10 text-cream/70 transition-all duration-200 hover:bg-cream/25 hover:text-cream hover:scale-105"
                        aria-label="Edit trip name"
                      >
                        <i className="ti ti-pencil text-[15px]" aria-hidden />
                      </button>
                      {isOrganizer && (
                        <button
                          type="button"
                          onClick={() => router.push(`/trips/${tripId}/settings`)}
                          className="grid h-8 w-8 place-items-center rounded-full bg-cream/10 text-cream/70 transition-all duration-200 hover:bg-cream/25 hover:text-cream hover:scale-105"
                          aria-label="Trip settings"
                        >
                          <i className="ti ti-settings text-[15px]" aria-hidden />
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
              <div className="mt-4 inline-flex items-center gap-2 text-xs text-cream/55">
                <i className="ti ti-calendar text-sm" aria-hidden />
                {formatDates()}
              </div>
              {trip.destination && trip.destination !== 'TBD' && (
                <p className="mt-2 text-xs text-cream/50">{trip.destination}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowEditCover(!showEditCover)}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-cream/10 text-cream/80 transition-all duration-200 hover:bg-cream/25 hover:text-cream hover:scale-105"
              aria-label="Edit cover image"
            >
              <i className="ti ti-photo text-base" aria-hidden />
            </button>
          </div>
        </section>

        {showEditCover && (
          <div className="mt-4 rounded-none border border-border bg-card px-5 py-4">
            <p className="text-[10px] tracking-[0.35em] uppercase text-muted-foreground mb-3">Change cover image</p>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-3 rounded-none border border-border px-4 py-3 text-sm cursor-pointer hover:bg-secondary/50 transition">
                <i className="ti ti-photo text-muted-foreground" aria-hidden />
                Choose from photo library
                <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
              </label>
              {trip.cover_image && (
                <button
                  type="button"
                  onClick={() => { setTempPosition({ ...imagePosition }); setShowCropModal(true); setShowEditCover(false) }}
                  className="flex items-center gap-3 rounded-none border border-border px-4 py-3 text-sm text-left hover:bg-secondary/50 transition"
                >
                  <i className="ti ti-arrows-move text-muted-foreground" aria-hidden />
                  Adjust image position
                </button>
              )}
              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder="Paste an image URL..."
                  value={urlInput}
                  onChange={e => setUrlInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleUrlImage()}
                  className="flex-1 border-b border-border bg-transparent py-2 text-sm outline-none font-serif"
                />
                <button type="button" onClick={handleUrlImage} className="rounded-none bg-forest-deep px-3 py-1.5 text-xs text-cream">Use</button>
              </div>
              {trip.cover_image && (
                <button type="button" onClick={handleRemoveImage} className="flex items-center gap-3 rounded-none border border-destructive/30 px-4 py-3 text-sm text-destructive text-left">
                  <i className="ti ti-trash" aria-hidden />
                  Remove cover image
                </button>
              )}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="mt-8 grid grid-cols-2 border-b border-border">
          {(['prep', 'gametime'] as const).map(tab => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`group relative pb-3 text-xs tracking-[0.3em] uppercase transition-all duration-200 ${
                activeTab === tab ? 'text-foreground' : 'text-muted-foreground hover:text-foreground/80'
              }`}
            >
              {tab === 'prep' ? 'Prep' : 'Game time'}
              <span
                className={`absolute -bottom-px left-0 right-0 h-0.5 bg-foreground transition-all duration-200 origin-center ${
                  activeTab === tab ? 'opacity-100 scale-x-100' : 'opacity-0 scale-x-75 group-hover:opacity-35 group-hover:scale-x-100'
                }`}
              />
            </button>
          ))}
        </div>

        {activeTab === 'prep' && (
          <>
            {/* To do */}
            <section className="mt-8">
              <div className="text-[10px] tracking-[0.35em] uppercase text-muted-foreground">To do</div>
              {votes.length === 0 ? (
                <div className="avanti-box mt-3 flex items-center gap-3 rounded-none border border-border bg-card px-5 py-4">
                  <span className="h-2 w-2 rounded-full bg-sage" />
                  <span className="font-serif italic text-muted-foreground">No actions at this time</span>
                </div>
              ) : (
                <div className="mt-3 flex flex-col gap-2">
                  {votes.filter(v => v.id).map(vote => (
                    <button
                      key={vote.id}
                      type="button"
                      onClick={() => router.push(`/trips/${tripId}/vote/${vote.id}`)}
                      className="group avanti-box flex items-center justify-between rounded-none border border-forest-deep bg-card px-5 py-4 text-left transition-all duration-200 ease-out hover:-translate-y-px hover:border-forest-deep hover:[box-shadow:var(--shadow-box-hover)]"
                    >
                      <div className="flex items-center gap-3">
                        <span className="h-2 w-2 rounded-full bg-forest-deep transition-transform duration-200 group-hover:scale-125" />
                        <div>
                          <p className="font-serif text-base transition-colors duration-200 group-hover:text-forest-deep">Vote — {vote.vote_type}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {vote.voting_deadline ? getDaysLeft(vote.voting_deadline) : vote.submission_deadline ? getDaysLeft(vote.submission_deadline) : vote.deadline ? getDaysLeft(vote.deadline) : 'No deadline'} · {(vote.options || []).length} options
                          </p>
                        </div>
                      </div>
                      <i className="ti ti-arrow-right text-sm text-muted-foreground transition-all duration-200 group-hover:translate-x-1 group-hover:text-foreground" aria-hidden />
                    </button>
                  ))}
                </div>
              )}
            </section>

            {/* Decisions */}
            <button
              type="button"
              onClick={() => router.push(`/trips/${tripId}/decisions`)}
              className="group avanti-box mt-3 flex w-full items-center justify-between rounded-none border border-border bg-card px-5 py-4 text-left transition-all duration-200 ease-out hover:-translate-y-px hover:border-forest-deep/40 hover:[box-shadow:var(--shadow-box-hover)]"
            >
              <span className="font-serif text-lg transition-colors duration-200 group-hover:text-forest-deep">Decisions</span>
              <span className="inline-flex items-center gap-2 text-[11px] tracking-[0.3em] uppercase text-muted-foreground transition-colors duration-200 group-hover:text-foreground">
                View all <i className="ti ti-arrow-right text-xs transition-transform duration-200 group-hover:translate-x-1" aria-hidden />
              </span>
            </button>

            {/* Planning steps */}
            <section className="mt-8">
              <div className="text-[10px] tracking-[0.35em] uppercase text-muted-foreground">Planning steps</div>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {steps.map((step, i) => {
                  const state = getStepState(step.number)
                  return (
                    <StepCard
                      key={step.key}
                      step={step}
                      index={i}
                      state={state}
                      onClick={() => state !== 'locked' && router.push(step.path)}
                    />
                  )
                })}
              </div>
            </section>

            {/* Status pill */}
            <div className="avanti-box mt-5 rounded-none border border-forest-deep/25 bg-card px-5 py-3.5">
              <p className="font-serif italic text-sm text-foreground m-0">
                {travelers.length} traveler{travelers.length !== 1 ? 's' : ''}
                {' · '}
                {readyCount} of {travelers.length} ready
                {' · '}
                Step {activeStep} active
              </p>
            </div>

          </>
        )}

        {activeTab === 'gametime' && (
          <div className="mt-16 text-center">
            <p className="text-4xl mb-4">✈️</p>
            <p className="font-serif text-xl text-foreground mb-2">Game time coming soon</p>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Morning briefings, live updates, and bill splitting — unlocks when your trip begins.
            </p>
          </div>
        )}
      </main>

      <footer className="bg-forest-deep text-cream">
        <div className="mx-auto max-w-4xl px-6 sm:px-10 py-8">
          <div className="flex flex-wrap gap-x-8 gap-y-3 text-xs tracking-wider">
            {[
              { label: 'How it works', href: '/how-it-works' },
              { label: 'About', href: '/about' },
              { label: 'Contact', href: '/contact' },
              { label: 'Dashboard', href: '/dashboard' },
            ].map(l => (
              <Link key={l.label} href={l.href} className="text-cream/70 transition hover:text-cream">
                {l.label}
              </Link>
            ))}
          </div>
          <div className="mt-6 text-[11px] text-cream/40">2026 © Avanti. All rights reserved.</div>
        </div>
      </footer>

      {showCropModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
          <div className="w-full max-w-md rounded-none bg-background p-6 font-serif">
            <p className="text-[10px] tracking-[0.35em] uppercase text-muted-foreground mb-1">Adjust image</p>
            <p className="text-xs text-muted-foreground mb-4">Drag to reposition · Scroll to zoom</p>
            <div
              className="relative h-52 rounded-none overflow-hidden mb-4 select-none touch-none"
              style={{ cursor: isTempDragging ? 'grabbing' : 'grab' }}
              onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); setIsTempDragging(true); setTempDragStart({ x: e.clientX, y: e.clientY, startPosX: tempPosition.x, startPosY: tempPosition.y }) }}
              onPointerMove={e => { if (!isTempDragging) return; const dx = (e.clientX - tempDragStart.x) * 0.15; const dy = (e.clientY - tempDragStart.y) * 0.15; setTempPosition(p => ({ ...p, x: Math.max(0, Math.min(100, tempDragStart.startPosX - dx)), y: Math.max(0, Math.min(100, tempDragStart.startPosY - dy)) })) }}
              onPointerUp={() => setIsTempDragging(false)}
              onPointerCancel={() => setIsTempDragging(false)}
              onWheel={e => { e.preventDefault(); setTempPosition(p => ({ ...p, scale: Math.max(0.5, Math.min(3, p.scale - e.deltaY * 0.002)) })) }}
            >
              <img src={trip.cover_image} alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover pointer-events-none" style={{ transform: `translate(${(50 - tempPosition.x) * 2}px, ${(50 - tempPosition.y) * 2}px) scale(${tempPosition.scale})`, transformOrigin: 'center center' }} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
            </div>
            <div className="mb-4">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Zoom {Math.round(tempPosition.scale * 100)}%</p>
              <input type="range" min="50" max="300" step="1" value={Math.round(tempPosition.scale * 100)} onChange={e => setTempPosition(p => ({ ...p, scale: parseInt(e.target.value) / 100 }))} className="w-full" />
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowCropModal(false)} className="flex-1 rounded-none border border-border py-3 text-[10px] tracking-[0.2em] uppercase text-muted-foreground">Cancel</button>
              <button type="button" onClick={async () => { setImagePosition(tempPosition); await saveImagePosition(tempPosition); setShowCropModal(false) }} className="flex-1 rounded-none border border-foreground py-3 text-[10px] tracking-[0.2em] uppercase">Apply →</button>
            </div>
          </div>
        </div>
      )}

      {showWelcome && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-forest-deep/85 p-6 cursor-pointer"
          onClick={() => setShowWelcome(false)}
        >
          <div className="text-center text-cream font-serif" onClick={e => e.stopPropagation()}>
            <p className="text-[11px] tracking-[0.3em] uppercase text-cream/50 mb-3">You&apos;re in</p>
            <h2 className="text-4xl font-light mb-3">Welcome{welcomeName ? `, ${welcomeName}` : ''}</h2>
            <p className="text-base text-cream/70 leading-relaxed mb-8 max-w-xs mx-auto">Now we go... Avanti!</p>
            <p className="text-[11px] text-cream/35 tracking-[0.15em] uppercase">Tap anywhere to continue</p>
          </div>
        </div>
      )}
    </>
  )
}
