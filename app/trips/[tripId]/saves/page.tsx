'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import SubpageShell from '../../../components/SubpageShell'
import SuitcaseLoader from '../../../components/SuitcaseLoader'
import {
  fetchInspirations,
  parseInspirationClient,
  saveInspirationClient,
} from '@/lib/trip-companion/client-api'
import type { ParsedInspiration } from '@/lib/trip-companion/types'

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export default function TripSavesPage() {
  const { tripId } = useParams() as { tripId: string }
  const dropRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)
  const [trip, setTrip] = useState<any>(null)
  const [saves, setSaves] = useState<any[]>([])
  const [url, setUrl] = useState('')
  const [caption, setCaption] = useState('')
  const [parsing, setParsing] = useState(false)
  const [preview, setPreview] = useState<ParsedInspiration | null>(null)
  const [previewMeta, setPreviewMeta] = useState<{ source_type: string; source_url?: string }>({ source_type: 'url' })
  const [saving, setSaving] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const load = useCallback(async () => {
    const { supabase } = await import('@/lib/supabase')
    const { data: tripData } = await supabase.from('trips').select('*').eq('id', tripId).single()
    setTrip(tripData)
    try {
      const list = await fetchInspirations(tripId)
      setSaves(list)
    } catch {
      setSaves([])
    }
    setLoading(false)
  }, [tripId])

  useEffect(() => { load().catch(console.error) }, [load])

  const runParse = async (opts: { url?: string; caption?: string; imageBase64?: string; mimeType?: string; source_type: string }) => {
    setParsing(true)
    try {
      const parsed = await parseInspirationClient({
        tripId,
        url: opts.url,
        caption: opts.caption,
        imageBase64: opts.imageBase64,
        mimeType: opts.mimeType,
      })
      setPreview(parsed)
      setPreviewMeta({ source_type: opts.source_type, source_url: opts.url })
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not identify place')
    } finally {
      setParsing(false)
    }
  }

  const onParseLink = () => {
    if (!url.trim() && !caption.trim()) return
    runParse({ url: url.trim() || undefined, caption: caption.trim() || undefined, source_type: url.trim() ? 'url' : 'paste' })
  }

  const processFile = async (file: File) => {
    const base64 = await fileToBase64(file)
    await runParse({
      imageBase64: base64,
      mimeType: file.type,
      caption: caption.trim() || undefined,
      source_type: 'screenshot',
    })
  }

  const onPaste = (e: React.ClipboardEvent) => {
    for (const item of e.clipboardData.items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const file = item.getAsFile()
        if (file) processFile(new File([file], 'screenshot.png', { type: file.type }))
        return
      }
    }
  }

  const confirmSave = async () => {
    if (!preview) return
    setSaving(true)
    try {
      await saveInspirationClient(tripId, preview as unknown as Record<string, unknown>, previewMeta)
      setPreview(null)
      setUrl('')
      setCaption('')
      await load()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <SuitcaseLoader message="Loading saves" />

  return (
    <SubpageShell
      backHref={`/trips/${tripId}`}
      backLabel="Trip"
      eyebrow={trip?.name}
      title="Saved places"
      subtitle="TikTok · Instagram · Pinterest · articles · screenshots"
      maxWidth="max-w-2xl"
    >
      <div
        ref={dropRef}
        tabIndex={0}
        onPaste={onPaste}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => {
          e.preventDefault()
          setDragOver(false)
          const file = e.dataTransfer.files[0]
          if (file) processFile(file)
        }}
        className={`avanti-box border-2 border-dashed px-5 py-8 mb-6 transition-colors ${
          dragOver ? 'border-forest-deep bg-forest-pale/30' : 'border-border bg-card'
        }`}
      >
        <p className="font-serif text-lg mb-1">Drop a screenshot or paste a link</p>
        <p className="text-xs text-muted-foreground mb-4">
          Avanti identifies the restaurant, shop, or spot and suggests the best day and time on your trip.
        </p>
        <input
          type="url"
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder="https://tiktok.com/… or instagram.com/reel/…"
          className="w-full border border-border bg-background px-3 py-2 text-sm mb-2"
        />
        <textarea
          value={caption}
          onChange={e => setCaption(e.target.value)}
          placeholder="Optional caption or notes from the post"
          rows={2}
          className="w-full border border-border bg-background px-3 py-2 text-sm mb-3 resize-none"
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={parsing}
            onClick={onParseLink}
            className="avanti-btn avanti-btn-primary"
          >
            {parsing ? 'Analyzing…' : 'Identify place →'}
          </button>
          <label className="avanti-btn avanti-btn-ghost cursor-pointer">
            Upload image
            <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f) }} />
          </label>
        </div>
      </div>

      {preview && (
        <div className="avanti-box border border-forest-deep bg-forest-pale/40 px-5 py-5 mb-8">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Identified</p>
          <p className="font-serif text-xl m-0">{preview.place_name}</p>
          <p className="text-sm text-muted-foreground mt-1 m-0">{preview.place_description}</p>
          {(preview.place_address || preview.place_city) && (
            <p className="text-xs mt-2 m-0">{[preview.place_address, preview.place_city].filter(Boolean).join(', ')}</p>
          )}
          {preview.suggested_day_date && (
            <div className="mt-4 border-t border-forest-deep/20 pt-4">
              <p className="text-[10px] uppercase tracking-wider text-forest-deep mb-1">Best time to go</p>
              <p className="text-sm m-0">
                {preview.suggested_day_date}
                {preview.suggested_time ? ` · ${preview.suggested_time}` : ''}
              </p>
              <p className="text-xs text-muted-foreground mt-1 m-0">{preview.suggestion_reason}</p>
            </div>
          )}
          <div className="flex gap-2 mt-4">
            <button type="button" disabled={saving} onClick={confirmSave} className="avanti-btn avanti-btn-primary">
              {saving ? 'Saving…' : 'Save to trip →'}
            </button>
            <button type="button" onClick={() => setPreview(null)} className="avanti-btn avanti-btn-ghost">Cancel</button>
          </div>
        </div>
      )}

      <section>
        <p className="text-[10px] tracking-[0.35em] uppercase text-muted-foreground mb-3">Your saves ({saves.length})</p>
        {saves.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">Nothing saved yet.</p>
        ) : (
          <div className="space-y-2">
            {saves.map(s => (
              <div key={s.id} className="avanti-box border border-border bg-card px-4 py-3">
                <div className="flex justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium m-0">{s.place_name}</p>
                    <p className="text-xs text-muted-foreground m-0 mt-0.5">{s.place_category}{s.source_platform ? ` · ${s.source_platform}` : ''}</p>
                  </div>
                  {s.suggested_day_date && (
                    <span className="text-[10px] uppercase tracking-wider text-forest-deep shrink-0">
                      {s.suggested_day_date}{s.suggested_time ? ` ${s.suggested_time}` : ''}
                    </span>
                  )}
                </div>
                {s.suggestion_reason && (
                  <p className="text-xs text-muted-foreground mt-2 m-0">{s.suggestion_reason}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </SubpageShell>
  )
}
