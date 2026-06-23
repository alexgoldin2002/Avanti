export function formatCost(n: number | null | undefined): string {
  if (n == null || n <= 0) return '—'
  return `$${Math.round(n).toLocaleString()}`
}

export const TIER_LABELS: Record<string, string> = {
  budget: 'Budget',
  mid: 'Mid',
  luxury: 'Luxury',
}
