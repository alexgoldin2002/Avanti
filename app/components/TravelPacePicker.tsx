'use client'

import { TRAVEL_PACE_OPTIONS, type TravelPacePreferenceId } from '@/lib/travel-pace-preference'

type TravelPacePickerProps = {
  value: TravelPacePreferenceId | ''
  onChange: (id: TravelPacePreferenceId) => void
  sectionLabelStyle: React.CSSProperties
  helperStyle?: React.CSSProperties
  buttonFontStyle: React.CSSProperties
}

export default function TravelPacePicker({
  value,
  onChange,
  sectionLabelStyle,
  helperStyle,
  buttonFontStyle,
}: TravelPacePickerProps) {
  const helper = {
    fontSize: '12px',
    color: 'var(--muted-foreground)',
    margin: '0 0 12px',
    lineHeight: 1.5,
    ...helperStyle,
  }

  return (
    <div>
      <span style={sectionLabelStyle}>How much travel do you want throughout the trip?</span>
      <p style={helper}>
        We&apos;ll pick the right number of stops from this and your dates — you don&apos;t need to decide that now.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {TRAVEL_PACE_OPTIONS.map(opt => (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            style={{
              padding: '14px 18px',
              cursor: 'pointer',
              border: `1px solid ${value === opt.id ? 'var(--forest-deep)' : '#d4d4c8'}`,
              background: value === opt.id ? '#e8f5ee' : '#fff',
              color: value === opt.id ? 'var(--forest-deep)' : '#6a6a6a',
              textAlign: 'left',
              ...buttonFontStyle,
            }}
          >
            <span
              style={{
                display: 'block',
                fontSize: '16px',
                color: 'var(--foreground)',
                marginBottom: '4px',
              }}
            >
              {opt.label}
            </span>
            <span
              style={{
                display: 'block',
                fontSize: '13px',
                color: 'var(--muted-foreground)',
                lineHeight: 1.5,
              }}
            >
              {opt.description}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
