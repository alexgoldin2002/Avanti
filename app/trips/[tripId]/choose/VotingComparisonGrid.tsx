'use client'

import type { ReactNode } from 'react'
import {
  activitiesSummary,
  costDollarCount,
  logisticsSummary,
  weatherMood,
  weightedScore,
  type InterestWeights,
  type VotingColumn,
} from '@/lib/destination-decision/voting-display'
import { formatCost, TIER_LABELS } from '@/lib/destination-decision/client-api'
import type { DestinationTier } from '@/lib/destination-decision/types'

function WeatherIcons({ mood }: { mood: ReturnType<typeof weatherMood> }) {
  const icon = (name: string) => (
    <i className={`ti ti-${name} text-lg text-forest-deep/80`} aria-hidden />
  )
  if (mood === 'sun') return <span className="flex gap-1 justify-center">{icon('sun')}</span>
  if (mood === 'rain') return <span className="flex gap-1 justify-center">{icon('cloud-rain')}</span>
  if (mood === 'snow') return <span className="flex gap-1 justify-center">{icon('snowflake')}</span>
  if (mood === 'cloud') return <span className="flex gap-1 justify-center">{icon('cloud')}</span>
  return (
    <span className="flex gap-1 justify-center">
      {icon('sun')}
      {icon('cloud')}
    </span>
  )
}

function DollarIcons({ count }: { count: number }) {
  return (
    <span className="font-serif text-forest-deep tracking-tight">
      {'$'.repeat(count)}
      <span className="text-border">{'$'.repeat(Math.max(0, 4 - count))}</span>
    </span>
  )
}

function StarRow({
  value,
  onChange,
  disabled,
}: {
  value: number
  onChange?: (n: number) => void
  disabled?: boolean
}) {
  return (
    <div className="flex justify-center gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          disabled={disabled || !onChange}
          onClick={() => onChange?.(n)}
          className={`text-base leading-none p-0.5 ${
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

type RowDef = {
  id: string
  label: string
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
      render: col => {
        const costText = String(col.card.cost || '')
        return (
          <div className="text-center">
            <DollarIcons count={costDollarCount(col.tier, costText)} />
            {col.personalCost != null && (
              <p className="text-[10px] text-muted-foreground mt-1 mb-0 tabular-nums">
                {formatCost(col.personalCost)}
              </p>
            )}
          </div>
        )
      },
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
      render: col => (
        <WeatherIcons mood={weatherMood(String(col.card.weather || ''))} />
      ),
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
      render: col => (
        <StarRow
          value={votes[col.id]?.desire_score ?? 0}
          onChange={readOnly ? undefined : n => onDesireChange(col.id, n)}
          disabled={readOnly}
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
