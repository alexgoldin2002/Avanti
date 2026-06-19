'use client'

import TripFeatureHub from '../_shared/TripFeatureHub'

export default function SavedPlacesFeature() {
  return (
    <TripFeatureHub
      eyebrow="Inspiration"
      title="Saved places"
      description="Paste TikTok, Instagram, Pinterest, or article links — or drop a screenshot. Avanti identifies the spot and suggests the best day on your trip."
      requireDestination
      tripPath={id => `/trips/${id}/saves`}
      icon={
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        </svg>
      }
    />
  )
}
