'use client'
import { useState, useEffect, useRef, useMemo, type ReactNode } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import SuitcaseLoader from '../../../components/SuitcaseLoader'
import DestinationCard from '../../../components/DestinationCard'
import { fetchFullDestinationCards, fetchRemainingDestinationCards, GENERATION_TIME_HINT, regenerateSingleDestinationCard } from '@/lib/fetch-destination-batches'
import {
  fetchDestinationMatrix,
  fetchRegenerateMatrixRow,
  MATRIX_GENERATION_TIME_HINT,
  parseMatrixProgressStatus,
} from '@/lib/fetch-destination-matrix'
import type { ParsedDestinationCard } from '@/lib/parse-destination-cards'
import { STOP_OPTIONS, TRIP_REGION_OPTIONS, TRIP_ACTIVITY_OPTIONS } from '@/lib/preview-trip-storage'
import { findTravelerForUser, patchTravelerStep2 } from '@/lib/traveler-lookup'
import SubmitChoicesButton from '@/components/voting/SubmitChoicesButton'
import DestinationMatrix from '@/components/voting/DestinationMatrix'
import DateRangeFields from '@/app/components/DateRangeFields'
import PhaseBanner from '@/components/trip-phases/PhaseBanner'
import PhaseLockedScreen from '@/components/trip-phases/PhaseLockedScreen'
import Step2WorkspaceShell from '@/components/step2/Step2WorkspaceShell'
import Step2QuestionBlock from '@/components/step2/Step2QuestionBlock'
import Step2ChatBar from '@/components/step2/Step2ChatBar'
import { STEP2_WORKSPACE_PANEL, STEP2_WORKSPACE_BOX, STEP2_WORKSPACE_BOX_PAD } from '@/components/step2/workspace-layout'
import { useTripPhase } from '@/lib/trip-phases/useTripPhase'
import { groupDatesBlockSubmission } from '@/components/trip/GroupDateOverlapBanner'
import { analyzeGroupDateOverlap, travelerProfilesFromRows } from '@/lib/group-date-overlap'
import {
  departureCitiesToStoredString,
  formatDepartureCitiesForPrompt,
  parseDepartureCitiesFromStep2,
} from '@/lib/departure-cities'
import { pathStepLabel } from '@/lib/step2/planning-path'
import { loadGoogleMapsScript, whenGooglePlacesReady } from '@/lib/google-maps-loader'
import { votingComplete } from '@/lib/trip-phases/state'
import type { DestinationMatrixRow, DestinationMatrixCombo } from '@/lib/parse-destination-matrix'
import { buildConsideringPathCards, enrichMatrixChipRows, enrichMatrixPairings, sortMatrixRowsByScore } from '@/lib/parse-destination-matrix'
import type { MatrixTabId } from '@/lib/matrix-trip-shape'
import {
  createGenerationSnapshot,
  snapshotHasContent,
  type Step2GenerationSnapshot,
} from '@/lib/step2/generation-snapshot'

function Step2ConfirmModal({
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
  loading = false,
}: {
  title: string
  body: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
  loading?: boolean
}) {
  const s = { fontFamily: 'var(--font-cormorant), Georgia, serif' }
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: '24px' }}>
      <div style={{ background: 'var(--cream)', borderRadius: '0', padding: '28px', width: '100%', maxWidth: '400px', textAlign: 'center', ...s, boxShadow: 'var(--shadow-box)' }}>
        <p style={{ fontSize: '18px', fontWeight: 300, color: 'var(--foreground)', margin: '0 0 12px' }}>{title}</p>
        <p style={{ fontSize: '13px', color: 'var(--muted-foreground)', margin: '0 0 24px', lineHeight: 1.7 }}>{body}</p>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            style={{ flex: 1, border: '1px solid var(--border)', padding: '12px', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted-foreground)', background: 'transparent', cursor: 'pointer', borderRadius: '0', ...s }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            style={{ flex: 1, border: '1px solid var(--foreground)', padding: '12px', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#fff', background: 'var(--foreground)', cursor: 'pointer', borderRadius: '0', ...s, opacity: loading ? 0.5 : 1 }}
          >
            {loading ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Step2() {
  const { tripId } = useParams() as { tripId: string }
  const router = useRouter()
  const chatEndRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)
  const [trip, setTrip] = useState<any>(null)
  const [stage, setStage] = useState<1 | 2 | 3 | 'generate' | 'done'>(1)
  // Q1
  const [q1, setQ1] = useState('')
  // Q2 answers
  const [departureCityInput, setDepartureCityInput] = useState('')
  const [departureCities, setDepartureCities] = useState<string[]>([])
  const [dates, setDates] = useState('')
  const [fixedDates, setFixedDates] = useState({ start: '', end: '' })
  const [flexLength, setFlexLength] = useState('')
  const [datesOther, setDatesOther] = useState('')
  const [domestic, setDomestic] = useState('')
  const [regions, setRegions] = useState<string[]>([])
  const [stops, setStops] = useState('')
  const [stopsOther, setStopsOther] = useState('')
  const [activities, setActivities] = useState<string[]>([])
  const [vibe, setVibe] = useState<string[]>([])
  const [vibeOther, setVibeOther] = useState('')
  const [accommodation, setAccommodation] = useState('')
  const [budget, setBudget] = useState('')
  const [budgetOther, setBudgetOther] = useState('')
  const [popularity, setPopularity] = useState('')
  // Q3
  const [q3, setQ3] = useState('')
  // AI chat
  const [chatInput, setChatInput] = useState('')
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([])
  const [chatLoading, setChatLoading] = useState(false)
  const [showRefreshChatConfirm, setShowRefreshChatConfirm] = useState(false)
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false)
  const [showEditConfirm, setShowEditConfirm] = useState(false)
  const [showRestorePriorConfirm, setShowRestorePriorConfirm] = useState(false)
  const [showChangePathConfirm, setShowChangePathConfirm] = useState(false)
  const [changingPath, setChangingPath] = useState(false)
  const [showStartOverConfirm, setShowStartOverConfirm] = useState(false)
  const [startingOver, setStartingOver] = useState(false)
  const [refreshingChat, setRefreshingChat] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [regeneratingCardIndex, setRegeneratingCardIndex] = useState<number | null>(null)
  const [regeneratingSingleName, setRegeneratingSingleName] = useState<string | null>(null)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [generateStatus, setGenerateStatus] = useState<string | null>(null)
  const [cards, setCards] = useState<ParsedDestinationCard[]>([])
  const [whyNot, setWhyNot] = useState<{ name: string; reasons: string[] }[]>([])
  const [editMode, setEditMode] = useState(false)
  const [restoreSnapshot, setRestoreSnapshot] = useState<Step2GenerationSnapshot | null>(null)
  const [priorGenerationSnapshot, setPriorGenerationSnapshot] = useState<Step2GenerationSnapshot | null>(null)
  const [viewingPriorGeneration, setViewingPriorGeneration] = useState(false)
  const [cardsInvalidated, setCardsInvalidated] = useState(false)
  const [votes, setVotes] = useState<Record<string, boolean>>({})
  const [maxVotes, setMaxVotes] = useState(2)
  const [isOrganizer, setIsOrganizer] = useState(false)
  const [travelerId, setTravelerId] = useState<string | null>(null)
  const [choicesSubmitted, setChoicesSubmitted] = useState(false)
  const [submitToast, setSubmitToast] = useState('')
  const [groupTravelers, setGroupTravelers] = useState<any[]>([])
  const [consideringInput, setConsideringInput] = useState('')
  const [consideringList, setConsideringList] = useState<string[]>([])
  const [matrixRows, setMatrixRows] = useState<DestinationMatrixRow[]>([])
  const [matrixPairings, setMatrixPairings] = useState<DestinationMatrixCombo[]>([])
  const [matrixTriples, setMatrixTriples] = useState<DestinationMatrixCombo[]>([])
  const [matrixSummary, setMatrixSummary] = useState('')
  const [matrixRecommendedTab, setMatrixRecommendedTab] = useState<MatrixTabId | null>(null)
  const [matrixRecommendedShape, setMatrixRecommendedShape] = useState('')

  const {
    phase: brainstormPhase,
    loading: phaseLoading,
    canEdit: canEditBrainstorm,
    canView: canViewBrainstorm,
    reload: reloadPhase,
  } = useTripPhase(tripId, 'brainstorm')

  const dateOverlap = useMemo(
    () => analyzeGroupDateOverlap(travelerProfilesFromRows(groupTravelers)),
    [groupTravelers]
  )
  const datesBlockSubmit = groupDatesBlockSubmission(dateOverlap)

  const s = { fontFamily: 'var(--font-cormorant), Georgia, serif' }
  const inputStyle = { width: '100%', borderBottom: '1px solid #d4d4c8', background: 'transparent', padding: '8px 0', fontSize: '15px', color: 'var(--foreground)', outline: 'none', ...s }
  const labelStyle = { fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase' as const, color: 'var(--muted-foreground)', display: 'block', marginBottom: '8px' }
  const sectionLabel = { fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase' as const, color: 'var(--muted-foreground)', marginBottom: '10px', display: 'block' }
  const chipStyle = (selected: boolean) => ({
    padding: '8px 16px', fontSize: '13px', cursor: 'pointer',
    border: `1px solid ${selected ? 'var(--forest-deep)' : '#d4d4c8'}`,
    background: selected ? '#e8f5ee' : '#fff',
    color: selected ? 'var(--forest-deep)' : '#6a6a6a',
    borderRadius: '24px', transition: 'all 0.15s', ...s,
  })
  const nextBtn = (onClick: () => void, disabled: boolean, label = 'Next →') => (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '14px 32px', border: '1px solid var(--forest-deep)',
        background: disabled ? 'transparent' : 'var(--forest-deep)',
        color: disabled ? '#d4d4c8' : '#ffffff',
        fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase',
        cursor: disabled ? 'default' : 'pointer', ...s,
      }}
    >
      {label}
    </button>
  )

  useEffect(() => {
    const load = async () => {
      const { data: tripData } = await supabase.from('trips').select('*').eq('id', tripId).single()
      if (tripData) {
        setTrip(tripData)
        if (tripData.max_votes) setMaxVotes(tripData.max_votes)
      }
      const { data: { user } } = await supabase.auth.getUser()
      if (user && tripData) {
        setIsOrganizer(tripData.organizer_id === user.id)
      }
      if (user) {
        const traveler = await findTravelerForUser(supabase, tripId, user.id)
        if (traveler) {
          setTravelerId(traveler.id)
          setChoicesSubmitted(!!(traveler as { choices_submitted?: boolean }).choices_submitted)
        }
        const { data: allTravelers } = await supabase
          .from('travelers')
          .select('id, nickname, full_name, step2, fills_own_preferences')
          .eq('trip_id', tripId)
        if (allTravelers) setGroupTravelers(allTravelers)
        if (traveler) {
          const s2 = traveler.step2 as Record<string, unknown>
          if (s2.q1) { setQ1(s2.q1 as string) }
          if (s2.departureCity || s2.departureCities) {
            setDepartureCities(parseDepartureCitiesFromStep2(s2))
          }
          if (s2.dates && s2.dates !== 'Completely flexible') setDates(s2.dates as string)
          if (s2.fixedDates) setFixedDates(s2.fixedDates as { start: string; end: string })
          if (s2.flexLength) setFlexLength(s2.flexLength as string)
          if (s2.domestic) setDomestic(s2.domestic as string)
          if (s2.regions) setRegions(s2.regions as string[])
          if (s2.stops) {
            if (STOP_OPTIONS.includes(s2.stops as string)) setStops(s2.stops as string)
            else { setStops('Other'); setStopsOther(s2.stops as string) }
          }
          if (s2.activities) setActivities(s2.activities as string[])
          if (s2.vibe) setVibe(s2.vibe as string[])
          if (s2.accommodation) setAccommodation(s2.accommodation as string)
          if (s2.budget) setBudget(s2.budget as string)
          if (s2.popularity) setPopularity(s2.popularity as string)
          if (s2.q3) setQ3(s2.q3 as string)
          if (s2.stage) setStage(s2.stage as typeof stage)
          if (Array.isArray(s2.chatMessages)) setChatMessages(s2.chatMessages as { role: 'user' | 'assistant'; content: string }[])
          if (Array.isArray(s2.consideringList)) setConsideringList(s2.consideringList as string[])
          let loadedMatrixRows: DestinationMatrixRow[] = []
          let loadedMatrixPairings: DestinationMatrixCombo[] = []
          let loadedMatrixTriples: DestinationMatrixCombo[] = []
          if (Array.isArray(s2.matrix)) {
            loadedMatrixRows = s2.matrix as DestinationMatrixRow[]
            enrichMatrixChipRows(loadedMatrixRows)
            setMatrixRows(loadedMatrixRows)
          }
          if (Array.isArray(s2.matrixPairings)) {
            loadedMatrixPairings = s2.matrixPairings as DestinationMatrixCombo[]
            enrichMatrixPairings(loadedMatrixPairings)
            setMatrixPairings(loadedMatrixPairings)
          }
          if (Array.isArray(s2.matrixTriples)) {
            loadedMatrixTriples = s2.matrixTriples as DestinationMatrixCombo[]
            enrichMatrixChipRows(loadedMatrixTriples)
            setMatrixTriples(loadedMatrixTriples)
          }
          if (typeof s2.matrixSummary === 'string') setMatrixSummary(s2.matrixSummary)
          if (s2.matrixRecommendedTab) setMatrixRecommendedTab(s2.matrixRecommendedTab as MatrixTabId)
          if (typeof s2.matrixRecommendedShape === 'string') setMatrixRecommendedShape(s2.matrixRecommendedShape)
          if (s2.priorGeneration && typeof s2.priorGeneration === 'object') {
            setPriorGenerationSnapshot(s2.priorGeneration as Step2GenerationSnapshot)
          }
          if (loadedMatrixRows.length > 0) {
            const parsedCards = buildConsideringPathCards(
              loadedMatrixRows,
              loadedMatrixPairings,
              loadedMatrixTriples,
            )
            setCards(parsedCards)
            if (Array.isArray(s2.why_not)) setWhyNot(s2.why_not as { name: string; reasons: string[] }[])
            if (s2.cardVotes && typeof s2.cardVotes === 'object') {
              setVotes(s2.cardVotes as Record<string, boolean>)
            }
            if (s2.submittedCardPicks) {
              setChoicesSubmitted(true)
            }
            setStage('done')
            void patchTravelerStep2(supabase, traveler.id, { cards: parsedCards })
          } else if (Array.isArray(s2.cards) && s2.cards.length > 0) {
            setCards(s2.cards)
            if (Array.isArray(s2.why_not)) setWhyNot(s2.why_not as { name: string; reasons: string[] }[])
            if (s2.cardVotes && typeof s2.cardVotes === 'object') {
              setVotes(s2.cardVotes as Record<string, boolean>)
            }
            if (s2.submittedCardPicks) {
              setChoicesSubmitted(true)
            }
            setStage('done')
          }
        }
      }
      setLoading(false)
    }
    load()
  }, [tripId])

  useEffect(() => {
    if (loading || !trip) return
    if (trip.destination_planning_path === 'known') {
      router.replace(`/trips/${tripId}`)
      return
    }
    // No path chosen yet — the host picks it on the path page; everyone else
    // waits there and is auto-routed here once a path is set.
    if (!trip.destination_planning_path) {
      router.replace(`/trips/${tripId}/step2/path`)
    }
  }, [loading, trip, tripId, router])

  const isConsideringPath = trip?.destination_planning_path === 'considering'
  const isBrainstormPath = trip?.destination_planning_path === 'brainstorm'
  const isMatrixPath = isConsideringPath || isBrainstormPath
  const step2Label = pathStepLabel(trip?.destination_planning_path)
  const canChangePlanningPath =
    isOrganizer &&
    isMatrixPath &&
    (trip?.voting_round == null || trip.voting_round < 1)

  const destinationFinalized = !!trip && votingComplete(trip)
  const canStartOver = isOrganizer && !!trip?.destination_planning_path && !destinationFinalized

  const confirmStartOver = async () => {
    setStartingOver(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const headers: HeadersInit = {}
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`
      const res = await fetch(`/api/trips/${tripId}/reset-step2`, { method: 'POST', headers })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not start over')
      setShowStartOverConfirm(false)
      router.push(data.redirectTo || `/trips/${tripId}/step2/path`)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not start over')
    } finally {
      setStartingOver(false)
    }
  }

  const confirmChangePlanningPath = async () => {
    setChangingPath(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const headers: HeadersInit = {}
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`
      const res = await fetch(`/api/trips/${tripId}/planning-path`, { method: 'DELETE', headers })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not change path')
      setShowChangePathConfirm(false)
      router.push(data.redirectTo || `/trips/${tripId}/step2/path`)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not change path')
    } finally {
      setChangingPath(false)
    }
  }

  const hasGeneratedContent = isMatrixPath
    ? matrixRows.length > 0
    : cards.length > 0

  const displayCards = viewingPriorGeneration && priorGenerationSnapshot ? priorGenerationSnapshot.cards : cards
  const displayVotes = viewingPriorGeneration && priorGenerationSnapshot ? priorGenerationSnapshot.votes : votes
  const displayMatrixRows = viewingPriorGeneration && priorGenerationSnapshot ? priorGenerationSnapshot.matrixRows : matrixRows
  const displayMatrixPairings = viewingPriorGeneration && priorGenerationSnapshot ? priorGenerationSnapshot.matrixPairings : matrixPairings
  const displayMatrixTriples = viewingPriorGeneration && priorGenerationSnapshot ? priorGenerationSnapshot.matrixTriples : matrixTriples
  const displayMatrixSummary = viewingPriorGeneration && priorGenerationSnapshot ? priorGenerationSnapshot.matrixSummary : matrixSummary
  const displayMatrixRecommendedTab = viewingPriorGeneration && priorGenerationSnapshot ? priorGenerationSnapshot.matrixRecommendedTab : matrixRecommendedTab
  const displayMatrixRecommendedShape = viewingPriorGeneration && priorGenerationSnapshot ? priorGenerationSnapshot.matrixRecommendedShape : matrixRecommendedShape
  const isViewingPrior = viewingPriorGeneration && snapshotHasContent(priorGenerationSnapshot)

  const shouldCollapseInputs = isMatrixPath && hasGeneratedContent && !editMode && !isViewingPrior

  const showQ1Answered =
    ((typeof stage === 'number' && stage >= 2) || stage === 'generate' || stage === 'done') && !editMode

  const preferencesSummary = useMemo(() => {
    const parts: string[] = []
    if (isConsideringPath && consideringList.length > 0) {
      const names = consideringList.map(p => p.split(',')[0]?.trim() || p)
      parts.push(
        names.length <= 2 ? names.join(' · ') : `${names.slice(0, 2).join(' · ')} +${names.length - 2}`,
      )
    }
    if (departureCities[0]) {
      parts.push(`from ${departureCities[0].split(',')[0]?.trim() || departureCities[0]}`)
    }
    if (dates === 'Fixed dates' && fixedDates.start && fixedDates.end) {
      parts.push(`${fixedDates.start} – ${fixedDates.end}`)
    } else if (flexLength) {
      parts.push(flexLength)
    } else if (dates) {
      parts.push(dates)
    }
    if (budget && budget !== 'Other') parts.push(budget)
    else if (budget === 'Other' && budgetOther.trim()) parts.push(budgetOther.trim())
    if (stops) parts.push(stops === 'Other' ? stopsOther.trim() || 'Custom stops' : stops)
    return parts.filter(Boolean).join(' · ') || 'View or edit your trip preferences'
  }, [
    isConsideringPath,
    consideringList,
    departureCities,
    dates,
    fixedDates,
    flexLength,
    budget,
    budgetOther,
    stops,
    stopsOther,
  ])

  const isQ2Complete = () => {
    if (departureCities.length === 0) return false
    if (!dates) return false
    if (dates === 'Fixed dates' && (!fixedDates.start || !fixedDates.end)) return false
    if (dates === 'Flexible — I have a range' && (!fixedDates.start || !fixedDates.end || !flexLength)) return false
    if (isConsideringPath) {
      if (consideringList.length < 2) return false
    } else {
      if (!domestic) return false
      if (domestic === 'International' && regions.length === 0) return false
    }
    if (!stops) return false
    if (stops === 'Other' && !stopsOther.trim()) return false
    if (activities.length === 0) return false
    if (vibe.length === 0) return false
    if (vibe.includes('Other') && !vibeOther.trim()) return false
    if (!accommodation) return false
    if (!budget) return false
    if (budget === 'Other' && !budgetOther.trim()) return false
    if (!isConsideringPath && !popularity) return false
    return true
  }

  const q2Valid = isQ2Complete()
  const q3Valid = q3.trim().length > 0

  const consideringSingleNames = useMemo(
    () => new Set(displayMatrixRows.map(r => r.name)),
    [displayMatrixRows],
  )
  const consideringPairingLabels = useMemo(
    () => new Set(displayMatrixPairings.map(p => p.label)),
    [displayMatrixPairings],
  )
  const consideringTripleLabels = useMemo(
    () => new Set(displayMatrixTriples.map(t => t.label)),
    [displayMatrixTriples],
  )
  const selectedVoteCount = Object.values(displayVotes).filter(Boolean).length
  const consideringPairingVoteMode = useMemo(
    () => Object.entries(votes).some(([k, v]) => v && consideringPairingLabels.has(k)),
    [votes, consideringPairingLabels],
  )
  const consideringTripleVoteMode = useMemo(
    () => Object.entries(votes).some(([k, v]) => v && consideringTripleLabels.has(k)),
    [votes, consideringTripleLabels],
  )

  const toggleConsideringSingle = (name: string) => {
    const isCurrentlyVoted = votes[name]
    const singlesCount = Object.entries(votes).filter(([k, v]) => v && consideringSingleNames.has(k)).length
    if (!isCurrentlyVoted && singlesCount >= maxVotes) return
    const next: Record<string, boolean> = { ...votes }
    consideringPairingLabels.forEach(label => { delete next[label] })
    consideringTripleLabels.forEach(label => { delete next[label] })
    if (isCurrentlyVoted) delete next[name]
    else next[name] = true
    setVotes(next)
    persistCardVotes(next)
  }

  const toggleConsideringPairing = (label: string) => {
    const isCurrentlyVoted = votes[label]
    const pairingsCount = Object.entries(votes).filter(([k, v]) => v && consideringPairingLabels.has(k)).length
    if (!isCurrentlyVoted && pairingsCount >= maxVotes) return
    const next: Record<string, boolean> = { ...votes }
    consideringSingleNames.forEach(name => { delete next[name] })
    consideringTripleLabels.forEach(tripleLabel => { delete next[tripleLabel] })
    if (isCurrentlyVoted) delete next[label]
    else next[label] = true
    setVotes(next)
    persistCardVotes(next)
  }

  const toggleConsideringTriple = (label: string) => {
    const isCurrentlyVoted = votes[label]
    const triplesCount = Object.entries(votes).filter(([k, v]) => v && consideringTripleLabels.has(k)).length
    if (!isCurrentlyVoted && triplesCount >= maxVotes) return
    const next: Record<string, boolean> = { ...votes }
    consideringSingleNames.forEach(name => { delete next[name] })
    consideringPairingLabels.forEach(pairingLabel => { delete next[pairingLabel] })
    if (isCurrentlyVoted) delete next[label]
    else next[label] = true
    setVotes(next)
    persistCardVotes(next)
  }

  const showSubmitChoices = !generating && !isViewingPrior && (
    isMatrixPath ? matrixRows.length > 0 : cards.length >= maxVotes
  )

  const showQ2 = (typeof stage === 'number' && stage >= 2) || stage === 'generate' || stage === 'done' || editMode
  const showQ3 = editMode || stage === 'generate' || stage === 'done' || (typeof stage === 'number' && stage >= 3 && q2Valid)

  useEffect(() => {
    loadGoogleMapsScript()
  }, [])

  useEffect(() => {
    if (!showQ2) return
    const tryInit = () => {
      const input = document.getElementById('departure-city-input') as HTMLInputElement
      if (!input) return
      if (!(window as any).google?.maps?.places) return
      const autocomplete = new (window as any).google.maps.places.Autocomplete(input, {
        types: ['(cities)'],
        fields: ['formatted_address', 'name', 'place_id'],
      })
      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace()
        if (!place?.place_id) return
        const name = place.formatted_address || place.name || ''
        if (!name) return
        setDepartureCities(prev => (prev.includes(name) ? prev : [...prev, name]))
        setDepartureCityInput('')
      })
    }
    whenGooglePlacesReady().then(() => tryInit())
  }, [showQ2, stage])

  const addConsideringPlace = (name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    setConsideringList(prev => (prev.includes(trimmed) ? prev : [...prev, trimmed]))
    setConsideringInput('')
  }

  useEffect(() => {
    if (!isConsideringPath || !showQ2) return
    const tryInit = () => {
      const input = document.getElementById('considering-place-input') as HTMLInputElement
      if (!input) return
      if (!(window as any).google?.maps?.places) return
      const autocomplete = new (window as any).google.maps.places.Autocomplete(input, {
        types: ['(cities)'],
        fields: ['formatted_address', 'name', 'place_id'],
      })
      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace()
        if (!place?.place_id) return
        const name = place.formatted_address || place.name || ''
        if (name) addConsideringPlace(name)
      })
    }
    tryInit()
    const timer = setTimeout(tryInit, 1000)
    return () => clearTimeout(timer)
  }, [isConsideringPath, showQ2, stage])

  const buildAnswersPayload = () => ({
    q1,
    departureCities,
    departureCity: departureCitiesToStoredString(departureCities),
    dates,
    fixedDates,
    flexLength,
    domestic,
    regions,
    stops,
    stopsOther,
    activities,
    vibe,
    vibeOther,
    accommodation,
    budget,
    budgetOther,
    popularity,
    q3,
    consideringList,
    matrix: matrixRows,
    matrixPairings,
    matrixTriples,
    matrixSummary,
    matrixRecommendedTab,
    matrixRecommendedShape,
  })

  const applyAnswersFromPayload = (answers: Record<string, unknown>) => {
    setQ1(String(answers.q1 || ''))
    if (Array.isArray(answers.departureCities)) {
      setDepartureCities(answers.departureCities as string[])
    }
    const datesVal = String(answers.dates || '')
    setDates(datesVal === 'Completely flexible' ? '' : datesVal)
    setFixedDates((answers.fixedDates as { start: string; end: string }) || { start: '', end: '' })
    setFlexLength(String(answers.flexLength || ''))
    setDomestic(String(answers.domestic || ''))
    setRegions(Array.isArray(answers.regions) ? (answers.regions as string[]) : [])
    const stopsVal = String(answers.stops || '')
    if (STOP_OPTIONS.includes(stopsVal)) {
      setStops(stopsVal)
      setStopsOther('')
    } else if (stopsVal) {
      setStops('Other')
      setStopsOther(stopsVal)
    } else {
      setStops('')
      setStopsOther('')
    }
    setActivities(Array.isArray(answers.activities) ? (answers.activities as string[]) : [])
    const vibeList = Array.isArray(answers.vibe) ? (answers.vibe as string[]) : []
    setVibe(vibeList)
    setVibeOther(String(answers.vibeOther || ''))
    setAccommodation(String(answers.accommodation || ''))
    const budgetVal = String(answers.budget || '')
    if (['Under $1,000', '$1,000–2,000', '$2,000–4,000', '$4,000–7,000', '$7,000+'].includes(budgetVal)) {
      setBudget(budgetVal)
      setBudgetOther('')
    } else if (budgetVal) {
      setBudget('Other')
      setBudgetOther(budgetVal)
    } else {
      setBudget('')
      setBudgetOther('')
    }
    setPopularity(String(answers.popularity || ''))
    setQ3(String(answers.q3 || ''))
    if (Array.isArray(answers.consideringList)) {
      setConsideringList(answers.consideringList as string[])
    }
  }

  const captureCurrentSnapshot = (): Step2GenerationSnapshot =>
    createGenerationSnapshot({
      answers: buildAnswersPayload(),
      cards,
      votes,
      stage,
      consideringList,
      matrixRows,
      matrixPairings,
      matrixTriples,
      matrixSummary,
      matrixRecommendedTab,
      matrixRecommendedShape,
    })

  const persistPriorGeneration = async (snapshot: Step2GenerationSnapshot) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const tid = travelerId || (await findTravelerForUser(supabase, tripId, user.id))?.id
    if (!tid) return
    await patchTravelerStep2(supabase, tid, { priorGeneration: snapshot })
  }

  const applySnapshotToState = (snapshot: Step2GenerationSnapshot) => {
    applyAnswersFromPayload(snapshot.answers)
    if (snapshot.matrixRows.length > 0) {
      setCards(buildConsideringPathCards(snapshot.matrixRows, snapshot.matrixPairings, snapshot.matrixTriples))
    } else {
      setCards(snapshot.cards)
    }
    setVotes(snapshot.votes)
    setStage(snapshot.stage)
    setConsideringList(snapshot.consideringList)
    setMatrixRows(snapshot.matrixRows)
    setMatrixPairings(snapshot.matrixPairings)
    setMatrixTriples(snapshot.matrixTriples)
    setMatrixSummary(snapshot.matrixSummary)
    setMatrixRecommendedTab(snapshot.matrixRecommendedTab)
    setMatrixRecommendedShape(snapshot.matrixRecommendedShape)
  }

  const persistSnapshotToDb = async (snapshot: Step2GenerationSnapshot) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const tid = travelerId || (await findTravelerForUser(supabase, tripId, user.id))?.id
    if (!tid) return
    await patchTravelerStep2(supabase, tid, {
      ...snapshot.answers,
      cards:
        snapshot.matrixRows.length > 0
          ? buildConsideringPathCards(snapshot.matrixRows, snapshot.matrixPairings, snapshot.matrixTriples)
          : snapshot.cards,
      cardVotes: snapshot.votes,
      stage: snapshot.stage,
      consideringList: snapshot.consideringList,
      matrix: snapshot.matrixRows,
      matrixPairings: snapshot.matrixPairings,
      matrixTriples: snapshot.matrixTriples,
      matrixSummary: snapshot.matrixSummary,
      matrixRecommendedTab: snapshot.matrixRecommendedTab,
      matrixRecommendedShape: snapshot.matrixRecommendedShape,
    })
  }

  const startEditing = (targetStage?: typeof stage) => {
    if (hasGeneratedContent && !editMode && !isViewingPrior) {
      setRestoreSnapshot(captureCurrentSnapshot())
      setEditMode(true)
      setCardsInvalidated(false)
    }
    if (targetStage !== undefined) setStage(targetStage)
  }

  const handleRestorePreviousCards = async () => {
    if (!restoreSnapshot) return
    applySnapshotToState(restoreSnapshot)
    setEditMode(false)
    setCardsInvalidated(false)
    setRestoreSnapshot(null)
    setViewingPriorGeneration(false)
    await persistSnapshotToDb(restoreSnapshot)
  }

  const confirmRestorePriorGeneration = async () => {
    if (!priorGenerationSnapshot) return
    setShowRestorePriorConfirm(false)
    const snapshot = priorGenerationSnapshot
    applySnapshotToState(snapshot)
    setPriorGenerationSnapshot(null)
    setViewingPriorGeneration(false)
    await persistSnapshotToDb(snapshot)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const tid = travelerId || (await findTravelerForUser(supabase, tripId, user.id))?.id
    if (!tid) return
    await patchTravelerStep2(supabase, tid, { priorGeneration: null })
  }

  useEffect(() => {
    if (!editMode || !restoreSnapshot || cardsInvalidated) return
    if (JSON.stringify(buildAnswersPayload()) !== JSON.stringify(restoreSnapshot.answers)) {
      setCards([])
      setVotes({})
      setMatrixRows([])
      setMatrixPairings([])
      setMatrixTriples([])
      setMatrixSummary('')
      setMatrixRecommendedTab(null)
      setMatrixRecommendedShape('')
      setCardsInvalidated(true)
    }
  }, [
    editMode,
    restoreSnapshot,
    cardsInvalidated,
    q1,
    departureCities,
    dates,
    fixedDates,
    flexLength,
    domestic,
    regions,
    stops,
    stopsOther,
    activities,
    vibe,
    vibeOther,
    accommodation,
    budget,
    budgetOther,
    popularity,
    q3,
    consideringList,
  ])

  const saveProgress = async (stageToSave: any, messagesOverride?: { role: 'user' | 'assistant'; content: string }[]) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const tid = travelerId || (await findTravelerForUser(supabase, tripId, user.id))?.id
    if (!tid) return
    await patchTravelerStep2(supabase, tid, {
      q1, departureCities, departureCity: departureCitiesToStoredString(departureCities),
      dates, fixedDates, flexLength,
      domestic, regions, stops: stops === 'Other' ? stopsOther : stops,
      activities, vibe: vibe.includes('Other') ? [...vibe.filter(v => v !== 'Other'), vibeOther] : vibe,
      accommodation, budget: budget === 'Other' ? budgetOther : budget,
      popularity, q3, stage: stageToSave,
      consideringList,
      matrix: matrixRows,
      matrixPairings,
      matrixTriples,
      matrixSummary,
      matrixRecommendedTab,
      matrixRecommendedShape,
      chatMessages: messagesOverride ?? chatMessages,
    })
    void (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const headers: HeadersInit = {}
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`
      await fetch(`/api/trips/${tripId}/date-overlap`, { method: 'POST', headers })
    })().catch(() => {})
  }

  const persistCardVotes = async (nextVotes: Record<string, boolean>) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const tid = travelerId || (await findTravelerForUser(supabase, tripId, user.id))?.id
    if (!tid) return
    await patchTravelerStep2(supabase, tid, { cardVotes: nextVotes })
  }

  const persistChatMessages = async (messages: { role: 'user' | 'assistant'; content: string }[]) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const tid = travelerId || (await findTravelerForUser(supabase, tripId, user.id))?.id
    if (!tid) return
    await patchTravelerStep2(supabase, tid, { chatMessages: messages })
  }

  const refreshChat = async () => {
    setRefreshingChat(true)
    const { data: { user } } = await supabase.auth.getUser()
    setChatMessages([])
    setChatInput('')
    if (user) {
      const tid = travelerId || (await findTravelerForUser(supabase, tripId, user.id))?.id
      if (tid) {
        await patchTravelerStep2(supabase, tid, { chatMessages: [] })
      }
      await supabase.from('trip_conversations').delete().eq('trip_id', tripId).eq('user_id', user.id)
    }
    setRefreshingChat(false)
    setShowRefreshChatConfirm(false)
  }

  const toggleMulti = (arr: string[], val: string, setter: (a: string[]) => void) => {
    setter(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val])
  }

  const parseWhyNot = (text: string): { name: string; reasons: string[] }[] => {
    const result: { name: string; reasons: string[] }[] = []
    const reasoningStart = text.indexOf('REASONING:')
    const reasoningEnd = text.indexOf('REASONING_END')
    if (reasoningStart === -1) return result
    const block = text.slice(reasoningStart, reasoningEnd !== -1 ? reasoningEnd : undefined)
    const sections = block.split('---').map((s: string) => s.trim()).filter((s: string) => s && s.includes('NAME:'))
    for (const section of sections) {
      const nameMatch = section.match(/NAME:\s*(.+)/)
      const name = nameMatch?.[1]?.trim() || ''
      if (!name) continue
      const reasons = section.split('\n')
        .filter((l: string) => l.trim().startsWith('-'))
        .map((l: string) => l.replace(/^-\s*/, '').trim())
        .filter((l: string) => l.length > 0)
      result.push({ name, reasons })
    }
    return result
  }

  const persistPartialCards = async (partial: ParsedDestinationCard[]) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || partial.length === 0) return
    const tid = travelerId || (await findTravelerForUser(supabase, tripId, user.id))?.id
    if (!tid) return
    if (!travelerId) setTravelerId(tid)
    await patchTravelerStep2(supabase, tid, { cards: partial, stage: 'done' })
  }

  const generateDestinations = async (opts?: { resume?: boolean }) => {
    const resume = opts?.resume === true && cards.length > 0
    const snapshot = resume ? [...cards] : []

    setGenerating(true)
    setGenerateError(null)
    setGenerateStatus(
      isMatrixPath
        ? '0% done — Starting…'
        : GENERATION_TIME_HINT,
    )
    if (!resume) {
      setCards([])
      setMatrixRows([])
      setMatrixPairings([])
      setMatrixTriples([])
      setMatrixSummary('')
      setMatrixRecommendedTab(null)
      setMatrixRecommendedShape('')
    }
    await saveProgress('done')

    const answerPayload = {
      q1,
      departureCities,
      departureCity: departureCitiesToStoredString(departureCities),
      dates,
      fixedDates,
      flexLength,
      domestic,
      regions,
      stops,
      stopsOther,
      activities,
      vibe,
      vibeOther,
      accommodation,
      budget,
      budgetOther,
      popularity,
      q3,
    }

    try {
      if (isMatrixPath) {
        if (isConsideringPath && consideringList.length < 2) {
          setGenerateError('Add at least 2 destinations to your list before generating.')
          return
        }

        const {
          matrix: rows,
          pairings,
          triples,
          summary,
          recommendedTab,
          recommendedShape,
        } = await fetchDestinationMatrix({
          tripId,
          answers: answerPayload,
          messages: chatMessages,
          consideringList: isConsideringPath ? consideringList : [],
          mode: isConsideringPath ? 'considering' : 'brainstorm',
          onStatus: setGenerateStatus,
        })

        enrichMatrixChipRows(rows)
        enrichMatrixPairings(pairings)
        enrichMatrixChipRows(triples)

        const parsed = buildConsideringPathCards(rows, pairings, triples)
        setMatrixRows(rows)
        setMatrixPairings(pairings)
        setMatrixTriples(triples)
        setMatrixSummary(summary)
        setMatrixRecommendedTab(recommendedTab)
        setMatrixRecommendedShape(recommendedShape)
        setCards(parsed)
        setStage('done')
        setEditMode(false)
        setRestoreSnapshot(null)
        setCardsInvalidated(false)

        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const tid = travelerId || (await findTravelerForUser(supabase, tripId, user.id))?.id
          if (tid) {
            if (!travelerId) setTravelerId(tid)
            await patchTravelerStep2(supabase, tid, {
              cards: parsed,
              matrix: rows,
              matrixPairings: pairings,
              matrixTriples: triples,
              matrixSummary: summary,
              matrixRecommendedTab: recommendedTab,
              matrixRecommendedShape: recommendedShape,
              cardVotes: {},
              ...(isConsideringPath ? { consideringList } : {}),
            })
            setVotes({})
          }
        }
        return
      }

    const fetchOptions = {
      tripId,
      onStatus: setGenerateStatus,
      onPartialCards: (partial: ParsedDestinationCard[]) => {
        setCards(partial)
        if (partial.length > 0) setStage('done')
        void persistPartialCards(partial)
      },
      messages: chatMessages,
    }

      const parsed = resume
        ? await fetchRemainingDestinationCards(snapshot, answerPayload, fetchOptions)
        : await fetchFullDestinationCards(answerPayload, fetchOptions)

      setCards(parsed)
      setStage('done')
      setEditMode(false)
      setRestoreSnapshot(null)
      setCardsInvalidated(false)
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const tid = travelerId || (await findTravelerForUser(supabase, tripId, user.id))?.id
        if (tid) {
          if (!travelerId) setTravelerId(tid)
          await patchTravelerStep2(
            supabase,
            tid,
            resume ? { cards: parsed } : { cards: parsed, cardVotes: {} },
          )
          if (!resume) setVotes({})
        }
      }
      if (parsed.length > 0 && parsed.length < 4) {
        setGenerateError('Could not finish all 4 — tap Finish generating to try again.')
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Something went wrong generating trip ideas'
      console.error('generate error:', e)
      if (resume && snapshot.length > 0) {
        setCards(snapshot)
        void persistPartialCards(snapshot)
      }
      const hint =
        message.includes('timed out') ||
        message.includes('504') ||
        message.includes('Failed') ||
        message.includes('No destination cards')
          ? ' This can happen on slower connections — wait a moment and try again.'
          : ''
      setGenerateError(message + hint)
    } finally {
      setGenerating(false)
      setGenerateStatus(null)
    }
  }

  const requestFullRegenerate = () => {
    if (hasGeneratedContent && !isViewingPrior) {
      setShowRegenerateConfirm(true)
      return
    }
    void generateDestinations()
  }

  const confirmFullRegenerate = async () => {
    setShowRegenerateConfirm(false)
    setEditMode(false)
    setRestoreSnapshot(null)
    setCardsInvalidated(false)
    if (hasGeneratedContent && !isViewingPrior) {
      const prior = captureCurrentSnapshot()
      setPriorGenerationSnapshot(prior)
      setViewingPriorGeneration(false)
      await persistPriorGeneration(prior)
    }
    await generateDestinations()
  }

  const regenerateMatrixSingle = async (replaceName: string) => {
    if (!isMatrixPath || isViewingPrior || !canEditBrainstorm || generating) return
    setRegeneratingSingleName(replaceName)
    setGenerateError(null)
    try {
      const answerPayload = {
        q1,
        departureCities,
        departureCity: departureCitiesToStoredString(departureCities),
        dates,
        fixedDates,
        flexLength,
        domestic,
        regions,
        stops,
        stopsOther,
        activities,
        vibe,
        vibeOther,
        accommodation,
        budget,
        budgetOther,
        popularity,
        q3,
      }
      const newRow = await fetchRegenerateMatrixRow({
        tripId,
        answers: answerPayload,
        replaceName,
        keepNames: matrixRows.map(r => r.name),
        messages: chatMessages,
        mode: isConsideringPath ? 'considering' : 'brainstorm',
      })

      const nextRows = matrixRows.map(r => (r.name === replaceName ? newRow : r))
      enrichMatrixChipRows(nextRows)
      sortMatrixRowsByScore(nextRows)

      const parsed = buildConsideringPathCards(nextRows, matrixPairings, matrixTriples)
      setMatrixRows(nextRows)
      setCards(parsed)

      if (replaceName !== newRow.name) {
        setVotes(prev => {
          const next = { ...prev }
          delete next[replaceName]
          void persistCardVotes(next)
          return next
        })
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const tid = travelerId || (await findTravelerForUser(supabase, tripId, user.id))?.id
        if (tid) {
          await patchTravelerStep2(supabase, tid, {
            matrix: nextRows,
            cards: parsed,
          })
        }
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Could not regenerate this destination'
      setGenerateError(message)
    } finally {
      setRegeneratingSingleName(null)
    }
  }

  const regenerateSingleCard = async (cardIndex: number) => {
    if (isMatrixPath || isViewingPrior || !canEditBrainstorm || generating) return
    const oldName = cards[cardIndex]?.name
    setRegeneratingCardIndex(cardIndex)
    setGenerateError(null)
    try {
      const answerPayload = {
        q1,
        departureCities,
        departureCity: departureCitiesToStoredString(departureCities),
        dates,
        fixedDates,
        flexLength,
        domestic,
        regions,
        stops,
        stopsOther,
        activities,
        vibe,
        vibeOther,
        accommodation,
        budget,
        budgetOther,
        popularity,
        q3,
      }
      const nextCards = await regenerateSingleDestinationCard(cards, cardIndex, answerPayload, {
        tripId,
        messages: chatMessages,
        onStatus: setGenerateStatus,
      })
      setCards(nextCards)
      if (oldName && oldName !== nextCards[cardIndex]?.name) {
        setVotes(prev => {
          const next = { ...prev }
          delete next[oldName]
          return next
        })
      }
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const tid = travelerId || (await findTravelerForUser(supabase, tripId, user.id))?.id
        if (tid) {
          await patchTravelerStep2(supabase, tid, { cards: nextCards })
        }
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Could not regenerate this card'
      setGenerateError(message)
    } finally {
      setRegeneratingCardIndex(null)
      setGenerateStatus(null)
    }
  }

  const sendChat = async () => {
    if (!chatInput.trim() || chatLoading) return
    const userMsg = { role: 'user' as const, content: chatInput }
    const newMessages = [...chatMessages, userMsg]
    setChatMessages(newMessages)
    setChatInput('')
    setChatLoading(true)
    try {
      const res = await fetch('/api/step2-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages,
          tripId,
          context: {
            q1,
            departureCity: formatDepartureCitiesForPrompt(departureCities),
            dates,
            fixedDates,
            flexLength,
            domestic,
            regions,
            stops: stops === 'Other' ? stopsOther : stops,
            activities,
            vibe: vibe.includes('Other') ? [...vibe.filter(v => v !== 'Other'), vibeOther] : vibe,
            accommodation,
            budget: budget === 'Other' ? budgetOther : budget,
            popularity,
            q3,
            trip_type: trip?.trip_type,
          },
        }),
      })
      const data = await res.json()
      const finalMessages = [...newMessages, { role: 'assistant' as const, content: data.message }]
      setChatMessages(finalMessages)
      await persistChatMessages(finalMessages)
    } catch (e) {
      const finalMessages = [...newMessages, { role: 'assistant' as const, content: 'Something went wrong. Try again.' }]
      setChatMessages(finalMessages)
      await persistChatMessages(finalMessages)
    }
    setChatLoading(false)
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  const underlineInputStyle = { width: '100%', border: 'none', borderBottom: '1px solid #d4d4c8', background: 'transparent', padding: '8px 0', fontSize: '15px', color: 'var(--foreground)', outline: 'none', resize: 'none' as const, lineHeight: 1.6, ...s }

  const AvantiQuestion = ({ children }: { children: React.ReactNode }) => (
    <Step2QuestionBlock>{children}</Step2QuestionBlock>
  )

  const UserBubble = ({ children }: { children: React.ReactNode }) => (
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '28px' }}>
      <div style={{ maxWidth: '80%', background: 'var(--forest-deep)', color: '#fff', borderRadius: '0', padding: '12px 16px', fontSize: '14px', lineHeight: 1.6, whiteSpace: 'pre-wrap', ...s }}>
        {children}
      </div>
    </div>
  )

  if (loading || phaseLoading) return <SuitcaseLoader message="Loading" />

  if (brainstormPhase && !canViewBrainstorm) {
    return (
      <Step2WorkspaceShell tripId={tripId} stepLabel={step2Label} tripName={trip?.name}>
        <PhaseBanner
          tripId={tripId}
          phase={brainstormPhase}
          isOrganizer={isOrganizer}
          onUpdated={() => void reloadPhase()}
          workspace
        />
        <PhaseLockedScreen phase={brainstormPhase} backHref={`/trips/${tripId}`} />
      </Step2WorkspaceShell>
    )
  }

  if (trip && !trip.invites_closed) {
    return (
      <Step2WorkspaceShell tripId={tripId} stepLabel={step2Label} tripName={trip?.name}>
        <div className="text-center py-12">
          <p className="font-serif text-[22px] font-light mb-3">Step 2 not open yet</p>
          <p className="text-sm text-muted-foreground mb-6 leading-relaxed max-w-sm mx-auto">
            The host needs to start Step 2 from Invite guests and set the suggestion window.
          </p>
          <button
            type="button"
            onClick={() => router.push(`/trips/${tripId}/invite`)}
            className="avanti-btn-primary"
          >
            Go to Invite →
          </button>
        </div>
      </Step2WorkspaceShell>
    )
  }

  return (
    <>
    <Step2WorkspaceShell
      tripId={tripId}
      stepLabel={step2Label}
      tripName={trip?.name}
      onChangePath={canChangePlanningPath ? () => setShowChangePathConfirm(true) : undefined}
      changePathLabel="← Choose a different path (2A / 2B / 2C)"
      onStartOver={canStartOver ? () => setShowStartOverConfirm(true) : undefined}
      startOverLabel="Start Step 2 over from scratch"
      footer={
        <Step2ChatBar
          chatInput={chatInput}
          onChatInputChange={setChatInput}
          onSend={() => void sendChat()}
          chatLoading={chatLoading}
          chatMessages={chatMessages}
          onRefreshChat={() => setShowRefreshChatConfirm(true)}
          refreshingChat={refreshingChat}
        />
      }
    >
        {brainstormPhase && (
          <PhaseBanner
            tripId={tripId}
            phase={brainstormPhase}
            isOrganizer={isOrganizer}
            onUpdated={() => void reloadPhase()}
            workspace
          />
        )}

        {(stage === 1 || editMode) && (
          <div className={`${STEP2_WORKSPACE_PANEL} ${STEP2_WORKSPACE_BOX} ${STEP2_WORKSPACE_BOX_PAD}`}>
            <AvantiQuestion>
              Tell us about this trip. Who is going? What kind of trip are you looking for? Any idea where? What&apos;s the reason for the trip?
            </AvantiQuestion>

            <div className="pl-[54px] sm:pl-[58px]">
              <textarea
                value={q1}
                onChange={e => setQ1(e.target.value)}
                placeholder="e.g. 8 college friends, graduation trip, beaches and nightlife somewhere in Europe"
                rows={6}
                className="w-full min-h-[140px] border-0 outline-none bg-transparent p-0 text-[15px] sm:text-base text-foreground resize-none leading-[1.7] font-serif placeholder:italic placeholder:text-muted-foreground/75"
              />
              {stage === 1 && !editMode && (
                <div className="flex justify-end mt-5">
                  <button
                    onClick={() => { setStage(2); saveProgress(2) }}
                    disabled={!q1.trim()}
                    className="px-7 py-3 border border-foreground/20 text-[10px] uppercase tracking-[0.25em] font-serif transition-colors disabled:cursor-default disabled:text-muted-foreground/40 disabled:bg-transparent enabled:text-foreground enabled:cursor-pointer enabled:hover:border-forest-deep enabled:hover:text-forest-deep"
                  >
                    Next →
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        <CollapsiblePreferences collapse={shouldCollapseInputs} summary={preferencesSummary}>
        {showQ1Answered && (
          <div style={{ marginBottom: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '16px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--forest-deep)', flexShrink: 0 }} />
              <p style={{ fontSize: '16px', color: 'var(--foreground)', lineHeight: 1.7, margin: 0, fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
                Tell us about this trip. Who is going? What kind of trip are you looking for? Any idea where? What&apos;s the reason for the trip?
              </p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <div style={{ maxWidth: '80%', background: 'var(--forest-deep)', color: '#fff', padding: '12px 16px', borderRadius: '0', fontSize: '14px', lineHeight: 1.6, fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
                {q1}
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
              {canEditBrainstorm && (
              <button
                onClick={() => startEditing(1)}
                style={{ fontSize: '11px', color: 'var(--muted-foreground)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'var(--font-cormorant), Georgia, serif' }}
              >
                Edit
              </button>
              )}
            </div>
          </div>
        )}

        {showQ2 && (
          <>
            <AvantiQuestion>
              A few more details — tap to answer each one.
            </AvantiQuestion>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', marginBottom: showQ3 ? '32px' : '0', paddingLeft: '54px' }}>
              {isConsideringPath && (
                <div>
                  <span style={sectionLabel}>Places you are considering</span>
                  <p style={{ fontSize: '12px', color: 'var(--muted-foreground)', margin: '0 0 10px', lineHeight: 1.5, ...s }}>
                    Start typing a city and pick from the Google suggestions — each destination is verified before it&apos;s added.
                  </p>
                  {consideringList.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                      {consideringList.map((place, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: '#e8f5ee', border: '1px solid #2d6a4f', borderRadius: '20px' }}>
                          <span style={{ fontSize: '13px', color: 'var(--forest-deep)', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>{place}</span>
                          <button
                            type="button"
                            onClick={() => setConsideringList(consideringList.filter((_, idx) => idx !== i))}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2d6a4f', fontSize: '14px', lineHeight: 1, padding: '0 0 0 2px' }}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <input
                      id="considering-place-input"
                      type="text"
                      autoComplete="off"
                      value={consideringInput}
                      onChange={e => setConsideringInput(e.target.value)}
                      placeholder="e.g. Tokyo, Japan"
                      style={{ flex: 1, borderBottom: '1px solid #d4d4c8', background: 'transparent', padding: '8px 0', fontSize: '14px', outline: 'none', ...s }}
                    />
                  </div>
                </div>
              )}
              <div>
                <span style={sectionLabel}>Where are you flying from?</span>
                <p style={{ fontSize: '12px', color: 'var(--muted-foreground)', margin: '0 0 10px', lineHeight: 1.5, ...s }}>
                  Start typing a city and pick from the Google suggestions — each departure city is verified before it&apos;s added.
                </p>

                {departureCities.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                    {departureCities.map((city, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: '#e8f5ee', border: '1px solid #2d6a4f', borderRadius: '20px' }}>
                        <span style={{ fontSize: '13px', color: 'var(--forest-deep)', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>{city}</span>
                        <button
                          onClick={() => setDepartureCities(departureCities.filter((_, idx) => idx !== i))}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2d6a4f', fontSize: '14px', lineHeight: 1, padding: '0 0 0 2px' }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input
                    id="departure-city-input"
                    type="text"
                    autoComplete="off"
                    style={{
                      flex: 1,
                      borderBottom: '1px solid #d4d4c8',
                      borderTop: 'none', borderLeft: 'none', borderRight: 'none',
                      background: 'transparent',
                      padding: '8px 0',
                      fontSize: '14px',
                      color: 'var(--foreground)',
                      outline: 'none',
                      fontFamily: 'var(--font-cormorant), Georgia, serif',
                    }}
                    value={departureCityInput}
                    onChange={e => setDepartureCityInput(e.target.value)}
                    placeholder="Type a city..."
                  />
                </div>
              </div>
              <div style={{ borderTop: '0.5px solid #e4e4d8' }} />

              <div>
                <span style={sectionLabel}>What are your dates?</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                  {['Fixed dates', 'Flexible — I have a range'].map(opt => (
                    <button key={opt} onClick={() => setDates(opt)} style={chipStyle(dates === opt)}>{opt}</button>
                  ))}
                </div>
                {dates === 'Fixed dates' && (
                  <DateRangeFields
                    start={fixedDates.start}
                    end={fixedDates.end}
                    onChange={setFixedDates}
                    startLabel="Departure"
                    endLabel="Return"
                    inputStyle={inputStyle}
                    labelStyle={labelStyle}
                  />
                )}
                {dates === 'Flexible — I have a range' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <DateRangeFields
                      start={fixedDates.start}
                      end={fixedDates.end}
                      onChange={setFixedDates}
                      startLabel="Earliest departure"
                      endLabel="Latest return"
                      inputStyle={inputStyle}
                      labelStyle={labelStyle}
                    />
                    <div>
                      <label style={labelStyle}>Preferred trip length</label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {['3–4 nights', '5–7 nights', '8–10 nights', '11–14 nights', '2+ weeks'].map(opt => (
                          <button key={opt} onClick={() => setFlexLength(opt)} style={chipStyle(flexLength === opt)}>{opt}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              {!isConsideringPath && (
                <>
                  <div style={{ borderTop: '0.5px solid #e4e4d8' }} />

                  <div>
                    <span style={sectionLabel}>Domestic or international?</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                      {['Domestic only', 'International', 'No preference'].map(opt => (
                        <button key={opt} onClick={() => setDomestic(opt)} style={chipStyle(domestic === opt)}>{opt}</button>
                      ))}
                    </div>
                    {domestic === 'International' && (
                      <div>
                        <label style={{ ...labelStyle, marginTop: '8px' }}>Regions you&apos;d consider</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                          {TRIP_REGION_OPTIONS.map(r => (
                            <button key={r} onClick={() => toggleMulti(regions, r, setRegions)} style={chipStyle(regions.includes(r))}>{r}</button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
              <div style={{ borderTop: '0.5px solid #e4e4d8' }} />

              <div>
                <span style={sectionLabel}>How many places?</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {['Just one', '2 stops', '3 stops', 'Open to anything', 'Other'].map(opt => (
                    <button key={opt} onClick={() => setStops(opt)} style={chipStyle(stops === opt)}>{opt}</button>
                  ))}
                </div>
                {stops === 'Other' && (
                  <input style={{ ...inputStyle, marginTop: '8px' }} value={stopsOther} onChange={e => setStopsOther(e.target.value)} placeholder="Tell us more..." />
                )}
              </div>
              <div style={{ borderTop: '0.5px solid #e4e4d8' }} />

              <div>
                <span style={sectionLabel}>What kind of activities?</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {TRIP_ACTIVITY_OPTIONS.map(opt => (
                    <button key={opt} onClick={() => toggleMulti(activities, opt, setActivities)} style={chipStyle(activities.includes(opt))}>{opt}</button>
                  ))}
                </div>
              </div>
              <div style={{ borderTop: '0.5px solid #e4e4d8' }} />

              <div>
                <span style={sectionLabel}>What&apos;s the vibe?</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                  {['Luxury', 'Budget-conscious', 'Party', 'Romantic', 'Family-friendly', 'Cultural immersion', 'Off the beaten path', 'Touristy & easy', 'Relaxed & slow', 'Action-packed', 'Other'].map(opt => (
                    <button key={opt} onClick={() => toggleMulti(vibe, opt, setVibe)} style={chipStyle(vibe.includes(opt))}>{opt}</button>
                  ))}
                </div>
                {vibe.includes('Other') && (
                  <input style={{ ...inputStyle, marginTop: '8px' }} value={vibeOther} onChange={e => setVibeOther(e.target.value)} placeholder="Describe the vibe..." />
                )}
              </div>
              <div style={{ borderTop: '0.5px solid #e4e4d8' }} />

              <div>
                <span style={sectionLabel}>Hotel or Airbnb?</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {['Hotel', 'Airbnb / villa', 'Resort', 'Boutique / guesthouse', 'No preference'].map(opt => (
                    <button key={opt} onClick={() => setAccommodation(opt)} style={chipStyle(accommodation === opt)}>{opt}</button>
                  ))}
                </div>
              </div>
              <div style={{ borderTop: '0.5px solid #e4e4d8' }} />

              <div>
                <span style={sectionLabel}>Trip budget per person?</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                  {['Under $1,000', '$1,000–2,000', '$2,000–4,000', '$4,000–7,000', '$7,000+', 'Other'].map(opt => (
                    <button key={opt} onClick={() => setBudget(opt)} style={chipStyle(budget === opt)}>{opt}</button>
                  ))}
                </div>
                {budget === 'Other' && (
                  <input style={{ ...inputStyle, marginTop: '8px' }} value={budgetOther} onChange={e => setBudgetOther(e.target.value)} placeholder="Describe your budget..." />
                )}
              </div>
              {!isConsideringPath && (
                <>
                  <div style={{ borderTop: '0.5px solid #e4e4d8' }} />

                  <div>
                    <span style={sectionLabel}>How popular should the destination be?</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {['Well known & easy', 'A mix of both', 'Off the beaten path', 'Surprise us'].map(opt => (
                        <button key={opt} onClick={() => setPopularity(opt)} style={chipStyle(popularity === opt)}>{opt}</button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {stage === 2 && !editMode && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '8px' }}>
                  {nextBtn(() => { setStage(3); saveProgress(3) }, !q2Valid)}
                </div>
              )}
            </div>
          </>
        )}

        {showQ3 && (
          <>
            <AvantiQuestion>
              What don&apos;t you want? Any deal breakers? Anything else Avanti should know?
            </AvantiQuestion>

            {(stage === 3 || editMode) ? (
              <div style={{ marginBottom: '32px', paddingLeft: '54px' }}>
                <textarea
                  value={q3}
                  onChange={e => setQ3(e.target.value)}
                  placeholder="No cold weather. Don't want anywhere too touristy. One person in the group has a shellfish allergy. We'd rather not go anywhere that requires a visa..."
                  rows={3}
                  style={underlineInputStyle}
                />
                {stage === 3 && !editMode && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                    {nextBtn(() => { setStage('generate'); saveProgress('generate') }, !q3Valid, 'Next →')}
                  </div>
                )}
              </div>
            ) : q3.trim() && !editMode ? (
              <>
                <UserBubble>{q3}</UserBubble>
                {(stage === 3 || stage === 'generate' || stage === 'done') && !editMode && !generating && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginTop: '24px', gap: '10px' }}>
                    <p style={{ fontSize: '12px', color: 'var(--muted-foreground)', textAlign: 'right', margin: 0, lineHeight: 1.6, maxWidth: '320px', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
                      {GENERATION_TIME_HINT}
                    </p>
                    <button
                      onClick={() => (hasGeneratedContent ? requestFullRegenerate() : void generateDestinations())}
                      style={{
                        padding: '14px 32px',
                        border: '1px solid var(--forest-deep)',
                        background: 'var(--forest-deep)',
                        color: '#ffffff',
                        fontSize: '10px',
                        letterSpacing: '0.25em',
                        textTransform: 'uppercase',
                        cursor: 'pointer',
                        fontFamily: 'var(--font-cormorant), Georgia, serif',
                      }}
                    >
                      {hasGeneratedContent
                        ? (isMatrixPath ? 'Regenerate options →' : 'Regenerate trip ideas →')
                        : (isMatrixPath ? 'Generate options →' : 'Generate trip ideas →')}
                    </button>
                  </div>
                )}
              </>
            ) : null}
          </>
        )}
        </CollapsiblePreferences>

        {editMode && (
          <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {cardsInvalidated && (
              <div style={{ padding: '14px 18px', border: '1px solid #d4a017', background: '#fef9ec' }}>
                <p style={{ fontSize: '13px', color: '#6a5a20', margin: '0 0 10px', lineHeight: 1.6, fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
                  Your trip cards were cleared because you changed your answers. Regenerate to see new picks, or restore your previous cards.
                </p>
                {restoreSnapshot && (
                  <button
                    type="button"
                    onClick={() => void handleRestorePreviousCards()}
                    style={{ padding: '10px 18px', border: '1px solid #8a6a10', background: 'transparent', color: '#8a6a10', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'var(--font-cormorant), Georgia, serif' }}
                  >
                    ← Back to previous cards
                  </button>
                )}
              </div>
            )}
            {!cardsInvalidated && restoreSnapshot && (
              <button
                type="button"
                onClick={() => void handleRestorePreviousCards()}
                style={{ padding: '12px 20px', border: '1px solid #d4d4c8', background: 'transparent', color: 'var(--muted-foreground)', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'var(--font-cormorant), Georgia, serif' }}
              >
                ← Cancel editing
              </button>
            )}
            <button
              onClick={() => {
                if (!q3Valid || !q2Valid || !q1.trim()) return
                requestFullRegenerate()
              }}
              disabled={!q3Valid || !q2Valid || !q1.trim() || generating}
              style={{
                width: '100%', padding: '18px',
                border: '1px solid var(--forest-deep)', background: 'var(--forest-deep)',
                color: '#ffffff', fontSize: '11px', letterSpacing: '0.25em',
                textTransform: 'uppercase', cursor: 'pointer',
                fontFamily: 'var(--font-cormorant), Georgia, serif',
                opacity: !q3Valid || !q2Valid || !q1.trim() ? 0.5 : 1,
              }}
            >
              Regenerate {isMatrixPath ? 'options' : 'trip ideas'} →
            </button>
          </div>
        )}

        {generating && (isMatrixPath ? matrixRows.length === 0 : cards.length === 0) && (
          isMatrixPath ? (() => {
            const { percent, label } = parseMatrixProgressStatus(generateStatus)
            return (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 0', gap: '16px' }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#2d6a4f" strokeWidth="1.5" strokeLinecap="round">
                  <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" style={{ animation: 'spin 1.5s linear infinite', transformOrigin: 'center' }} />
                </svg>
                <p style={{ fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#2d6a4f', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>Avanti is thinking...</p>
                <p style={{ fontSize: '28px', color: 'var(--forest-deep)', textAlign: 'center', margin: 0, fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
                  {percent != null ? `${percent}% done` : 'Starting…'}
                </p>
                <p style={{ fontSize: '15px', color: 'var(--foreground)', textAlign: 'center', maxWidth: '320px', lineHeight: 1.6, fontFamily: 'var(--font-cormorant), Georgia, serif', margin: 0 }}>
                  {label}
                </p>
                <p style={{ fontSize: '13px', color: 'var(--muted-foreground)', textAlign: 'center', maxWidth: '320px', lineHeight: 1.6, fontFamily: 'var(--font-cormorant), Georgia, serif', margin: 0 }}>
                  {MATRIX_GENERATION_TIME_HINT}
                </p>
              </div>
            )
          })() : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 0', gap: '16px' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#2d6a4f" strokeWidth="1.5" strokeLinecap="round">
              <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" style={{ animation: 'spin 1.5s linear infinite', transformOrigin: 'center' }} />
            </svg>
            <p style={{ fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#2d6a4f', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>Avanti is thinking...</p>
            <p style={{ fontSize: '15px', color: 'var(--foreground)', textAlign: 'center', maxWidth: '320px', lineHeight: 1.6, fontFamily: 'var(--font-cormorant), Georgia, serif', margin: 0 }}>
              {GENERATION_TIME_HINT}
            </p>
            <p style={{ fontSize: '13px', color: 'var(--muted-foreground)', textAlign: 'center', maxWidth: '320px', lineHeight: 1.6, fontFamily: 'var(--font-cormorant), Georgia, serif', margin: 0 }}>
              {generateStatus && generateStatus !== GENERATION_TIME_HINT ? generateStatus : 'Weighing destinations against your vibe, budget, and deal breakers…'}
            </p>
          </div>
          )
        )}

        {!generating && generateError && cards.length === 0 && (
          <div style={{ marginTop: '32px', padding: '20px 24px', border: '1px solid #c0392b', background: '#fdf2f2', textAlign: 'center' }}>
            <p style={{ fontSize: '14px', color: '#c0392b', margin: '0 0 16px', lineHeight: 1.6, fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
              {generateError}
            </p>
            <button
              type="button"
              onClick={() => generateDestinations()}
              style={{
                padding: '12px 28px',
                border: '1px solid var(--forest-deep)',
                background: 'var(--forest-deep)',
                color: '#ffffff',
                fontSize: '10px',
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                fontFamily: 'var(--font-cormorant), Georgia, serif',
              }}
            >
              Try again →
            </button>
          </div>
        )}

        {!editMode && hasGeneratedContent && canEditBrainstorm && !isViewingPrior && (
          <div style={{ marginTop: '24px', marginBottom: '8px', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => setShowEditConfirm(true)}
              style={{ fontSize: '11px', color: 'var(--muted-foreground)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'var(--font-cormorant), Georgia, serif' }}
            >
              Edit preferences
            </button>
          </div>
        )}

        {snapshotHasContent(priorGenerationSnapshot) && hasGeneratedContent && !editMode && (
          <div style={{ marginTop: '8px', marginBottom: '12px', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => setViewingPriorGeneration(v => !v)}
              style={{ fontSize: '11px', color: 'var(--forest-deep)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'var(--font-cormorant), Georgia, serif' }}
            >
              {isViewingPrior ? '← Back to current results' : '← View previous results'}
            </button>
          </div>
        )}

        {isViewingPrior && (
          <div style={{ marginBottom: '16px', padding: '12px 16px', border: '1px solid #a8d4b8', background: '#e8f5ee', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <p style={{ fontSize: '13px', color: 'var(--forest-deep)', margin: 0, lineHeight: 1.6, fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
              You&apos;re viewing your previous generation. Restoring makes these your current pairings and replaces the newer set — you can&apos;t switch back afterward.
            </p>
            {canEditBrainstorm && (
              <button
                type="button"
                onClick={() => setShowRestorePriorConfirm(true)}
                style={{
                  alignSelf: 'flex-start',
                  padding: '10px 18px',
                  border: '1px solid var(--forest-deep)',
                  background: 'var(--forest-deep)',
                  color: '#ffffff',
                  fontSize: '10px',
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-cormorant), Georgia, serif',
                }}
              >
                {isMatrixPath ? 'Restore previous pairings →' : 'Restore previous cards →'}
              </button>
            )}
          </div>
        )}

        {!editMode && (isMatrixPath ? displayMatrixRows.length > 0 : displayCards.length > 0) && (
          <>
            {generating && (
              <div style={{ marginTop: '24px', marginBottom: '8px', textAlign: 'center' }}>
                <p style={{ fontSize: '14px', color: 'var(--foreground)', margin: '0 0 8px', lineHeight: 1.6, fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
                  {GENERATION_TIME_HINT}
                </p>
                <p style={{ fontSize: '12px', color: 'var(--muted-foreground)', margin: 0, lineHeight: 1.6, fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
                  {generateStatus && generateStatus !== GENERATION_TIME_HINT ? generateStatus : `${cards.length} of 4 ready…`}
                </p>
              </div>
            )}
            {generateError && cards.length > 0 && !isMatrixPath && cards.length < 4 && (
              <div style={{ marginTop: '16px', padding: '14px 18px', border: '1px solid #d4a017', background: '#fef9ec', textAlign: 'center' }}>
                <p style={{ fontSize: '13px', color: '#8a6a10', margin: '0 0 10px', lineHeight: 1.6, fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
                  {generateError} — showing {cards.length} of 4 picks so far.
                </p>
                <button type="button" onClick={() => generateDestinations({ resume: true })} style={{ padding: '10px 20px', border: '1px solid var(--forest-deep)', background: 'var(--forest-deep)', color: '#ffffff', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
                  Finish generating →
                </button>
              </div>
            )}
          {displayMatrixRows.length > 0 ? (
            <DestinationMatrix
              key={`${displayMatrixRecommendedTab || 'tab'}-${displayMatrixRows.length}-${displayMatrixPairings.length}-${displayMatrixTriples.length}-${isViewingPrior ? 'prior' : 'current'}`}
              rows={displayMatrixRows}
              pairings={displayMatrixPairings}
              triples={displayMatrixTriples}
              summary={displayMatrixSummary}
              recommendedTab={displayMatrixRecommendedTab}
              recommendedShape={displayMatrixRecommendedShape}
              tripShapeAnswers={{ stops, stopsOther, flexLength, fixedDates, dates }}
              selected={displayVotes}
              maxVotes={maxVotes}
              readOnly={!canEditBrainstorm || isViewingPrior}
              onToggleSingle={toggleConsideringSingle}
              onTogglePairing={toggleConsideringPairing}
              onToggleTriple={toggleConsideringTriple}
              onRegenerateSingle={
                !canEditBrainstorm || isViewingPrior || generating
                  ? undefined
                  : (name: string) => void regenerateMatrixSingle(name)
              }
              regeneratingSingleName={regeneratingSingleName}
            />
          ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '32px', marginBottom: '32px' }}>
            {displayCards.map((card, index) => (
              <DestinationCard
                key={card.name || card.destination || index}
                card={card}
                tripId={tripId}
                isVoted={!!displayVotes[card.name]}
                onVote={!canEditBrainstorm || isViewingPrior ? undefined : () => {
                  const currentCount = Object.values(votes).filter(Boolean).length
                  const isCurrentlyVoted = votes[card.name]
                  if (!isCurrentlyVoted && currentCount >= maxVotes) return
                  setVotes(v => {
                    const next = { ...v, [card.name]: !v[card.name] }
                    persistCardVotes(next)
                    return next
                  })
                }}
                onRegenerate={
                  !canEditBrainstorm || isViewingPrior || isMatrixPath || generating
                    ? undefined
                    : () => void regenerateSingleCard(index)
                }
                regenerating={regeneratingCardIndex === index}
              />
            ))}
          </div>
          )}
          </>
        )}

        {!generating && !isMatrixPath && cards.length > 0 && cards.length < 4 && !generateError && (
          <div style={{ marginTop: '8px', marginBottom: '24px', textAlign: 'center' }}>
            <p style={{ fontSize: '13px', color: 'var(--muted-foreground)', margin: '0 0 12px', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
              {cards.length} of 4 destinations ready — tap to generate the rest.
            </p>
            <button type="button" onClick={() => generateDestinations({ resume: true })} style={{ padding: '10px 20px', border: '1px solid var(--forest-deep)', background: 'var(--forest-deep)', color: '#ffffff', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
              Finish generating →
            </button>
          </div>
        )}

        {showSubmitChoices && (
          <>
            {hasGeneratedContent && canEditBrainstorm && !isViewingPrior && (
              <div style={{ marginTop: '8px', marginBottom: '20px', textAlign: 'center' }}>
                <p style={{ fontSize: '12px', color: 'var(--muted-foreground)', margin: '0 0 12px', lineHeight: 1.6, fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
                  Want a fresh set? Regenerating replaces your current options. Your previous results are saved — you can view them again afterward.
                </p>
                <button
                  type="button"
                  onClick={requestFullRegenerate}
                  disabled={generating}
                  style={{
                    padding: '12px 28px',
                    border: '1px solid var(--forest-deep)',
                    background: 'transparent',
                    color: 'var(--forest-deep)',
                    fontSize: '10px',
                    letterSpacing: '0.2em',
                    textTransform: 'uppercase',
                    cursor: generating ? 'default' : 'pointer',
                    opacity: generating ? 0.5 : 1,
                    fontFamily: 'var(--font-cormorant), Georgia, serif',
                  }}
                >
                  Regenerate options →
                </button>
              </div>
            )}
            <p style={{ fontSize: '13px', color: 'var(--muted-foreground)', textAlign: 'center', marginBottom: '8px', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
              {selectedVoteCount} of {maxVotes}{' '}
              {isMatrixPath
                ? consideringTripleVoteMode
                  ? 'three-stop routes'
                  : consideringPairingVoteMode
                    ? 'pairings'
                    : 'destinations'
                : 'cards'}{' '}
              selected
              {isMatrixPath ? (
                consideringTripleVoteMode || consideringPairingVoteMode
                  ? ' · each route is one proposal for the group'
                  : ''
              ) : (
                ` · ${cards.length} destination${cards.length === 1 ? '' : 's'} ready${cards.length < 4 ? ' — tap Finish generating above for a full set of 4' : ''}`
              )}
            </p>
            {datesBlockSubmit && !choicesSubmitted && (
              <p style={{ fontSize: '12px', color: '#a32d2d', textAlign: 'center', margin: '0 0 12px', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
                Group dates need alignment before you can submit card choices.
              </p>
            )}
            <SubmitChoicesButton
              tripId={tripId}
              selectedCount={selectedVoteCount}
              requiredCount={maxVotes}
              alreadySubmitted={choicesSubmitted}
              disabled={!canEditBrainstorm || datesBlockSubmit}
              onSuccess={() => {
                setChoicesSubmitted(true)
                router.push(`/trips/${tripId}/vote`)
              }}
            />
          </>
        )}

        {choicesSubmitted && canEditBrainstorm && (
          <div style={{ marginTop: '16px', marginBottom: '32px', textAlign: 'center' }}>
            <p style={{ fontSize: '14px', color: 'var(--forest-deep)', margin: 0, fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
              ✓ Your card choices are saved — change them anytime before the window closes.
            </p>
          </div>
        )}

        {choicesSubmitted && !canEditBrainstorm && trip?.voting_round != null && (
          <div style={{ marginTop: '16px', marginBottom: '32px', textAlign: 'center' }}>
            <p style={{ fontSize: '14px', color: 'var(--forest-deep)', margin: '0 0 12px', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
              ✓ Your card choices are final.
            </p>
            <button
              type="button"
              onClick={() => router.push(`/trips/${tripId}/vote`)}
              style={{ padding: '12px 24px', border: '1px solid var(--forest-deep)', background: 'transparent', color: 'var(--forest-deep)', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'var(--font-cormorant), Georgia, serif' }}
            >
              Go to group vote →
            </button>
          </div>
        )}

        <div ref={chatEndRef} />
    </Step2WorkspaceShell>

      {showRefreshChatConfirm && (
        <Step2ConfirmModal
          title="Refresh chat?"
          body="Are you sure? This will delete your chat history and any stored conversation data. This cannot be undone."
          confirmLabel={refreshingChat ? 'Clearing...' : 'Refresh chat'}
          loading={refreshingChat}
          onCancel={() => setShowRefreshChatConfirm(false)}
          onConfirm={refreshChat}
        />
      )}

      {showRegenerateConfirm && (
        <Step2ConfirmModal
          title={isMatrixPath ? 'Regenerate options?' : 'Regenerate trip ideas?'}
          body="This will replace your current cards with a new set and clear your selections. Your previous results will be saved — you can view them again with View previous results."
          confirmLabel={isMatrixPath ? 'Regenerate options' : 'Regenerate cards'}
          loading={generating}
          onCancel={() => setShowRegenerateConfirm(false)}
          onConfirm={() => void confirmFullRegenerate()}
        />
      )}

      {showEditConfirm && (
        <Step2ConfirmModal
          title="Edit your preferences?"
          body="Changing your inputs will clear your current cards. You'll need to regenerate to see new picks. Are you sure you want to do this?"
          confirmLabel="Edit preferences"
          onCancel={() => setShowEditConfirm(false)}
          onConfirm={() => {
            setShowEditConfirm(false)
            startEditing(1)
          }}
        />
      )}

      {showRestorePriorConfirm && (
        <Step2ConfirmModal
          title={isMatrixPath ? 'Restore previous pairings?' : 'Restore previous cards?'}
          body={`This will permanently replace your current ${isMatrixPath ? 'options' : 'cards'} with the previous set. You cannot undo this or go back to the newer results.`}
          confirmLabel={isMatrixPath ? 'Restore previous pairings' : 'Restore previous cards'}
          onCancel={() => setShowRestorePriorConfirm(false)}
          onConfirm={() => void confirmRestorePriorGeneration()}
        />
      )}

      {showChangePathConfirm && (
        <Step2ConfirmModal
          title="Choose a different path?"
          body="You’ll return to the Step 2 path picker to choose 2A, 2B, or 2C again. Your answers so far stay saved, but you may need to regenerate options after switching."
          confirmLabel={changingPath ? 'Updating…' : 'Choose again'}
          loading={changingPath}
          onCancel={() => { if (!changingPath) setShowChangePathConfirm(false) }}
          onConfirm={() => void confirmChangePlanningPath()}
        />
      )}

      {showStartOverConfirm && (
        <Step2ConfirmModal
          title="Start Step 2 completely over?"
          body="This erases everything in Step 2 for the whole group — the planning path, every traveler’s questionnaire answers, all generated destinations, and any votes cast. It cannot be undone, and everyone returns to choosing a path (2A / 2B / 2C). Once a destination is finalized, this is no longer possible."
          confirmLabel={startingOver ? 'Erasing…' : 'Yes, erase everything'}
          loading={startingOver}
          onCancel={() => { if (!startingOver) setShowStartOverConfirm(false) }}
          onConfirm={() => void confirmStartOver()}
        />
      )}

      {submitToast && (
        <div style={{ position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', background: 'var(--forest-deep)', color: '#ffffff', padding: '10px 20px', borderRadius: '24px', fontSize: '12px', letterSpacing: '0.1em', zIndex: 100, ...s }}>
          {submitToast}
        </div>
      )}
    </>
  )
}

function CollapsiblePreferences({
  collapse,
  summary,
  children,
}: {
  collapse: boolean
  summary: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const serif = { fontFamily: 'var(--font-cormorant), Georgia, serif' } as const
  if (!collapse) return <>{children}</>
  return (
    <details
      open={open}
      onToggle={e => setOpen(e.currentTarget.open)}
      style={{
        marginBottom: '28px',
        border: '1px solid #d4d4c8',
        background: '#ffffff',
      }}
    >
      <summary
        style={{
          padding: '14px 16px',
          cursor: 'pointer',
          listStyle: 'none',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '12px',
          ...serif,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <span
            style={{
              display: 'block',
              fontSize: '11px',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--forest-deep)',
              marginBottom: '4px',
            }}
          >
            Your trip preferences
          </span>
          <span
            style={{
              display: 'block',
              fontSize: '13px',
              color: 'var(--muted-foreground)',
              lineHeight: 1.5,
              fontWeight: 400,
            }}
          >
            {summary}
          </span>
        </div>
        <span
          aria-hidden
          style={{
            fontSize: '12px',
            color: 'var(--muted-foreground)',
            flexShrink: 0,
            marginTop: '2px',
            display: 'inline-block',
            lineHeight: 1,
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s ease',
          }}
        >
          ▾
        </span>
      </summary>
      <div style={{ padding: '8px 16px 16px', borderTop: '0.5px solid #e4e4d8' }}>{children}</div>
    </details>
  )
}
