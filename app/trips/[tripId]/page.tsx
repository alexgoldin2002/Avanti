'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import AvantiLogo from '../../components/AvantiLogo'
import SuitcaseLoader from '../../components/SuitcaseLoader'

const STEP_COLORS = [
  { bg: '#e8f0e4', border: '#8aad7a', numBg: '#1a4a0e', titleColor: '#0a2a06', subColor: '#1a5a32' },
  { bg: '#eaf5e8', border: '#a8d49a', numBg: '#2a7a1e', titleColor: '#143a0a', subColor: '#235a14' },
  { bg: '#eef5e4', border: '#b8d492', numBg: '#3a7a14', titleColor: '#1e3a08', subColor: '#2e5a10' },
  { bg: '#f0f5e0', border: '#c8d880', numBg: '#5a7a0a', titleColor: '#2a3a04', subColor: '#3a5a08' },
  { bg: '#f2f5dc', border: '#d4d878', numBg: '#6a7a10', titleColor: '#343a06', subColor: '#4a5a0c' },
  { bg: '#f5f4d8', border: '#dcd870', numBg: '#7a7a14', titleColor: '#3a3a04', subColor: '#5a5a0c' },
]

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
  const [stepColors, setStepColors] = useState(STEP_COLORS)
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

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setUserId(user.id)
      const { data: tripData } = await supabase.from('trips').select('*').eq('id', tripId).single()
      if (user && tripData) {
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
      const { data: voteData } = await supabase.from('group_votes').select('*').eq('trip_id', tripId).eq('status', 'open').order('created_at', { ascending: false })
      if (tripData) {
        setTrip(tripData)
        if (tripData.step_colors) setStepColors(tripData.step_colors)
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
        setStepColors(data.colors)
        await supabase.from('trips').update({ step_colors: data.colors }).eq('id', tripId)
      }
    } catch (e) {}
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
        setStepColors(data.colors)
        await supabase.from('trips').update({ step_colors: data.colors }).eq('id', tripId)
      }
    } catch (e) {}
    setExtractingColors(false)
    setUrlInput('')
  }

  const handleRemoveImage = async () => {
    await supabase.from('trips').update({ cover_image: null, step_colors: null }).eq('id', tripId)
    setTrip((t: any) => ({ ...t, cover_image: null }))
    setStepColors(STEP_COLORS)
    setShowEditCover(false)
  }

  const saveImagePosition = async (pos: any) => {
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

  const getStepStatus = (stepNum: number) => {
    const active = getActiveStep()
    if (stepNum < active) return 'completed'
    if (stepNum === active) return 'active'
    return 'locked'
  }

  const steps = [
    { number: 1, title: 'Invite guests', description: trip?.invites_closed ? `${travelers.filter(t => t.role !== 'organizer').length} guests · closed` : `${travelers.filter(t => t.role !== 'organizer').length} guests added`, path: `/trips/${tripId}/invite` },
    { number: 2, title: 'Brainstorm', description: 'Plan with Avanti AI', path: `/trips/${tripId}/plan` },
    { number: 3, title: 'Itinerary & flights', description: 'Routes and transport', path: `/trips/${tripId}/itinerary` },
    { number: 4, title: 'Accommodation', description: 'Hotels and Airbnbs', path: `/trips/${tripId}/accommodation` },
    { number: 5, title: 'Activities', description: 'Things to do', path: `/trips/${tripId}/activities` },
    { number: 6, title: 'Dining', description: 'Restaurants and reservations', path: `/trips/${tripId}/dining` },
  ]

  const getDaysLeft = (deadline: string) => {
    const diff = new Date(deadline).getTime() - Date.now()
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
    if (days <= 0) return 'Closing today'
    if (days === 1) return '1 day left'
    return `${days} days left`
  }

  const s = { fontFamily: 'var(--font-cormorant), Georgia, serif' }

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

  return (
    <main style={{ minHeight: '100vh', background: '#fafaf8', ...s }}>
      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '32px 24px' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <AvantiLogo size="sm" />
          <button onClick={() => router.push('/dashboard')} style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#9a9a8a', background: 'none', border: 'none', cursor: 'pointer', ...s }}>← All trips</button>
        </div>

        <div style={{ background: trip.cover_color || '#182D09', borderRadius: '12px', marginBottom: '16px', position: 'relative', overflow: 'hidden', minHeight: '140px', border: 'none', outline: 'none' }}>
          {trip.cover_image && (
            <>
              <img src={trip.cover_image} alt="" draggable={false} style={{ position: 'absolute', top: '50%', left: '50%', transform: `translate(-50%, -50%) translate(${(50 - imagePosition.x) * 2}px, ${(50 - imagePosition.y) * 2}px) scale(${imagePosition.scale})`, width: '100%', height: '100%', objectFit: 'cover', transformOrigin: 'center center', pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.1) 60%, transparent 100%)' }} />
            </>
          )}
          {extractingColors && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(26,58,42,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20, borderRadius: '12px' }}>
              <svg width="40" height="34" viewBox="0 0 80 64" fill="none">
                <style>{`@keyframes dc{0%{stroke-dashoffset:300;opacity:.3}60%{stroke-dashoffset:0;opacity:1}100%{stroke-dashoffset:-300;opacity:.3}}.sc{stroke-dasharray:300;animation:dc 2.4s ease-in-out infinite}`}</style>
                <rect className="sc" x="6" y="18" width="68" height="40" rx="4" stroke="white" strokeWidth="2" fill="none"/>
                <rect className="sc" x="26" y="6" width="28" height="14" rx="2" stroke="white" strokeWidth="2" fill="none" style={{ animationDelay: '0.2s' }}/>
                <line className="sc" x1="6" y1="32" x2="74" y2="32" stroke="white" strokeWidth="1.5" style={{ animationDelay: '0.4s' }}/>
                <circle cx="18" cy="62" r="3.5" stroke="white" strokeWidth="2" fill="none"/>
                <circle cx="62" cy="62" r="3.5" stroke="white" strokeWidth="2" fill="none"/>
              </svg>
            </div>
          )}
          <button onClick={() => setShowEditCover(!showEditCover)} style={{ position: 'absolute', top: '12px', right: '12px', background: 'rgba(255,255,255,0.15)', border: 'none', cursor: 'pointer', borderRadius: '50%', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }} title="Edit cover">
            <i className="ti ti-photo-edit" style={{ fontSize: '14px', color: 'rgba(255,255,255,0.6)' }} aria-hidden="true" />
          </button>
          <div style={{ position: 'relative', zIndex: 1, padding: '24px 28px' }}>
            <p style={{ fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', margin: '0 0 8px' }}>{trip.trip_type || 'Trip'}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              {editingName ? (
                <input value={nameInput} onChange={e => setNameInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditingName(false) }} onBlur={handleSaveName} autoFocus style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.5)', color: '#ffffff', fontSize: '32px', fontWeight: 300, outline: 'none', width: '100%', ...s, padding: '4px 0' }} />
              ) : (
                <>
                  <h1 style={{ fontSize: '32px', fontWeight: 300, color: '#ffffff', margin: 0, letterSpacing: '-0.5px', lineHeight: 1.1, ...s }}>{trip.name}</h1>
                  <button onClick={() => { setEditingName(true); setNameInput(trip.name) }} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', cursor: 'pointer', borderRadius: '50%', width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <i className="ti ti-pencil" style={{ fontSize: '12px', color: 'rgba(255,255,255,0.55)' }} aria-hidden="true" />
                  </button>
                </>
              )}
            </div>
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.65)', margin: '0 0 2px' }}>{trip.destination}</p>
            <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', margin: 0 }}>{formatDates()}</p>
          </div>
        </div>

        {showEditCover && (
          <div style={{ background: '#fff', border: '0.5px solid #e4e4d8', borderRadius: '12px', padding: '18px', marginBottom: '16px' }}>
            <p style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#9a9a8a', margin: '0 0 12px' }}>Change cover image</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', border: '0.5px solid #e4e4d8', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', color: '#1a1a1a', ...s }}>
                <i className="ti ti-photo" style={{ fontSize: '16px', color: '#9a9a8a' }} aria-hidden="true" />
                Choose from photo library
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileUpload} />
              </label>
              {trip.cover_image && (
                <button onClick={() => { setTempPosition({...imagePosition}); setShowCropModal(true); setShowEditCover(false) }} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', border: '0.5px solid #e4e4d8', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', color: '#1a1a1a', background: 'transparent', ...s }}>
                  <i className="ti ti-arrows-move" style={{ fontSize: '16px', color: '#9a9a8a' }} aria-hidden="true" />
                  Adjust image position
                </button>
              )}
              <div style={{ display: 'flex', gap: '8px' }}>
                <input type="url" placeholder="Paste an image URL..." value={urlInput} onChange={e => setUrlInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleUrlImage()} style={{ flex: 1, borderBottom: '1px solid #d4d4c8', background: 'transparent', padding: '8px 0', fontSize: '13px', color: '#1a1a1a', outline: 'none', ...s }} />
                <button onClick={handleUrlImage} style={{ padding: '6px 12px', border: '1px solid #1a1a1a', background: '#1a1a1a', color: '#fafaf8', cursor: 'pointer', fontSize: '11px', borderRadius: '6px', ...s }}>Use</button>
              </div>
              {trip.cover_image && (
                <button onClick={handleRemoveImage} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', border: '0.5px solid #f0d4d4', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', color: '#a32d2d', background: 'transparent', ...s }}>
                  <i className="ti ti-trash" style={{ fontSize: '16px' }} aria-hidden="true" />
                  Remove cover image
                </button>
              )}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '0', marginBottom: '20px', borderBottom: '1px solid #e8e8e0' }}>
          {[{ key: 'prep', label: 'Prep' }, { key: 'gametime', label: 'Game time' }].map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
              style={{ flex: 1, padding: '10px 0', fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', color: activeTab === tab.key ? '#1a1a1a' : '#9a9a8a', background: 'none', border: 'none', borderBottom: `2px solid ${activeTab === tab.key ? '#2d5a18' : 'transparent'}`, cursor: 'pointer', ...s }}>
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'prep' && (
          <>
            <div style={{ marginBottom: '20px' }}>
              <p style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#9a9a8a', margin: '0 0 10px' }}>To do</p>
              {votes.length === 0 ? (
                <div style={{ padding: '14px 18px', background: '#fff', border: '0.5px solid #e4e4d8', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#d4d4c8', flexShrink: 0 }} />
                  <p style={{ fontSize: '13px', color: '#b4b4a8', margin: 0, fontStyle: 'italic', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>No actions at this time</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {votes.map(vote => (
                    <button key={vote.id} onClick={() => router.push(`/trips/${tripId}/vote/${vote.id}`)}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', background: '#fff', border: '1.5px solid #2d5a18', borderRadius: '10px', cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#2d5a18' }} />
                        <div>
                          <p style={{ fontSize: '13px', color: '#1a1a1a', margin: '0 0 2px' }}>Vote — {vote.vote_type}</p>
                          <p style={{ fontSize: '11px', color: '#9a9a8a', margin: 0 }}>{vote.deadline ? getDaysLeft(vote.deadline) : 'No deadline set'} · {(vote.options || []).length} options</p>
                        </div>
                      </div>
                      <span style={{ fontSize: '18px', color: '#2d5a18' }}>›</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <p style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#9a9a8a', margin: '0 0 12px' }}>Planning steps</p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '10px' }}>
              {steps.slice(0, 3).map((step, i) => {
                const status = getStepStatus(step.number)
                const colors = stepColors[i] || STEP_COLORS[i]
                const isActive = status === 'active'
                const isLocked = status === 'locked'
                const isCompleted = status === 'completed'
                return (
                  <div key={step.number} onClick={() => !isLocked && router.push(step.path)}
                    style={{ background: colors.bg, border: isActive ? `2px solid ${colors.numBg}` : `0.5px solid ${colors.border}`, borderRadius: '12px', padding: '16px', position: 'relative', cursor: isLocked ? 'default' : 'pointer', opacity: isLocked ? 0.42 : 1, transition: 'all 0.2s', minHeight: '90px', boxShadow: isActive ? `0 0 0 3px ${colors.bg}` : 'none' }}>
                    <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: isCompleted ? colors.numBg : isLocked ? '#d4d4c8' : colors.numBg, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', fontWeight: 300, position: 'absolute', top: '10px', right: '10px', ...s }}>
                      {isCompleted ? '✓' : step.number}
                    </div>
                    {isActive && <div style={{ position: 'absolute', top: '8px', left: '8px', width: '6px', height: '6px', borderRadius: '50%', background: colors.numBg }} />}
                    <p style={{ fontSize: '14px', fontWeight: 400, color: colors.titleColor, margin: '0 0 4px', lineHeight: 1.2, paddingRight: '38px', ...s }}>{step.title}</p>
                    <p style={{ fontSize: '11px', color: colors.subColor, margin: 0, lineHeight: 1.4, opacity: 0.85 }}>{step.description}</p>
                    {isLocked && <i className="ti ti-lock" style={{ position: 'absolute', bottom: '10px', right: '10px', fontSize: '12px', color: '#b4b4a8', opacity: 0.5 }} aria-hidden="true" />}
                  </div>
                )
              })}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '20px' }}>
              {steps.slice(3).map((step, i) => {
                const status = getStepStatus(step.number)
                const colors = stepColors[i + 3] || STEP_COLORS[i + 3]
                const isActive = status === 'active'
                const isLocked = status === 'locked'
                const isCompleted = status === 'completed'
                return (
                  <div key={step.number} onClick={() => !isLocked && router.push(step.path)}
                    style={{ background: colors.bg, border: isActive ? `2px solid ${colors.numBg}` : `0.5px solid ${colors.border}`, borderRadius: '12px', padding: '16px', position: 'relative', cursor: isLocked ? 'default' : 'pointer', opacity: isLocked ? 0.42 : 1, transition: 'all 0.2s', minHeight: '90px' }}>
                    <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: isCompleted ? colors.numBg : isLocked ? '#d4d4c8' : colors.numBg, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', fontWeight: 300, position: 'absolute', top: '10px', right: '10px', ...s }}>
                      {isCompleted ? '✓' : step.number}
                    </div>
                    {isActive && <div style={{ position: 'absolute', top: '8px', left: '8px', width: '6px', height: '6px', borderRadius: '50%', background: colors.numBg }} />}
                    <p style={{ fontSize: '14px', fontWeight: 400, color: colors.titleColor, margin: '0 0 4px', lineHeight: 1.2, paddingRight: '38px', ...s }}>{step.title}</p>
                    <p style={{ fontSize: '11px', color: colors.subColor, margin: 0, lineHeight: 1.4, opacity: 0.85 }}>{step.description}</p>
                    {isLocked && <i className="ti ti-lock" style={{ position: 'absolute', bottom: '10px', right: '10px', fontSize: '12px', color: '#b4b4a8', opacity: 0.5 }} aria-hidden="true" />}
                  </div>
                )
              })}
            </div>

            <div style={{ borderLeft: '3px solid #2d5a18', borderRadius: '0 8px 8px 0', padding: '12px 16px', border: '0.5px solid #8aad7a', borderLeftColor: '#2d5a18', borderLeftWidth: '3px', background: '#fafaf8' }}>
              <p style={{ fontSize: '12px', color: '#6a6a6a', margin: 0, ...s }}>
                {travelers.length} traveler{travelers.length !== 1 ? 's' : ''} ·{' '}
                {travelers.filter(t => t.profile_complete).length} of {travelers.length} ready ·{' '}
                <span style={{ color: '#2d5a18' }}>Step {getActiveStep()} active</span>
              </p>
            </div>
          </>
        )}

        {activeTab === 'gametime' && (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <p style={{ fontSize: '32px', margin: '0 0 12px' }}>✈️</p>
            <p style={{ fontSize: '18px', fontWeight: 300, color: '#1a1a1a', margin: '0 0 8px', ...s }}>Game time coming soon</p>
            <p style={{ fontSize: '13px', color: '#9a9a8a' }}>Morning briefings, live updates, and bill splitting — unlocks when your trip begins.</p>
          </div>
        )}

      </div>

      {showCropModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '24px' }}>
          <div style={{ background: '#fafaf8', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '480px', ...s }}>
            <p style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#9a9a8a', margin: '0 0 6px' }}>Adjust image</p>
            <p style={{ fontSize: '12px', color: '#9a9a8a', margin: '0 0 12px' }}>Drag to reposition · Scroll to zoom</p>
            <div style={{ position: 'relative', height: '200px', borderRadius: '10px', overflow: 'hidden', cursor: isTempDragging ? 'grabbing' : 'grab', marginBottom: '16px', userSelect: 'none', touchAction: 'none' }}
              onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); setIsTempDragging(true); setTempDragStart({ x: e.clientX, y: e.clientY, startPosX: tempPosition.x, startPosY: tempPosition.y }) }}
              onPointerMove={e => { if (!isTempDragging) return; const dx = (e.clientX - tempDragStart.x) * 0.15; const dy = (e.clientY - tempDragStart.y) * 0.15; setTempPosition(p => ({ ...p, x: Math.max(0, Math.min(100, tempDragStart.startPosX - dx)), y: Math.max(0, Math.min(100, tempDragStart.startPosY - dy)) })) }}
              onPointerUp={() => setIsTempDragging(false)}
              onPointerCancel={() => setIsTempDragging(false)}
              onWheel={e => { e.preventDefault(); setTempPosition(p => ({ ...p, scale: Math.max(0.5, Math.min(3, p.scale - e.deltaY * 0.002)) })) }}>
              <img src={trip.cover_image} draggable={false} style={{ position: 'absolute', top: '50%', left: '50%', transform: `translate(-50%, -50%) translate(${(50 - tempPosition.x) * 2}px, ${(50 - tempPosition.y) * 2}px) scale(${tempPosition.scale})`, width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none', transformOrigin: 'center center' }} />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.4) 0%, transparent 60%)', pointerEvents: 'none' }} />
              <p style={{ position: 'absolute', bottom: '10px', left: '14px', color: '#fff', fontSize: '13px', fontWeight: 300, margin: 0, ...s, pointerEvents: 'none' }}>{trip.name}</p>
            </div>
            <div style={{ marginBottom: '14px' }}>
              <p style={{ fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9a9a8a', margin: '0 0 6px' }}>Zoom {Math.round(tempPosition.scale * 100)}%</p>
              <input type="range" min="50" max="300" step="1" value={Math.round(tempPosition.scale * 100)} onChange={e => setTempPosition(p => ({ ...p, scale: parseInt(e.target.value) / 100 }))} style={{ width: '100%' }} />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowCropModal(false)} style={{ flex: 1, border: '1px solid #d4d4c8', padding: '12px', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#9a9a8a', background: 'transparent', cursor: 'pointer', borderRadius: '6px', ...s }}>Cancel</button>
              <button onClick={async () => { setImagePosition(tempPosition); await saveImagePosition(tempPosition); setShowCropModal(false) }} style={{ flex: 1, border: '1px solid #1a1a1a', padding: '12px', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#1a1a1a', background: 'transparent', cursor: 'pointer', borderRadius: '6px', ...s }}>Apply →</button>
            </div>
          </div>
        </div>
      )}
      {showWelcome && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(26,58,42,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '24px', cursor: 'pointer', fontFamily: 'var(--font-cormorant), Georgia, serif' }}
          onClick={() => setShowWelcome(false)}
        >
          <div style={{ textAlign: 'center', color: '#fff' }} onClick={e => e.stopPropagation()}>
            <p style={{ fontSize: '11px', letterSpacing: '0.3em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', margin: '0 0 12px' }}>You're in</p>
            <h2 style={{ fontSize: '38px', fontWeight: 300, color: '#ffffff', margin: '0 0 12px', letterSpacing: '-0.5px' }}>
              Welcome{welcomeName ? `, ${welcomeName}` : ''}
            </h2>
            <p style={{ fontSize: '15px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.7, margin: '0 0 32px', maxWidth: '300px' }}>
              Now we go... Avanti!
            </p>
            <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>Tap anywhere to continue</p>
          </div>
        </div>
      )}
    </main>
  )
}
