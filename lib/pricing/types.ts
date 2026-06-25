export type PriceBreakdown = {
  flights?: { min: number; max: number }
  stays?: { min: number; max: number }
  activities?: { min: number; max: number }
  food?: { min: number; max: number }
  transport?: { min: number; max: number }
}

export type BudgetFit = 'fits' | 'over_budget' | 'unknown'

export type DestinationPriceEstimate = {
  minPerPerson: number
  maxPerPerson: number
  budgetFit: BudgetFit
  /** Shown on cards when budgetFit is over_budget */
  budgetFitMessage?: string
  source: 'api' | 'ai' | 'mixed'
  breakdown: PriceBreakdown
  computedAt: string
  /** When APIs were unavailable or partial */
  notes?: string
}
