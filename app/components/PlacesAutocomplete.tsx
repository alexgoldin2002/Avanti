'use client'
import { useEffect, useRef, useState } from 'react'
import { loadGoogleMapsScript, whenGooglePlacesReady } from '@/lib/google-maps-loader'

interface PlaceResult {
  name: string
  fullName: string
  placeId: string
  lat: number
  lng: number
  types: string[]
}

interface Props {
  value: string
  onChange: (value: string) => void
  onSelect: (place: PlaceResult) => void
  placeholder?: string
  style?: React.CSSProperties
}

declare global {
  interface Window {
    google: any
  }
}

export default function PlacesAutocomplete({ value, onChange, onSelect, placeholder, style }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const autocompleteRef = useRef<any>(null)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  const [selectedPlace, setSelectedPlace] = useState<string | null>(null)

  useEffect(() => {
    if (!value) setSelectedPlace(null)
  }, [value])

  useEffect(() => {
    loadGoogleMapsScript()
    whenGooglePlacesReady().then(() => initAutocomplete())
  }, [])

  const clearSelection = () => {
    setSelectedPlace(null)
    onChange('')
    if (inputRef.current) inputRef.current.value = ''
  }

  const initAutocomplete = () => {
    if (!inputRef.current || !window.google) return
    autocompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
      types: ['(regions)'],
      fields: ['name', 'formatted_address', 'place_id', 'geometry', 'types'],
    })
    autocompleteRef.current.addListener('place_changed', () => {
      const place = autocompleteRef.current.getPlace()
      if (!place.geometry) {
        setError('Please select a valid location from the dropdown')
        return
      }
      setError('')
      const displayName = place.name || place.formatted_address || ''
      setSelectedPlace(displayName)
      onChange(displayName)
      onSelect({
        name: place.name,
        fullName: place.formatted_address,
        placeId: place.place_id,
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng(),
        types: place.types || [],
      })
    })
    setLoaded(true)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    borderBottom: `1px solid ${error ? '#c0392b' : 'var(--border)'}`,
    background: 'transparent',
    padding: '10px 0',
    fontSize: '14px',
    color: 'var(--foreground)',
    outline: 'none',
    fontFamily: 'var(--font-cormorant), Georgia, serif',
    ...style,
  }

  return (
    <div style={{ position: 'relative' }}>
      <input
        ref={inputRef}
        value={selectedPlace ? selectedPlace : value}
        onChange={e => {
          if (selectedPlace) setSelectedPlace(null)
          onChange(e.target.value)
          if (error) setError('')
        }}
        placeholder={placeholder || 'Start typing a city or country...'}
        style={inputStyle}
        autoComplete="off"
      />
      {error && <p style={{ fontSize: '11px', color: '#c0392b', margin: '4px 0 0' }}>{error}</p>}
      {selectedPlace && (
        <div style={{ marginTop: '8px', display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'var(--foreground)', color: '#fff', borderRadius: '20px', padding: '4px 12px', fontSize: '12px', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
          📍 {selectedPlace}
          <button onClick={clearSelection} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: '14px', padding: 0 }}>×</button>
        </div>
      )}
    </div>
  )
}
