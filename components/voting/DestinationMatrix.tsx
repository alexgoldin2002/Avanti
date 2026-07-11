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

function SinglesComparisonDetails({
  rows,
  s,
  gated,
  onGate,
}: {
  rows: DestinationMatrixRow[]
  s: { fontFamily: string }
  gated?: boolean
  onGate?: () => void
}) {
  const [open, setOpen] = useState(false)
  if (gated && onGate) {
    return <GatedDetailsLink label="Full comparison details" onGate={onGate} s={s} />
  }

  return (
    <details
      open={open}
      onToggle={e => setOpen(e.currentTarget.open)}
      style={{ marginBottom: '8px' }}
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
        Full comparison details
        <DisclosureChevron open={open} />
      </summary>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '12px' }}>
        {rows.map((row, index) => (
          <div key={row.name} style={{ padding: '16px', border: '1px solid #e8e8e0', background: '#ffffff' }}>
            <p style={{ fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--forest-deep)', margin: '0 0 8px', fontWeight: 600, ...s }}>
              #{index + 1} · {row.overallScore}/10
            </p>
            <ProConBubbles
              highlight={row.highlight}
              consider={row.consider}
              tradeoff={row.tradeoff}
              synopsis={row.synopsis}
              logistics={row.logistics}
            />
            <p style={{ fontSize: '16px', fontWeight: 500, margin: '0 0 4px', ...s }}>{row.name}</p>
            {costHeadlineFromBudget(row.budgetFit) && (
              <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--forest-deep)', margin: '0 0 8px', ...s }}>{costHeadlineFromBudget(row.budgetFit)}</p>
            )}
            <p style={{ fontSize: '13px', margin: '0 0 8px', lineHeight: 1.6, ...s }}>{row.synopsis}</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px', lineHeight: 1.5, color: 'var(--muted-foreground)' }}>
              <div><strong>Weather:</strong> {row.weather}</div>
              <div><strong>Logistics:</strong> {row.logistics}</div>
              <div><strong>Vibe:</strong> {row.vibe}</div>
              <div><strong>Group fit:</strong> {row.groupFit}</div>
            </div>
            <p style={{ fontSize: '12px', margin: '8px 0 0', lineHeight: 1.5, ...s }}><strong>Activities:</strong> {row.activities}</p>
            <p style={{ fontSize: '12px', margin: '8px 0 0', lineHeight: 1.5, color: 'var(--muted-foreground)', ...s }}><strong>Tradeoff:</strong> {row.tradeoff}</p>
            <BudgetBreakdown budgetFit={row.budgetFit} />
          </div>
        ))}
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
  const includeTripleRoutes = shouldIncludeTripleRoutes(tripShapeAnswers)
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

  const { tabs, defaultTab } = useMemo(
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

  const renderSinglesTable = () => (
    <div style={{ overflowX: 'auto', marginBottom: '16px' }}>
      <p style={{ fontSize: '12px', color: 'var(--muted-foreground)', margin: '0 0 12px', lineHeight: 1.5, ...s }}>
        Pick up to {maxVotes} destinations — each counts as one choice for the group vote.
      </p>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', ...s }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #d4d4c8' }}>
            <th style={{ textAlign: 'left', padding: '10px 8px', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>Pick</th>
            <th style={{ textAlign: 'center', padding: '10px 8px', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--muted-foreground)', width: '48px' }}>Rank</th>
            <th style={{ textAlign: 'left', padding: '10px 8px', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>Destination</th>
            <th style={{ textAlign: 'center', padding: '10px 8px', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>Score</th>
            <th style={{ textAlign: 'left', padding: '10px 8px', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>Best for</th>
            <th style={{ textAlign: 'left', padding: '10px 8px', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>Tradeoff</th>
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row, index) => {
            const isSelected = !!selected[row.name]
            const canSelect = gateSelection || readOnly || isSelected || singlesSelectedCount < maxVotes
            const proChip = resolveHighlightChip(row.highlight || '', {
              synopsis: row.synopsis,
              logistics: row.logistics,
              groupFit: row.groupFit,
              activities: row.activities,
              vibe: row.vibe,
            })
            const conChip = resolveConsiderChip(row.consider || '', row.tradeoff || '', undefined, {
              synopsis: row.synopsis,
              logistics: row.logistics,
              groupFit: row.groupFit,
              activities: row.activities,
              vibe: row.vibe,
            })
            return (
              <tr
                key={row.name}
                style={{
                  borderBottom: '1px solid #e8e8e0',
                  background: isSelected ? '#e8f5ee' : 'transparent',
                  cursor: gateSelection ? 'pointer' : readOnly ? 'default' : canSelect ? 'pointer' : 'not-allowed',
                  opacity: !gateSelection && !readOnly && !canSelect ? 0.5 : 1,
                }}
                onClick={() => {
                  if (gateSelection) {
                    triggerGate()
                    return
                  }
                  if (readOnly || !canSelect) return
                  onToggleSingle(row.name)
                }}
              >
                <td style={{ padding: '12px 8px', verticalAlign: 'top' }}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    disabled={!gateSelection && (readOnly || (!isSelected && singlesSelectedCount >= maxVotes))}
                    onChange={() => {
                      if (gateSelection) {
                        triggerGate()
                        return
                      }
                      onToggleSingle(row.name)
                    }}
                    onClick={e => e.stopPropagation()}
                  />
                </td>
                <td style={{ padding: '12px 8px', verticalAlign: 'top', textAlign: 'center', fontWeight: 600, color: 'var(--forest-deep)' }}>
                  #{index + 1}
                </td>
                <td style={{ padding: '12px 8px', verticalAlign: 'top', minWidth: '140px' }}>
                  <div style={{ display: 'flex', gap: '6px', marginBottom: '6px', flexWrap: 'wrap' }}>
                    {proChip && (
                      <span style={{ ...proBubbleStyle, fontSize: '9px' }}>{proChip}</span>
                    )}
                    {conChip && (
                      <span style={{ ...conBubbleStyle, fontSize: '9px' }}>{conChip}</span>
                    )}
                  </div>
                  <strong style={{ display: 'block', marginBottom: '4px' }}>{row.name}</strong>
                  {onRegenerateSingle && !readOnly && (
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation()
                        onRegenerateSingle(row.name)
                      }}
                      disabled={regeneratingSingleName === row.name}
                      style={{
                        marginBottom: '6px',
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
                  {costHeadlineFromBudget(row.budgetFit) && (
                    <span style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--forest-deep)', marginBottom: '4px' }}>{costHeadlineFromBudget(row.budgetFit)}</span>
                  )}
                  <span style={{ fontSize: '12px', color: 'var(--muted-foreground)', lineHeight: 1.5 }}>{row.synopsis}</span>
                </td>
                <td style={{ padding: '12px 8px', verticalAlign: 'top', textAlign: 'center', fontWeight: 600, color: 'var(--forest-deep)' }}>
                  {row.overallScore}/10
                </td>
                <td style={{ padding: '12px 8px', verticalAlign: 'top', fontSize: '12px', lineHeight: 1.5, maxWidth: '200px' }}>
                  {row.groupFit}
                </td>
                <td style={{ padding: '12px 8px', verticalAlign: 'top', fontSize: '12px', lineHeight: 1.5, maxWidth: '180px', color: 'var(--muted-foreground)' }}>
                  {row.tradeoff}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
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
      {selectable && matrixBlurb && (
        <p style={{ fontSize: '13px', color: 'var(--forest-deep)', margin: 0, lineHeight: 1.5, ...s }}>
          {matrixBlurb}
        </p>
      )}
      {selectable && opts.pickHint && (
        <p style={{ fontSize: '12px', color: 'var(--muted-foreground)', margin: 0, lineHeight: 1.5, ...s }}>
          {opts.pickHint}
        </p>
      )}
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
                  One cheapest route, one splurge paired with a budget-friendly stop.
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

  return (
    <div style={{ marginTop: '24px' }}>
      {tabs.length > 1 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
          {tabs.map(tab => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              style={tabButtonStyle(activeTab === tab)}
            >
              {matrixTabLabel(tab)}
            </button>
          ))}
        </div>
      )}

      {activeTab === 'singles' && renderSinglesTable()}

      {activeTab === 'pairings' && (
        <>
          {sortedPairings.length > 0 ? (
            renderPairings(sortedPairings, true, {
              grouped: true,
              pickHint: `Pick up to ${maxVotes} two-stop routes for the group vote — each counts as one proposal.`,
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
              pickHint: `Pick up to ${maxVotes} three-stop routes for the group vote — each counts as one proposal.`,
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

      {activeTab === 'singles' && (
        <SinglesComparisonDetails
          rows={sortedRows}
          s={s}
          gated={gateSelection}
          onGate={triggerGate}
        />
      )}
    </div>
  )
}
