'use client'

import { useMemo, useState } from 'react'
import { formatCost } from '@/lib/accommodation/client-api'
import type { StayOption } from '@/lib/accommodation/types'
import BookSearchLink from '../../../components/BookSearchLink'
import { isRentalStyleStay } from '@/lib/booking/search-links'

const badgeStyles: Record<string, string> = {
  best: 'bg-forest-deep text-white',
  cheapest: 'bg-emerald-600 text-white',
  group_fit: 'bg-amber-600 text-white',
  top_rated: 'bg-sky-600 text-white',
}

const badgeLabels: Record<string, string> = {
  best: 'Best pick',
  cheapest: 'Cheapest',
  group_fit: 'Group fit',
  top_rated: 'Top rated',
}

export function fmtStayDate(iso: string): string {
  const [y, m, d] = (iso || '').split('-').map(Number)
  if (!y || !m || !d) return iso
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  })
}

type StayResultsBoardProps = {
  options: StayOption[]
  isOrganizer: boolean
  busy: boolean
  onLock: (optionId: string) => void
  onRefresh?: () => void
}

export default function StayResultsBoard({
  options,
  isOrganizer,
  busy,
  onLock,
  onRefresh,
}: StayResultsBoardProps) {
  const [sort, setSort] = useState<'best' | 'price' | 'rating'>('best')
  const [typeFilter, setTypeFilter] = useState<'all' | 'hotel' | 'rental'>('all')
  const [expanded, setExpanded] = useState<string | null>(null)

  const sorted = useMemo(() => {
    let list = [...options]
    if (typeFilter === 'hotel') {
      list = list.filter(o => !isRentalStyleStay(o.type))
    } else if (typeFilter === 'rental') {
      list = list.filter(o => isRentalStyleStay(o.type))
    }
    if (sort === 'price') list.sort((a, b) => a.price_per_night_usd - b.price_per_night_usd)
    else if (sort === 'rating') list.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    else list.sort((a, b) => (b.recommended ? 1 : 0) - (a.recommended ? 1 : 0))
    return list
  }, [options, sort, typeFilter])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {(['best', 'price', 'rating'] as const).map(key => (
          <button
            key={key}
            type="button"
            onClick={() => setSort(key)}
            className={`rounded-full border px-3.5 py-1.5 text-xs transition-colors ${
              sort === key ? 'border-forest-deep bg-forest-pale text-forest-deep' : 'border-border bg-card text-muted-foreground'
            }`}
          >
            {key === 'best' ? 'Best' : key === 'price' ? 'Price' : 'Rating'}
          </button>
        ))}
        {(['all', 'hotel', 'rental'] as const).map(key => (
          <button
            key={key}
            type="button"
            onClick={() => setTypeFilter(key)}
            className={`rounded-full border px-3.5 py-1.5 text-xs transition-colors ${
              typeFilter === key ? 'border-forest-deep bg-forest-pale text-forest-deep' : 'border-border bg-card text-muted-foreground'
            }`}
          >
            {key === 'all' ? 'All stays' : key === 'hotel' ? 'Hotels' : 'Rentals'}
          </button>
        ))}
        {onRefresh && (
          <button type="button" disabled={busy} onClick={onRefresh} className="ml-auto text-xs text-muted-foreground hover:text-forest-deep">
            {busy ? 'Refreshing…' : '↻ Refresh search'}
          </button>
        )}
      </div>

      <div className="space-y-3">
        {sorted.map(option => {
          const isOpen = expanded === option.id
          const preferRental = isRentalStyleStay(option.type)
          const links = option.book_links

          return (
            <div
              key={option.id}
              className={`avanti-box border bg-card transition-colors ${
                option.recommended ? 'border-forest-deep/40' : 'border-border'
              }`}
            >
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : option.id)}
                className="w-full p-5 text-left"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      {option.badges.map(b => (
                        <span key={b} className={`text-[10px] uppercase tracking-wider px-2 py-0.5 ${badgeStyles[b] || 'bg-muted text-foreground'}`}>
                          {badgeLabels[b] || b}
                        </span>
                      ))}
                      {option.source === 'liteapi' && (
                        <span className="text-[10px] uppercase tracking-wider text-forest-deep">Live rate</span>
                      )}
                    </div>
                    <p className="font-serif text-lg m-0">{option.name}</p>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1 mb-0">
                      {[option.type, option.area, option.stars != null && `${option.stars}★`, option.rating != null && `${option.rating}/10`].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-serif text-xl text-forest-deep m-0">{formatCost(option.price_per_night_usd)}</p>
                    <p className="text-[10px] text-muted-foreground m-0">/night · {formatCost(option.total_usd)} total</p>
                  </div>
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-border px-5 pb-5 pt-4 space-y-4">
                  {option.address && <p className="text-sm text-muted-foreground m-0">{option.address}</p>}
                  {option.room_summary && <p className="text-sm m-0">{option.room_summary}</p>}
                  {option.group_fit && <p className="text-sm m-0"><span className="text-muted-foreground">Group fit:</span> {option.group_fit}</p>}
                  {option.pros.length > 0 && (
                    <ul className="text-sm m-0 pl-4 space-y-1">
                      {option.pros.map((p, i) => <li key={i}>{p}</li>)}
                    </ul>
                  )}
                  {option.cons.length > 0 && (
                    <ul className="text-sm text-muted-foreground m-0 pl-4 space-y-1">
                      {option.cons.map((c, i) => <li key={i}>{c}</li>)}
                    </ul>
                  )}
                  <div className="flex flex-wrap gap-2 pt-2">
                    {preferRental ? (
                      <>
                        {links.vrbo && <BookSearchLink href={links.vrbo} label="VRBO →" variant="primary" />}
                        {links.airbnb && <BookSearchLink href={links.airbnb} label="Airbnb" />}
                        {links.booking && <BookSearchLink href={links.booking} label="Hotels →" />}
                      </>
                    ) : (
                      <>
                        {links.booking && <BookSearchLink href={links.booking} label="Booking.com →" variant="primary" />}
                        {links.expedia && <BookSearchLink href={links.expedia} label="Expedia →" />}
                        {links.vrbo && <BookSearchLink href={links.vrbo} label="VRBO →" />}
                      </>
                    )}
                    {links.google && <BookSearchLink href={links.google} label="Google Hotels" />}
                  </div>
                  {isOrganizer && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onLock(option.id)}
                      className="avanti-btn avanti-btn-primary w-full mt-2"
                    >
                      {busy ? 'Locking…' : 'Lock this stay for the group →'}
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
