import {
  PAIRING_CATEGORY_ORDER,
  PAIRING_CATEGORY_SECTION_LABELS,
  type PairingCategory,
} from './matrix-pairing-categories'
import type { DestinationMatrixCombo } from './parse-destination-matrix'
import { sortMatrixCombosByRank } from './parse-destination-matrix'

function normalizePairingLabel(label: string): string {
  return label.trim().toLowerCase()
}

/** Short blurb for cross-category wins, e.g. "Also the best mix of budget". */
export function crossCategoryWinBlurb(categories: PairingCategory[]): string {
  if (categories.length === 0) return ''
  const labels = categories.map(c => PAIRING_CATEGORY_SECTION_LABELS[c].toLowerCase())
  if (labels.length === 1) return `Also the ${labels[0]}`
  return `Also the ${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`
}

/**
 * When the same pairing is rank 1 in multiple categories, keep it only in the
 * first category (travel → budget → activity) and surface the runner-up in the others.
 */
export function resolveCrossCategoryPairingDisplay(pairings: DestinationMatrixCombo[]): {
  displayByCategory: Map<PairingCategory, DestinationMatrixCombo[]>
  alsoWinsByLabel: Map<string, PairingCategory[]>
  /** Rank-2 pairings promoted when the category's #1 won elsewhere. */
  promotedRunnerUpKeys: Set<string>
} {
  const byCategory = new Map<PairingCategory, DestinationMatrixCombo[]>()
  for (const cat of PAIRING_CATEGORY_ORDER) {
    byCategory.set(cat, [])
  }
  for (const p of pairings) {
    if (!p.pairingCategory) continue
    byCategory.get(p.pairingCategory)?.push(p)
  }
  for (const list of byCategory.values()) {
    sortMatrixCombosByRank(list)
  }

  const rank1LabelByCategory = new Map<PairingCategory, string>()
  for (const cat of PAIRING_CATEGORY_ORDER) {
    const items = byCategory.get(cat) || []
    const top = items.find(p => p.rank === 1) ?? items[0]
    if (top) rank1LabelByCategory.set(cat, normalizePairingLabel(top.label))
  }

  const labelToWinCategories = new Map<string, PairingCategory[]>()
  for (const [cat, label] of rank1LabelByCategory) {
    const list = labelToWinCategories.get(label) || []
    list.push(cat)
    labelToWinCategories.set(label, list)
  }

  const crossWinnerLabels = new Set<string>()
  const primaryCategoryByLabel = new Map<string, PairingCategory>()
  const alsoWinsByLabel = new Map<string, PairingCategory[]>()

  for (const [label, cats] of labelToWinCategories) {
    if (cats.length <= 1) continue
    crossWinnerLabels.add(label)
    const sorted = [...cats].sort(
      (a, b) => PAIRING_CATEGORY_ORDER.indexOf(a) - PAIRING_CATEGORY_ORDER.indexOf(b),
    )
    primaryCategoryByLabel.set(label, sorted[0])
    alsoWinsByLabel.set(label, sorted.slice(1))
  }

  const displayByCategory = new Map<PairingCategory, DestinationMatrixCombo[]>()
  const promotedRunnerUpKeys = new Set<string>()

  for (const cat of PAIRING_CATEGORY_ORDER) {
    const items = byCategory.get(cat) || []
    const top = items.find(p => p.rank === 1)
    if (top) {
      const topNorm = normalizePairingLabel(top.label)
      if (crossWinnerLabels.has(topNorm) && primaryCategoryByLabel.get(topNorm) !== cat) {
        const runnerUp = items.find(p => p.rank === 2)
        if (runnerUp) {
          promotedRunnerUpKeys.add(`${cat}:${normalizePairingLabel(runnerUp.label)}`)
        }
      }
    }

    const filtered = items.filter(p => {
      const norm = normalizePairingLabel(p.label)
      if (!crossWinnerLabels.has(norm)) return true
      if (p.rank !== 1) return true
      return primaryCategoryByLabel.get(norm) === cat
    })
    displayByCategory.set(cat, filtered)
  }

  return { displayByCategory, alsoWinsByLabel, promotedRunnerUpKeys }
}
