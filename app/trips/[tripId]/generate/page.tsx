'use client'
import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { BackLink } from '../../../components/SubpageShell'

const PROCESSING_STEPS = [
  { message: "Reading everyone's preferences...", duration: 3000 },
  { message: "Identifying departure cities and sub-groups...", duration: 3500 },
  { message: "Checking for group fare opportunities...", duration: 2500 },
  { message: "Scanning credit card benefits across the group...", duration: 3000 },
  { message: "Calculating true costs including hidden fees...", duration: 4000 },
  { message: "Analyzing flight routing options...", duration: 3500 },
  { message: "Checking ferry and train connections...", duration: 3000 },
  { message: "Weighing must-dos against budget constraints...", duration: 3500 },
  { message: "Comparing accommodation locations to nightlife...", duration: 3000 },
  { message: "Building itinerary options...", duration: 4000 },
  { message: "Finalizing recommendations...", duration: 2000 },
]

export default function GenerateOptions() {
  const params = useParams()
  const router = useRouter()
  const tripId = params.tripId as string
  const [trip, setTrip] = useState<any>(null)
  const [currentStep, setCurrentStep] = useState(0)
  const [progress, setProgress] = useState(0)
  const [generating, setGenerating] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [prefCount, setPrefCount] = useState(0)
  const [travelerCount, setTravelerCount] = useState(0)
  const hasStarted = useRef(false)

  useEffect(() => {
    const load = async () => {
      const { data: tripData } = await supabase.from('trips').select('*').eq('id', tripId).single()
      if (tripData) {
        setTrip(tripData)
        if (tripData.options_generated) { router.push(`/trips/${tripId}/options`); return }
      }
      const { data: prefs } = await supabase.from('trip_preferences').select('id').eq('trip_id', tripId)
      const { data: travelers } = await supabase.from('travelers').select('id').eq('trip_id', tripId)
      setPrefCount(prefs?.length || 0)
      setTravelerCount(travelers?.length || 0)
    }
    load()
  }, [tripId, router])

  useEffect(() => {
    if (!trip || hasStarted.current) return
    hasStarted.current = true
    startGeneration()
  }, [trip])

  const startGeneration = async () => {
    setGenerating(true)
    let stepIndex = 0
    let totalTime = PROCESSING_STEPS.reduce((sum, s) => sum + s.duration, 0)
    let elapsed = 0

    const advanceStep = () => {
      if (stepIndex < PROCESSING_STEPS.length - 1) {
        elapsed += PROCESSING_STEPS[stepIndex].duration
        setProgress(Math.round((elapsed / totalTime) * 85))
        stepIndex++
        setCurrentStep(stepIndex)
        setTimeout(advanceStep, PROCESSING_STEPS[stepIndex].duration)
      }
    }
    setTimeout(advanceStep, PROCESSING_STEPS[0].duration)

    try {
      const res = await fetch('/api/generate-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tripId })
      })
      const data = await res.json()
      if (data.error) { setError(data.error); setGenerating(false); return }
      setProgress(100)
      setCurrentStep(PROCESSING_STEPS.length - 1)
      setTimeout(() => { setDone(true); setTimeout(() => router.push(`/trips/${tripId}/options`), 1500) }, 500)
    } catch (e: any) {
      setError(e.message)
      setGenerating(false)
    }
  }

  const s = { fontFamily: 'var(--font-cormorant), Georgia, serif' }

  if (!trip) return null

  return (
    <main style={{ flex: 1, minHeight: '80vh', background: 'var(--forest-deep)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', position: 'relative', ...s }}>
      <div style={{ position: 'absolute', top: '24px', right: '24px', left: '24px', maxWidth: '520px', margin: '0 auto' }}>
        <BackLink
          href={`/trips/${tripId}`}
          className="text-white/50 hover:text-white"
          wrapperClassName="mb-0 flex justify-end"
        />
      </div>
      <div style={{ width: '100%', maxWidth: '520px', textAlign: 'center' }}>

        <div style={{ marginBottom: '48px' }}>
          <div style={{ display: 'inline-block', position: 'relative' }}>
            <div style={{ clipPath: 'polygon(4% 0%, 100% 0%, 96% 100%, 0% 100%)', border: '1px solid rgba(255,255,255,0.3)', padding: '10px 32px' }}>
              <span style={{ fontSize: '28px', fontWeight: 300, letterSpacing: '0.3em', color: 'rgba(255,255,255,0.9)', textTransform: 'uppercase', fontStyle: 'oblique 8deg' }}>AVANTI</span>
            </div>
          </div>
        </div>

        {!done ? (
          <>
            <div style={{ marginBottom: '40px' }}>
              <svg width="64" height="52" viewBox="0 0 80 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                <style>{`
                  @keyframes drawCase3 {
                    0% { stroke-dashoffset: 300; opacity: 0.3; }
                    60% { stroke-dashoffset: 0; opacity: 1; }
                    100% { stroke-dashoffset: -300; opacity: 0.3; }
                  }
                  .sc3 { stroke-dasharray: 300; animation: drawCase3 2.4s ease-in-out infinite; }
                `}</style>
                <rect className="sc3" x="6" y="18" width="68" height="40" rx="4" stroke="rgba(255,255,255,0.8)" strokeWidth="1.5" fill="none"/>
                <rect className="sc3" x="26" y="6" width="28" height="14" rx="2" stroke="rgba(255,255,255,0.8)" strokeWidth="1.5" fill="none" style={{ animationDelay: '0.2s' }}/>
                <line className="sc3" x1="6" y1="32" x2="74" y2="32" stroke="rgba(255,255,255,0.8)" strokeWidth="1" style={{ animationDelay: '0.4s' }}/>
                <circle cx="18" cy="62" r="3.5" stroke="rgba(255,255,255,0.8)" strokeWidth="1.5" fill="none"/>
                <circle cx="62" cy="62" r="3.5" stroke="rgba(255,255,255,0.8)" strokeWidth="1.5" fill="none"/>
              </svg>
            </div>

            <h2 style={{ fontSize: '32px', fontWeight: 300, color: '#ffffff', margin: '0 0 8px', letterSpacing: '-0.5px' }}>Building your options</h2>
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginBottom: '40px', lineHeight: 1.7 }}>
              Analyzing {prefCount} preference set{prefCount !== 1 ? 's' : ''} across {travelerCount} traveler{travelerCount !== 1 ? 's' : ''}
            </p>

            <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '4px', height: '2px', marginBottom: '32px', overflow: 'hidden' }}>
              <div style={{ height: '100%', background: 'linear-gradient(to right, var(--forest), #97c459)', width: `${progress}%`, transition: 'width 0.8s ease', borderRadius: '4px' }} />
            </div>

            <div style={{ minHeight: '60px' }}>
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', letterSpacing: '0.02em', transition: 'opacity 0.5s' }}>
                {PROCESSING_STEPS[currentStep]?.message}
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginTop: '32px' }}>
              {PROCESSING_STEPS.map((_, i) => (
                <div key={i} style={{ width: i === currentStep ? '20px' : '6px', height: '6px', borderRadius: '3px', background: i <= currentStep ? 'var(--forest)' : 'rgba(255,255,255,0.15)', transition: 'all 0.4s' }} />
              ))}
            </div>

            {error && (
              <div style={{ marginTop: '32px', padding: '16px', background: 'rgba(224,74,74,0.15)', borderRadius: '0', border: '1px solid rgba(224,74,74,0.3)' }}>
                <p style={{ fontSize: '13px', color: '#f09595', margin: 0 }}>Something went wrong: {error}</p>
                <button onClick={startGeneration} style={{ marginTop: '12px', border: '1px solid #f09595', background: 'transparent', color: '#f09595', padding: '8px 16px', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', cursor: 'pointer', ...s }}>
                  Try again
                </button>
              </div>
            )}
          </>
        ) : (
          <div>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>✓</div>
            <h2 style={{ fontSize: '32px', fontWeight: 300, color: '#ffffff', margin: '0 0 8px' }}>Options ready</h2>
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>Taking you there now...</p>
          </div>
        )}
      </div>
    </main>
  )
}
