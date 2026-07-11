'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'

type Props = {
  value: string
  onChange: (name: string) => void
  onPick?: (name: string) => void
  inputStyle: CSSProperties
  s: CSSProperties
  placeholder?: string
}

export default function MedicationAutocomplete({ value, onChange, onPick, inputStyle, s, placeholder }: Props) {
  const [results, setResults] = useState<string[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(-1)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const skipNext = useRef(false)

  useEffect(() => {
    if (skipNext.current) { skipNext.current = false; return }
    if (timer.current) clearTimeout(timer.current)
    const q = value.trim()
    if (q.length < 2) { setResults([]); setOpen(false); return }
    timer.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/medications/search?q=${encodeURIComponent(q)}`)
        const json = await res.json()
        const list: string[] = Array.isArray(json.results) ? json.results : []
        setResults(list)
        setOpen(list.length > 0)
        setActive(-1)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 250)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [value])

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  const pick = (name: string) => {
    skipNext.current = true
    onChange(name)
    onPick?.(name)
    setOpen(false)
    setResults([])
    setActive(-1)
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <input
        style={inputStyle}
        value={value}
        placeholder={placeholder || 'Start typing a medication…'}
        onChange={e => onChange(e.target.value)}
        onFocus={() => { if (results.length) setOpen(true) }}
        onKeyDown={e => {
          if (!open) return
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, results.length - 1)) }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)) }
          else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); pick(results[active]) }
          else if (e.key === 'Escape') setOpen(false)
        }}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
      />
      {loading && (
        <span style={{ position: 'absolute', right: 0, top: '12px', fontSize: '10px', color: '#b4b4a8', letterSpacing: '0.1em', textTransform: 'uppercase', ...s }}>…</span>
      )}
      {open && results.length > 0 && (
        <ul
          style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 40,
            listStyle: 'none', margin: '2px 0 0', padding: '4px 0',
            background: 'var(--card)', border: '1px solid #d4d4c8',
            maxHeight: '240px', overflowY: 'auto', boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
          }}
        >
          {results.map((r, i) => (
            <li key={r}>
              <button
                type="button"
                onMouseDown={e => { e.preventDefault(); pick(r) }}
                onMouseEnter={() => setActive(i)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer',
                  padding: '9px 14px', fontSize: '14px', color: 'var(--foreground)',
                  background: i === active ? '#f2f5ef' : 'transparent', ...s,
                }}
              >
                {r}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
