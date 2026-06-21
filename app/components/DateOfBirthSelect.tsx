'use client'

import { useEffect, useMemo, useState } from 'react'

const MONTHS = [
  { value: '01', label: 'January' },
  { value: '02', label: 'February' },
  { value: '03', label: 'March' },
  { value: '04', label: 'April' },
  { value: '05', label: 'May' },
  { value: '06', label: 'June' },
  { value: '07', label: 'July' },
  { value: '08', label: 'August' },
  { value: '09', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
]

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate()
}

function parseIsoDate(iso: string) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    return { month: '', day: '', year: '' }
  }
  const [year, month, day] = iso.split('-')
  return {
    month,
    day: String(parseInt(day, 10)),
    year,
  }
}

function toIsoDate(month: string, day: string, year: string) {
  if (!month || !day || !year) return ''
  return `${year}-${month}-${day.padStart(2, '0')}`
}

type DateOfBirthSelectProps = {
  value: string
  onChange: (isoDate: string) => void
  selectStyle?: React.CSSProperties
}

export default function DateOfBirthSelect({ value, onChange, selectStyle }: DateOfBirthSelectProps) {
  const parsed = parseIsoDate(value)
  const [month, setMonth] = useState(parsed.month)
  const [day, setDay] = useState(parsed.day)
  const [year, setYear] = useState(parsed.year)

  useEffect(() => {
    const next = parseIsoDate(value)
    setMonth(next.month)
    setDay(next.day)
    setYear(next.year)
  }, [value])

  const currentYear = new Date().getFullYear()
  const years = useMemo(
    () => Array.from({ length: 120 }, (_, i) => String(currentYear - i)),
    [currentYear]
  )

  const maxDay = useMemo(() => {
    if (!month) return 31
    const y = year ? parseInt(year, 10) : currentYear
    return daysInMonth(y, parseInt(month, 10))
  }, [month, year, currentYear])

  const days = useMemo(() => Array.from({ length: maxDay }, (_, i) => String(i + 1)), [maxDay])

  const emit = (m: string, d: string, y: string) => {
    let safeDay = d
    if (m && y && d) {
      const max = daysInMonth(parseInt(y, 10), parseInt(m, 10))
      if (parseInt(d, 10) > max) safeDay = String(max)
    }
    onChange(toIsoDate(m, safeDay, y))
  }

  const baseSelectStyle: React.CSSProperties = {
    width: '100%',
    cursor: 'pointer',
    appearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%239a9a8a' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 4px center',
    paddingRight: '24px',
    ...selectStyle,
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 0.7fr 0.9fr', gap: '10px' }}>
      <select
        aria-label="Birth month"
        value={month}
        onChange={e => {
          const m = e.target.value
          setMonth(m)
          emit(m, day, year)
        }}
        style={baseSelectStyle}
      >
        <option value="">Month</option>
        {MONTHS.map(m => (
          <option key={m.value} value={m.value}>{m.label}</option>
        ))}
      </select>
      <select
        aria-label="Birth day"
        value={day}
        onChange={e => {
          const d = e.target.value
          setDay(d)
          emit(month, d, year)
        }}
        style={baseSelectStyle}
      >
        <option value="">Day</option>
        {days.map(d => (
          <option key={d} value={d}>{d}</option>
        ))}
      </select>
      <select
        aria-label="Birth year"
        value={year}
        onChange={e => {
          const y = e.target.value
          setYear(y)
          emit(month, day, y)
        }}
        style={baseSelectStyle}
      >
        <option value="">Year</option>
        {years.map(y => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>
    </div>
  )
}

export { parseIsoDate, toIsoDate }
