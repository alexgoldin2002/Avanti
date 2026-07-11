'use client'

import { useMemo, useRef, useState, useEffect } from 'react'
import { formatCost, chatFlights, type FlightChatMessage } from '@/lib/flights/client-api'
import {
  DEPART_WINDOW_LABELS,
  FLIGHT_SORT_LABELS,
  EMPTY_FLIGHT_FILTERS,
  type FlightOption,
  type FlightFilterState,
  type FlightSortKey,
} from '@/lib/flights/types'
import { flightSearchUrl, googleFlightsUrl } from '@/lib/booking/search-links'
import BookSearchLink from '../../../components/BookSearchLink'

// "2026-09-08" -> "Tue, 8 Sep 2026"
export function fmtFlightDate(iso: string): string {
  const [y, m, d] = (iso || '').split('-').map(Number)
  if (!y || !m || !d) return iso
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  })
}

// "7:15 PM" -> hour 0-23
function departHour(time: string): number {
  const m = time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i)
  if (!m) return 12
  let h = parseInt(m[1], 10) % 12
  if (/pm/i.test(m[3])) h += 12
  return h
}

function windowMatches(win: FlightFilterState['departWindow'], time: string): boolean {
  if (win === 'any') return true
  const h = departHour(time)
  if (win === 'morning') return h >= 5 && h < 12
  if (win === 'afternoon') return h >= 12 && h < 18
  if (win === 'evening') return h >= 18 && h <= 23
  return h >= 0 && h < 5 // redeye
}

const badgeStyles: Record<string, string> = {
  best: 'bg-forest-deep text-white',
  cheapest: 'bg-emerald-600 text-white',
  fastest: 'bg-sky-600 text-white',
}

// ─────────────────────────────────────────────────────────────────────────
// Filter bar
// ─────────────────────────────────────────────────────────────────────────
function FilterDropdown({
  label,
  active,
  children,
}: {
  label: string
  active: boolean
  children: (close: () => void) => React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs transition-colors ${
          active ? 'border-forest-deep bg-forest-pale text-forest-deep' : 'border-border bg-card text-muted-foreground hover:border-forest-deep/40'
        }`}
      >
        {label}
        <span className="text-[9px]">▾</span>
      </button>
      {open && (
        <div className="absolute left-0 z-20 mt-2 w-60 border border-border bg-card p-3 shadow-lg">
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  )
}

function FilterBar({
  options,
  filters,
  setFilters,
}: {
  options: FlightOption[]
  filters: FlightFilterState
  setFilters: (f: FlightFilterState) => void
}) {
  const airlines = useMemo(
    () => Array.from(new Set(options.flatMap(o => o.airlines))).sort(),
    [options],
  )
  const stopsLabel =
    filters.stops === 'nonstop' ? 'Nonstop' : filters.stops === 'one_or_fewer' ? '1 stop or fewer' : 'Stops'
  const priceLabel = filters.maxPriceUsd ? `Under ${formatCost(filters.maxPriceUsd)}` : 'Price'
  const timesLabel = filters.departWindow === 'any' ? 'Times' : DEPART_WINDOW_LABELS[filters.departWindow]
  const durLabel = filters.maxDurationHours ? `Under ${filters.maxDurationHours}h` : 'Duration'

  return (
    <div className="flex flex-wrap items-center gap-2">
      <FilterDropdown label={stopsLabel} active={filters.stops !== 'any'}>
        {close => (
          <div className="space-y-1">
            {([['any', 'Any number of stops'], ['nonstop', 'Nonstop only'], ['one_or_fewer', '1 stop or fewer']] as const).map(([val, lbl]) => (
              <button
                key={val}
                type="button"
                onClick={() => { setFilters({ ...filters, stops: val }); close() }}
                className={`block w-full rounded px-2 py-1.5 text-left text-xs ${filters.stops === val ? 'bg-forest-pale text-forest-deep' : 'hover:bg-forest-mist/50'}`}
              >
                {lbl}
              </button>
            ))}
          </div>
        )}
      </FilterDropdown>

      <FilterDropdown label={filters.airlines.length ? `Airlines (${filters.airlines.length})` : 'Airlines'} active={filters.airlines.length > 0}>
        {() => (
          <div className="max-h-56 space-y-1 overflow-auto">
            {airlines.length === 0 && <p className="text-xs text-muted-foreground">No airlines yet</p>}
            {airlines.map(a => {
              const on = filters.airlines.includes(a)
              return (
                <label key={a} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-forest-mist/50">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() =>
                      setFilters({
                        ...filters,
                        airlines: on ? filters.airlines.filter(x => x !== a) : [...filters.airlines, a],
                      })
                    }
                  />
                  {a}
                </label>
              )
            })}
            {filters.airlines.length > 0 && (
              <button type="button" onClick={() => setFilters({ ...filters, airlines: [] })} className="mt-1 text-[11px] text-forest-deep hover:underline">
                Clear airlines
              </button>
            )}
          </div>
        )}
      </FilterDropdown>

      <FilterDropdown label={priceLabel} active={!!filters.maxPriceUsd}>
        {close => (
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Max price / person</p>
            <div className="flex flex-wrap gap-1.5">
              {[500, 750, 1000, 1500, 2500].map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => { setFilters({ ...filters, maxPriceUsd: v }); close() }}
                  className={`rounded-full border px-2.5 py-1 text-[11px] ${filters.maxPriceUsd === v ? 'border-forest-deep bg-forest-pale text-forest-deep' : 'border-border text-muted-foreground'}`}
                >
                  ${v}
                </button>
              ))}
            </div>
            {filters.maxPriceUsd && (
              <button type="button" onClick={() => { setFilters({ ...filters, maxPriceUsd: null }); close() }} className="text-[11px] text-forest-deep hover:underline">
                Any price
              </button>
            )}
          </div>
        )}
      </FilterDropdown>

      <FilterDropdown label={timesLabel} active={filters.departWindow !== 'any'}>
        {close => (
          <div className="space-y-1">
            {(Object.keys(DEPART_WINDOW_LABELS) as FlightFilterState['departWindow'][]).map(w => (
              <button
                key={w}
                type="button"
                onClick={() => { setFilters({ ...filters, departWindow: w }); close() }}
                className={`block w-full rounded px-2 py-1.5 text-left text-xs ${filters.departWindow === w ? 'bg-forest-pale text-forest-deep' : 'hover:bg-forest-mist/50'}`}
              >
                {DEPART_WINDOW_LABELS[w]}
              </button>
            ))}
          </div>
        )}
      </FilterDropdown>

      <FilterDropdown label={durLabel} active={!!filters.maxDurationHours}>
        {close => (
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Max trip duration</p>
            <div className="flex flex-wrap gap-1.5">
              {[8, 12, 16, 20, 30].map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => { setFilters({ ...filters, maxDurationHours: v }); close() }}
                  className={`rounded-full border px-2.5 py-1 text-[11px] ${filters.maxDurationHours === v ? 'border-forest-deep bg-forest-pale text-forest-deep' : 'border-border text-muted-foreground'}`}
                >
                  {v}h
                </button>
              ))}
            </div>
            {filters.maxDurationHours && (
              <button type="button" onClick={() => { setFilters({ ...filters, maxDurationHours: null }); close() }} className="text-[11px] text-forest-deep hover:underline">
                Any duration
              </button>
            )}
          </div>
        )}
      </FilterDropdown>

      <div className="ml-auto flex items-center gap-2">
        <span className="text-[11px] text-muted-foreground">Sort</span>
        <select
          value={filters.sort}
          onChange={e => setFilters({ ...filters, sort: e.target.value as FlightSortKey })}
          className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-foreground"
        >
          {(Object.keys(FLIGHT_SORT_LABELS) as FlightSortKey[]).map(k => (
            <option key={k} value={k}>{FLIGHT_SORT_LABELS[k]}</option>
          ))}
        </select>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// One result row
// ─────────────────────────────────────────────────────────────────────────
function OptionRow({
  tripId,
  option,
  expanded,
  onToggle,
  isOrganizer,
  busy,
  onLock,
}: {
  tripId: string
  option: FlightOption
  expanded: boolean
  onToggle: () => void
  isOrganizer: boolean
  busy: boolean
  onLock: () => void
}) {
  const bookHref = flightSearchUrl({
    origin: option.origin,
    destination: option.destination,
    departDate: option.departure_date,
    returnDate: option.return_date,
    pubref: tripId,
    label: 'flights',
  })
  const googleHref = googleFlightsUrl({
    origin: option.origin,
    destination: option.destination,
    departDate: option.departure_date,
    returnDate: option.return_date,
  })

  return (
    <div className={`border bg-card ${option.recommended ? 'border-forest-deep' : 'border-border'}`}>
      <button type="button" onClick={onToggle} className="grid w-full grid-cols-[1.6fr_0.9fr_1fr_1fr_auto] items-center gap-3 px-4 py-3 text-left max-sm:grid-cols-2">
        {/* Airline + times */}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            {option.badges.map(b => (
              <span key={b} className={`rounded-sm px-1.5 py-0.5 text-[9px] uppercase tracking-wider ${badgeStyles[b] || 'bg-muted'}`}>{b}</span>
            ))}
          </div>
          <p className="mt-0.5 text-base font-medium text-foreground m-0">
            {option.depart_time} – {option.arrive_time}
            {option.arrive_plus_days > 0 && <sup className="text-[10px] text-muted-foreground">+{option.arrive_plus_days}</sup>}
          </p>
          <p className="truncate text-xs text-muted-foreground m-0">
            {option.airlines.join(', ')}{option.operated_by ? ` · ${option.operated_by}` : ''}
          </p>
        </div>

        {/* Duration + route */}
        <div className="max-sm:hidden">
          <p className="text-sm text-foreground m-0">{option.duration_label}</p>
          <p className="text-xs text-muted-foreground m-0">{option.origin}–{option.destination}</p>
        </div>

        {/* Stops */}
        <div className="max-sm:hidden">
          <p className={`text-sm m-0 ${option.stops === 0 ? 'text-emerald-700' : 'text-foreground'}`}>{option.stops_label}</p>
          {option.layover_detail && <p className="text-xs text-muted-foreground m-0">{option.layover_detail}</p>}
          {option.self_transfer && <p className="text-[11px] text-amber-700 m-0">Self-transfer</p>}
        </div>

        {/* CO2 */}
        <div className="max-sm:hidden">
          {option.co2_kg != null ? (
            <>
              <p className="text-sm text-foreground m-0">{Math.round(option.co2_kg)} kg CO2e</p>
              {option.co2_delta_pct != null && (
                <p className={`text-xs m-0 ${option.co2_delta_pct <= 0 ? 'text-emerald-700' : 'text-muted-foreground'}`}>
                  {option.co2_delta_pct > 0 ? '+' : ''}{option.co2_delta_pct}% emissions
                </p>
              )}
            </>
          ) : <span className="text-xs text-muted-foreground">—</span>}
        </div>

        {/* Price */}
        <div className="text-right">
          <p className="text-lg font-semibold text-forest-deep m-0">{formatCost(option.price_usd)}</p>
          <p className="text-[11px] text-muted-foreground m-0">{option.price_label}{option.member_breakdown?.length ? ' · avg' : ''}</p>
          <span className="text-xs text-muted-foreground">{expanded ? '▲' : '▾'}</span>
        </div>
      </button>

      {expanded && (
        <div className="space-y-4 border-t border-border px-4 py-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {option.pros.length > 0 && (
              <div className="border border-emerald-100 bg-emerald-50/60 px-3 py-2">
                <p className="mb-1 text-[10px] uppercase tracking-wider text-emerald-800">Pros</p>
                <ul className="m-0 list-none space-y-0.5 pl-0">
                  {option.pros.map((p, i) => <li key={i} className="text-xs text-emerald-900">+ {p}</li>)}
                </ul>
              </div>
            )}
            {option.cons.length > 0 && (
              <div className="border border-rose-100 bg-rose-50/60 px-3 py-2">
                <p className="mb-1 text-[10px] uppercase tracking-wider text-rose-800">Cons</p>
                <ul className="m-0 list-none space-y-0.5 pl-0">
                  {option.cons.map((c, i) => <li key={i} className="text-xs text-rose-900">− {c}</li>)}
                </ul>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            {option.cabin && <span><strong className="text-foreground">Cabin:</strong> {option.cabin}</span>}
            {option.bags_summary && <span><strong className="text-foreground">Bags:</strong> {option.bags_summary}</span>}
            {option.seat_summary && <span><strong className="text-foreground">Seat:</strong> {option.seat_summary}</span>}
          </div>

          {option.member_breakdown && option.member_breakdown.length > 0 && (
            <div className="border border-border/60 px-3 py-2">
              <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Per traveler</p>
              {option.member_breakdown.map(m => (
                <p key={m.traveler_id} className="m-0 flex justify-between text-xs">
                  <span>{m.traveler_name} · {m.origin}</span>
                  <span className="text-forest-deep">{formatCost(m.price_usd)}{m.note ? ` — ${m.note}` : ''}</span>
                </p>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <BookSearchLink href={bookHref} label="Search & book →" variant="primary" />
            <BookSearchLink href={googleHref} label="Google Flights" />
            {isOrganizer && (
              <button
                type="button"
                disabled={busy}
                onClick={onLock}
                className="avanti-btn avanti-btn-primary ml-auto"
              >
                Lock these dates & flight →
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// AI chat panel
// ─────────────────────────────────────────────────────────────────────────
function ChatPanel({
  tripId,
  options,
  onNewOptions,
}: {
  tripId: string
  options: FlightOption[]
  onNewOptions: (opts: FlightOption[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<FlightChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, sending])

  const send = async () => {
    const text = input.trim()
    if (!text || sending) return
    setErr(null)
    const next = [...messages, { role: 'user' as const, content: text }]
    setMessages(next)
    setInput('')
    setSending(true)
    try {
      const res = await chatFlights(tripId, next, options)
      setMessages(m => [...m, { role: 'assistant', content: res.reply }])
      if (res.new_options.length > 0) onNewOptions(res.new_options)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Chat failed')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="avanti-box border border-border bg-card">
      <button type="button" onClick={() => setOpen(o => !o)} className="flex w-full items-center justify-between px-4 py-3 text-left">
        <span className="font-serif text-base text-forest-deep">Ask the flight agent</span>
        <span className="text-xs text-muted-foreground">{open ? 'Hide' : 'Compare more options →'}</span>
      </button>

      {open && (
        <div className="border-t border-border px-4 py-4">
          <p className="mb-3 text-xs text-muted-foreground">
            Ask for anything Google Flights can&apos;t — e.g. &ldquo;nonstop only under $900&rdquo;, &ldquo;compare Delta vs United&rdquo;, or &ldquo;what if we left a day later?&rdquo; New options get added to the list above.
          </p>
          <div className="mb-3 max-h-64 space-y-2 overflow-auto">
            {messages.length === 0 && <p className="text-xs italic text-muted-foreground">No messages yet.</p>}
            {messages.map((m, i) => (
              <div key={i} className={`text-sm ${m.role === 'user' ? 'text-right' : ''}`}>
                <span className={`inline-block max-w-[85%] px-3 py-2 ${m.role === 'user' ? 'bg-forest-deep text-white' : 'border border-border bg-forest-mist/40 text-foreground'}`}>
                  {m.content}
                </span>
              </div>
            ))}
            {sending && <p className="text-xs italic text-muted-foreground">Thinking…</p>}
            <div ref={endRef} />
          </div>
          {err && <p className="mb-2 text-xs text-red-700">{err}</p>}
          <div className="flex gap-2">
            <input
              className="avanti-input flex-1"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); send() } }}
              placeholder="Ask for more options…"
              disabled={sending}
            />
            <button type="button" onClick={send} disabled={sending || !input.trim()} className="avanti-btn avanti-btn-primary">
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Board
// ─────────────────────────────────────────────────────────────────────────
export default function FlightResultsBoard({
  tripId,
  options,
  recommendedDates,
  isOrganizer,
  busy,
  onLock,
  onNewOptions,
}: {
  tripId: string
  options: FlightOption[]
  recommendedDates?: { departure_date: string; return_date: string; why: string } | null
  isOrganizer: boolean
  busy: boolean
  onLock: (optionId: string) => void
  onNewOptions: (opts: FlightOption[]) => void
}) {
  const [filters, setFilters] = useState<FlightFilterState>(EMPTY_FLIGHT_FILTERS)
  const [expanded, setExpanded] = useState<string | null>(options[0]?.id ?? null)

  const filtered = useMemo(() => {
    let list = options.filter(o => {
      if (filters.stops === 'nonstop' && o.stops !== 0) return false
      if (filters.stops === 'one_or_fewer' && o.stops > 1) return false
      if (filters.airlines.length && !o.airlines.some(a => filters.airlines.includes(a))) return false
      if (filters.maxPriceUsd != null && o.price_usd > filters.maxPriceUsd) return false
      if (!windowMatches(filters.departWindow, o.depart_time)) return false
      if (filters.maxDurationHours != null && o.duration_hours > filters.maxDurationHours) return false
      return true
    })
    list = [...list]
    if (filters.sort === 'price') list.sort((a, b) => a.price_usd - b.price_usd)
    else if (filters.sort === 'duration') list.sort((a, b) => a.duration_hours - b.duration_hours)
    else if (filters.sort === 'depart') list.sort((a, b) => departHour(a.depart_time) - departHour(b.depart_time))
    // 'best' keeps the agent's original ranking
    return list
  }, [options, filters])

  return (
    <div className="space-y-4">
      {recommendedDates && (
        <div className="border border-forest-deep/20 bg-forest-pale px-4 py-3">
          <p className="text-[10px] uppercase tracking-wider text-forest-deep m-0">Best dates the agent found</p>
          <p className="font-serif text-lg text-forest-deep m-0">
            {fmtFlightDate(recommendedDates.departure_date)} → {fmtFlightDate(recommendedDates.return_date)}
          </p>
        </div>
      )}

      <FilterBar options={options} filters={filters} setFilters={setFilters} />

      <p className="text-xs text-muted-foreground">
        Showing {filtered.length} of {options.length} options · prices are AI estimates per person, round trip — confirm live before booking.
      </p>

      <div className="space-y-2">
        {filtered.map(o => (
          <OptionRow
            key={o.id}
            tripId={tripId}
            option={o}
            expanded={expanded === o.id}
            onToggle={() => setExpanded(expanded === o.id ? null : o.id)}
            isOrganizer={isOrganizer}
            busy={busy}
            onLock={() => onLock(o.id)}
          />
        ))}
        {filtered.length === 0 && (
          <div className="border border-border bg-card px-4 py-8 text-center">
            <p className="text-sm text-muted-foreground m-0">No options match these filters. Loosen them, or ask the agent below for alternatives.</p>
          </div>
        )}
      </div>

      <ChatPanel tripId={tripId} options={options} onNewOptions={onNewOptions} />
    </div>
  )
}
