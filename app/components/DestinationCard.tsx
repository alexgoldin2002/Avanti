'use client'

import { useState } from 'react'
import DestinationLocatorMap from './DestinationLocatorMap'

type CardData = {
  name: string
  highlight?: string
  consider?: string
  synopsis: string
  logistics?: string
  cost?: string
  weather?: string
  activities?: string
  groupFit?: string
  vibeCheck?: string
  footnotes?: string
  tradeoff?: string
  isWildcard?: boolean
}

export default function DestinationCard({
  card,
  tripId,
  isVoted = false,
  onVote,
  previewMode = false,
  hideMap = false,
  locked = false,
}: {
  card: CardData
  tripId?: string
  isVoted?: boolean
  onVote?: () => void
  previewMode?: boolean
  hideMap?: boolean
  locked?: boolean
}) {
  const [open, setOpen] = useState<string | null>(null)
  const s = { fontFamily: 'var(--font-cormorant), Georgia, serif' }
  const toggle = (key: string) => setOpen(prev => (prev === key ? null : key))
  const isWildcard = card.isWildcard
  const parseBullets = (text: string): string[] => {
    if (!text) return []
    return text.split('\n').map(l => l.replace(/^[-•*]\s*/, '').trim()).filter(l => l.length > 2)
  }
  const costPill = card.cost?.split('\n')[0]?.trim() || ''
  const sections = [
    { key: 'logistics', label: 'Getting there', content: card.logistics },
    { key: 'cost', label: 'Cost breakdown', content: card.cost },
    { key: 'weather', label: 'Weather', content: card.weather },
    { key: 'activities', label: 'Activities', content: card.activities },
    { key: 'groupFit', label: 'Group fit', content: card.groupFit },
    { key: 'vibeCheck', label: 'Vibe check', content: card.vibeCheck },
    ...(card.tradeoff ? [{ key: 'tradeoff', label: 'Honest tradeoff', content: card.tradeoff }] : []),
    ...(card.footnotes ? [{ key: 'footnotes', label: 'Things to know', content: card.footnotes }] : []),
  ].filter(sec => sec.content?.trim())

  if (locked) {
    return (
      <div className="relative overflow-hidden border border-forest-deep/20 bg-ivory flex flex-col items-center justify-center min-h-[320px] p-8 text-center">
        <p className="eyebrow text-muted-foreground mb-3">Locked</p>
        <p className="font-serif text-xl text-forest-deep mb-4">Two more picks waiting</p>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
          Create a free account to unlock all four destinations, vote with your group, and save this trip.
        </p>
      </div>
    )
  }

  return (
    <div
      className={previewMode ? 'protected-preview-card' : undefined}
      style={{ border: '1.5px solid #1a1a1a', borderRadius: '0', overflow: 'hidden', background: isWildcard ? 'var(--forest-deep)' : '#fff', display: 'flex', flexDirection: 'column', position: 'relative' }}
    >
      {previewMode && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-10 overflow-hidden opacity-[0.04]"
          style={{
            backgroundImage: 'repeating-linear-gradient(-45deg, transparent, transparent 80px, currentColor 80px, currentColor 81px)',
            color: isWildcard ? '#fff' : '#1a1a1a',
          }}
        />
      )}
      {!hideMap && <DestinationLocatorMap destinationName={card.name} dark={isWildcard} />}
      {isWildcard && (
        <div style={{ padding: '12px 20px 0' }}>
          <span style={{ fontSize: '9px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)', background: 'rgba(255,255,255,0.08)', padding: '3px 10px' }}>
            Wildcard — Avanti&apos;s curveball
          </span>
        </div>
      )}
      <div style={{ padding: isWildcard ? '14px 20px 18px' : '22px 20px 18px', paddingRight: isWildcard ? '112px' : '120px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
          <h3 style={{ fontSize: '22px', fontWeight: 400, color: isWildcard ? '#fff' : '#1a1a1a', margin: 0, lineHeight: 1.2, ...s }}>
            {card.name}
          </h3>
          {costPill && (
            <span style={{ fontSize: '12px', color: isWildcard ? 'rgba(255,255,255,0.55)' : '#9a9a8a', flexShrink: 0, ...s }}>
              {costPill.match(/\$[\d,]+[–\-]\$?[\d,]+/)?.[0] || costPill.slice(0, 25)}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
          {card.highlight && (
            <span style={{ fontSize: '10px', padding: '3px 10px', borderRadius: '20px', background: isWildcard ? 'rgba(255,255,255,0.12)' : '#e8f5ee', color: isWildcard ? 'rgba(255,255,255,0.8)' : 'var(--forest-deep)', border: `0.5px solid ${isWildcard ? 'rgba(255,255,255,0.2)' : '#a8d4b8'}`, fontFamily: 'var(--font-cormorant), Georgia, serif', letterSpacing: '0.05em' }}>
              {card.highlight}
            </span>
          )}
          {card.consider && (
            <span style={{ fontSize: '10px', padding: '3px 10px', borderRadius: '20px', background: isWildcard ? 'rgba(255,165,0,0.15)' : '#fef9ec', color: isWildcard ? 'rgba(255,200,100,0.9)' : '#8a6a10', border: `0.5px solid ${isWildcard ? 'rgba(255,165,0,0.3)' : '#f0c040'}`, fontFamily: 'var(--font-cormorant), Georgia, serif', letterSpacing: '0.05em' }}>
              {card.consider}
            </span>
          )}
        </div>
        <p style={{ fontSize: '13px', color: isWildcard ? 'rgba(255,255,255,0.65)' : '#6a6a6a', margin: 0, lineHeight: 1.6 }}>
          {card.synopsis}
        </p>
      </div>
      <div style={{ borderTop: `1px solid ${isWildcard ? 'rgba(255,255,255,0.1)' : '#f0f0e8'}` }} />
      {sections.map((section, si) => (
        <div key={section.key}>
          <button
            type="button"
            onClick={() => toggle(section.key)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 20px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
          >
            <span style={{ fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: isWildcard ? 'rgba(255,255,255,0.4)' : '#9a9a8a' }}>{section.label}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={isWildcard ? 'rgba(255,255,255,0.3)' : '#c4c4b8'} strokeWidth="2" style={{ transform: open === section.key ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {open === section.key && (
            <div style={{ padding: '0 20px 14px' }}>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {parseBullets(section.content!).map((bullet, bi) => (
                  <li key={bi} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                    <span style={{ fontSize: '10px', color: isWildcard ? 'rgba(255,255,255,0.25)' : '#c4c4b8', flexShrink: 0, marginTop: '3px' }}>—</span>
                    <span style={{ fontSize: '12px', color: isWildcard ? 'rgba(255,255,255,0.75)' : '#3a3a3a', lineHeight: 1.6 }}>{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {si < sections.length - 1 && (
            <div style={{ borderTop: `0.5px solid ${isWildcard ? 'rgba(255,255,255,0.07)' : '#f5f5f0'}`, margin: '0 20px' }} />
          )}
        </div>
      ))}
      {!previewMode && (
      <div style={{ padding: '14px 20px', borderTop: `1px solid ${isWildcard ? 'rgba(255,255,255,0.1)' : '#f0f0e8'}`, marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button
              type="button"
              onClick={onVote}
              style={{
                width: '100%', padding: '11px',
                border: `1px solid ${isVoted ? '#2d6a4f' : isWildcard ? 'rgba(255,255,255,0.2)' : '#1a1a1a'}`,
                background: isVoted ? '#e8f5ee' : 'transparent',
                color: isVoted ? 'var(--forest-deep)' : isWildcard ? 'rgba(255,255,255,0.65)' : '#1a1a1a',
                fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase',
                cursor: 'pointer', borderRadius: '0', fontFamily: 'var(--font-cormorant), Georgia, serif',
              }}
            >
              {isVoted ? '✓ Selected' : 'Add to vote'}
            </button>
            {tripId && (
              <button
                type="button"
                onClick={() => { window.location.href = `/trips/${tripId}/destinations/${encodeURIComponent(card.name)}` }}
                style={{ width: '100%', padding: '9px', border: 'none', background: 'transparent', color: isWildcard ? 'rgba(255,255,255,0.4)' : '#9a9a8a', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'var(--font-cormorant), Georgia, serif' }}
              >
                Deep dive →
              </button>
            )}
      </div>
      )}
    </div>
  )
}
