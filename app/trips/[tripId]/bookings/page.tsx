'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import SubpageShell from '../../../components/SubpageShell'
import SuitcaseLoader from '../../../components/SuitcaseLoader'
import {
  fetchTripBookings,
  parseBookingFile,
  saveBooking,
  CATEGORY_LABELS,
} from '@/lib/bookings/client-api'
import type { ParsedBooking } from '@/lib/bookings/types'

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export default function TripBookingsPage() {
  const { tripId } = useParams() as { tripId: string }
  const router = useRouter()
  const dropRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)
  const [trip, setTrip] = useState<any>(null)
  const [bookings, setBookings] = useState<any[]>([])
  const [inboxAddress, setInboxAddress] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [preview, setPreview] = useState<ParsedBooking | null>(null)
  const [previewSource, setPreviewSource] = useState('upload')
  const [pendingFile, setPendingFile] = useState<{ base64: string; name: string; mime: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    const { supabase } = await import('@/lib/supabase')
    const { data: tripData } = await supabase.from('trips').select('*').eq('id', tripId).single()
    setTrip(tripData)
    const data = await fetchTripBookings(tripId)
    setBookings(data.bookings)
    setInboxAddress(data.inboxAddress)
    setLoading(false)
  }, [tripId])

  useEffect(() => { load().catch(console.error) }, [load])

  const processFile = async (file: File) => {
    setParsing(true)
    try {
      const base64 = await fileToBase64(file)
      const isScreenshot = file.name.toLowerCase().includes('screenshot') || file.type.startsWith('image/')
      const { parsed, source } = await parseBookingFile(tripId, base64, file.name, file.type || 'image/jpeg')
      setPreview(parsed)
      setPreviewSource(isScreenshot ? 'screenshot' : source)
      setPendingFile({ base64, name: file.name, mime: file.type || 'image/jpeg' })
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not read file')
    } finally {
      setParsing(false)
    }
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  const onPaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items
    for (const item of items) {
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
      await saveBooking(
        tripId,
        preview,
        previewSource as 'upload' | 'screenshot' | 'manual',
        pendingFile?.base64,
        pendingFile?.name,
        pendingFile?.mime
      )
      setPreview(null)
      setPendingFile(null)
      await load()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const copyInbox = () => {
    navigator.clipboard.writeText(inboxAddress)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) return <SuitcaseLoader message="Loading bookings" />

  return (
    <SubpageShell
      backHref={`/trips/${tripId}`}
      backLabel="Trip"
      eyebrow={trip?.name}
      title="Bookings & confirmations"
      subtitle="Forward emails, drop files, or paste screenshots — everything in one place."
      maxWidth="max-w-3xl"
    >
      {/* Inbox */}
      <div className="avanti-box border border-forest-deep/20 bg-forest-pale px-5 py-4 mb-6">
        <p className="eyebrow text-forest mb-1">Forward confirmations here</p>
        <div className="flex flex-wrap items-center gap-2">
          <code className="text-sm text-forest-deep break-all">{inboxAddress}</code>
          <button type="button" onClick={copyInbox} className="text-[10px] uppercase tracking-wider text-forest-deep hover:underline shrink-0">
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-2 mb-0">
          Forward booking emails from Gmail, OpenTable, airlines, hotels — or CC this address when booking.
        </p>
      </div>

      {/* Drop zone */}
      <div
        ref={dropRef}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onPaste={onPaste}
        tabIndex={0}
        className={`avanti-box border-2 border-dashed px-6 py-10 text-center mb-8 transition-colors outline-none focus:border-forest-deep/50 ${
          dragOver ? 'border-forest-deep bg-forest-pale' : 'border-border bg-card'
        }`}
      >
        {parsing ? (
          <p className="font-serif text-lg text-muted-foreground">Avanti is reading your confirmation…</p>
        ) : (
          <>
            <p className="font-serif text-xl mb-2">Drop PDF or screenshot here</p>
            <p className="text-sm text-muted-foreground mb-4">Or paste a screenshot (⌘V) · drag from desktop or phone</p>
            <label className="avanti-btn avanti-btn-primary cursor-pointer inline-block">
              Choose file
              <input
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0]
                  if (f) processFile(f)
                }}
              />
            </label>
          </>
        )}
      </div>

      {/* Preview / confirm */}
      {preview && (
        <div className="avanti-box border border-forest-deep/30 bg-card p-5 mb-8">
          <p className="eyebrow text-muted-foreground mb-3">Confirm details</p>
          <input
            className="avanti-input w-full font-serif text-xl mb-3"
            value={preview.display_title}
            onChange={e => setPreview({ ...preview, display_title: e.target.value })}
          />
          <div className="grid sm:grid-cols-2 gap-3 text-sm mb-4">
            <label>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Category</span>
              <select
                className="avanti-input w-full mt-1"
                value={preview.category}
                onChange={e => setPreview({ ...preview, category: e.target.value as ParsedBooking['category'] })}
              >
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Confirmation #</span>
              <input
                className="avanti-input w-full mt-1"
                value={preview.confirmation_number || ''}
                onChange={e => setPreview({ ...preview, confirmation_number: e.target.value || null })}
              />
            </label>
            <label>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Date & time</span>
              <input
                type="datetime-local"
                className="avanti-input w-full mt-1"
                value={preview.starts_at ? preview.starts_at.slice(0, 16) : ''}
                onChange={e => setPreview({ ...preview, starts_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
              />
            </label>
            <label>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Location</span>
              <input
                className="avanti-input w-full mt-1"
                value={preview.location || ''}
                onChange={e => setPreview({ ...preview, location: e.target.value || null })}
              />
            </label>
          </div>
          {preview.qr_payload && (
            <p className="text-xs text-muted-foreground mb-3">QR detected: {preview.qr_payload.slice(0, 80)}…</p>
          )}
          <div className="flex gap-3">
            <button type="button" disabled={saving} onClick={confirmSave} className="avanti-btn avanti-btn-primary flex-1">
              {saving ? 'Saving…' : 'Save to trip →'}
            </button>
            <button type="button" onClick={() => { setPreview(null); setPendingFile(null) }} className="avanti-btn avanti-btn-ghost">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {bookings.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground font-serif italic">
          No bookings yet — forward an email or drop a screenshot above.
        </div>
      ) : (
        <div className="space-y-2">
          <p className="eyebrow text-muted-foreground mb-3">{bookings.length} confirmation{bookings.length !== 1 ? 's' : ''}</p>
          {bookings.map(b => (
            <button
              key={b.id as string}
              type="button"
              onClick={() => router.push(`/trips/${tripId}/bookings/${b.id}`)}
              className="avanti-box group w-full border border-border bg-card px-5 py-4 text-left hover:border-forest-deep/30 transition-all"
            >
              <div className="flex justify-between gap-2">
                <div>
                  <p className="font-serif text-lg group-hover:text-forest-deep">{b.display_title as string}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {CATEGORY_LABELS[b.category as string] || b.category}
                    {b.starts_at && ` · ${new Date(b.starts_at as string).toLocaleString()}`}
                  </p>
                  {b.booker && (
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Booked by {(b.booker as { name?: string }).name}
                      {(b.booker as { email?: string }).email && ` · ${(b.booker as { email?: string }).email}`}
                    </p>
                  )}
                </div>
                {b.confirmation_number && (
                  <span className="text-xs text-forest-deep shrink-0 font-mono">{b.confirmation_number as string}</span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => router.push(`/trips/${tripId}/itinerary`)}
        className="mt-8 w-full avanti-btn avanti-btn-ghost"
      >
        View itinerary →
      </button>
    </SubpageShell>
  )
}
