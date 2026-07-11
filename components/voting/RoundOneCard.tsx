'use client'

import type { DestinationAnalysisRow, RoundOneContent } from '@/lib/voting/types'
import {
  budgetFitStyle,
  formatPriceRangeLine,
  priceRangeSubline,
} from '@/lib/voting/round-one-price'
import {
  isPlaceholderRoundOneContent,
  resolveRoundOneContent,
} from '@/lib/voting/round-one-content'

type RoundOneCardProps = {
  destination: DestinationAnalysisRow
  rank: number
  dragProps?: {
    draggable: boolean
    onDragStart: (e: React.DragEvent) => void
    onDragEnd: () => void
  }
}

function parseCountry(name: string, country: string | null): { title: string; countryLabel: string } {
  if (country) return { title: name, countryLabel: country }
  const parts = name.split(',').map(s => s.trim())
  if (parts.length >= 2) {
    return { title: parts.slice(0, -1).join(', '), countryLabel: parts[parts.length - 1] }
  }
  return { title: name, countryLabel: '—' }
}

export default function RoundOneCard({ destination, rank, dragProps }: RoundOneCardProps) {
  const content: RoundOneContent =
    destination.round_one_content &&
    !isPlaceholderRoundOneContent(destination.round_one_content)
      ? destination.round_one_content
      : resolveRoundOneContent({
          roundOneContent: destination.round_one_content,
          cardSnapshot: destination.card_snapshot,
          destinationName: destination.destination_name,
        })
  const { title, countryLabel } = parseCountry(destination.destination_name, destination.country)
  const priceEstimate = destination.price_estimate
  const fitStyle = budgetFitStyle(priceEstimate?.budgetFit ?? 'unknown')

  const s = { fontFamily: 'var(--font-cormorant), Georgia, serif' }

  return (
    <div
      {...dragProps}
      style={{
        border: '1.5px solid #1a1a1a',
        background: '#fff',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        cursor: dragProps ? 'grab' : 'default',
        userSelect: dragProps ? 'none' : 'auto',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          padding: '12px 16px',
          borderBottom: '1px solid #f0f0e8',
          background: '#ffffff',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: 'var(--forest-deep)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            fontWeight: 600,
            ...s,
          }}
        >
          {rank}
        </span>
        {dragProps && (
          <span style={{ fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9a9a8a', ...s }}>
            Drag card ⋮⋮
          </span>
        )}
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ padding: '16px 16px 12px', flex: 1 }}>
          <p style={{ fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#9a9a8a', margin: '0 0 4px', ...s }}>
            {countryLabel}
          </p>
          <h3 style={{ fontSize: '20px', fontWeight: 400, margin: '0 0 14px', lineHeight: 1.2, ...s }}>{title}</h3>

          <Section label="Overview">
            <p style={{ fontSize: '13px', color: '#3a3a3a', lineHeight: 1.65, margin: 0, ...s }}>{content.overview}</p>
          </Section>

          <Section label="Best known for">
            <BulletList items={content.best_known_for} />
          </Section>

          <Section label="Activities">
            <BulletList items={content.activities} />
          </Section>

          <Section label="Price range">
            {priceEstimate?.budgetFit === 'over_budget' && priceEstimate.budgetFitMessage && (
              <p
                style={{
                  fontSize: '12px',
                  color: fitStyle.color,
                  background: fitStyle.background,
                  margin: '0 0 8px',
                  padding: '8px 10px',
                  lineHeight: 1.5,
                  ...s,
                }}
              >
                {priceEstimate.budgetFitMessage}
              </p>
            )}
            <p style={{ fontSize: '13px', color: '#1a1a1a', margin: 0, ...s }}>
              {formatPriceRangeLine(priceEstimate)}
            </p>
            {priceRangeSubline(priceEstimate) && (
              <p style={{ fontSize: '11px', color: '#9a9a8a', margin: '6px 0 0', lineHeight: 1.5, ...s }}>
                {priceRangeSubline(priceEstimate)}
              </p>
            )}
          </Section>

          <Section label="Weather">
            <p style={{ fontSize: '13px', color: '#3a3a3a', margin: 0, ...s }}>{content.weather}</p>
          </Section>
        </div>
      </div>
    </div>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <p
        style={{
          fontSize: '10px',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: '#9a9a8a',
          margin: '0 0 6px',
          fontFamily: 'var(--font-cormorant), Georgia, serif',
        }}
      >
        {label}
      </p>
      {children}
    </div>
  )
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {items.map(item => (
        <li key={item} style={{ display: 'flex', gap: '8px', fontSize: '12px', color: '#3a3a3a', lineHeight: 1.5, fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
          <span style={{ color: '#c4c4b8' }}>—</span>
          {item}
        </li>
      ))}
    </ul>
  )
}
