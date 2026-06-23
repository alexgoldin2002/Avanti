'use client'

import type { ReactNode } from 'react'
import {
  activitiesSummary,
  logisticsSummary,
  parseCostRange,
  parseGroupFitDisplay,
  parseWeatherDisplay,
  weightedScore,
  type InterestWeights,
  type VotingColumn,
} from '@/lib/destination-decision/voting-display'
import { TIER_LABELS } from '@/lib/destination-decision/client-api'
import type { DestinationTier } from '@/lib/destination-decision/types'

function CostRangeCell({ col }: { col: VotingColumn }) {
  const costText = String(col.card.cost || '')
  const range = parseCostRange(costText, col.tier, col.personalCost)
  const symbolRange =
    range.tierLow === range.tierHigh
      ? range.symbolLow
      : `${range.symbolLow} – ${range.symbolHigh}`

  return (
    <div className="text-center">
      <p className="font-serif text-lg text-forest-deep tracking-tight m-0 mb-1">{symbolRange}</p>
      {range.usdLabel && (
        <p className="text-[10px] text-muted-foreground m-0 tabular-nums leading-snug">{range.usdLabel}</p>
      )}
    </div>
  )
}

function WeatherCell({ col }: { col: VotingColumn }) {
  const weather = parseWeatherDisplay(String(col.card.weather || ''))
  return (
    <div className="text-center">
      <p className="text-2xl m-0 mb-1 leading-none" aria-hidden>
        {weather.emoji}
      </p>
      <p className="font-serif text-base text-forest-deep m-0 tabular-nums">
        {weather.tempLabel ?? '—'}
      </p>
    </div>
  )
}

function StarRow({
  value,
  onChange,
  disabled,
  size = 'base',
}: {
  value: number
  onChange?: (n: number) => void
  disabled?: boolean
  size?: 'sm' | 'base'
}) {
  return (
    <div className="flex justify-center gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          disabled={disabled || !onChange}
          onClick={() => onChange?.(n)}
          className={`${size === 'sm' ? 'text-sm' : 'text-base'} leading-none p-0.5 ${
            value >= n ? 'text-forest-deep' : 'text-border'
          } ${onChange && !disabled ? 'cursor-pointer hover:text-forest-deep/70' : 'cursor-default'}`}
          aria-label={`${n} stars`}
        >
          ★
        </button>
      ))}
    </div>
  )
}

function GroupFitCell({
  col,
  userScore,
  onUserScore,
  readOnly,
}: {
  col: VotingColumn
  userScore: number
  onUserScore?: (n: number) => void
  readOnly?: boolean
}) {
  const fit = parseGroupFitDisplay(col.card, col.groupSummary, col.worksForYou)

  return (
    <div className="text-center space-y-3 px-1">
      <div>
        <p className="text-[9px] uppercase tracking-[0.14em] text-muted-foreground mb-1">Avanti</p>
        <StarRow value={fit.avantiStars} disabled size="sm" />
        {fit.membersTotal != null && fit.membersTotal > 0 && (
          <p className="text-[10px] text-muted-foreground mt-1 mb-0">
            {fit.membersYes}/{fit.membersTotal} budgets work
          </p>
        )}
        {fit.worksForYou && (
          <p className="text-[10px] text-muted-foreground mt-0.5 mb-0 capitalize">
            You: {fit.worksForYou}
          </p>
        )}
        {fit.cardSnippet && (
          <p className="text-[10px] text-muted-foreground mt-1 mb-0 line-clamp-2 leading-snug">
            {fit.cardSnippet}
          </p>
        )}
      </div>
      {!readOnly && (
        <div className="border-t border-border/60 pt-2">
          <p className="text-[9px] uppercase tracking-[0.14em] text-muted-foreground mb-1">Your score</p>
          <StarRow
            value={userScore}
            onChange={onUserScore}
            disabled={readOnly}
            size="sm"
          />
        </div>
      )}
    </div>
  )
}

type RowDef = {
  id: string
  label: string
  hint?: string
  render: (col: VotingColumn) => ReactNode
}

type VotingComparisonGridProps = {
  columns: VotingColumn[]
  weights: InterestWeights
  votes: Record<
    string,
    { desire_score?: number; approved?: boolean }
  >
  onDesireChange: (optionId: string, score: number) => void
  onApprovedChange: (optionId: string, approved: boolean) => void
  readOnly?: boolean
  showScores?: boolean
}

export default function VotingComparisonGrid({
  columns,
  weights,
  votes,
  onDesireChange,
  onApprovedChange,
  readOnly = false,
  showScores = true,
}: VotingComparisonGridProps) {
  if (columns.length === 0) return null

  const rows: RowDef[] = [
    {
      id: 'cost',
      label: 'Cost range',
      render: col => <CostRangeCell col={col} />,
    },
    {
      id: 'gettingThere',
      label: 'Getting there',
      render: col => (
        <div className="text-center px-1">
          <i className="ti ti-plane text-lg text-forest-deep/70 mb-1 block" aria-hidden />
          <p className="text-[11px] text-muted-foreground leading-snug m-0 line-clamp-3">
            {logisticsSummary(col.card)}
          </p>
        </div>
      ),
    },
    {
      id: 'weather',
      label: 'Weather',
      render: col => <WeatherCell col={col} />,
    },
    {
      id: 'activities',
      label: 'Activities',
      render: col => {
        const items = activitiesSummary(col.card)
        return (
          <ul className="text-[11px] text-muted-foreground text-left m-0 p-0 list-none space-y-1 px-1">
            {items.length > 0 ? (
              items.map((line, i) => (
                <li key={i} className="line-clamp-2 leading-snug">
                  {line}
                </li>
              ))
            ) : (
              <li>—</li>
            )}
          </ul>
        )
      },
    },
    {
      id: 'groupFit',
      label: 'Group fit',
      hint: 'Avanti = feasibility for the whole group. Your score = how much you want this place.',
      render: col => (
        <GroupFitCell
          col={col}
          userScore={votes[col.id]?.desire_score ?? 0}
          onUserScore={readOnly ? undefined : n => onDesireChange(col.id, n)}
          readOnly={readOnly}
        />
      ),
    },
  ]

  const extraRows: RowDef[] = []
  const hasVibe = columns.some(c => c.card.vibeCheck)
  const hasTradeoff = columns.some(c => c.card.tradeoff)
  if (hasVibe) {
    extraRows.push({
      id: 'vibe',
      label: 'Vibe check',
      render: col => (
        <p className="text-[11px] text-muted-foreground text-center m-0 px-1 line-clamp-3 leading-snug">
          {String(col.card.vibeCheck || '—')}
        </p>
      ),
    })
  }
  if (hasTradeoff) {
    extraRows.push({
      id: 'tradeoff',
      label: 'Tradeoff',
      render: col => (
        <p className="text-[11px] text-muted-foreground text-center m-0 px-1 line-clamp-3 leading-snug italic">
          {String(col.card.tradeoff || '—')}
        </p>
      ),
    })
  }

  const allRows = [...rows, ...extraRows]

  const scores = columns.map(col =>
    weightedScore(col, weights, votes[col.id]?.desire_score)
  )
  const topScore = Math.max(...scores)

  return (
    <div className="overflow-x-auto -mx-2 px-2 pb-2">
      <table className="w-full min-w-[640px] border-collapse">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-cream w-[100px] sm:w-[120px] p-0" />
            {columns.map(col => (
              <th
                key={col.id}
                className="align-bottom px-3 pb-4 text-center min-w-[120px] max-w-[160px]"
              >
                <p className="font-serif text-base sm:text-lg text-foreground mb-1 leading-tight">
                  {col.name.split(',')[0]}
                </p>
                {col.name.includes(',') && (
                  <p className="text-[10px] text-muted-foreground mb-1">{col.name.split(',').slice(1).join(',').trim()}</p>
                )}
                <p className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground">
                  {TIER_LABELS[col.tier as DestinationTier] || col.tier}
                </p>
                {showScores && scores[columns.indexOf(col)] === topScore && topScore > 0 && (
                  <span className="inline-block mt-2 text-[9px] uppercase tracking-wider bg-forest-pale text-forest-deep px-2 py-0.5">
                    Best match
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {allRows.map(row => (
            <tr key={row.id} className="border-t border-border">
              <th
                scope="row"
                className="sticky left-0 z-10 bg-cream text-left py-4 pr-3 align-top"
              >
                <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-normal leading-tight block">
                  {row.label}
                </span>
                {row.hint && (
                  <span className="text-[9px] text-muted-foreground/80 leading-snug block mt-1 max-w-[100px]">
                    {row.hint}
                  </span>
                )}
              </th>
              {columns.map(col => (
                <td key={col.id} className="py-4 px-3 align-top border-l border-border/50">
                  {row.render(col)}
                </td>
              ))}
            </tr>
          ))}
          {!readOnly && (
            <tr className="border-t border-border">
              <th
                scope="row"
                className="sticky left-0 z-10 bg-cream text-left py-4 pr-3 align-middle"
              >
                <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-normal">
                  I&apos;d go
                </span>
              </th>
              {columns.map(col => (
                <td key={col.id} className="py-4 px-3 text-center border-l border-border/50">
                  <label className="inline-flex items-center justify-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!votes[col.id]?.approved}
                      onChange={e => onApprovedChange(col.id, e.target.checked)}
                      className="w-4 h-4 accent-forest-deep"
                    />
                  </label>
                </td>
              ))}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
