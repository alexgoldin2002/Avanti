'use client'

import { useState } from 'react'
import type { DestinationAnalysisRow, RoundOneContent } from '@/lib/voting/types'
import {
  GroupDestinationCard,
  PLACEHOLDER_DESTINATION,
  PLACEHOLDER_ROUND_ONE,
  formatBudgetLine,
} from '@/components/voting/DestinationCard'
import type { ParsedDestinationCard } from '@/lib/parse-destination-cards'

type RoundOneCardProps = {
  destination: DestinationAnalysisRow
  rank: number
  tripId?: string
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

function cardFromSnapshot(snapshot: Record<string, unknown>): ParsedDestinationCard {
  return { ...PLACEHOLDER_DESTINATION, ...(snapshot as Partial<ParsedDestinationCard>) }
}

export default function RoundOneCard({ destination, rank, tripId, dragProps }: RoundOneCardProps) {
  const [learnMoreOpen, setLearnMoreOpen] = useState(false)
  const content: RoundOneContent = destination.round_one_content || PLACEHOLDER_ROUND_ONE
  const { title, countryLabel } = parseCountry(destination.destination_name, destination.country)
  const groupCard = cardFromSnapshot(destination.card_snapshot || {})

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
          background: '#fafaf8',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: 'var(--forest-deep)',
            color: '#fafaf8',
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

          <Section label="Budget">
            <p style={{ fontSize: '13px', color: '#1a1a1a', margin: 0, ...s }}>
              {formatBudgetLine(destination.feasibility_floor, destination.highest_member_max)}
            </p>
          </Section>

          <Section label="Weather">
            <p style={{ fontSize: '13px', color: '#3a3a3a', margin: 0, ...s }}>{content.weather}</p>
          </Section>
        </div>

        <div style={{ borderTop: '1px solid #f0f0e8', marginTop: 'auto' }}>
          <button
            type="button"
            draggable={false}
            onMouseDown={e => e.stopPropagation()}
            onClick={() => setLearnMoreOpen(o => !o)}
            style={{
              width: '100%',
              padding: '12px 20px',
              background: 'transparent',
              border: 'none',
              textAlign: 'left',
              fontSize: '10px',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              color: '#6a6a6a',
              cursor: 'pointer',
              userSelect: 'auto',
              ...s,
            }}
          >
            {learnMoreOpen ? 'Hide details ↑' : 'Learn more ↓'}
          </button>
          {learnMoreOpen && (
            <div
              style={{ padding: '0 12px 16px' }}
              draggable={false}
              onMouseDown={e => e.stopPropagation()}
            >
              <GroupDestinationCard card={groupCard} tripId={tripId} />
            </div>
          )}
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
