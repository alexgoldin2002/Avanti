'use client'

import TripFeatureHub from '../_shared/TripFeatureHub'

export default function GameTimeFeature() {
  return (
    <TripFeatureHub
      eyebrow="On trip"
      title="Game time"
      description="Full day-by-day itinerary with flight confirmations, hotel addresses, and linked bookings — your live trip command center."
      requireDestination
      tripPath={id => `/trips/${id}?tab=gametime`}
      icon={
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </svg>
      }
    />
  )
}
