'use client'

import TripFeatureHub from '../_shared/TripFeatureHub'

export default function EssentialsFeature() {
  return (
    <TripFeatureHub
      eyebrow="Safety"
      title="Destination essentials"
      description="Emergency numbers, nearest hospital to your hotel, embassy contacts, and local apps — rideshare, transit, and food delivery."
      requireDestination
      tripPath={id => `/trips/${id}/essentials`}
      icon={
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      }
    />
  )
}
