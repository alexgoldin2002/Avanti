'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import ProtectedContent from './ProtectedContent'
import {
  fetchPreviewDestinationMatrix,
  MATRIX_GENERATION_TIME_HINT,
  parseMatrixProgressStatus,
} from '@/lib/fetch-destination-matrix'
import {
  savePreviewTrip,
  loadPreviewTrip,
  markPendingShare,
  TRIP_REGION_OPTIONS,
  TRIP_ACTIVITY_OPTIONS,
} from '@/lib/preview-trip-storage'
import DateRangeFields, { isValidDateRange } from './DateRangeFields'
import {
  departureCitiesToStoredString,
  parseDepartureCitiesFromStep2,
} from '@/lib/departure-cities'
import { PLANNING_PATH_OPTIONS, type DestinationPlanningPath } from '@/lib/step2/planning-path'
import { loadGoogleMapsScript, whenGooglePlacesReady } from '@/lib/google-maps-loader'
import DestinationMatrix from '@/components/voting/DestinationMatrix'
import type { ParsedDestinationCard } from '@/lib/parse-destination-cards'
import {
  buildConsideringPathCards,
  enrichMatrixChipRows,
  enrichMatrixPairings,
  type DestinationMatrixCombo,
  type DestinationMatrixRow,
} from '@/lib/parse-destination-matrix'
import type { MatrixTabId } from '@/lib/matrix-trip-shape'
import { PLACEHOLDERS } from '@/lib/form-placeholders'

type Stage = 'path' | 'known' | 1 | 2 | 3 | 'generate' | 'done'

export default function HomeTripPlanner({
  onSignupRequest,
  onSigninRequest,
}: {
  onSignupRequest: () => void
  onSigninRequest: () => void
}) {
  const [stage, setStage] = useState<Stage>('path')
  const [planningPath, setPlanningPath] = useState<DestinationPlanningPath | null>(null)
  const [q1, setQ1] = useState('')
  const [departureCityInput, setDepartureCityInput] = useState('')
  const [departureCities, setDepartureCities] = useState<string[]>([])
  const [dates, setDates] = useState('')
  const [fixedDates, setFixedDates] = useState({ start: '', end: '' })
  const [flexLength, setFlexLength] = useState('')
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
  const [q3, setQ3] = useState('')
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [generateStatus, setGenerateStatus] = useState<string | null>(null)
  const [cards, setCards] = useState<ParsedDestinationCard[]>([])
  const [consideringList, setConsideringList] = useState<string[]>([])
  const [consideringInput, setConsideringInput] = useState('')
  const [matrixRows, setMatrixRows] = useState<DestinationMatrixRow[]>([])
  const [matrixPairings, setMatrixPairings] = useState<DestinationMatrixCombo[]>([])
  const [matrixTriples, setMatrixTriples] = useState<DestinationMatrixCombo[]>([])
  const [matrixSummary, setMatrixSummary] = useState('')
  const [matrixRecommendedTab, setMatrixRecommendedTab] = useState<MatrixTabId | null>(null)
  const [matrixRecommendedShape, setMatrixRecommendedShape] = useState('')
  const [knownPlaces, setKnownPlaces] = useState<string[]>([])
  const [knownSearch, setKnownSearch] = useState('')
  const previewResultsRef = useRef<HTMLDivElement>(null)
  const [authPromptOpen, setAuthPromptOpen] = useState(false)

  const isConsideringPath = planningPath === 'considering'
  const isKnownPath = planningPath === 'known'

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

  useEffect(() => {
    const saved = loadPreviewTrip()
    if (saved.meta?.planningPath) {
      setPlanningPath(saved.meta.planningPath)
    }
    if (saved.meta?.knownDestination) {
      setKnownPlaces([saved.meta.knownDestination])
    }
    if (saved.meta?.consideringList) setConsideringList(saved.meta.consideringList)
    if (saved.answers) {
      const a = saved.answers
      if (a.q1) setQ1(String(a.q1))
      if (a.departureCity || a.departureCities) {
        setDepartureCities(parseDepartureCitiesFromStep2(a as Record<string, unknown>))
      }
      if (a.dates) {
        if (a.dates !== 'Completely flexible') setDates(String(a.dates))
      }
      if (a.fixedDates) setFixedDates(a.fixedDates as { start: string; end: string })
      if (a.flexLength) setFlexLength(String(a.flexLength))
      if (a.domestic) setDomestic(String(a.domestic))
      if (Array.isArray(a.regions)) setRegions(a.regions as string[])
      if (a.stops) setStops(String(a.stops))
      if (a.stopsOther) setStopsOther(String(a.stopsOther))
      if (Array.isArray(a.activities)) setActivities(a.activities as string[])
      if (Array.isArray(a.vibe)) setVibe(a.vibe as string[])
      if (a.vibeOther) setVibeOther(String(a.vibeOther))
      if (a.accommodation) setAccommodation(String(a.accommodation))
      if (a.budget) setBudget(String(a.budget))
      if (a.budgetOther) setBudgetOther(String(a.budgetOther))
      if (a.popularity) setPopularity(String(a.popularity))
      if (a.q3) setQ3(String(a.q3))
    }
    if (saved.meta?.matrixRows?.length) {
      setMatrixRows(saved.meta.matrixRows)
      setMatrixPairings(saved.meta.matrixPairings ?? [])
      setMatrixTriples(saved.meta.matrixTriples ?? [])
      setMatrixSummary(saved.meta.matrixSummary ?? '')
      setMatrixRecommendedTab(saved.meta.matrixRecommendedTab ?? null)
      setMatrixRecommendedShape(saved.meta.matrixRecommendedShape ?? '')
      setCards(
        Array.isArray(saved.cards) && saved.cards.length > 0
          ? (saved.cards as ParsedDestinationCard[])
          : buildConsideringPathCards(
              saved.meta.matrixRows,
              saved.meta.matrixPairings ?? [],
              saved.meta.matrixTriples ?? [],
            ),
      )
      setStage('done')
    } else if (saved.meta?.planningPath === 'known' && saved.meta?.knownDestination && saved.answers?.q1) {
      setStage('done')
    } else if (saved.answers?.q1 && saved.meta?.planningPath) {
      setStage(1)
    }
  }, [])

  useEffect(() => {
    loadGoogleMapsScript()
  }, [])

  const showQ2 = planningPath && ((typeof stage === 'number' && stage >= 2) || stage === 'generate' || stage === 'done')

  useEffect(() => {
    if (stage !== 'known' && !showQ2) return
    const initAutocomplete = (inputId: string, onPick: (name: string) => void) => {
      const input = document.getElementById(inputId) as HTMLInputElement
      if (!input) return
      const g = (window as Window & { google?: { maps?: { places?: { Autocomplete: new (el: HTMLInputElement, opts: object) => { addListener: (ev: string, fn: () => void) => void; getPlace: () => { formatted_address?: string; name?: string; place_id?: string } } } } } }).google
      if (!g?.maps?.places) return
      const autocomplete = new g.maps.places.Autocomplete(input, {
        types: ['(cities)'],
        fields: ['formatted_address', 'name', 'place_id'],
      })
      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace()
        if (!place?.place_id) return
        const name = place.formatted_address || place.name || ''
        if (name) onPick(name)
      })
    }
    const tryInit = () => {
      initAutocomplete('home-departure-city-input', name => {
        setDepartureCities(prev => (prev.includes(name) ? prev : [...prev, name]))
        setDepartureCityInput('')
      })
      if (isConsideringPath) {
        initAutocomplete('home-considering-place-input', name => {
          setConsideringList(prev => (prev.includes(name) ? prev : [...prev, name]))
          setConsideringInput('')
        })
      }
      if (isKnownPath) {
        initAutocomplete('home-known-destination-input', name => {
          setKnownPlaces(prev => (prev.includes(name) ? prev : [...prev, name]))
          setKnownSearch('')
        })
      }
    }
    whenGooglePlacesReady().then(() => tryInit())
  }, [showQ2, stage, isConsideringPath, isKnownPath])

  const isKnownSetupComplete = () => {
    if (knownPlaces.length === 0) return false
    if (!dates) return false
    if ((dates === 'Fixed dates' || dates === 'Flexible — I have a range') && !isValidDateRange(fixedDates.start, fixedDates.end)) return false
    if (dates === 'Flexible — I have a range' && !flexLength) return false
    return true
  }

  const isQ2Complete = () => {
    if (isKnownPath) {
      if (departureCities.length === 0) return false
      if (activities.length === 0) return false
      if (vibe.length === 0) return false
      if (vibe.includes('Other') && !vibeOther.trim()) return false
      if (!accommodation) return false
      if (!budget) return false
      if (budget === 'Other' && !budgetOther.trim()) return false
      return true
    }
    if (isConsideringPath && consideringList.length < 2) return false
    if (departureCities.length === 0) return false
    if (!dates) return false
    if ((dates === 'Fixed dates' || dates === 'Flexible — I have a range') && !isValidDateRange(fixedDates.start, fixedDates.end)) return false
    if (dates === 'Flexible — I have a range' && !flexLength) return false
    if (!domestic) return false
    if (domestic === 'International' && regions.length === 0) return false
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
  const showQ3 = stage === 'generate' || stage === 'done' || (typeof stage === 'number' && stage >= 3 && q2Valid)

  const toggleMulti = (arr: string[], val: string, setter: (a: string[]) => void) => {
    setter(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val])
  }

  const buildMetaPayload = (): import('@/lib/preview-trip-storage').PreviewTripMeta => ({
    planningPath: planningPath!,
    consideringList: isConsideringPath ? consideringList : [],
    knownDestination: isKnownPath ? knownPlaces[0] : undefined,
    knownDates: isKnownPath
      ? { mode: dates, fixedDates, flexLength }
      : undefined,
    matrixRows,
    matrixPairings,
    matrixTriples,
    matrixSummary,
    matrixRecommendedTab,
    matrixRecommendedShape,
  })

  const handleShare = () => {
    if (!planningPath) return
    const answers = buildAnswersPayload()
    savePreviewTrip(answers, cards, buildMetaPayload())
    markPendingShare()
  }

  const finishKnownPreview = () => {
    if (!planningPath || !isKnownPath) return
    const answers = buildAnswersPayload()
    savePreviewTrip(answers, [], buildMetaPayload())
    setStage('done')
  }

  const requestSignup = () => {
    handleShare()
    onSignupRequest()
  }

  const requestSignin = () => {
    handleShare()
    onSigninRequest()
  }

  const openAuthPrompt = () => {
    handleShare()
    setAuthPromptOpen(true)
  }

  const closeAuthPrompt = () => {
    setAuthPromptOpen(false)
  }

  const authPromptSignup = () => {
    setAuthPromptOpen(false)
    onSignupRequest()
  }

  const authPromptSignin = () => {
    setAuthPromptOpen(false)
    onSigninRequest()
  }

  const buildAnswersPayload = () => ({
    q1,
    tripLabel: q1.slice(0, 80) || 'Group trip',
    departureCities,
    departureCity: departureCitiesToStoredString(departureCities),
    dates,
    fixedDates,
    flexLength,
    domestic,
    regions,
    stops: stops === 'Other' ? stopsOther : stops,
    stopsOther,
    activities,
    vibe: vibe.includes('Other') ? [...vibe.filter(v => v !== 'Other'), vibeOther] : vibe,
    vibeOther,
    accommodation,
    budget: budget === 'Other' ? budgetOther : budget,
    budgetOther,
    popularity,
    q3,
  })

  const generateDestinations = async () => {
    if (!planningPath) return
    setGenerating(true)
    setGenerateError(null)
    setCards([])
    setMatrixRows([])
    setMatrixPairings([])
    setMatrixTriples([])
    const answers = buildAnswersPayload()

    try {
      const result = await fetchPreviewDestinationMatrix({
        planningPath,
        answers,
        consideringList: isConsideringPath ? consideringList : [],
        mode: isConsideringPath ? 'considering' : 'brainstorm',
        onStatus: setGenerateStatus,
      })

      enrichMatrixChipRows(result.matrix)
      enrichMatrixPairings(result.pairings)
      enrichMatrixChipRows(result.triples)

      const parsed = buildConsideringPathCards(result.matrix, result.pairings, result.triples)
      setMatrixRows(result.matrix)
      setMatrixPairings(result.pairings)
      setMatrixTriples(result.triples)
      setMatrixSummary(result.summary)
      setMatrixRecommendedTab(result.recommendedTab)
      setMatrixRecommendedShape(result.recommendedShape)
      setCards(parsed)
      setStage('done')
      savePreviewTrip(answers, parsed, {
        planningPath: planningPath!,
        consideringList: isConsideringPath ? consideringList : [],
        knownDestination: isKnownPath ? knownPlaces[0] : undefined,
        knownDates: isKnownPath
          ? { mode: dates, fixedDates, flexLength }
          : undefined,
        matrixRows: result.matrix,
        matrixPairings: result.pairings,
        matrixTriples: result.triples,
        matrixSummary: result.summary,
        matrixRecommendedTab: result.recommendedTab,
        matrixRecommendedShape: result.recommendedShape,
      })
      requestAnimationFrame(() => {
        previewResultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Something went wrong generating trip ideas'
      setGenerateError(
        message.includes('timed out') || message.includes('504')
          ? `${message} Generation can take 2–3 minutes — please wait a moment and try again.`
          : message,
      )
    } finally {
      setGenerating(false)
      setGenerateStatus(null)
    }
  }

  const nextBtn = (onClick: () => void, disabled: boolean, label = 'Next →') => (
    <button
      type="button"
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

  const avatarStyle = { width: '40px', height: '40px', borderRadius: '50%', background: 'var(--forest-deep)', flexShrink: 0 } as const
  const questionTextStyle = { fontSize: '16px', color: 'var(--foreground)', lineHeight: 1.7, margin: 0, ...s }
  const underlineInputStyle = { width: '100%', border: 'none', borderBottom: '1px solid #d4d4c8', background: 'transparent', padding: '8px 0', fontSize: '15px', color: 'var(--foreground)', outline: 'none', resize: 'none' as const, lineHeight: 1.6, ...s }

  const AvantiQuestion = ({ children }: { children: React.ReactNode }) => (
    <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', marginBottom: '20px' }}>
      <div style={avatarStyle} />
      <p style={questionTextStyle}>{children}</p>
    </div>
  )

  const UserBubble = ({ children }: { children: React.ReactNode }) => (
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '28px' }}>
      <div style={{ maxWidth: '80%', background: 'var(--forest-deep)', color: '#fff', borderRadius: '0', padding: '12px 16px', fontSize: '14px', lineHeight: 1.6, whiteSpace: 'pre-wrap', ...s }}>
        {children}
      </div>
    </div>
  )

  return (
    <div className="bg-cream text-forest-deep py-16 md:py-24 px-6" style={s}>
      <div className={`mx-auto px-0 ${stage === 'done' ? 'max-w-6xl' : 'max-w-2xl'}`}>
        <div className="text-center mb-12">
          <p className="eyebrow text-muted-foreground mb-3">Try it free</p>
          <h2 className="font-serif text-3xl md:text-4xl text-forest-deep italic leading-tight">
            Tell us about your trip
          </h2>
          <p className="mt-4 text-muted-foreground text-base leading-relaxed max-w-md mx-auto">
            No account needed to preview options. Create an account to save your picks, invite your group, and start voting together.
          </p>
        </div>

        {stage === 'path' && (
          <>
            <AvantiQuestion>What stage best describes your group right now?</AvantiQuestion>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px', paddingLeft: '54px' }}>
              {PLANNING_PATH_OPTIONS.map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setPlanningPath(opt.id)}
                  style={{
                    padding: '14px 18px',
                    cursor: 'pointer',
                    border: `1px solid ${planningPath === opt.id ? 'var(--forest-deep)' : '#d4d4c8'}`,
                    background: planningPath === opt.id ? '#e8f5ee' : '#fff',
                    color: planningPath === opt.id ? 'var(--forest-deep)' : '#6a6a6a',
                    textAlign: 'left',
                    ...s,
                  }}
                >
                  <span style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted-foreground)', display: 'block', marginBottom: '4px' }}>
                    Step {opt.stepLabel}
                  </span>
                  <span style={{ display: 'block', fontSize: '16px', color: 'var(--foreground)', marginBottom: '4px' }}>{opt.title}</span>
                  <span style={{ display: 'block', fontSize: '13px', color: 'var(--muted-foreground)', lineHeight: 1.5 }}>{opt.description}</span>
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingLeft: '54px' }}>
              {nextBtn(() => setStage(1), !planningPath)}
            </div>
          </>
        )}

        {(stage === 1) && (
          <>
            <AvantiQuestion>
              Tell us about this trip. Who is going? What kind of trip are you looking for? Any idea where? What&apos;s the reason for the trip?
            </AvantiQuestion>
            <div style={{ paddingLeft: '56px', marginTop: '16px' }}>
              <textarea
                value={q1}
                onChange={e => setQ1(e.target.value)}
                placeholder={PLACEHOLDERS.tripDescription}
                rows={4}
                style={{ ...underlineInputStyle, width: '100%' }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                {nextBtn(() => setStage(isKnownPath ? 'known' : 2), !q1.trim())}
              </div>
            </div>
          </>
        )}

        {stage === 'known' && (
          <>
            <AvantiQuestion>Where are you going, and when?</AvantiQuestion>
            <div style={{ paddingLeft: '54px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div>
                <span style={sectionLabel}>Destination</span>
                <p style={{ fontSize: '12px', color: 'var(--muted-foreground)', margin: '0 0 10px', ...s }}>
                  Pick from the Google dropdown.
                </p>
                {knownPlaces.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                    {knownPlaces.map((place, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: '#e8f5ee', border: '1px solid #2d6a4f', borderRadius: '20px' }}>
                        <span style={{ fontSize: '13px', color: 'var(--forest-deep)', ...s }}>{place}</span>
                        <button type="button" onClick={() => setKnownPlaces(knownPlaces.filter((_, idx) => idx !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2d6a4f', fontSize: '14px', padding: 0 }}>×</button>
                      </div>
                    ))}
                  </div>
                )}
                <input
                  id="home-known-destination-input"
                  type="text"
                  value={knownSearch}
                  onChange={e => setKnownSearch(e.target.value)}
                  placeholder={PLACEHOLDERS.destination}
                  style={inputStyle}
                />
              </div>
              <div>
                <span style={sectionLabel}>What are your dates?</span>
                <p style={{ fontSize: '12px', color: 'var(--muted-foreground)', margin: '0 0 10px', lineHeight: 1.5, ...s }}>
                  Pick a range — it can be wide, but we need start and end dates.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                  {['Fixed dates', 'Flexible — I have a range'].map(opt => (
                    <button key={opt} type="button" onClick={() => setDates(opt)} style={chipStyle(dates === opt)}>{opt}</button>
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
                      <span style={labelStyle}>Preferred trip length</span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                        {['3–4 nights', '5–7 nights', '8–10 nights', '11–14 nights', '2+ weeks'].map(opt => (
                          <button key={opt} type="button" onClick={() => setFlexLength(opt)} style={chipStyle(flexLength === opt)}>{opt}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                {nextBtn(() => setStage(2), !isKnownSetupComplete())}
              </div>
            </div>
          </>
        )}

        {stage !== 1 && stage !== 'path' && stage !== 'known' && (
          <div style={{ marginBottom: '32px' }}>
            <AvantiQuestion>
              Tell us about this trip. Who is going? What kind of trip are you looking for? Any idea where? What&apos;s the reason for the trip?
            </AvantiQuestion>
            <UserBubble>{q1}</UserBubble>
            {stage !== 'done' && stage !== 'generate' && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '-16px', marginBottom: '24px' }}>
                <button type="button" onClick={() => setStage(1)} style={{ fontSize: '11px', color: 'var(--muted-foreground)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', ...s }}>
                  Edit
                </button>
              </div>
            )}
          </div>
        )}

        {showQ2 && stage !== 'done' && (
          <>
            <AvantiQuestion>A few more details — tap to answer each one.</AvantiQuestion>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', marginBottom: showQ3 ? '32px' : '0', paddingLeft: '54px' }}>
              {isConsideringPath && (
                <div>
                  <span style={sectionLabel}>Places you are considering</span>
                  <p style={{ fontSize: '12px', color: 'var(--muted-foreground)', margin: '0 0 10px', lineHeight: 1.5, ...s }}>
                    Add at least 2 destinations — pick from Google suggestions.
                  </p>
                  {consideringList.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                      {consideringList.map((place, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: '#e8f5ee', border: '1px solid #2d6a4f', borderRadius: '20px' }}>
                          <span style={{ fontSize: '13px', color: 'var(--forest-deep)', ...s }}>{place}</span>
                          <button type="button" onClick={() => setConsideringList(consideringList.filter((_, idx) => idx !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2d6a4f', fontSize: '14px', lineHeight: 1, padding: '0 0 0 2px' }}>×</button>
                        </div>
                      ))}
                    </div>
                  )}
                  <input
                    id="home-considering-place-input"
                    type="text"
                    autoComplete="off"
                    style={{ flex: 1, width: '100%', borderBottom: '1px solid #d4d4c8', background: 'transparent', padding: '8px 0', fontSize: '14px', color: 'var(--foreground)', outline: 'none', ...s }}
                    value={consideringInput}
                    onChange={e => setConsideringInput(e.target.value)}
                    placeholder="e.g. Tokyo, Japan"
                  />
                </div>
              )}
              {isConsideringPath && <div style={{ borderTop: '0.5px solid #e4e4d8' }} />}
              <div>
                <span style={sectionLabel}>Where are you flying from?</span>
                <p style={{ fontSize: '12px', color: 'var(--muted-foreground)', margin: '0 0 10px', lineHeight: 1.5, ...s }}>
                  Start typing a city and pick from the Google suggestions — each departure city is verified before it&apos;s added.
                </p>
                {departureCities.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                    {departureCities.map((city, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: '#e8f5ee', border: '1px solid #2d6a4f', borderRadius: '20px' }}>
                        <span style={{ fontSize: '13px', color: 'var(--forest-deep)', ...s }}>{city}</span>
                        <button type="button" onClick={() => setDepartureCities(departureCities.filter((_, idx) => idx !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2d6a4f', fontSize: '14px', lineHeight: 1, padding: '0 0 0 2px' }}>×</button>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input
                    id="home-departure-city-input"
                    type="text"
                    autoComplete="off"
                    style={{ flex: 1, borderBottom: '1px solid #d4d4c8', borderTop: 'none', borderLeft: 'none', borderRight: 'none', background: 'transparent', padding: '8px 0', fontSize: '14px', color: 'var(--foreground)', outline: 'none', ...s }}
                    value={departureCityInput}
                    onChange={e => setDepartureCityInput(e.target.value)}
                    placeholder="Type a city..."
                  />
                </div>
              </div>
              <div style={{ borderTop: '0.5px solid #e4e4d8' }} />

              {!isKnownPath && (
                <>
                  <div>
                    <span style={sectionLabel}>What are your dates?</span>
                <p style={{ fontSize: '12px', color: 'var(--muted-foreground)', margin: '0 0 10px', lineHeight: 1.5, ...s }}>
                  Pick a range — it can be wide, but we need start and end dates.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                  {['Fixed dates', 'Flexible — I have a range'].map(opt => (
                    <button key={opt} type="button" onClick={() => setDates(opt)} style={chipStyle(dates === opt)}>{opt}</button>
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
                          <button key={opt} type="button" onClick={() => setFlexLength(opt)} style={chipStyle(flexLength === opt)}>{opt}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div style={{ borderTop: '0.5px solid #e4e4d8' }} />

              <div>
                <span style={sectionLabel}>Domestic or international?</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                  {['Domestic only', 'International', 'No preference'].map(opt => (
                    <button key={opt} type="button" onClick={() => setDomestic(opt)} style={chipStyle(domestic === opt)}>{opt}</button>
                  ))}
                </div>
                {domestic === 'International' && (
                  <div>
                    <label style={{ ...labelStyle, marginTop: '8px' }}>Regions you&apos;d consider</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {TRIP_REGION_OPTIONS.map(r => (
                        <button key={r} type="button" onClick={() => toggleMulti(regions, r, setRegions)} style={chipStyle(regions.includes(r))}>{r}</button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div style={{ borderTop: '0.5px solid #e4e4d8' }} />

              <div>
                <span style={sectionLabel}>How many places?</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {['Just one', '2 stops', '3 stops', 'Open to anything', 'Other'].map(opt => (
                    <button key={opt} type="button" onClick={() => setStops(opt)} style={chipStyle(stops === opt)}>{opt}</button>
                  ))}
                </div>
                {stops === 'Other' && <input style={{ ...inputStyle, marginTop: '8px' }} value={stopsOther} onChange={e => setStopsOther(e.target.value)} placeholder="Tell us more..." />}
              </div>
              <div style={{ borderTop: '0.5px solid #e4e4d8' }} />
                </>
              )}

              <div>
                <span style={sectionLabel}>What kind of activities?</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {TRIP_ACTIVITY_OPTIONS.map(opt => (
                    <button key={opt} type="button" onClick={() => toggleMulti(activities, opt, setActivities)} style={chipStyle(activities.includes(opt))}>{opt}</button>
                  ))}
                </div>
              </div>
              <div style={{ borderTop: '0.5px solid #e4e4d8' }} />

              <div>
                <span style={sectionLabel}>What&apos;s the vibe?</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                  {['Luxury', 'Budget-conscious', 'Party', 'Romantic', 'Family-friendly', 'Cultural immersion', 'Off the beaten path', 'Touristy & easy', 'Relaxed & slow', 'Action-packed', 'Other'].map(opt => (
                    <button key={opt} type="button" onClick={() => toggleMulti(vibe, opt, setVibe)} style={chipStyle(vibe.includes(opt))}>{opt}</button>
                  ))}
                </div>
                {vibe.includes('Other') && <input style={{ ...inputStyle, marginTop: '8px' }} value={vibeOther} onChange={e => setVibeOther(e.target.value)} placeholder="Describe the vibe..." />}
              </div>
              <div style={{ borderTop: '0.5px solid #e4e4d8' }} />

              <div>
                <span style={sectionLabel}>Hotel or Airbnb?</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {['Hotel', 'Airbnb / villa', 'Resort', 'Boutique / guesthouse', 'No preference'].map(opt => (
                    <button key={opt} type="button" onClick={() => setAccommodation(opt)} style={chipStyle(accommodation === opt)}>{opt}</button>
                  ))}
                </div>
              </div>
              <div style={{ borderTop: '0.5px solid #e4e4d8' }} />

              <div>
                <span style={sectionLabel}>Trip budget per person?</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                  {['Under $1,000', '$1,000–2,000', '$2,000–4,000', '$4,000–7,000', '$7,000+', 'Other'].map(opt => (
                    <button key={opt} type="button" onClick={() => setBudget(opt)} style={chipStyle(budget === opt)}>{opt}</button>
                  ))}
                </div>
                {budget === 'Other' && <input style={{ ...inputStyle, marginTop: '8px' }} value={budgetOther} onChange={e => setBudgetOther(e.target.value)} placeholder="Describe your budget..." />}
              </div>
              <div style={{ borderTop: '0.5px solid #e4e4d8' }} />

              {!isConsideringPath && !isKnownPath && (
                <div>
                  <span style={sectionLabel}>How popular should the destination be?</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {['Well known & easy', 'A mix of both', 'Off the beaten path', 'Surprise us'].map(opt => (
                      <button key={opt} type="button" onClick={() => setPopularity(opt)} style={chipStyle(popularity === opt)}>{opt}</button>
                    ))}
                  </div>
                </div>
              )}

              {stage === 2 && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '8px' }}>
                  {nextBtn(() => setStage(3), !q2Valid)}
                </div>
              )}
            </div>
          </>
        )}

        {showQ3 && stage !== 'done' && (
          <>
            <AvantiQuestion>What don&apos;t you want? Any deal breakers? Anything else Avanti should know?</AvantiQuestion>
            {stage === 3 || stage === 'generate' ? (
              <div style={{ marginBottom: '32px', paddingLeft: '54px' }}>
                <textarea
                  value={q3}
                  onChange={e => setQ3(e.target.value)}
                  placeholder="No cold weather. Don't want anywhere too touristy..."
                  rows={3}
                  style={underlineInputStyle}
                />
                {stage === 3 && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                    {nextBtn(
                      () => {
                        if (isKnownPath) {
                          finishKnownPreview()
                        } else {
                          setStage('generate')
                          void generateDestinations()
                        }
                      },
                      !q3Valid,
                      isKnownPath ? 'Save preview →' : 'Generate options →',
                    )}
                  </div>
                )}
              </div>
            ) : q3.trim() ? (
              <UserBubble>{q3}</UserBubble>
            ) : null}
          </>
        )}

        {generating && (() => {
          const { percent, label } = parseMatrixProgressStatus(generateStatus)
          return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 0', gap: '16px' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#2d6a4f" strokeWidth="1.5" strokeLinecap="round">
              <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" style={{ animation: 'spin 1.5s linear infinite', transformOrigin: 'center' }} />
            </svg>
            <p style={{ fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#2d6a4f', ...s }}>Avanti is thinking...</p>
            <p style={{ fontSize: '28px', color: 'var(--forest-deep)', textAlign: 'center', margin: 0, ...s }}>
              {percent != null ? `${percent}% done` : 'Starting…'}
            </p>
            <p style={{ fontSize: '15px', color: 'var(--foreground)', textAlign: 'center', maxWidth: '320px', lineHeight: 1.6, ...s }}>
              {label}
            </p>
            <p style={{ fontSize: '13px', color: 'var(--muted-foreground)', textAlign: 'center', maxWidth: '280px', lineHeight: 1.6, ...s }}>
              {MATRIX_GENERATION_TIME_HINT}
            </p>
          </div>
          )
        })()}

        {!generating && generateError && (
          <div style={{ marginTop: '32px', padding: '20px 24px', border: '1px solid #c0392b', background: '#fdf2f2', textAlign: 'center' }}>
            <p style={{ fontSize: '14px', color: '#c0392b', margin: '0 0 16px', lineHeight: 1.6, ...s }}>{generateError}</p>
            <button type="button" onClick={() => generateDestinations()} style={{ padding: '12px 28px', border: '1px solid var(--forest-deep)', background: 'var(--forest-deep)', color: '#ffffff', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', cursor: 'pointer', ...s }}>
              Try again →
            </button>
          </div>
        )}

        {!generating && isKnownPath && stage === 'done' && knownPlaces.length > 0 && (
          <div className="text-center border border-forest-deep/20 bg-ivory p-8 md:p-10 mt-8">
            <p className="eyebrow text-muted-foreground mb-2">Your preview</p>
            <h3 className="font-serif text-2xl text-forest-deep italic mb-3">
              {knownPlaces[0]}
            </h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto leading-relaxed">
              Your preferences are saved. Create an account to start your trip, invite your group, and continue planning.
            </p>
            <button type="button" onClick={requestSignup} className="bg-forest-deep text-cream eyebrow px-10 py-4 hover:bg-forest-deep/90 transition">
              Create account &amp; start trip →
            </button>
            <button type="button" onClick={requestSignin} className="mt-4 block w-full eyebrow text-muted-foreground hover:text-forest-deep transition">
              Already have an account? Sign in
            </button>
          </div>
        )}

        {!generating && matrixRows.length > 0 && (
          <div ref={previewResultsRef}>
            <div className="mt-10 mb-8 text-center">
              <p className="eyebrow text-muted-foreground mb-2">Your preview</p>
              <h3 className="font-serif text-2xl text-forest-deep italic">
                {isConsideringPath ? 'Your comparison matrix' : 'Destination options for your group'}
              </h3>
              {matrixSummary && (
                <p className="mt-3 text-sm text-foreground max-w-lg mx-auto leading-relaxed">{matrixSummary}</p>
              )}
              <p className="mt-3 text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
                Voting and inviting your group requires an account — nothing is shared until you sign in.
              </p>
            </div>
            <ProtectedContent className="mb-8">
              <DestinationMatrix
                rows={matrixRows}
                pairings={matrixPairings}
                triples={matrixTriples}
                summary={matrixSummary}
                recommendedTab={matrixRecommendedTab}
                recommendedShape={matrixRecommendedShape}
                tripShapeAnswers={{
                  stops: stops === 'Other' ? stopsOther : stops,
                  stopsOther,
                  flexLength,
                  fixedDates,
                  dates,
                }}
                selected={{}}
                maxVotes={2}
                onToggleSingle={openAuthPrompt}
                onTogglePairing={openAuthPrompt}
                onToggleTriple={openAuthPrompt}
                previewGated
                onPreviewGate={openAuthPrompt}
              />
            </ProtectedContent>
            <div className="text-center border border-forest-deep/20 bg-ivory p-8 md:p-10">
              <p className="font-serif text-xl text-forest-deep mb-3 italic">Ready to share with your group?</p>
              <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto leading-relaxed">
                Create an account to save these options, invite travel mates, and unlock group voting. You can&apos;t vote or invite anyone until you&apos;re signed in.
              </p>
              <button
                type="button"
                onClick={requestSignup}
                className="bg-forest-deep text-cream eyebrow px-10 py-4 hover:bg-forest-deep/90 transition"
              >
                Share with friends →
              </button>
              <button
                type="button"
                onClick={requestSignin}
                className="mt-4 block w-full eyebrow text-muted-foreground hover:text-forest-deep transition"
              >
                Already have an account? Sign in
              </button>
              <Link href="/" className="mt-6 inline-block eyebrow text-muted-foreground/70 hover:text-forest-deep transition">
                ← Back to home
              </Link>
            </div>
          </div>
        )}
      </div>

      {authPromptOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-forest-deep/75 backdrop-blur-sm p-6"
          onClick={closeAuthPrompt}
        >
          <div
            className="relative w-full max-w-md bg-cream p-8 md:p-10 shadow-2xl border border-forest-deep/10"
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="preview-auth-title"
          >
            <button
              type="button"
              onClick={closeAuthPrompt}
              aria-label="Close"
              className="absolute top-4 right-4 text-muted-foreground hover:text-forest-deep transition text-xl leading-none"
            >
              ×
            </button>
            <div className="text-center mb-6">
              <p className="font-serif tracking-[0.45em] text-forest-deep text-lg">AVANTI</p>
              <h3 id="preview-auth-title" className="font-serif text-2xl text-forest-deep italic mt-4 mb-3">
                Save your picks &amp; invite your group
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">
                Create a free account to select destinations, see full breakdowns, and start voting with your travel mates.
              </p>
            </div>
            <button
              type="button"
              onClick={authPromptSignup}
              className="w-full bg-forest-deep text-cream eyebrow py-4 hover:bg-forest-deep/90 transition"
            >
              Create account →
            </button>
            <button
              type="button"
              onClick={authPromptSignin}
              className="mt-4 w-full eyebrow text-muted-foreground hover:text-forest-deep transition"
            >
              Already have an account? Sign in
            </button>
            <button
              type="button"
              onClick={closeAuthPrompt}
              className="mt-6 w-full text-sm text-muted-foreground hover:text-forest-deep transition"
              style={s}
            >
              Keep browsing preview
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
