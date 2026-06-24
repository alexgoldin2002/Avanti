'use client'

import type { GroupDateOverlapResult } from '@/lib/group-date-overlap'

type GroupDateOverlapBannerProps = {
  result: GroupDateOverlapResult
  compact?: boolean
}

export default function GroupDateOverlapBanner({ result, compact = false }: GroupDateOverlapBannerProps) {
  if (result.status === 'ok') {
    return (
      <div className="avanti-box border border-forest-deep/20 bg-forest-pale/40 px-4 py-3 mb-6">
        <p className="text-[10px] uppercase tracking-[0.28em] text-forest mb-1">Group dates</p>
        <p className="text-sm text-forest-deep m-0">{result.summary}</p>
        {result.minRequiredBy && !compact && (
          <p className="text-xs text-muted-foreground mt-2 mb-0">
            Shortest trip length in the group: {result.minRequiredBy.label} ({result.minRequiredBy.displayName})
          </p>
        )}
      </div>
    )
  }

  if (result.status === 'waiting') {
    return (
      <div className="avanti-box border border-border bg-secondary/30 px-4 py-3 mb-6">
        <p className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground mb-1">Group dates</p>
        <p className="text-sm text-foreground m-0">{result.summary}</p>
        {result.fixes.length > 0 && (
          <ul className="mt-3 mb-0 pl-0 list-none space-y-2">
            {result.fixes.map(fix => (
              <li key={fix.travelerId} className="text-sm text-muted-foreground">
                <span className="font-serif text-foreground">{fix.displayName}</span>
                {' — '}
                {fix.reasons[0]}
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  }

  return (
    <div className="avanti-box border border-amber-300 bg-amber-50 px-4 py-4 mb-6">
      <p className="text-[10px] uppercase tracking-[0.28em] text-amber-900 mb-1">Group dates need attention</p>
      <p className="text-sm text-amber-950 m-0 mb-3">{result.summary}</p>
      {result.minRequiredBy && (
        <p className="text-xs text-amber-900/80 mb-3">
          Shortest trip length in the group: <strong>{result.minRequiredBy.label}</strong> ({result.minRequiredBy.displayName})
        </p>
      )}
      {result.fixes.length > 0 && (
        <>
          <p className="text-[10px] uppercase tracking-[0.2em] text-amber-900 mb-2">Who should update dates</p>
          <ul className="m-0 pl-0 list-none space-y-3">
            {result.fixes.map(fix => (
              <li key={fix.travelerId} className="text-sm text-amber-950">
                <span className="font-serif text-base">{fix.displayName}</span>
                <ul className="mt-1 mb-0 pl-4 list-disc text-amber-900/90">
                  {fix.reasons.map(reason => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

export function groupDatesBlockSubmission(result: GroupDateOverlapResult): boolean {
  return result.status === 'no_overlap' || result.status === 'too_short'
}
