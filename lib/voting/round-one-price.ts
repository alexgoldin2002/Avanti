import { formatUsd } from '@/lib/group-budget'
import type { DestinationPriceEstimate } from '@/lib/pricing/types'

export function formatPriceRangeLine(estimate: DestinationPriceEstimate | null | undefined): string {
  if (!estimate) return 'Price estimate pending'

  if (estimate.minPerPerson === estimate.maxPerPerson) {
    return `${formatUsd(estimate.minPerPerson)} / person`
  }
  return `${formatUsd(estimate.minPerPerson)} — ${formatUsd(estimate.maxPerPerson)} / person`
}

export function priceRangeSubline(estimate: DestinationPriceEstimate | null | undefined): string | null {
  if (!estimate) return null
  if (estimate.source === 'ai') {
    return 'Rough estimate — flights, hotels, and activities will be priced in detail after you pick a destination.'
  }
  if (estimate.source === 'mixed') {
    return 'Based on live pricing where available, plus estimates for the rest.'
  }
  return 'Based on live flight, hotel, and activity pricing for your dates, plus local transport and meals.'
}

export function budgetFitStyle(budgetFit: DestinationPriceEstimate['budgetFit']): {
  color: string
  background: string
} {
  if (budgetFit === 'over_budget') {
    return { color: '#8b2e2e', background: '#fdf2f2' }
  }
  return { color: '#3a5a40', background: '#f2f7f3' }
}
