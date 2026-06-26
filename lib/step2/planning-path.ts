export type DestinationPlanningPath = 'known' | 'considering' | 'brainstorm'

export const PLANNING_PATH_OPTIONS: {
  id: DestinationPlanningPath
  stepLabel: string
  title: string
  description: string
}[] = [
  {
    id: 'known',
    stepLabel: '2A',
    title: 'We know where we are going',
    description: 'Enter your destination and skip straight to flights and planning.',
  },
  {
    id: 'considering',
    stepLabel: '2B',
    title: 'We have a list of places we are considering',
    description: 'Compare your shortlist side by side, then pick two for the group vote.',
  },
  {
    id: 'brainstorm',
    stepLabel: '2C',
    title: 'We need help brainstorming',
    description: 'Answer a few questions — Avanti suggests destinations, pairings, and routes for the group vote.',
  },
]

export function isDestinationPlanningPath(value: unknown): value is DestinationPlanningPath {
  return value === 'known' || value === 'considering' || value === 'brainstorm'
}

export function pathStepLabel(path: DestinationPlanningPath | null | undefined): string {
  return PLANNING_PATH_OPTIONS.find(o => o.id === path)?.stepLabel ?? '2'
}

export function tripHasKnownDestination(
  trip: {
    destination_planning_path?: string | null
    destination?: string | null
  } | null | undefined
): boolean {
  if (!trip) return false
  return (
    trip.destination_planning_path === 'known' &&
    !!trip.destination &&
    trip.destination !== 'TBD'
  )
}
