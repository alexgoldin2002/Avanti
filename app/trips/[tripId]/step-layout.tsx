'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { BackLink } from '../../components/SubpageShell'

interface StepLayoutProps {
  tripId: string
  stepNumber: number
  stepTitle: string
  stepDescription?: string
  autoSaved?: boolean
  children: React.ReactNode
}

const DEFAULT_COLORS = [
  { bg: 'var(--accent-light)', border: '#8aad7a', numBg: '#1a4a0e', numText: 'var(--accent-light)', titleColor: '#0a2a06', subColor: '#1a5a32' },
  { bg: '#eaf5e8', border: '#a8d49a', numBg: '#2a7a1e', numText: '#eaf5e8', titleColor: '#143a0a', subColor: '#235a14' },
  { bg: '#eef5e4', border: '#b8d492', numBg: '#3a7a14', numText: '#eef5e4', titleColor: '#1e3a08', subColor: '#2e5a10' },
  { bg: '#f0f5e0', border: '#c8d880', numBg: '#5a7a0a', numText: '#f0f5e0', titleColor: '#2a3a04', subColor: '#3a5a08' },
  { bg: '#f2f5dc', border: '#d4d878', numBg: '#6a7a10', numText: '#f2f5dc', titleColor: '#343a06', subColor: '#4a5a0c' },
  { bg: '#f5f4d8', border: '#dcd870', numBg: '#7a7a14', numText: '#f5f4d8', titleColor: '#3a3a04', subColor: '#5a5a0c' },
]

export default function StepLayout({ tripId, stepNumber, stepTitle, stepDescription, autoSaved, children }: StepLayoutProps) {
  const [colors, setColors] = useState(DEFAULT_COLORS)
  const [trip, setTrip] = useState<any>(null)

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('trips').select('name, step_colors, cover_color').eq('id', tripId).single()
      if (data) {
        setTrip(data)
        if (data.step_colors && data.step_colors.length >= stepNumber) {
          setColors(data.step_colors)
        }
      }
    }
    load()
  }, [tripId, stepNumber])

  const stepColor = colors[stepNumber - 1] || colors[0]
  const s = { fontFamily: 'var(--font-cormorant), Georgia, serif' }

  return (
    <main style={{ minHeight: '100vh', background: 'var(--cream)', position: 'relative', overflow: 'hidden', ...s }}>

      <div style={{
        position: 'fixed',
        top: '-120px',
        right: '-120px',
        width: '500px',
        height: '500px',
        borderRadius: '50%',
        background: stepColor.bg,
        opacity: 0.6,
        pointerEvents: 'none',
        zIndex: 0,
      }} />

      <div style={{
        position: 'fixed',
        bottom: '-80px',
        left: '-80px',
        width: '320px',
        height: '320px',
        borderRadius: '50%',
        background: stepColor.bg,
        opacity: 0.4,
        pointerEvents: 'none',
        zIndex: 0,
      }} />

      <div style={{
        position: 'fixed',
        top: '40%',
        left: '60%',
        width: '200px',
        height: '200px',
        borderRadius: '40px',
        background: stepColor.numBg,
        opacity: 0.04,
        transform: 'rotate(15deg)',
        pointerEvents: 'none',
        zIndex: 0,
      }} />

      <div style={{ position: 'relative', zIndex: 1, maxWidth: '600px', margin: '0 auto', padding: '48px 24px' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: '40px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {autoSaved && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--forest)' }} />
                <span style={{ fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--forest)' }}>Saved</span>
              </div>
            )}
            <BackLink href={`/trips/${tripId}`} wrapperClassName="mb-0 flex justify-end" />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '20px', marginBottom: '40px' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: stepColor.numBg,
            color: stepColor.numText,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '28px',
            fontWeight: 300,
            fontFamily: 'var(--font-cormorant), Georgia, serif',
            flexShrink: 0,
            marginTop: '4px',
          }}>
            {stepNumber}
          </div>
          <div>
            <p style={{ fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', color: stepColor.subColor, margin: '0 0 6px' }}>
              Step {stepNumber}
            </p>
            <h1 style={{ fontSize: '36px', fontWeight: 300, color: stepColor.titleColor, margin: '0 0 8px', lineHeight: 1.1, ...s }}>
              {stepTitle}
            </h1>
            {stepDescription && (
              <p style={{ fontSize: '14px', color: stepColor.subColor, margin: 0, lineHeight: 1.6, opacity: 0.85 }}>
                {stepDescription}
              </p>
            )}
          </div>
        </div>

        <div style={{
          background: 'rgba(255,255,255,0.8)',
          borderRadius: '16px',
          border: `0.5px solid ${stepColor.border}`,
          padding: '32px',
          backdropFilter: 'blur(8px)',
        }}>
          {children}
        </div>

        {trip && (
          <div style={{
            marginTop: '16px',
            padding: '10px 16px',
            background: stepColor.bg,
            borderRadius: '8px',
            border: `0.5px solid ${stepColor.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <p style={{ fontSize: '11px', color: stepColor.subColor, margin: 0, letterSpacing: '0.05em' }}>
              {trip.name}
            </p>
            <div style={{ display: 'flex', gap: '4px' }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: i === stepNumber - 1 ? stepColor.numBg : stepColor.border,
                  opacity: i === stepNumber - 1 ? 1 : 0.4,
                }} />
              ))}
            </div>
          </div>
        )}

      </div>
    </main>
  )
}
