'use client'

import { useEffect, useState } from 'react'

type LocatorPayload = {
  city: string
  country: string | null
  continent: string
  mapUrl: string | null
  svg: {
    marker: { x: number; y: number }
    countryRect: { x: number; y: number; width: number; height: number } | null
    continentMarker: { x: number; y: number }
  }
}

function LocatorSvg({
  payload,
  dark,
}: {
  payload: LocatorPayload
  dark?: boolean
}) {
  const land = dark ? '#2a4038' : '#e8ece6'
  const water = dark ? '#1e332c' : '#d4ddd8'
  const countryFill = dark ? 'rgba(255,255,255,0.18)' : 'rgba(45,106,79,0.22)'
  const countryStroke = dark ? 'rgba(255,255,255,0.45)' : 'rgba(45,106,79,0.65)'
  const dot = dark ? '#ffffff' : '#1a1a1a'

  const { marker, countryRect, continentMarker } = payload.svg

  return (
    <svg viewBox="0 0 100 100" className="w-full h-full" aria-hidden>
      <rect width="100" height="100" fill={water} />
      <rect x="8" y="10" width="84" height="68" rx="2" fill={land} />

      {countryRect && (
        <rect
          x={countryRect.x}
          y={countryRect.y}
          width={countryRect.width}
          height={countryRect.height}
          fill={countryFill}
          stroke={countryStroke}
          strokeWidth="1"
          rx="1"
        />
      )}

      <circle cx={marker.x} cy={marker.y} r="3.5" fill={dot} stroke={water} strokeWidth="1.5" />

      <g transform="translate(62, 62)">
        <rect width="34" height="34" rx="2" fill={water} stroke={countryStroke} strokeWidth="0.75" />
        <rect x="3" y="4" width="28" height="24" rx="1" fill={land} />
        {countryRect && (
          <rect
            x={3 + (continentMarker.x / 100) * 22 - 4}
            y={4 + (continentMarker.y / 100) * 18 - 3}
            width="8"
            height="6"
            fill={countryFill}
            stroke={countryStroke}
            strokeWidth="0.5"
            rx="0.5"
          />
        )}
        <circle
          cx={3 + (continentMarker.x / 100) * 22}
          cy={4 + (continentMarker.y / 100) * 18}
          r="1.6"
          fill={dot}
        />
      </g>
    </svg>
  )
}

export default function DestinationLocatorMap({
  destinationName,
  dark = false,
}: {
  destinationName: string
  dark?: boolean
}) {
  const [payload, setPayload] = useState<LocatorPayload | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    setFailed(false)

    const cacheKey = `avanti-locator:${destinationName}`
    try {
      const cached = sessionStorage.getItem(cacheKey)
      if (cached) {
        setPayload(JSON.parse(cached) as LocatorPayload)
        return
      }
    } catch {
      /* ignore */
    }

    fetch(`/api/destinations/locator?name=${encodeURIComponent(destinationName)}`)
      .then(async res => {
        if (!res.ok) throw new Error('not found')
        return res.json() as Promise<LocatorPayload>
      })
      .then(data => {
        if (cancelled) return
        setPayload(data)
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify(data))
        } catch {
          /* ignore */
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })

    return () => {
      cancelled = true
    }
  }, [destinationName])

  const label = payload?.country || payload?.city || destinationName.split(',')[0]

  return (
    <div
      className="absolute top-3 right-3 z-[5] w-[92px] sm:w-[104px] overflow-hidden border shadow-sm"
      style={{
        borderColor: dark ? 'rgba(255,255,255,0.18)' : 'rgba(26,26,26,0.12)',
        background: dark ? 'rgba(0,0,0,0.15)' : '#ffffff',
      }}
      title={`${destinationName} · ${payload?.continent ?? 'Map'}`}
    >
      <div className="aspect-square w-full relative">
        {!payload && !failed && (
          <div
            className="absolute inset-0 animate-pulse"
            style={{ background: dark ? 'rgba(255,255,255,0.06)' : '#ecece4' }}
          />
        )}
        {payload?.mapUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={payload.mapUrl}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        ) : payload ? (
          <LocatorSvg payload={payload} dark={dark} />
        ) : failed ? (
          <div className="absolute inset-0 flex items-center justify-center p-2 text-center">
            <span
              className="text-[9px] uppercase tracking-[0.12em] leading-tight"
              style={{ color: dark ? 'rgba(255,255,255,0.45)' : '#9a9a8a' }}
            >
              {label}
            </span>
          </div>
        ) : null}
      </div>
      <div
        className="px-1.5 py-1 text-center border-t"
        style={{
          borderColor: dark ? 'rgba(255,255,255,0.1)' : 'rgba(26,26,26,0.08)',
          background: dark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.92)',
        }}
      >
        <p
          className="text-[8px] uppercase tracking-[0.14em] m-0 truncate leading-tight"
          style={{ color: dark ? 'rgba(255,255,255,0.55)' : '#6a6a6a' }}
        >
          {payload?.continent ?? '…'}
        </p>
      </div>
    </div>
  )
}
