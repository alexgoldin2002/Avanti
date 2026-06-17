'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import SuitcaseLoader from '../../../../components/SuitcaseLoader'
import Footer from '../../../../components/Footer'
import { BackLink } from '../../../../components/SubpageShell'

export default function VotePage() {
  const params = useParams()
  const router = useRouter()
  const tripId = params.tripId as string
  const voteId = params.voteId as string
  const [vote, setVote] = useState<any>(null)
  const [trip, setTrip] = useState<any>(null)
  const [responses, setResponses] = useState<any[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [isOrganizer, setIsOrganizer] = useState(false)
  const [expandedCard, setExpandedCard] = useState<number | null>(null)
  const [selectedOptions, setSelectedOptions] = useState<number[]>([])
  const [myComment, setMyComment] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [showAddOption, setShowAddOption] = useState(false)
  const [newOptionTitle, setNewOptionTitle] = useState('')
  const [newOptionNote, setNewOptionNote] = useState('')
  const [addingOption, setAddingOption] = useState(false)
  const [showTimingModal, setShowTimingModal] = useState(false)
  const [submissionHours, setSubmissionHours] = useState(48)
  const [votingHours, setVotingHours] = useState(48)
  const [myOptionCount, setMyOptionCount] = useState(0)
  const [maxOptions, setMaxOptions] = useState(3)
  const [locking, setLocking] = useState(false)

  const getVoteStatus = (v: any) => {
    if (!v) return 'loading'
    const now = new Date()
    if (v.status === 'closed') return 'closed'
    if (!v.submission_deadline) return 'submission_open'
    if (new Date(v.submission_deadline) > now) return 'submission_open'
    if (!v.voting_deadline) return 'voting_open'
    if (new Date(v.voting_deadline) > now) return 'voting_open'
    return 'closed'
  }

  const getTimeLeft = (deadline: string) => {
    const diff = new Date(deadline).getTime() - Date.now()
    if (diff <= 0) return 'Closed'
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(hours / 24)
    if (days > 0) return `${days}d ${hours % 24}h left`
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    if (hours > 0) return `${hours}h ${mins}m left`
    return `${mins}m left`
  }

  const getMaxSelectionsForRound = (round: number, totalOptions: number) => {
    if (totalOptions <= 3) return 1
    if (totalOptions <= 6) return round === 1 ? 2 : 1
    return round === 1 ? 3 : round === 2 ? 2 : 1
  }

  const load = useCallback(async () => {
    console.log('Loading vote page, voteId:', voteId, 'tripId:', tripId)
    const { data: { user } } = await supabase.auth.getUser()
    console.log('User:', user?.id)
    if (user) setUserId(user.id)
    const { data: voteData, error: voteError } = await supabase.from('group_votes').select('*').eq('id', voteId).single()
    console.log('Vote data:', voteData, 'Vote error:', voteError)
    const { data: tripData } = await supabase.from('trips').select('*').eq('id', tripId).single()
    const { data: responseData } = await supabase.from('group_vote_responses').select('*').eq('vote_id', voteId)
    const { data: settingsData } = await supabase.from('trip_settings').select('*').eq('trip_id', tripId).maybeSingle()
    if (voteData) setVote(voteData)
    if (tripData) { setTrip(tripData); if (user) setIsOrganizer(tripData.organizer_id === user.id) }
    if (responseData) {
      setResponses(responseData)
      if (user) {
        const myResponses = responseData.filter((r: any) => r.user_id === user.id)
        const currentRoundResponses = myResponses.filter((r: any) => r.round === (voteData?.current_round || 1))
        if (currentRoundResponses.length > 0) { setSubmitted(true); setSelectedOptions(currentRoundResponses.map((r: any) => r.option_index)) }
        const myOptions = (voteData?.options || []).filter((o: any) => o.added_by === user.id)
        setMyOptionCount(myOptions.length)
      }
    }
    if (settingsData) setMaxOptions(settingsData.max_vote_options_per_person)
    setLoading(false)
  }, [tripId, voteId])

  useEffect(() => { load() }, [load])

  const handleSetTiming = async () => {
    const subDeadline = new Date(Date.now() + submissionHours * 60 * 60 * 1000)
    const voteDeadline = new Date(subDeadline.getTime() + votingHours * 60 * 60 * 1000)
    await supabase.from('group_votes').update({ submission_deadline: subDeadline.toISOString(), voting_deadline: voteDeadline.toISOString(), status: 'submission_open' }).eq('id', voteId)
    setShowTimingModal(false)
    load()
  }

  const handleAddOption = async () => {
    if (!newOptionTitle.trim()) return
    setAddingOption(true)
    const currentOptions = vote?.options || []
    const newOption = { title: newOptionTitle, tagline: newOptionNote || '', price: null, priceRange: '', bullets: [], details: {}, bottomLine: '', added_by: userId, added_by_name: 'Group member', is_manual: true }
    const updatedOptions = [...currentOptions, newOption]
    await supabase.from('group_votes').update({ options: updatedOptions }).eq('id', voteId)
    setNewOptionTitle('')
    setNewOptionNote('')
    setShowAddOption(false)
    setAddingOption(false)
    load()
  }

  const toggleSelectOption = (i: number) => {
    if (submitted) return
    const maxSelections = getMaxSelectionsForRound(vote?.current_round || 1, (vote?.options || []).length)
    setSelectedOptions(prev => {
      if (prev.includes(i)) return prev.filter(x => x !== i)
      if (prev.length >= maxSelections) return [...prev.slice(1), i]
      return [...prev, i]
    })
  }

  const handleSubmitVote = async () => {
    if (selectedOptions.length === 0) return
    setSubmitting(true)
    const round = vote?.current_round || 1
    for (const optionIndex of selectedOptions) {
      await supabase.from('group_vote_responses').upsert({ vote_id: voteId, user_id: userId, option_index: optionIndex, round, comment: myComment })
    }
    setSubmitted(true)
    setSubmitting(false)
    load()
  }

  const handleAdvanceRound = async () => {
    const options = vote?.options || []
    const currentRound = vote?.current_round || 1
    const roundResponses = responses.filter((r: any) => r.round === currentRound)
    const voteCounts: Record<number, number> = {}
    roundResponses.forEach((r: any) => { voteCounts[r.option_index] = (voteCounts[r.option_index] || 0) + 1 })
    const sorted = Object.entries(voteCounts).sort((a, b) => Number(b[1]) - Number(a[1]))
    const keepCount = options.length <= 6 ? 3 : 4
    const keepIndices = sorted.slice(0, keepCount).map(([i]) => parseInt(i))
    const survivingOptions = options.filter((_: any, i: number) => keepIndices.includes(i))
    const newVoteDeadline = new Date(Date.now() + votingHours * 60 * 60 * 1000)
    await supabase.from('group_votes').update({ options: survivingOptions, current_round: currentRound + 1, voting_deadline: newVoteDeadline.toISOString(), round_results: [...(vote?.round_results || []), { round: currentRound, eliminated: options.filter((_: any, i: number) => !keepIndices.includes(i)).map((o: any) => o.title) }] }).eq('id', voteId)
    setSubmitted(false)
    setSelectedOptions([])
    load()
  }

  const handleLockWinner = async () => {
    setLocking(true)
    const winnerIndex = selectedOptions[0] ?? 0
    const winner = (vote?.options || [])[winnerIndex]
    await supabase.from('group_votes').update({ status: 'closed', winner }).eq('id', voteId)
    await supabase.from('trips').update({ destination: winner?.title, options_generated: true }).eq('id', tripId)
    router.push(`/trips/${tripId}`)
  }

  const s = { fontFamily: 'var(--font-cormorant), Georgia, serif' }

  if (loading) return <SuitcaseLoader message="Loading vote" />

  if (!loading && !vote) return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: '100%', background: 'var(--cream)', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
      <div style={{ flex: 1, maxWidth: '600px', margin: '0 auto', padding: '40px 24px', width: '100%' }}>
        <BackLink href={`/trips/${tripId}`} wrapperClassName="mb-8 flex justify-end" />
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <p style={{ fontSize: '20px', fontWeight: 300, color: 'var(--foreground)', marginBottom: '8px' }}>Vote not found</p>
          <p style={{ fontSize: '13px', color: 'var(--muted-foreground)', margin: 0 }}>This vote may have been deleted or the link is invalid.</p>
        </div>
      </div>
      <Footer />
    </div>
  )

  if (!trip) return null

  const voteStatus = getVoteStatus(vote)
  const options = vote?.options || []
  const maxSelections = getMaxSelectionsForRound(vote?.current_round || 1, options.length)
  const totalVoters = [...new Set(responses.filter((r: any) => r.round === vote?.current_round).map((r: any) => r.user_id))].length

  const statusColors: Record<string, { bg: string, text: string, label: string }> = {
    submission_open: { bg: '#faeeda', text: '#854f0b', label: 'Accepting options' },
    voting_open: { bg: 'var(--accent-light)', text: 'var(--forest)', label: 'Voting open' },
    closed: { bg: '#f5f5f0', text: 'var(--muted-foreground)', label: 'Vote closed' },
  }
  const statusInfo = statusColors[voteStatus] || statusColors.closed

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: '100%', background: 'var(--cream)', ...s }}>
      <div style={{ flex: 1, maxWidth: '600px', margin: '0 auto', padding: '40px 24px', width: '100%' }}>

        <BackLink href={`/trips/${tripId}/decisions`} wrapperClassName="mb-8 flex justify-end" />

        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <div style={{ padding: '4px 12px', background: statusInfo.bg, borderRadius: '20px' }}>
              <span style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: statusInfo.text }}>{statusInfo.label}</span>
            </div>
            {vote?.current_round > 1 && (
              <div style={{ padding: '4px 12px', background: '#eeedfe', borderRadius: '20px' }}>
                <span style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#534ab7' }}>Round {vote.current_round}</span>
              </div>
            )}
          </div>
          <h1 style={{ fontSize: '32px', fontWeight: 300, color: 'var(--foreground)', margin: '0 0 6px', ...s }}>{vote.vote_type}</h1>
          <p style={{ fontSize: '12px', color: 'var(--muted-foreground)', margin: 0 }}>{trip.name} · {totalVoters} vote{totalVoters !== 1 ? 's' : ''} so far</p>
        </div>

        {isOrganizer && !vote.submission_deadline && (
          <div style={{ background: '#faeeda', border: '0.5px solid #ef9f27', borderRadius: '0', padding: '16px 18px', marginBottom: '20px' }}>
            <p style={{ fontSize: '13px', color: '#854f0b', margin: '0 0 10px', ...s }}>Set voting timeline to open this vote to the group</p>
            <button onClick={() => setShowTimingModal(true)}
              style={{ border: '1px solid #854f0b', background: 'transparent', color: '#854f0b', padding: '10px 20px', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '0', ...s }}>
              Set timeline →
            </button>
          </div>
        )}

        {voteStatus === 'submission_open' && vote.submission_deadline && (
          <div style={{ background: 'var(--card)', border: '0.5px solid var(--border)', borderRadius: '0', padding: '14px 18px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted-foreground)', margin: '0 0 2px' }}>Options close</p>
              <p style={{ fontSize: '13px', color: '#854f0b', margin: 0, ...s }}>{getTimeLeft(vote.submission_deadline)}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted-foreground)', margin: '0 0 2px' }}>Voting opens after</p>
              <p style={{ fontSize: '13px', color: 'var(--forest)', margin: 0, ...s }}>{getTimeLeft(vote.voting_deadline)}</p>
            </div>
          </div>
        )}

        {voteStatus === 'voting_open' && vote.voting_deadline && (
          <div style={{ background: 'var(--accent-light)', border: '0.5px solid #9fd4b8', borderRadius: '0', padding: '14px 18px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--forest)', margin: '0 0 2px' }}>Vote closes</p>
              <p style={{ fontSize: '13px', color: 'var(--forest-deep)', margin: 0, ...s }}>{getTimeLeft(vote.voting_deadline)}</p>
            </div>
            {options.length > 1 && (
              <p style={{ fontSize: '12px', color: 'var(--forest)', margin: 0, ...s }}>Pick {maxSelections === 1 ? 'your favorite' : `your top ${maxSelections}`}</p>
            )}
          </div>
        )}

        {(vote?.round_results?.length ?? 0) > 0 && (
          <div style={{ marginBottom: '20px' }}>
            {vote.round_results.map((r: any, i: number) => (
              <p key={i} style={{ fontSize: '11px', color: 'var(--muted-foreground)', margin: '0 0 4px' }}>
                Round {r.round} eliminated: {r.eliminated.join(', ')}
              </p>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
          {options.map((option: any, i: number) => {
            const isSelected = selectedOptions.includes(i)
            const isExpanded = expandedCard === i
            const voteCount = responses.filter((r: any) => r.option_index === i && r.round === (vote?.current_round || 1)).length
            const pct = totalVoters > 0 ? Math.round((voteCount / totalVoters) * 100) : 0

            return (
              <div key={i} style={{ border: isSelected ? '2px solid var(--forest)' : '0.5px solid var(--border)', borderRadius: '0', background: 'var(--card)', overflow: 'hidden', transition: 'border-color 0.2s' }}>
                <div style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                        <p style={{ fontSize: '16px', color: 'var(--foreground)', margin: 0, ...s }}>{option.title}</p>
                        {option.is_manual && <span style={{ fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted-foreground)', background: '#f5f5f0', padding: '2px 8px', borderRadius: '0' }}>Added by group</span>}
                      </div>
                      {option.tagline && <p style={{ fontSize: '12px', color: 'var(--muted-foreground)', margin: 0, lineHeight: 1.4 }}>{option.tagline}</p>}
                    </div>
                    {option.price && (
                      <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '12px' }}>
                        <p style={{ fontSize: '15px', color: 'var(--forest)', fontWeight: 500, margin: '0 0 1px', ...s }}>~${option.price?.toLocaleString()}</p>
                        {option.priceNote && <p style={{ fontSize: '10px', color: 'var(--muted-foreground)', margin: 0 }}>{option.priceNote}</p>}
                      </div>
                    )}
                  </div>

                  {(option.bullets?.length ?? 0) > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', margin: '8px 0' }}>
                      {option.bullets.slice(0, 3).map((b: any, j: number) => (
                        <div key={j} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                          <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: b.type === 'warning' ? '#854f0b' : 'var(--forest)', flexShrink: 0, marginTop: '6px' }} />
                          <p style={{ fontSize: '12px', color: b.type === 'warning' ? '#854f0b' : '#3a3a3a', margin: 0, lineHeight: 1.5 }}>{b.text}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {submitted && totalVoters > 0 && (
                    <div style={{ margin: '10px 0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontSize: '10px', color: 'var(--muted-foreground)' }}>{voteCount} vote{voteCount !== 1 ? 's' : ''}</span>
                        <span style={{ fontSize: '10px', color: 'var(--forest)', fontWeight: 500 }}>{pct}%</span>
                      </div>
                      <div style={{ height: '3px', background: '#e8e8e0', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', background: 'var(--forest)', width: `${pct}%`, transition: 'width 0.5s', borderRadius: '2px' }} />
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                    <button onClick={() => setExpandedCard(isExpanded ? null : i)}
                      style={{ padding: '7px 14px', border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--muted-foreground)', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '20px', ...s }}>
                      {isExpanded ? 'Hide ↑' : 'Details'}
                    </button>
                    {voteStatus === 'voting_open' && !submitted && (
                      <button onClick={() => toggleSelectOption(i)}
                        style={{ flex: 1, padding: '7px 14px', border: `2px solid ${isSelected ? 'var(--forest-deep)' : 'var(--forest-deep)'}`, background: isSelected ? 'var(--forest-deep)' : '#fff', color: isSelected ? '#fff' : 'var(--forest-deep)', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '20px', fontWeight: 500, ...s }}>
                        {isSelected ? '✓ Selected' : 'Select'}
                      </button>
                    )}
                    {submitted && isSelected && (
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: '11px', color: 'var(--forest)' }}>✓ Your vote</span>
                      </div>
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div style={{ borderTop: '0.5px solid #f0f0e8', padding: '16px', background: 'var(--cream)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {option.details?.avanti_take && (
                      <div style={{ padding: '12px 14px', background: 'var(--accent-light)', borderRadius: '0' }}>
                        <p style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--forest)', margin: '0 0 6px', ...s }}>Why Avanti picks this</p>
                        <p style={{ fontSize: '12px', color: '#0a3a1e', margin: 0, lineHeight: 1.7, ...s }}>{option.details.avanti_take}</p>
                      </div>
                    )}
                    {((option.details?.pros?.length ?? 0) > 0 || (option.details?.cons?.length ?? 0) > 0) && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        {(option.details?.pros?.length ?? 0) > 0 && (
                          <div>
                            <p style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--forest)', margin: '0 0 8px', ...s }}>Pros</p>
                            {option.details.pros.map((pro: string, j: number) => (
                              <div key={j} style={{ display: 'flex', gap: '6px', marginBottom: '5px' }}>
                                <span style={{ color: 'var(--forest)', fontSize: '10px', marginTop: '3px' }}>✓</span>
                                <p style={{ fontSize: '12px', color: '#3a3a3a', margin: 0, lineHeight: 1.5, ...s }}>{pro}</p>
                              </div>
                            ))}
                          </div>
                        )}
                        {(option.details?.cons?.length ?? 0) > 0 && (
                          <div>
                            <p style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#854f0b', margin: '0 0 8px', ...s }}>Watch out</p>
                            {option.details.cons.map((con: string, j: number) => (
                              <div key={j} style={{ display: 'flex', gap: '6px', marginBottom: '5px' }}>
                                <span style={{ color: '#854f0b', fontSize: '10px', marginTop: '3px' }}>⚠</span>
                                <p style={{ fontSize: '12px', color: '#854f0b', margin: 0, lineHeight: 1.5, ...s }}>{con}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    {(option.details?.things_to_do?.length ?? 0) > 0 && (
                      <div>
                        <p style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--muted-foreground)', margin: '0 0 8px', ...s }}>Top things to do</p>
                        {option.details.things_to_do.map((item: any, j: number) => (
                          <div key={j} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '0.5px solid #f0f0e8' }}>
                            <p style={{ fontSize: '12px', color: 'var(--foreground)', margin: 0, ...s }}>{item.activity}</p>
                            <p style={{ fontSize: '11px', color: 'var(--muted-foreground)', margin: 0, marginLeft: '12px', ...s }}>{item.cost}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    {option.details?.food && (
                      <div>
                        <p style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--muted-foreground)', margin: '0 0 6px', ...s }}>Food & drink</p>
                        <p style={{ fontSize: '12px', color: '#3a3a3a', margin: 0, lineHeight: 1.7, ...s }}>{option.details.food}</p>
                      </div>
                    )}
                    {option.details?.weather && (
                      <div>
                        <p style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--muted-foreground)', margin: '0 0 6px', ...s }}>Weather</p>
                        <p style={{ fontSize: '12px', color: '#3a3a3a', margin: 0, lineHeight: 1.7, ...s }}>{option.details.weather}</p>
                      </div>
                    )}
                    {option.details?.getting_there && (
                      <div>
                        <p style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--muted-foreground)', margin: '0 0 6px', ...s }}>Getting there</p>
                        <p style={{ fontSize: '12px', color: '#3a3a3a', margin: 0, lineHeight: 1.7, ...s }}>{option.details.getting_there}</p>
                      </div>
                    )}
                    {(option.details?.tiktok_searches?.length ?? 0) > 0 && (
                      <div>
                        <p style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--muted-foreground)', margin: '0 0 8px', ...s }}>See it for yourself</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {option.details.tiktok_searches.map((term: string, j: number) => (
                            <a key={j} href={`https://www.tiktok.com/search?q=${encodeURIComponent(term)}`} target="_blank" rel="noopener noreferrer"
                              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: 'var(--card)', border: '0.5px solid var(--border)', borderRadius: '0', textDecoration: 'none' }}>
                              <span style={{ fontSize: '14px' }}>🎵</span>
                              <p style={{ fontSize: '12px', color: 'var(--foreground)', margin: 0, ...s }}>{term}</p>
                              <span style={{ fontSize: '10px', color: 'var(--muted-foreground)', marginLeft: 'auto' }}>Search TikTok →</span>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                    {option.bottomLine && (
                      <div style={{ padding: '12px 14px', background: 'var(--forest-deep)', borderRadius: '0' }}>
                        <p style={{ fontSize: '12px', color: '#ffffff', margin: 0, lineHeight: 1.7, ...s }}>{option.bottomLine}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {voteStatus === 'submission_open' && (maxOptions === 99 || myOptionCount < maxOptions) && (
          <div style={{ marginBottom: '20px' }}>
            {!showAddOption ? (
              <button onClick={() => setShowAddOption(true)}
                style={{ width: '100%', border: '1.5px solid var(--forest)', background: 'transparent', color: 'var(--forest)', padding: '14px', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '0', ...s }}>
                + Add an option to vote on
              </button>
            ) : (
              <div style={{ background: 'var(--card)', border: '0.5px solid var(--border)', borderRadius: '0', padding: '18px' }}>
                <p style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--muted-foreground)', margin: '0 0 14px', ...s }}>Add your option</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--muted-foreground)', display: 'block', marginBottom: '6px', ...s }}>Destination or option *</label>
                    <input value={newOptionTitle} onChange={e => setNewOptionTitle(e.target.value)} placeholder="e.g. Mykonos + Santorini"
                      style={{ width: '100%', borderBottom: '1px solid var(--border)', background: 'transparent', padding: '8px 0', fontSize: '14px', color: 'var(--foreground)', outline: 'none', ...s }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--muted-foreground)', display: 'block', marginBottom: '6px', ...s }}>Why you think this is a good idea</label>
                    <textarea value={newOptionNote} onChange={e => setNewOptionNote(e.target.value)} placeholder="Add a note for the group..." rows={2}
                      style={{ width: '100%', border: '0.5px solid var(--border)', background: 'transparent', padding: '8px 10px', fontSize: '13px', color: 'var(--foreground)', outline: 'none', resize: 'none', borderRadius: '6px', ...s }} />
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => setShowAddOption(false)} style={{ flex: 1, border: '0.5px solid var(--border)', padding: '10px', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--muted-foreground)', background: 'transparent', cursor: 'pointer', borderRadius: '6px', ...s }}>Cancel</button>
                    <button onClick={handleAddOption} disabled={addingOption || !newOptionTitle.trim()}
                      style={{ flex: 2, border: '1px solid var(--forest)', padding: '10px', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--forest)', background: 'transparent', cursor: 'pointer', opacity: !newOptionTitle.trim() ? 0.4 : 1, borderRadius: '6px', ...s }}>
                      {addingOption ? 'Adding...' : 'Add to vote →'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {voteStatus === 'voting_open' && !submitted && selectedOptions.length > 0 && (
          <div style={{ marginBottom: '16px' }}>
            <textarea value={myComment} onChange={e => setMyComment(e.target.value)} placeholder="Add a comment (optional)..." rows={2}
              style={{ width: '100%', border: '0.5px solid var(--border)', background: 'var(--card)', padding: '10px 14px', fontSize: '13px', color: 'var(--foreground)', outline: 'none', resize: 'none', borderRadius: '0', marginBottom: '10px', ...s }} />
            <button onClick={handleSubmitVote} disabled={submitting}
              style={{ width: '100%', border: '1px solid var(--forest-deep)', background: 'var(--forest-deep)', color: '#fff', padding: '14px', fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '0', opacity: submitting ? 0.6 : 1, ...s }}>
              {submitting ? 'Submitting...' : `Submit vote${selectedOptions.length > 1 ? 's' : ''} →`}
            </button>
          </div>
        )}

        {submitted && voteStatus === 'voting_open' && (
          <div style={{ padding: '14px 18px', background: 'var(--accent-light)', borderRadius: '0', textAlign: 'center', marginBottom: '16px' }}>
            <p style={{ fontSize: '13px', color: 'var(--forest)', margin: 0, ...s }}>✓ Your vote is in. Results update in real time.</p>
          </div>
        )}

        {isOrganizer && voteStatus === 'voting_open' && submitted && options.length > 1 && (
          <div style={{ borderTop: '0.5px solid var(--border)', paddingTop: '20px', marginTop: '8px' }}>
            <p style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--muted-foreground)', margin: '0 0 6px' }}>Organizer controls</p>
            {options.length > 2 ? (
              <button onClick={handleAdvanceRound}
                style={{ width: '100%', border: '1px solid #534ab7', background: 'transparent', color: '#534ab7', padding: '13px', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '0', marginBottom: '10px', ...s }}>
                Advance to next round — eliminate lowest options →
              </button>
            ) : null}
            <button onClick={handleLockWinner} disabled={locking}
              style={{ width: '100%', background: 'var(--forest-deep)', border: 'none', padding: '14px', fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', color: '#fff', cursor: 'pointer', borderRadius: '0', opacity: locking ? 0.6 : 1, ...s }}>
              {locking ? 'Locking...' : 'Lock in winner →'}
            </button>
          </div>
        )}

      </div>

      {showTimingModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '24px' }}>
          <div style={{ background: 'var(--cream)', borderRadius: '0', padding: '32px', width: '100%', maxWidth: '400px', ...s }}>
            <h3 style={{ fontSize: '22px', fontWeight: 300, color: 'var(--foreground)', margin: '0 0 6px', ...s }}>Set voting timeline</h3>
            <p style={{ fontSize: '12px', color: 'var(--muted-foreground)', margin: '0 0 24px', lineHeight: 1.6 }}>How long should each phase last?</p>
            <div style={{ marginBottom: '20px' }}>
              <p style={{ fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--muted-foreground)', margin: '0 0 10px' }}>Submission window — how long can people add options?</p>
              <div style={{ display: 'flex', gap: '8px' }}>
                {[12, 24, 48, 72].map(h => (
                  <button key={h} onClick={() => setSubmissionHours(h)}
                    style={{ flex: 1, padding: '10px 6px', border: `1.5px solid ${submissionHours === h ? 'var(--forest-deep)' : 'var(--border)'}`, background: submissionHours === h ? 'var(--accent-light)' : 'transparent', color: submissionHours === h ? 'var(--forest-deep)' : 'var(--muted-foreground)', fontSize: '12px', cursor: 'pointer', borderRadius: '0', ...s }}>
                    {h < 24 ? `${h}h` : `${h/24}d`}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: '28px' }}>
              <p style={{ fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--muted-foreground)', margin: '0 0 10px' }}>Voting window — how long can people vote?</p>
              <div style={{ display: 'flex', gap: '8px' }}>
                {[12, 24, 48, 72].map(h => (
                  <button key={h} onClick={() => setVotingHours(h)}
                    style={{ flex: 1, padding: '10px 6px', border: `1.5px solid ${votingHours === h ? 'var(--forest-deep)' : 'var(--border)'}`, background: votingHours === h ? 'var(--accent-light)' : 'transparent', color: votingHours === h ? 'var(--forest-deep)' : 'var(--muted-foreground)', fontSize: '12px', cursor: 'pointer', borderRadius: '0', ...s }}>
                    {h < 24 ? `${h}h` : `${h/24}d`}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowTimingModal(false)} style={{ flex: 1, border: '0.5px solid var(--border)', padding: '12px', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted-foreground)', background: 'transparent', cursor: 'pointer', borderRadius: '0', ...s }}>Cancel</button>
              <button onClick={handleSetTiming} style={{ flex: 2, border: '1px solid var(--forest-deep)', background: 'var(--forest-deep)', color: '#fff', padding: '12px', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '0', ...s }}>Open vote →</button>
            </div>
          </div>
        </div>
      )}
      <Footer />
    </div>
  )
}
