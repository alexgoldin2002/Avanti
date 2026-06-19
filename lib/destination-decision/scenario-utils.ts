import type { FlightToggle, DateToggle, ScenarioMatrix, WorksForYou } from './types'

function emptyCell() {
  return { cost: 0, works: 'no' as WorksForYou }
}

export function getScenarioCost(
  scenarios: ScenarioMatrix,
  flight: FlightToggle,
  dates: DateToggle
): { cost: number; works: WorksForYou } {
  return scenarios[flight]?.[dates] || emptyCell()
}

export function personalCostFromScenarios(
  scenarios: ScenarioMatrix,
  toggles: { flight?: FlightToggle; dates?: DateToggle }
): { cost: number; works: WorksForYou } {
  const flight = toggles.flight || 'one_stop'
  const dates = toggles.dates || 'best'
  return getScenarioCost(scenarios, flight, dates)
}
