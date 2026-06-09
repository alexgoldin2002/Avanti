'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import AvantiLogo from '../../../components/AvantiLogo'
import SuitcaseLoader from '../../../components/SuitcaseLoader'

export default function TripOptions() {
  const params = useParams()
  const router = useRouter()
  const tripId = params.tripId as string
  const [trip, setTrip] = useState<any>(null)
  const [options, setOptions] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [votes, setVotes] = useState<any[]>([])
  const [myVote, setMyVote] = useState<number | null>(null)
  const [myComment, setMyComment] = useState('')
  const [voting, setVoting] = useState(false)
  const [selectedOption, setSelectedOption] = useState(0)
  const [locking, setLocking] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [isOrganizer, setIsOrganizer] = useState(false)
  const [showAdjust, setShowAdjust] = useState<number | null>(null)
  const [adjustText, setAdjustText] = useState('')
  const [adjusting, setAdjusting] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setUserId(user.id)
      const { data: tripData } = await supabase.from('trips').select('*').eq('id', tripId).single()
      if (tripData) {
        setTrip(tripData)
        if (tripData.options) setOptions(tripData.options)
        if (tripData.recommended_option !== undefined) setSelectedOption(tripData.options?.recommended_option || 0)
        if (user) setIsOrganizer(tripData.organizer_id === user.id)
      }
      const { data: voteData } = await supabase.from('trip_votes').select('*').eq('trip_id', tripId)
      if (voteData) {
        setVotes(voteData)
        if (user) {
          const mine = voteData.find((v: any) => v.user_id === user.id)
          if (mine) { setMyVote(mine.option_index); setMyComment(mine.comment || '') }
        }
      }
      setLoading(false)
    }
    load()
  }, [tripId])

  const handleVote = async (optionIndex: number) => {
    setVoting(true)
    await supabase.from('trip_votes').upsert({ trip_id: tripId, user_id: userId, option_index: optionIndex, comment: myComment })
    setMyVote(optionIndex)
    const { data: voteData } = await supabase.from('trip_votes').select('*').eq('trip_id', tripId)
    if (voteData) setVotes(voteData)
    setVoting(false)
  }

  const handleLock = async (optionIndex: number) => {
    setLocking(true)
    const option = options.options[optionIndex]
    await supabase.from('trips').update({
      locked_option: option,
      phase_locked: true,
      phase: 'booked',
      destination: option.destination,
      start_date: option.dates?.split(' to ')[0]?.replace(/[^\d-]/g, '').trim() || trip.start_date,
      end_date: option.dates?.split(' to ')[1]?.replace(/[^\d-]/g, '').trim() || trip.end_date,
    }).eq('id', tripId)
    router.push(`/trips/${tripId}`)
  }

  const handleAdjust = async (optionIndex: number) => {
    if (!adjustText.trim()) return
    setAdjusting(true)
    try {
      const res = await fetch('/api/adjust-option', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tripId, optionIndex, adjustment: adjustText, currentOption: options.options[optionIndex] })
      })
      const data = await res.json()
      if (data.updatedOption) {
        const newOptions = { ...options }
        newOptions.options[optionIndex] = data.updatedOption
        setOptions(newOptions)
        await supabase.from('trips').update({ options: newOptions }).eq('id', tripId)
      }
    } catch (e) {}
    setAdjustText('')
    setShowAdjust(null)
    setAdjusting(false)
  }

  const getVotesForOption = (i: number) => votes.filter(v => v.option_index === i).length
  const optionColors = [
    { bg: '#e8f0e4', border: '#8aad7a', accent: '#1a4a0e', light: '#fafaf8', dark: '#0a2a06' },
    { bg: '#eeedfe', border: '#afa9ec', accent: '#534ab7', light: '#fafaf8', dark: '#26215c' },
    { bg: '#faeeda', border: '#ef9f27', accent: '#854f0b', light: '#fafaf8', dark: '#412402' },
  ]

  const s = { fontFamily: 'var(--font-cormorant), Georgia, serif' }

  if (loading) return <SuitcaseLoader message="Loading your options" />
  if (!trip || !options) return null

  const optionList = options.options || []

  return (
    <main style={{ minHeight: '100vh', background: '#fafaf8', ...s }}>
      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '48px 24px' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '40px' }}>
          <AvantiLogo size="sm" />
          <button onClick={() => router.push(`/trips/${tripId}`)} style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#9a9a8a', background: 'none', border: 'none', cursor: 'pointer', ...s }}>← Back to trip</button>
        </div>

        <div style={{ marginBottom: '40px' }}>
          <p style={{ fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', color: '#9a9a8a', margin: '0 0 8px' }}>Trip options</p>
          <h1 style={{ fontSize: '40px', fontWeight: 300, color: '#1a1a1a', margin: '0 0 12px', letterSpacing: '-0.5px', lineHeight: 1.1 }}>{trip.name}</h1>
          {options.group_insights && (
            <div style={{ background: '#e8f0e4', border: '0.5px solid #8aad7a', borderRadius: '10px', padding: '16px 20px' }}>
              <p style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#2d5a18', margin: '0 0 6px' }}>Avanti noticed</p>
              <p style={{ fontSize: '13px', color: '#0a2a06', margin: 0, lineHeight: 1.7 }}>{options.group_insights}</p>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '32px', overflowX: 'auto', paddingBottom: '4px' }}>
          {optionList.map((opt: any, i: number) => (
            <button key={i} onClick={() => setSelectedOption(i)}
              style={{ flexShrink: 0, padding: '10px 20px', border: `1.5px solid ${selectedOption === i ? optionColors[i].accent : '#e4e4d8'}`, background: selectedOption === i ? optionColors[i].bg : 'transparent', color: selectedOption === i ? optionColors[i].dark : '#9a9a8a', cursor: 'pointer', borderRadius: '24px', fontSize: '13px', transition: 'all 0.2s', ...s }}>
              {i === (options.recommended_option || 0) && <span style={{ fontSize: '10px', marginRight: '6px' }}>★</span>}
              Option {String.fromCharCode(65 + i)}
              {getVotesForOption(i) > 0 && <span style={{ marginLeft: '8px', background: optionColors[i].accent, color: '#fff', borderRadius: '10px', padding: '1px 7px', fontSize: '10px' }}>{getVotesForOption(i)}</span>}
            </button>
          ))}
        </div>

        {optionList[selectedOption] && (() => {
          const opt = optionList[selectedOption]
          const colors = optionColors[selectedOption]
          const voteCount = getVotesForOption(selectedOption)
          return (
            <div>
              <div style={{ background: colors.accent, borderRadius: '12px', padding: '28px 32px', marginBottom: '20px', position: 'relative', overflow: 'hidden' }}>
                {selectedOption === (options.recommended_option || 0) && (
                  <div style={{ position: 'absolute', top: '16px', right: '16px', background: 'rgba(255,255,255,0.2)', padding: '4px 12px', borderRadius: '12px' }}>
                    <span style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.9)' }}>★ Avanti recommends</span>
                  </div>
                )}
                <p style={{ fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', margin: '0 0 8px' }}>Option {String.fromCharCode(65 + selectedOption)}</p>
                <h2 style={{ fontSize: '32px', fontWeight: 300, color: '#ffffff', margin: '0 0 6px', letterSpacing: '-0.3px' }}>{opt.title}</h2>
                <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.7)', margin: '0 0 16px' }}>{opt.tagline}</p>
                <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                  {[
                    { label: 'Destination', value: opt.destination },
                    { label: 'Dates', value: opt.dates },
                    { label: 'Nights', value: `${opt.nights} nights` },
                    { label: 'Est. per person', value: `$${opt.estimated_cost_per_person?.toLocaleString()}` },
                  ].map(item => (
                    <div key={item.label}>
                      <p style={{ fontSize: '9px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', margin: '0 0 2px' }}>{item.label}</p>
                      <p style={{ fontSize: '14px', color: '#ffffff', margin: 0, fontWeight: 400 }}>{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div style={{ background: colors.bg, border: `0.5px solid ${colors.border}`, borderRadius: '10px', padding: '18px' }}>
                  <p style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: colors.accent, margin: '0 0 12px' }}>Cost breakdown</p>
                  {Object.entries(opt.cost_breakdown || {}).map(([key, val]: any) => (
                    <div key={key} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontSize: '12px', color: colors.dark, textTransform: 'capitalize' }}>{key}</span>
                      <span style={{ fontSize: '12px', color: colors.dark, fontWeight: 500 }}>${val?.toLocaleString()}</span>
                    </div>
                  ))}
                  {opt.true_cost_notes && (
                    <p style={{ fontSize: '11px', color: colors.accent, margin: '10px 0 0', lineHeight: 1.6, borderTop: `0.5px solid ${colors.border}`, paddingTop: '10px' }}>💡 {opt.true_cost_notes}</p>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {(opt.perks_flagged?.length ?? 0) > 0 && (
                    <div style={{ background: '#eaf3de', border: '0.5px solid #97c459', borderRadius: '10px', padding: '16px' }}>
                      <p style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#3b6d11', margin: '0 0 8px' }}>Perks flagged</p>
                      {opt.perks_flagged.map((perk: string, i: number) => (
                        <p key={i} style={{ fontSize: '11px', color: '#27500a', margin: '0 0 4px', lineHeight: 1.5 }}>✓ {perk}</p>
                      ))}
                    </div>
                  )}
                  {(opt.warnings?.length ?? 0) > 0 && (
                    <div style={{ background: '#faeeda', border: '0.5px solid #ef9f27', borderRadius: '10px', padding: '16px' }}>
                      <p style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#854f0b', margin: '0 0 8px' }}>Watch out</p>
                      {opt.warnings.map((w: string, i: number) => (
                        <p key={i} style={{ fontSize: '11px', color: '#633806', margin: '0 0 4px', lineHeight: 1.5 }}>⚠ {w}</p>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {(opt.sub_group_routing?.length ?? 0) > 0 && (
                <div style={{ background: '#fff', border: `0.5px solid ${colors.border}`, borderRadius: '10px', padding: '18px', marginBottom: '12px' }}>
                  <p style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: colors.accent, margin: '0 0 12px' }}>Routing by sub-group</p>
                  {opt.sub_group_routing.map((route: string, i: number) => (
                    <p key={i} style={{ fontSize: '12px', color: '#3a3a3a', margin: '0 0 6px', lineHeight: 1.6, paddingLeft: '12px', borderLeft: `2px solid ${colors.border}` }}>{route}</p>
                  ))}
                </div>
              )}

              {(opt.itinerary_highlights?.length ?? 0) > 0 && (
                <div style={{ background: '#fff', border: `0.5px solid ${colors.border}`, borderRadius: '10px', padding: '18px', marginBottom: '12px' }}>
                  <p style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: colors.accent, margin: '0 0 12px' }}>Itinerary highlights</p>
                  {opt.itinerary_highlights.map((day: string, i: number) => (
                    <p key={i} style={{ fontSize: '12px', color: '#3a3a3a', margin: '0 0 8px', lineHeight: 1.6 }}>{day}</p>
                  ))}
                </div>
              )}

              <div style={{ background: '#fff', border: `0.5px solid ${colors.border}`, borderRadius: '10px', padding: '18px', marginBottom: '20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <p style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: colors.accent, margin: '0 0 6px' }}>Best for</p>
                    <p style={{ fontSize: '13px', color: colors.dark, margin: 0, lineHeight: 1.6 }}>{opt.best_for}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: colors.accent, margin: '0 0 6px' }}>Trade-offs</p>
                    <p style={{ fontSize: '13px', color: colors.dark, margin: 0, lineHeight: 1.6 }}>{opt.trade_offs}</p>
                  </div>
                </div>
              </div>

              <div style={{ background: colors.bg, border: `0.5px solid ${colors.border}`, borderRadius: '10px', padding: '20px', marginBottom: '12px' }}>
                <p style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: colors.accent, margin: '0 0 12px' }}>
                  Vote for this option {voteCount > 0 && `· ${voteCount} vote${voteCount !== 1 ? 's' : ''} so far`}
                </p>
                <textarea value={myComment} onChange={e => setMyComment(e.target.value)}
                  placeholder="Add a comment or condition (optional)..."
                  rows={2}
                  style={{ width: '100%', border: `0.5px solid ${colors.border}`, background: 'rgba(255,255,255,0.7)', padding: '10px 12px', fontSize: '13px', color: '#1a1a1a', outline: 'none', resize: 'none', borderRadius: '6px', marginBottom: '12px', ...s }} />
                <button onClick={() => handleVote(selectedOption)} disabled={voting}
                  style={{ width: '100%', background: myVote === selectedOption ? colors.accent : 'transparent', border: `1.5px solid ${colors.accent}`, padding: '14px', fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase', color: myVote === selectedOption ? '#ffffff' : colors.accent, cursor: 'pointer', borderRadius: '6px', transition: 'all 0.2s', ...s }}>
                  {myVote === selectedOption ? '✓ You voted for this option' : voting ? 'Voting...' : `Vote for Option ${String.fromCharCode(65 + selectedOption)}`}
                </button>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <button onClick={() => setShowAdjust(showAdjust === selectedOption ? null : selectedOption)}
                  style={{ width: '100%', border: '0.5px solid #e4e4d8', padding: '12px', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#9a9a8a', background: '#fff', cursor: 'pointer', borderRadius: '8px', ...s }}>
                  ✦ Ask Avanti to adjust this option
                </button>
                {showAdjust === selectedOption && (
                  <div style={{ padding: '16px', background: '#f5f5f0', borderRadius: '0 0 8px 8px', border: '0.5px solid #e4e4d8', borderTop: 'none' }}>
                    <p style={{ fontSize: '12px', color: '#9a9a8a', margin: '0 0 10px' }}>Describe what you'd like to change about this option</p>
                    <textarea value={adjustText} onChange={e => setAdjustText(e.target.value)}
                      placeholder="Can we skip the morning museum and sleep in? Is there a ferry instead of the flight from Athens? What if we added an extra night in Paros?"
                      rows={3}
                      style={{ width: '100%', border: '0.5px solid #d4d4c8', background: '#fff', padding: '10px 12px', fontSize: '13px', color: '#1a1a1a', outline: 'none', resize: 'none', borderRadius: '6px', marginBottom: '10px', ...s }} />
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => setShowAdjust(null)} style={{ flex: 1, border: '0.5px solid #d4d4c8', padding: '10px', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#9a9a8a', background: 'transparent', cursor: 'pointer', ...s }}>Cancel</button>
                      <button onClick={() => handleAdjust(selectedOption)} disabled={adjusting || !adjustText.trim()}
                        style={{ flex: 2, border: `1px solid ${colors.accent}`, padding: '10px', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: colors.accent, background: 'transparent', cursor: 'pointer', opacity: adjusting || !adjustText.trim() ? 0.4 : 1, ...s }}>
                        {adjusting ? 'Adjusting...' : 'Adjust this option →'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {isOrganizer && (
                <div style={{ borderTop: '0.5px solid #e4e4d8', paddingTop: '20px' }}>
                  <p style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#9a9a8a', margin: '0 0 12px' }}>Organizer — lock in this option</p>
                  <p style={{ fontSize: '12px', color: '#9a9a8a', margin: '0 0 14px', lineHeight: 1.6 }}>Once you lock an option, Phase A is complete. The trip details update and Phase B (booking) begins.</p>
                  <button onClick={() => handleLock(selectedOption)} disabled={locking}
                    style={{ width: '100%', background: '#182D09', border: 'none', padding: '16px', fontSize: '11px', letterSpacing: '0.25em', textTransform: 'uppercase', color: '#ffffff', cursor: 'pointer', borderRadius: '8px', opacity: locking ? 0.6 : 1, ...s }}>
                    {locking ? 'Locking...' : `Lock in Option ${String.fromCharCode(65 + selectedOption)} →`}
                  </button>
                </div>
              )}
            </div>
          )
        })()}
      </div>
    </main>
  )
}
