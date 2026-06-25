'use client'

type DateRangeFieldsProps = {
  start: string
  end: string
  onChange: (next: { start: string; end: string }) => void
  startLabel: string
  endLabel: string
  inputStyle?: React.CSSProperties
  labelStyle?: React.CSSProperties
}

export function todayIsoDate(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatPickerHint(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function isValidDateRange(start: string, end: string): boolean {
  if (!start || !end) return false
  const today = todayIsoDate()
  if (start < today || end < start) return false
  return end >= start
}

export default function DateRangeFields({
  start,
  end,
  onChange,
  startLabel,
  endLabel,
  inputStyle = {},
  labelStyle = {},
}: DateRangeFieldsProps) {
  const today = todayIsoDate()
  const endMin = start && start >= today ? start : today
  const endBeforeStart = Boolean(start && end && end < start)

  const handleStartChange = (raw: string) => {
    const nextStart = raw && raw < today ? today : raw
    let nextEnd = end
    if (nextStart && nextEnd && nextEnd < nextStart) {
      nextEnd = nextStart
    }
    onChange({ start: nextStart, end: nextEnd })
  }

  const handleEndChange = (raw: string) => {
    const nextEnd = raw && raw < endMin ? endMin : raw
    if (start && nextEnd && nextEnd < start) return
    onChange({ start, end: nextEnd })
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
      <div>
        <label style={labelStyle}>{startLabel}</label>
        <input
          type="date"
          style={inputStyle}
          value={start}
          min={today}
          onChange={e => handleStartChange(e.target.value)}
        />
      </div>
      <div>
        <label style={labelStyle}>
          {endLabel}
          {start ? (
            <span style={{ display: 'block', fontSize: '10px', letterSpacing: '0.06em', textTransform: 'none', color: 'var(--muted-foreground)', marginTop: '4px', fontWeight: 400 }}>
              From {formatPickerHint(start)}
            </span>
          ) : null}
        </label>
        <input
          type="date"
          style={inputStyle}
          value={end}
          min={endMin}
          onChange={e => handleEndChange(e.target.value)}
        />
        {endBeforeStart && (
          <p style={{ fontSize: '11px', color: '#b45309', margin: '6px 0 0', lineHeight: 1.4 }}>
            Return must be on or after departure.
          </p>
        )}
      </div>
    </div>
  )
}
