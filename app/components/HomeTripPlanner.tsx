'use client'

import { useState, useEffect } from 'react'
import DestinationCard from './DestinationCard'
import ProtectedContent from './ProtectedContent'
import { fetchPreviewDestinationCards } from '@/lib/fetch-destination-batches'
import { savePreviewTrip, loadPreviewTrip, markPendingShare } from '@/lib/preview-trip-storage'
import DateRangeFields, { isValidDateRange } from './DateRangeFields'

type Stage = 1 | 2 | 3 | 'generate' | 'done'

export default function HomeTripPlanner({ onSignupRequest, onSigninRequest }: { onSignupRequest: () => void; onSigninRequest: () => void }) {
  const [stage, setStage] = useState<Stage>(1)
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
    if (saved.answers) {
      const a = saved.answers
      if (a.q1) setQ1(String(a.q1))
      if (a.departureCity) setDepartureCities(String(a.departureCity).split(',').map(c => c.trim()).filter(Boolean))
      if (a.dates) {
        if (a.dates === 'Completely flexible') setDates('')
        else setDates(String(a.dates))
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
    if (saved.cards && Array.isArray(saved.cards) && saved.cards.length > 0) {
      setCards(saved.cards as ParsedDestinationCard[])
      setStage('done')
    }
  }, [])

  useEffect(() => {
    if ((window as Window & { google?: { maps?: { places?: unknown } } }).google?.maps?.places) return
    if (document.getElementById('google-maps-script')) return
    const script = document.createElement('script')
    script.id = 'google-maps-script'
    script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_PLACES_KEY}&libraries=places`
    script.async = true
    document.head.appendChild(script)
  }, [])

  useEffect(() => {
    if (stage < 2) return
    const tryInit = () => {
      const input = document.getElementById('home-departure-city-input') as HTMLInputElement
      if (!input) return
      const g = (window as Window & { google?: { maps?: { places?: { Autocomplete: new (el: HTMLInputElement, opts: object) => { addListener: (ev: string, fn: () => void) => void; getPlace: () => { formatted_address?: string; name?: string } } } } } }).google
      if (!g?.maps?.places) return
      const autocomplete = new g.maps.places.Autocomplete(input, { types: ['(cities)'] })
      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace()
        const name = place?.formatted_address || place?.name || ''
        if (name) {
          setDepartureCities(prev => [...prev, name])
          setDepartureCityInput('')
        }
      })
    }
    tryInit()
    const timer = setTimeout(tryInit, 1000)
    return () => clearTimeout(timer)
  }, [stage])

  const isQ2Complete = () => {
    if (departureCities.length === 0) return false
    if (!dates || dates === 'Completely flexible') return false
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
    if (!popularity) return false
    return true
  }

  const q2Valid = isQ2Complete()
  const showQ2 = (typeof stage === 'number' && stage >= 2) || stage === 'generate' || stage === 'done'
  const showQ3 = stage === 'generate' || stage === 'done' || (typeof stage === 'number' && stage >= 3 && q2Valid)

  const toggleMulti = (arr: string[], val: string, setter: (a: string[]) => void) => {
    setter(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val])
  }

  const handleShare = () => {
    if (q1.trim() || cards.length > 0) {
      savePreviewTrip(buildAnswersPayload(), cards)
      markPendingShare()
    }
  }

  const requestSignup = () => {
    handleShare()
    onSignupRequest()
  }

  const requestSignin = () => {
    handleShare()
    onSigninRequest()
  }

  const buildAnswersPayload = () => ({
    q1,
    tripLabel: q1.slice(0, 80) || 'Group trip',
    departureCity: departureCities.join(', '),
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
    setGenerating(true)
    setGenerateError(null)
    setCards([])
    const answers = buildAnswersPayload()

    try {
      const parsed = await fetchPreviewDestinationCards(answers, {
        preview: true,
        onStatus: setGenerateStatus,
        onPartialCards: partial => {
          setCards(partial)
          if (partial.length > 0) setStage('done')
        },
      })
      setCards(parsed)
      setStage('done')
      savePreviewTrip(answers, parsed)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Something went wrong generating trip ideas'
      setGenerateError(message)
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
        color: disabled ? '#d4d4c8' : '#fafaf8',
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
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-12">
          <p className="eyebrow text-muted-foreground mb-3">Try it free</p>
          <h2 className="font-serif text-3xl md:text-4xl text-forest-deep italic leading-tight">
            Tell us about your trip
          </h2>
          <p className="mt-4 text-muted-foreground text-base leading-relaxed max-w-md mx-auto">
            No account needed to preview your picks. Sign in to share them with your group and start planning together.
          </p>
        </div>

        {(stage === 1) && (
          <>
            <AvantiQuestion>
              Tell us about this trip. Who is going? What kind of trip are you looking for? Any idea where? What&apos;s the reason for the trip?
            </AvantiQuestion>
            <div style={{ paddingLeft: '56px', marginTop: '16px' }}>
              <textarea
                value={q1}
                onChange={e => setQ1(e.target.value)}
                placeholder="e.g. 8 college friends, graduation trip, beaches and nightlife somewhere in Europe"
                rows={4}
                style={{ ...underlineInputStyle, width: '100%' }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                {nextBtn(() => setStage(2), !q1.trim())}
              </div>
            </div>
          </>
        )}

        {stage !== 1 && (
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
              <div>
                <span style={sectionLabel}>Where are you flying from?</span>
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
                    style={{ width: '200px', borderBottom: '1px solid #d4d4c8', borderTop: 'none', borderLeft: 'none', borderRight: 'none', background: 'transparent', padding: '8px 0', fontSize: '14px', color: 'var(--foreground)', outline: 'none', ...s }}
                    value={departureCityInput}
                    onChange={e => setDepartureCityInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && departureCityInput.trim()) {
                        setDepartureCities(prev => [...prev, departureCityInput.trim()])
                        setDepartureCityInput('')
                      }
                    }}
                    placeholder="Type a city..."
                  />
                  {departureCityInput.trim() && (
                    <button type="button" onClick={() => { setDepartureCities(prev => [...prev, departureCityInput.trim()]); setDepartureCityInput('') }} style={{ fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#2d6a4f', background: 'none', border: 'none', cursor: 'pointer', ...s }}>Add</button>
                  )}
                </div>
              </div>
              <div style={{ borderTop: '0.5px solid #e4e4d8' }} />

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
                      {['Europe', 'Caribbean', 'Latin America', 'Southeast Asia', 'East Asia', 'Middle East', 'Africa', 'South Pacific', 'Anywhere'].map(r => (
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

              <div>
                <span style={sectionLabel}>What kind of activities?</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {['Physical / outdoor', 'Cultural / historical', 'Entertainment & nightlife', 'Food & dining', 'Relaxation & wellness', 'Water activities', 'Shopping', 'Arts & music', 'Adventure sports'].map(opt => (
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

              <div>
                <span style={sectionLabel}>How popular should the destination be?</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {['Well known & easy', 'A mix of both', 'Off the beaten path', 'Surprise us'].map(opt => (
                    <button key={opt} type="button" onClick={() => setPopularity(opt)} style={chipStyle(popularity === opt)}>{opt}</button>
                  ))}
                </div>
              </div>

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
                    {nextBtn(() => { setStage('generate'); generateDestinations() }, false, 'See my destinations →')}
                  </div>
                )}
              </div>
            ) : q3.trim() ? (
              <UserBubble>{q3}</UserBubble>
            ) : null}
          </>
        )}

        {generating && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 0', gap: '16px' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#2d6a4f" strokeWidth="1.5" strokeLinecap="round">
              <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" style={{ animation: 'spin 1.5s linear infinite', transformOrigin: 'center' }} />
            </svg>
            <p style={{ fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#2d6a4f', ...s }}>Avanti is thinking...</p>
            <p style={{ fontSize: '13px', color: 'var(--muted-foreground)', textAlign: 'center', maxWidth: '280px', lineHeight: 1.6, ...s }}>
              {generateStatus || 'Weighing destinations against your vibe, budget, and deal breakers'}
            </p>
          </div>
        )}

        {!generating && generateError && (
          <div style={{ marginTop: '32px', padding: '20px 24px', border: '1px solid #c0392b', background: '#fdf2f2', textAlign: 'center' }}>
            <p style={{ fontSize: '14px', color: '#c0392b', margin: '0 0 16px', lineHeight: 1.6, ...s }}>{generateError}</p>
            <button type="button" onClick={() => generateDestinations()} style={{ padding: '12px 28px', border: '1px solid var(--forest-deep)', background: 'var(--forest-deep)', color: '#fafaf8', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', cursor: 'pointer', ...s }}>
              Try again →
            </button>
          </div>
        )}

        {!generating && cards.length > 0 && (
          <>
            <div className="mt-10 mb-8 text-center">
              <p className="eyebrow text-muted-foreground mb-2">Your picks</p>
              <h3 className="font-serif text-2xl text-forest-deep italic">Four destinations for your group</h3>
              <p className="mt-3 text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
                Browse your ideas here — create an account to share them with your group and vote together.
              </p>
            </div>
            <ProtectedContent className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              {cards.map((card, i) => (
                <DestinationCard
                  key={i}
                  card={card}
                  previewMode
                />
              ))}
            </ProtectedContent>
            <div className="text-center border border-forest-deep/20 bg-ivory p-8 md:p-10">
              <p className="font-serif text-xl text-forest-deep mb-3 italic">Like what you see?</p>
              <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto leading-relaxed">
                Share these ideas with your group, invite travel mates, and start voting — you&apos;ll need an account first.
              </p>
              <button
                type="button"
                onClick={requestSignup}
                className="bg-forest-deep text-cream eyebrow px-10 py-4 hover:bg-forest-deep/90 transition"
              >
                Share the ideas with the group →
              </button>
              <button
                type="button"
                onClick={requestSignin}
                className="mt-4 block w-full eyebrow text-muted-foreground hover:text-forest-deep transition"
              >
                Already have an account? Sign in
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
