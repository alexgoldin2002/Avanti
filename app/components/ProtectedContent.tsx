'use client'

import { useEffect, useRef, useCallback } from 'react'

const BLOCK_EVENTS = ['copy', 'cut', 'contextmenu', 'dragstart', 'selectstart'] as const

export default function ProtectedContent({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)

  const isInside = useCallback(() => {
    const el = ref.current
    if (!el) return false
    const sel = document.getSelection()
    if (sel?.anchorNode && el.contains(sel.anchorNode)) return true
    return false
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const blockIfInside = (e: Event) => {
      if (isInside() || el.contains(e.target as Node)) e.preventDefault()
    }

    const blockKeyboard = (e: KeyboardEvent) => {
      if (!isInside() && !el.contains(e.target as Node)) return
      if ((e.metaKey || e.ctrlKey) && ['c', 'x', 'a'].includes(e.key.toLowerCase())) {
        e.preventDefault()
      }
    }

    for (const ev of BLOCK_EVENTS) {
      el.addEventListener(ev, blockIfInside)
    }
    document.addEventListener('keydown', blockKeyboard, true)
    document.addEventListener('copy', blockIfInside, true)
    document.addEventListener('cut', blockIfInside, true)

    return () => {
      for (const ev of BLOCK_EVENTS) {
        el.removeEventListener(ev, blockIfInside)
      }
      document.removeEventListener('keydown', blockKeyboard, true)
      document.removeEventListener('copy', blockIfInside, true)
      document.removeEventListener('cut', blockIfInside, true)
    }
  }, [isInside])

  return (
    <div ref={ref} className={`protected-preview ${className}`}>
      {children}
    </div>
  )
}
