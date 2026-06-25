export type TravelWindow = {
  start: string
  end: string
  /** Human label, e.g. "Jun 10–17" or "June" */
  label: string
}

export type ClimateSummary = {
  /** One-line card copy */
  line: string
  avgHighF: number
  avgLowF: number
  rainyDayFraction: number
  sampleYears: number
  window: TravelWindow
}
