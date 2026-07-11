'use client'

import TripFeatureHub from '../_shared/TripFeatureHub'

export default function EntryRequirementsFeature() {
  return (
    <TripFeatureHub
      eyebrow="Before you go"
      title="Entry requirements"
      description="Visas and required documents for your group's nationalities, vaccine requirements, and medication rules — including what to bring because it may not be available at your destination."
      requireDestination
      tripPath={id => `/trips/${id}/entry-requirements`}
      icon={
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
          <rect x="4" y="3" width="16" height="18" rx="2" />
          <circle cx="12" cy="10" r="2.5" />
          <path d="M8.5 16.5c.7-1.6 2-2.5 3.5-2.5s2.8.9 3.5 2.5" />
        </svg>
      }
    />
  )
}
