'use client'

import TripFeatureHub from '../_shared/TripFeatureHub'

export default function BriefingsFeature() {
  return (
    <TripFeatureHub
      eyebrow="Notifications"
      title="Daily briefings"
      description="Night-before preview of tomorrow — what to pack and when to wake up. Morning texts with leave-by times and when you'll be back at the hotel."
      requireDestination
      tripPath={id => `/trips/${id}/briefings`}
      icon={
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      }
    />
  )
}
