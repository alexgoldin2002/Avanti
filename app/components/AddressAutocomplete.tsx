'use client'

import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import { loadGoogleMapsScript, whenGooglePlacesReady } from '@/lib/google-maps-loader'

type Resolved = { address: string; placeId: string | null; verified: boolean }

type AddressAutocompleteProps = {
  value: string
  verified: boolean
  onChange: (next: Resolved) => void
  inputStyle: CSSProperties
  placeholder?: string
  /** Restrict to a place type, e.g. 'address'. Defaults to full address. */
}

type GooglePlace = {
  place_id?: string
  formatted_address?: string
  name?: string
}

type GoogleAutocomplete = {
  addListener: (ev: string, fn: () => void) => void
  getPlace: () => GooglePlace
}

type GoogleNS = {
  maps?: {
    places?: {
      Autocomplete: new (el: HTMLInputElement, opts: object) => GoogleAutocomplete
    }
  }
}

export default function AddressAutocomplete({
  value,
  verified,
  onChange,
  inputStyle,
  placeholder = '123 Main Street, Chicago, IL 60601',
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const domId = useId()
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    loadGoogleMapsScript()
    whenGooglePlacesReady().then(() => {
      const input = inputRef.current
      if (!input) return
      const g = (window as Window & { google?: GoogleNS }).google
      if (!g?.maps?.places) return
      const autocomplete = new g.maps.places.Autocomplete(input, {
        types: ['address'],
        fields: ['formatted_address', 'name', 'place_id'],
      })
      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace()
        if (place?.place_id) {
          const address = place.formatted_address || place.name || ''
          onChange({ address, placeId: place.place_id, verified: true })
        }
      })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const showError = touched && value.trim() !== '' && !verified

  return (
    <div>
      <input
        ref={inputRef}
        id={domId}
        type="text"
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        onChange={e => onChange({ address: e.target.value, placeId: null, verified: false })}
        onBlur={() => setTouched(true)}
        onKeyDown={e => {
          // Block Enter so the browser doesn't submit free text as-is.
          if (e.key === 'Enter') e.preventDefault()
        }}
        aria-invalid={showError}
        style={{
          ...inputStyle,
          borderBottom: `1px solid ${showError ? '#c0392b' : (inputStyle.borderBottom as string) || '#d4d4c8'}`,
        }}
      />
      {showError && (
        <p role="alert" style={{ fontSize: '12px', color: '#c0392b', margin: '8px 0 0', lineHeight: 1.5, fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
          Pick your address from the dropdown so we can verify it — free text isn’t saved.
        </p>
      )}
      {verified && value.trim() !== '' && (
        <p style={{ fontSize: '11px', color: '#2d6a4f', margin: '6px 0 0', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
          ✓ Verified address
        </p>
      )}
    </div>
  )
}
