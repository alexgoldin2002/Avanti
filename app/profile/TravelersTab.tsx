'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  listAccountCompanions,
  upsertAccountCompanion,
  type AccountCompanion,
} from '@/lib/account-companions'
import DateOfBirthSelect from '../components/DateOfBirthSelect'

const s = { fontFamily: 'var(--font-cormorant), Georgia, serif' }
const inputStyle = {
  width: '100%',
  borderBottom: '1px solid #d4d4c8',
  background: 'transparent',
  padding: '10px 0',
  fontSize: '15px',
  color: 'var(--foreground)',
  outline: 'none',
  ...s,
}
const labelStyle = {
  fontSize: '10px',
  letterSpacing: '0.15em',
  textTransform: 'uppercase' as const,
  color: 'var(--muted-foreground)',
  display: 'block',
  marginBottom: '6px',
}
const sectionStyle = {
  fontSize: '10px',
  letterSpacing: '0.2em',
  textTransform: 'uppercase' as const,
  color: 'var(--muted-foreground)',
  borderBottom: '1px solid #e8e8e0',
  paddingBottom: '8px',
  marginBottom: '20px',
}

const emptyForm = {
  full_name: '',
  nickname: '',
  relationship: '',
  date_of_birth: '',
  passport_number: '',
  tsa_known_traveler: '',
}

export default function TravelersTab({ userId }: { userId: string }) {
  const [companions, setCompanions] = useState<AccountCompanion[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [showForm, setShowForm] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const rows = await listAccountCompanions(supabase, userId)
      setCompanions(rows)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [userId])

  const startEdit = (c: AccountCompanion) => {
    setEditingId(c.id)
    setForm({
      full_name: c.full_name,
      nickname: c.nickname || '',
      relationship: c.relationship || '',
      date_of_birth: c.date_of_birth || '',
      passport_number: c.passport_number || '',
      tsa_known_traveler: c.tsa_known_traveler || '',
    })
    setShowForm(true)
  }

  const startNew = () => {
    setEditingId(null)
    setForm(emptyForm)
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.full_name.trim()) return
    setSaving(true)
    try {
      await upsertAccountCompanion(supabase, userId, {
        id: editingId || undefined,
        full_name: form.full_name,
        nickname: form.nickname,
        relationship: form.relationship,
        date_of_birth: form.date_of_birth || undefined,
        passport_number: form.passport_number,
        tsa_known_traveler: form.tsa_known_traveler,
      })
      setShowForm(false)
      setEditingId(null)
      setForm(emptyForm)
      await load()
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <p style={{ fontSize: '13px', color: 'var(--muted-foreground)', ...s }}>Loading travelers…</p>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <div>
        <p style={sectionStyle}>Saved travelers</p>
        <p style={{ fontSize: '13px', color: 'var(--muted-foreground)', lineHeight: 1.7, marginBottom: '20px', ...s }}>
          Partner, kids, anyone you add on the same invite. You fill in passport and travel details; they count toward the group but don&apos;t vote separately.
        </p>

        {companions.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
            {companions.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => startEdit(c)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 14px',
                  border: '1px solid #e8e8e0',
                  background: 'var(--card)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  ...s,
                }}
              >
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: '#e8f0e4',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '14px',
                    color: '#083807',
                    flexShrink: 0,
                  }}
                >
                  {(c.nickname || c.full_name).charAt(0)}
                </div>
                <div>
                  <p style={{ fontSize: '14px', color: 'var(--foreground)', margin: '0 0 2px' }}>{c.full_name}</p>
                  <p style={{ fontSize: '11px', color: 'var(--muted-foreground)', margin: 0 }}>
                    {[c.relationship, c.passport_number ? 'Passport on file' : 'Passport needed'].filter(Boolean).join(' · ')}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}

        {!showForm && (
          <button
            type="button"
            onClick={startNew}
            style={{
              width: '100%',
              border: '1px dashed #d4d4c8',
              background: 'transparent',
              padding: '14px',
              fontSize: '10px',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: '#083807',
              cursor: 'pointer',
              ...s,
            }}
          >
            + Add a traveler
          </button>
        )}

        {showForm && (
          <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div>
              <label style={labelStyle}>Full legal name *</label>
              <input
                style={inputStyle}
                value={form.full_name}
                onChange={e => setForm({ ...form, full_name: e.target.value })}
                placeholder="Sydney Prusan"
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Nickname</label>
                <input
                  style={inputStyle}
                  value={form.nickname}
                  onChange={e => setForm({ ...form, nickname: e.target.value })}
                  placeholder="Syd"
                />
              </div>
              <div>
                <label style={labelStyle}>Relationship</label>
                <input
                  style={inputStyle}
                  value={form.relationship}
                  onChange={e => setForm({ ...form, relationship: e.target.value })}
                  placeholder="Partner, child…"
                />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Date of birth</label>
              <DateOfBirthSelect
                value={form.date_of_birth}
                onChange={date_of_birth => setForm({ ...form, date_of_birth })}
                selectStyle={{
                  ...inputStyle,
                  borderBottom: '1px solid #d4d4c8',
                  padding: '10px 24px 10px 0',
                  fontSize: '14px',
                }}
              />
            </div>
            <div>
              <label style={labelStyle}>Passport number</label>
              <input
                style={inputStyle}
                value={form.passport_number}
                onChange={e => setForm({ ...form, passport_number: e.target.value })}
                placeholder="A12345678"
              />
            </div>
            <div>
              <label style={labelStyle}>TSA Known Traveler / PreCheck</label>
              <input
                style={inputStyle}
                value={form.tsa_known_traveler}
                onChange={e => setForm({ ...form, tsa_known_traveler: e.target.value })}
                placeholder="Optional"
              />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !form.full_name.trim()}
                style={{
                  flex: 1,
                  border: '1px solid #083807',
                  background: '#083807',
                  color: '#fff',
                  padding: '14px',
                  fontSize: '10px',
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  opacity: saving ? 0.6 : 1,
                  ...s,
                }}
              >
                {saving ? 'Saving…' : 'Save traveler →'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false)
                  setEditingId(null)
                  setForm(emptyForm)
                }}
                style={{
                  padding: '14px 18px',
                  border: '1px solid #d4d4c8',
                  background: 'transparent',
                  fontSize: '10px',
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  color: 'var(--muted-foreground)',
                  cursor: 'pointer',
                  ...s,
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
