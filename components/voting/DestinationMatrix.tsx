'use client'

import { useEffect, useMemo, useState } from 'react'
import type {
  DestinationMatrixCombo,
  DestinationMatrixRow,
} from '@/lib/parse-destination-matrix'
import {
  budgetBreakdownDetailBody,
  combineSynopsisWithBudgetVerdict,
  costHeadlineFromBudget,
  parseCostBullets,
} from '@/lib/card-display-helpers'
import { resolveConsiderChip, resolveHighlightChip } from '@/lib/matrix-chip-fields'
import {
  PAIRING_CATEGORY_ORDER,
  PAIRING_CATEGORY_SECTION_LABELS,
  type PairingCategory,
} from '@/lib/matrix-pairing-categories'
import {
  crossCategoryWinBlurb,
  resolveCrossCategoryPairingDisplay,
} from '@/lib/matrix-pairing-cross-wins'
import { compactMatrixBlurb } from '@/lib/matrix-display-helpers'
import {
  coerceMatrixRecommendedTab,
  matrixTabLabel,
  resolveMatrixTabs,
  shouldIncludeTripleRoutes,
  type MatrixTabId,
} from '@/lib/matrix-trip-shape'
import { sortMatrixRowsByScore, sortPairingsByCategory, sortMatrixCombosByRank } from '@/lib/parse-destination-matrix'

type DestinationMatrixProps = {
  rows: DestinationMatrixRow[]
  pairings?: DestinationMatrixCombo[]
  triples?: DestinationMatrixCombo[]
  summary?: string
  recommendedTab?: MatrixTabId | null
  recommendedShape?: string
  tripShapeAnswers?: {
    stops?: string
    stopsOther?: string
    flexLength?: string
    fixedDates?: { start?: string; end?: string }
    dates?: string
    q1?: string
    q3?: string
  }
  selected: Record<string, boolean>
  maxVotes: number
  onToggleSingle: (name: string) => void
  onTogglePairing: (label: string) => void
  onToggleTriple: (label: string) => void
  onRegenerateSingle?: (name: string) => void
  regeneratingSingleName?: string | null
  readOnly?: boolean
  previewGated?: boolean
  onPreviewGate?: () => void
}

const s = { fontFamily: 'var(--font-cormorant), Georgia, serif' } as const

const proBubbleStyle = {
  fontSize: '10px',
  padding: '4px 10px',
  borderRadius: '20px',
  background: '#e8f5ee',
  color: 'var(--forest-deep)',
  border: '0.5px solid #a8d4b8',
  letterSpacing: '0.05em',
  lineHeight: 1.4,
  whiteSpace: 'normal' as const,
  ...s,
} as const

const conBubbleStyle = {
  fontSize: '10px',
  padding: '4px 10px',
  borderRadius: '20px',
  background: '#fdecea',
  color: '#a32d2d',
  border: '0.5px solid #f0b4b0',
  letterSpacing: '0.05em',
  lineHeight: 1.4,
  whiteSpace: 'normal' as const,
  ...s,
} as const

function ProConBubbles({
  highlight,
  consider,
  tradeoff,
  synopsis,
  logistics,
}: {
  highlight?: string
  consider?: string
  tradeoff?: string
  synopsis?: string
  logistics?: string
}) {
  const pro = resolveHighlightChip(highlight || '', { synopsis, logistics, tradeoff })
  const con = resolveConsiderChip(consider || '', tradeoff || '', undefined, { synopsis, logistics })
  if (!pro && !con) return null
  return (
    <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
      {pro && <span style={proBubbleStyle}>{pro}</span>}
      {con && <span style={conBubbleStyle}>{con}</span>}
    </div>
  )
}

function renderBoldMarkdown(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>
    }
    return part
  })
}

function BudgetBreakdown({ budgetFit }: { budgetFit: string }) {
  const body = budgetBreakdownDetailBody(budgetFit)
  if (!body) return null

  const bullets = parseCostBullets(budgetFit)
  const isBulletList = bullets.length > 1 && body.includes('\n')

  return (
    <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '0.5px solid #e8e8e0' }}>
      <p style={{ fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted-foreground)', margin: '0 0 8px', ...s }}>
        Budget breakdown
      </p>
      {isBulletList ? (
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {bullets.map((bullet, i) => (
            <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
              <span style={{ fontSize: '10px', color: '#c4c4b8', flexShrink: 0, marginTop: '3px' }}>—</span>
              <span style={{ fontSize: '12px', color: '#3a3a3a', lineHeight: 1.6 }}>{renderBoldMarkdown(bullet)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p style={{ fontSize: '12px', color: '#3a3a3a', lineHeight: 1.6, margin: 0 }}>
          {renderBoldMarkdown(body)}
        </p>
      )}
    </div>
  )
}

function DisclosureChevron({ open, size = '11px' }: { open: boolean; size?: string }) {
  return (
    <span
      aria-hidden
      style={{
        fontSize: size,
        lineHeight: 1,
        opacity: 0.75,
        display: 'inline-block',
        transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
        transition: 'transform 0.15s ease',
      }}
    >
      ▾
    </span>
  )
}

function LockIcon({ size = 12 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={{ flexShrink: 0, opacity: 0.7 }}
    >
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  )
}

function GatedDetailsLink({
  label,
  onGate,
  s,
}: {
  label: string
  onGate: () => void
  s: { fontFamily: string }
}) {
  const [hover, setHover] = useState(false)

  return (
    <div
      style={{ position: 'relative', marginTop: '4px', display: 'inline-block' }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <button
        type="button"
        onClick={onGate}
        style={{
          fontSize: '12px',
          color: 'var(--forest-deep)',
          cursor: 'pointer',
          listStyle: 'none',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          background: 'none',
          border: 'none',
          padding: 0,
          ...s,
        }}
      >
        {label}
        <LockIcon />
      </button>
      {hover && (
        <span
          role="tooltip"
          style={{
            position: 'absolute',
            left: 0,
            bottom: 'calc(100% + 6px)',
            zIndex: 20,
            whiteSpace: 'nowrap',
            fontSize: '11px',
            lineHeight: 1.4,
            padding: '6px 10px',
            borderRadius: '4px',
            background: 'var(--forest-deep)',
            color: '#fff',
            boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
            ...s,
          }}
        >
          Sign up/in to reveal breakdown
        </span>
      )}
    </div>
  )
}

function PairingCardDetails({
  combo,
  gated,
  onGate,
  s,
}: {
  combo: DestinationMatrixCombo
  gated?: boolean
  onGate?: () => void
  s: { fontFamily: string }
}) {
  const [open, setOpen] = useState(false)
  const hasDetails = Boolean(
    combo.routing || combo.tradeoff || budgetBreakdownDetailBody(combo.budgetFit),
  )

  if (!hasDetails) return null
  if (gated && onGate) {
    return <GatedDetailsLink label="Routing, tradeoffs & budget" onGate={onGate} s={s} />
  }

  return (
    <details
      open={open}
      onToggle={e => setOpen(e.currentTarget.open)}
      style={{ marginTop: '4px' }}
    >
      <summary
        style={{
          fontSize: '12px',
          color: 'var(--forest-deep)',
          cursor: 'pointer',
          listStyle: 'none',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          ...s,
        }}
      >
        Routing, tradeoffs & budget
        <DisclosureChevron open={open} />
      </summary>
      <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {combo.routing && (
          <p style={{ fontSize: '12px', margin: 0, lineHeight: 1.5 }}>
            <strong>Routing:</strong> {combo.routing}
          </p>
        )}
        {combo.tradeoff && (
          <p style={{ fontSize: '12px', margin: 0, lineHeight: 1.5, color: 'var(--muted-foreground)' }}>
            <strong>Tradeoff:</strong> {combo.tradeoff}
          </p>
        )}
        <BudgetBreakdown budgetFit={combo.budgetFit} />
      </div>
    </details>
  )
}

function SingleCardDetails({
  row,
  gated,
  onGate,
  s,
}: {
  row: DestinationMatrixRow
  gated?: boolean
  onGate?: () => void
  s: { fontFamily: string }
}) {
  const [open, setOpen] = useState(false)
  const hasDetails = Boolean(
    row.logistics ||
      row.weather ||
      row.activities ||
      row.groupFit ||
      row.vibe ||
      row.tradeoff ||
      budgetBreakdownDetailBody(row.budgetFit),
  )

  if (!hasDetails) return null
  if (gated && onGate) {
    return <GatedDetailsLink label="Routing, tradeoffs & budget" onGate={onGate} s={s} />
  }

  return (
    <details
      open={open}
      onToggle={e => setOpen(e.currentTarget.open)}
      style={{ marginTop: '4px' }}
    >
      <summary
        style={{
          fontSize: '12px',
          color: 'var(--forest-deep)',
          cursor: 'pointer',
          listStyle: 'none',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          ...s,
        }}
      >
        Routing, tradeoffs & budget
        <DisclosureChevron open={open} />
      </summary>
      <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {row.logistics && (
          <p style={{ fontSize: '12px', margin: 0, lineHeight: 1.5 }}>
            <strong>Logistics:</strong> {row.logistics}
          </p>
        )}
        {row.weather && (
          <p style={{ fontSize: '12px', margin: 0, lineHeight: 1.5 }}>
            <strong>Weather:</strong> {row.weather}
          </p>
        )}
        {row.activities && (
          <p style={{ fontSize: '12px', margin: 0, lineHeight: 1.5 }}>
            <strong>Activities:</strong> {row.activities}
          </p>
        )}
        {row.groupFit && (
          <p style={{ fontSize: '12px', margin: 0, lineHeight: 1.5 }}>
            <strong>Best for:</strong> {row.groupFit}
          </p>
        )}
        {row.vibe && (
          <p style={{ fontSize: '12px', margin: 0, lineHeight: 1.5 }}>
            <strong>Vibe:</strong> {row.vibe}
          </p>
        )}
        {row.tradeoff && (
          <p style={{ fontSize: '12px', margin: 0, lineHeight: 1.5, color: 'var(--muted-foreground)' }}>
            <strong>Tradeoff:</strong> {row.tradeoff}
          </p>
        )}
        <BudgetBreakdown budgetFit={row.budgetFit} />
      </div>
    </details>
  )
}

function tabButtonStyle(active: boolean) {
  return {
    padding: '8px 16px',
    border: active ? '1px solid var(--forest-deep)' : '1px solid #d4d4c8',
    background: active ? '#e8f5ee' : 'transparent',
    color: active ? 'var(--forest-deep)' : 'var(--muted-foreground)',
    fontSize: '11px',
    letterSpacing: '0.12em',
    textTransform: 'uppercase' as const,
    cursor: 'pointer',
    ...s,
  }
}

export default function DestinationMatrix({
  rows,
  pairings = [],
  triples = [],
  summary,
  recommendedTab,
  recommendedShape,
  tripShapeAnswers = {},
  selected,
  maxVotes,
  onToggleSingle,
  onTogglePairing,
  onToggleTriple,
  onRegenerateSingle,
  regeneratingSingleName = null,
  readOnly = false,
  previewGated = false,
  onPreviewGate,
}: DestinationMatrixProps) {
  const gateSelection = previewGated && !!onPreviewGate
  const triggerGate = () => {
    if (gateSelection) onPreviewGate!()
  }
  const includeTripleRoutes = shouldIncludeTripleRoutes(tripShapeAnswers, {
    q1: tripShapeAnswers.q1,
    q3: tripShapeAnswers.q3,
  })
  const visibleTriples = includeTripleRoutes ? triples : []
  const safeRecommendedTab = coerceMatrixRecommendedTab(recommendedTab, tripShapeAnswers)

  const sortedRows = useMemo(() => {
    const copy = [...rows]
    sortMatrixRowsByScore(copy)
    return copy
  }, [rows])

  const sortedPairings = useMemo(() => {
    const copy = [...pairings]
    sortPairingsByCategory(copy)
    return copy
  }, [pairings])

  const { displayByCategory: pairingsByCategory, alsoWinsByLabel, promotedRunnerUpKeys } = useMemo(
    () => resolveCrossCategoryPairingDisplay(sortedPairings),
    [sortedPairings],
  )

  const sortedTriples = useMemo(() => {
    const copy = [...visibleTriples]
    sortMatrixCombosByRank(copy)
    return copy
  }, [visibleTriples])

  const singleNames = useMemo(() => new Set(sortedRows.map(r => r.name)), [sortedRows])
  const pairingLabels = useMemo(() => new Set(sortedPairings.map(p => p.label)), [sortedPairings])
  const tripleLabels = useMemo(() => new Set(sortedTriples.map(t => t.label)), [sortedTriples])

  const singlesSelectedCount = useMemo(
    () => Object.entries(selected).filter(([k, v]) => v && singleNames.has(k)).length,
    [selected, singleNames],
  )
  const pairingsSelectedCount = useMemo(
    () => Object.entries(selected).filter(([k, v]) => v && pairingLabels.has(k)).length,
    [selected, pairingLabels],
  )
  const triplesSelectedCount = useMemo(
    () => Object.entries(selected).filter(([k, v]) => v && tripleLabels.has(k)).length,
    [selected, tripleLabels],
  )

  const { tabs, defaultTab, pace } = useMemo(
    () =>
      resolveMatrixTabs(tripShapeAnswers, {
        hasPairings: pairings.length > 0,
        hasTriples: visibleTriples.length > 0,
      }),
    [tripShapeAnswers, pairings.length, visibleTriples.length],
  )

  const initialTab =
    safeRecommendedTab && tabs.includes(safeRecommendedTab) ? safeRecommendedTab : defaultTab
  const [activeTab, setActiveTab] = useState<MatrixTabId>(initialTab)

  useEffect(() => {
    const next =
      safeRecommendedTab && tabs.includes(safeRecommendedTab) ? safeRecommendedTab : defaultTab
    setActiveTab(t => (tabs.includes(t) ? t : next))
  }, [safeRecommendedTab, defaultTab, tabs])

  const matrixBlurb = useMemo(
    () => compactMatrixBlurb(recommendedShape, summary),
    [recommendedShape, summary],
  )

  const pairingCategoryBoxStyle = {
    border: '1px solid #a8d4b8',
    background: '#e8f5ee',
    padding: '16px',
    borderRadius: '0',
  } as const

  const pairingCategoryTitleStyle = {
    fontSize: '15px',
    fontWeight: 600,
    color: 'var(--forest-deep)',
    margin: 0,
    letterSpacing: '0.02em',
    ...s,
  } as const

  const handleSingleClick = (row: DestinationMatrixRow) => {
    if (gateSelection) {
      triggerGate()
      return
    }
    if (readOnly) return
    onToggleSingle(row.name)
  }

  const handlePairingClick = (combo: DestinationMatrixCombo) => {
    if (gateSelection) {
      triggerGate()
      return
    }
    if (readOnly) return
    onTogglePairing(combo.label)
  }

  const handleTripleClick = (combo: DestinationMatrixCombo) => {
    if (gateSelection) {
      triggerGate()
      return
    }
    if (readOnly) return
    onToggleTriple(combo.label)
  }

  const renderSingleCard = (row: DestinationMatrixRow, index: number) => {
    const isSelected = !!selected[row.name]
    const canSelect = gateSelection || readOnly || isSelected || singlesSelectedCount < maxVotes

    return (
      <div
        key={row.name}
        style={{
          padding: '16px',
          border: isSelected ? '1px solid var(--forest-deep)' : '1px solid #e8e8e0',
          background: isSelected ? '#e8f5ee' : '#ffffff',
          opacity: gateSelection
            ? 1
            : !readOnly && !isSelected && singlesSelectedCount >= maxVotes
              ? 0.5
              : 1,
          ...s,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', flex: 1 }}>
            <input
              type="checkbox"
              checked={isSelected}
              disabled={!gateSelection && (readOnly || (!isSelected && singlesSelectedCount >= maxVotes))}
              onChange={() => handleSingleClick(row)}
              style={{ marginTop: '6px', cursor: canSelect ? 'pointer' : 'not-allowed' }}
            />
            <div style={{ flex: 1 }}>
              <strong
                style={{
                  display: 'block',
                  fontSize: '18px',
                  fontWeight: 500,
                  lineHeight: 1.3,
                  color: '#1a1a1a',
                  cursor: canSelect ? 'pointer' : 'default',
                  ...s,
                }}
                onClick={() => {
                  if (!canSelect) return
                  handleSingleClick(row)
                }}
              >
                {row.name}
              </strong>
              <span
                style={{
                  display: 'block',
                  fontSize: '10px',
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: 'var(--muted-foreground)',
                  marginTop: '4px',
                  ...s,
                }}
              >
                Rank #{index + 1}
              </span>
              {onRegenerateSingle && !readOnly && (
                <button
                  type="button"
                  onClick={() => onRegenerateSingle(row.name)}
                  disabled={regeneratingSingleName === row.name}
                  style={{
                    marginTop: '8px',
                    padding: '3px 8px',
                    border: '1px solid #d4d4c8',
                    background: 'transparent',
                    color: 'var(--muted-foreground)',
                    fontSize: '9px',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    cursor: regeneratingSingleName === row.name ? 'default' : 'pointer',
                    opacity: regeneratingSingleName === row.name ? 0.5 : 1,
                    ...s,
                  }}
                >
                  {regeneratingSingleName === row.name ? '…' : '↻ New'}
                </button>
              )}
            </div>
          </div>
          {row.overallScore > 0 && (
            <span style={{ fontWeight: 600, color: 'var(--forest-deep)', flexShrink: 0, fontSize: '13px' }}>
              {row.overallScore}/10
            </span>
          )}
        </div>
        <ProConBubbles
          highlight={row.highlight}
          consider={row.consider}
          tradeoff={row.tradeoff}
          synopsis={row.synopsis}
          logistics={row.logistics}
        />
        {costHeadlineFromBudget(row.budgetFit) && (
          <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--forest-deep)', margin: '0 0 10px', lineHeight: 1.4, ...s }}>
            {costHeadlineFromBudget(row.budgetFit)}
          </p>
        )}
        <p style={{ fontSize: '12px', margin: '0 0 8px', lineHeight: 1.6, color: 'var(--muted-foreground)' }}>
          {combineSynopsisWithBudgetVerdict(row.synopsis, row.budgetFit)}
        </p>
        <SingleCardDetails
          row={row}
          gated={gateSelection}
          onGate={triggerGate}
          s={s}
        />
      </div>
    )
  }

  const renderSingles = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
      {sortedRows.map((row, index) => renderSingleCard(row, index))}
    </div>
  )

  const renderPairingCard = (
    combo: DestinationMatrixCombo,
    selectable: boolean,
    opts: {
      selectedCount: number
      onToggle: (combo: DestinationMatrixCombo) => void
      cardKeyPrefix?: string
    },
  ) => {
    const isSelected = !!selected[combo.label]
    const canSelect = gateSelection || (selectable && !readOnly && (isSelected || opts.selectedCount < maxVotes))
    const alsoWins = alsoWinsByLabel.get(combo.label.trim().toLowerCase()) ?? []
    const crossWinBlurb = crossCategoryWinBlurb(alsoWins)
    const isPromotedRunnerUp =
      !!combo.pairingCategory &&
      promotedRunnerUpKeys.has(`${combo.pairingCategory}:${combo.label.trim().toLowerCase()}`)
    const budgetRoleLabel =
      combo.pairingCategory === 'budget'
        ? combo.rank === 1
          ? 'Cheapest pairing'
          : combo.rank === 2
            ? 'Splurge + balance'
            : null
        : null

    return (
      <div
        key={`${opts.cardKeyPrefix || combo.pairingCategory || 'pair'}-${combo.rank}-${combo.label}`}
        style={{
          position: 'relative',
          padding: '16px',
          paddingTop: crossWinBlurb ? '36px' : '16px',
          paddingRight: crossWinBlurb ? '120px' : '16px',
          border: isSelected ? '1px solid var(--forest-deep)' : '1px solid #e8e8e0',
          background: isSelected ? '#e8f5ee' : '#ffffff',
          opacity: gateSelection
            ? 1
            : selectable && !readOnly && !isSelected && opts.selectedCount >= maxVotes
              ? 0.5
              : 1,
          ...s,
        }}
      >
        {crossWinBlurb && (
          <div
            title={crossWinBlurb}
            style={{
              position: 'absolute',
              top: '10px',
              right: '10px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              gap: '2px',
              maxWidth: '108px',
              textAlign: 'right',
              pointerEvents: 'none',
            }}
          >
            <span style={{ color: '#b8860b', fontSize: '15px', lineHeight: 1 }} aria-hidden>
              ★
            </span>
            <span
              style={{
                fontSize: '10px',
                letterSpacing: '0.04em',
                color: 'var(--muted-foreground)',
                lineHeight: 1.35,
                ...s,
              }}
            >
              {crossWinBlurb}
            </span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', flex: 1 }}>
            {selectable && (
              <input
                type="checkbox"
                checked={isSelected}
                disabled={!gateSelection && (readOnly || (!isSelected && opts.selectedCount >= maxVotes))}
                onChange={() => {
                  if (gateSelection) {
                    triggerGate()
                    return
                  }
                  opts.onToggle(combo)
                }}
                style={{ marginTop: '6px', cursor: canSelect ? 'pointer' : 'not-allowed' }}
              />
            )}
            <div style={{ flex: 1 }}>
              <strong
                style={{
                  display: 'block',
                  fontSize: '18px',
                  fontWeight: 500,
                  lineHeight: 1.3,
                  color: '#1a1a1a',
                  cursor: selectable && canSelect ? 'pointer' : 'default',
                  ...s,
                }}
                onClick={() => {
                  if (gateSelection) {
                    triggerGate()
                    return
                  }
                  if (!selectable || readOnly || !canSelect) return
                  opts.onToggle(combo)
                }}
              >
                {combo.label}
              </strong>
              {budgetRoleLabel && (
                <span
                  style={{
                    display: 'block',
                    fontSize: '10px',
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: 'var(--muted-foreground)',
                    marginTop: '4px',
                    ...s,
                  }}
                >
                  {budgetRoleLabel}
                </span>
              )}
              {isPromotedRunnerUp && !budgetRoleLabel && (
                <span
                  style={{
                    display: 'block',
                    fontSize: '10px',
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: 'var(--muted-foreground)',
                    marginTop: '4px',
                    ...s,
                  }}
                >
                  Runner-up · equal pick here
                </span>
              )}
              {isPromotedRunnerUp && budgetRoleLabel && (
                <span
                  style={{
                    display: 'block',
                    fontSize: '10px',
                    letterSpacing: '0.08em',
                    color: 'var(--muted-foreground)',
                    marginTop: '2px',
                    fontStyle: 'italic',
                    ...s,
                  }}
                >
                  Top pick in this category leads elsewhere
                </span>
              )}
            </div>
          </div>
          {combo.overallScore > 0 && (
            <span style={{ fontWeight: 600, color: 'var(--forest-deep)', flexShrink: 0, fontSize: '13px' }}>
              {combo.overallScore}/10
            </span>
          )}
        </div>
        {costHeadlineFromBudget(combo.budgetFit) && (
          <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--forest-deep)', margin: '0 0 10px', lineHeight: 1.4, ...s }}>
            {costHeadlineFromBudget(combo.budgetFit)}
          </p>
        )}
        <p style={{ fontSize: '12px', margin: '0 0 8px', lineHeight: 1.6, color: 'var(--muted-foreground)' }}>
          {combineSynopsisWithBudgetVerdict(combo.synopsis, combo.budgetFit)}
        </p>
        <PairingCardDetails
          combo={combo}
          gated={gateSelection}
          onGate={triggerGate}
          s={s}
        />
      </div>
    )
  }

  const renderPairings = (
    combos: DestinationMatrixCombo[],
    selectable: boolean,
    opts: {
      grouped?: boolean
      pickHint?: string
      selectedCount: number
      onToggle: (combo: DestinationMatrixCombo) => void
      cardKeyPrefix?: string
    },
  ) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '16px' }}>
      {opts.grouped ? (
        PAIRING_CATEGORY_ORDER.map(cat => {
          const items = pairingsByCategory.get(cat) || []
          return (
            <div
              key={cat}
              style={{ ...pairingCategoryBoxStyle, display: 'flex', flexDirection: 'column', gap: '10px' }}
            >
              <h3 style={{ ...pairingCategoryTitleStyle, marginBottom: '4px' }}>
                {PAIRING_CATEGORY_SECTION_LABELS[cat]}
              </h3>
              {cat === 'budget' && items.length > 0 && (
                <p style={{ fontSize: '12px', color: 'var(--muted-foreground)', margin: '0 0 4px', lineHeight: 1.5, ...s }}>
                  Cheapest route + one splurge/budget mix.
                </p>
              )}
              {items.length === 0 ? (
                <p style={{ fontSize: '12px', color: 'var(--muted-foreground)', margin: 0, ...s }}>
                  No pairings here — regenerate the comparison to fill this section.
                </p>
              ) : (
                <>
                  {items.map(combo =>
                    renderPairingCard(combo, selectable, {
                      selectedCount: opts.selectedCount,
                      onToggle: opts.onToggle,
                      cardKeyPrefix: opts.cardKeyPrefix,
                    }),
                  )}
                  {items.length < 2 &&
                    !items.some(
                      combo =>
                        combo.pairingCategory &&
                        promotedRunnerUpKeys.has(
                          `${combo.pairingCategory}:${combo.label.trim().toLowerCase()}`,
                        ),
                    ) && (
                    <p style={{ fontSize: '12px', color: 'var(--muted-foreground)', margin: 0, fontStyle: 'italic', ...s }}>
                      Only one option here — regenerate the comparison for a second pairing in this category.
                    </p>
                  )}
                </>
              )}
            </div>
          )
        })
      ) : (
        combos.map(combo =>
          renderPairingCard(combo, selectable, {
            selectedCount: opts.selectedCount,
            onToggle: opts.onToggle,
            cardKeyPrefix: opts.cardKeyPrefix,
          }),
        )
      )}
    </div>
  )

  const tabPickHint =
    activeTab === 'singles'
      ? `Pick up to ${maxVotes} cities.`
      : activeTab === 'pairings'
        ? `Pick up to ${maxVotes} two-stop routes.`
        : `Pick up to ${maxVotes} three-stop routes.`

  return (
    <div style={{ marginTop: '24px' }}>
      {matrixBlurb && (
        <p style={{ fontSize: '13px', color: 'var(--forest-deep)', margin: '0 0 8px', lineHeight: 1.5, ...s }}>
          {matrixBlurb}
        </p>
      )}
      {!readOnly && (
        <p style={{ fontSize: '12px', color: 'var(--muted-foreground)', margin: '0 0 16px', lineHeight: 1.5, ...s }}>
          {tabPickHint}
        </p>
      )}
      {tabs.length > 1 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
          {tabs.map(tab => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              style={tabButtonStyle(activeTab === tab)}
            >
              {matrixTabLabel(tab, pace)}
            </button>
          ))}
        </div>
      )}

      {activeTab === 'singles' && renderSingles()}

      {activeTab === 'pairings' && (
        <>
          {sortedPairings.length > 0 ? (
            renderPairings(sortedPairings, true, {
              grouped: true,
              selectedCount: pairingsSelectedCount,
              onToggle: handlePairingClick,
            })
          ) : (
            <p style={{ fontSize: '13px', color: 'var(--muted-foreground)', ...s }}>
              No pairings generated — try regenerating, or use the one-stop view.
            </p>
          )}
        </>
      )}

      {activeTab === 'triples' && (
        <>
          {sortedTriples.length > 0 ? (
            renderPairings(sortedTriples, true, {
              selectedCount: triplesSelectedCount,
              onToggle: handleTripleClick,
              cardKeyPrefix: 'triple',
            })
          ) : (
            <p style={{ fontSize: '13px', color: 'var(--muted-foreground)', ...s }}>
              No three-stop routes yet — regenerate the comparison to generate them for this trip length.
            </p>
          )}
        </>
      )}
    </div>
  )
}
