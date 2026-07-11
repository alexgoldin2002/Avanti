'use client'

import {
  MOBILITY_NEEDS,
  SENSORY_NEEDS,
  ASSISTANCE_NEEDS,
  ALLERGIES,
  DIETARY,
  DOSAGE_UNITS,
} from '@/lib/profile/validation'
import MedicationAutocomplete from '../components/MedicationAutocomplete'
import InfoTooltip from '../components/InfoTooltip'
import { chipStyle, type ProfileDetails, type Medication, type Styles } from './shared'

type Props = {
  details: ProfileDetails
  updateAccessibility: (patch: Partial<ProfileDetails['accessibility']>) => void
  setMedications: (list: Medication[]) => void
  styles: Styles
}

type ListKey = 'mobility' | 'sensory' | 'assistance' | 'allergies' | 'dietary'

const NOTES_MAX = 500

function ChipGroup({
  title,
  subtitle,
  options,
  selected,
  onToggle,
  styles,
}: {
  title: string
  subtitle?: string
  options: readonly string[]
  selected: string[]
  onToggle: (value: string) => void
  styles: Styles
}) {
  const { s, labelStyle } = styles
  return (
    <div>
      <label style={labelStyle}>{title}</label>
      {subtitle && <p style={{ fontSize: '12px', color: '#b4b4a8', margin: '2px 0 10px', fontStyle: 'italic' }}>{subtitle}</p>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: subtitle ? 0 : '8px' }}>
        {options.map(opt => (
          <button key={opt} type="button" onClick={() => onToggle(opt)} style={chipStyle(selected.includes(opt), s)}>
            {opt}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function ExtraTab({ details, updateAccessibility, setMedications, styles }: Props) {
  const { s, inputStyle, labelStyle, selectStyle, sectionStyle } = styles
  const a = details.accessibility
  const meds = details.medications

  const toggle = (key: ListKey, value: string) => {
    const list = a[key]
    updateAccessibility({ [key]: list.includes(value) ? list.filter(v => v !== value) : [...list, value] })
  }

  const addMed = () => setMedications([...meds, { name: '', dosage: '', unit: 'mg' }])
  const updateMed = (i: number, patch: Partial<Medication>) =>
    setMedications(meds.map((m, idx) => (idx === i ? { ...m, ...patch } : m)))
  const removeMed = (i: number) => setMedications(meds.filter((_, idx) => idx !== i))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
      <div>
        <p style={sectionStyle}>Accessibility & accommodations</p>
        <p style={{ fontSize: '12px', color: 'var(--muted-foreground)', marginBottom: '24px', lineHeight: 1.7 }}>
          Avanti uses this privately to book accessible rooms, request airport assistance, and avoid anything that won&apos;t work for you. Only shared with providers when needed for a booking.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          <ChipGroup title="Mobility" options={MOBILITY_NEEDS} selected={a.mobility} onToggle={v => toggle('mobility', v)} styles={styles} />
          <ChipGroup title="Vision, hearing & sensory" options={SENSORY_NEEDS} selected={a.sensory} onToggle={v => toggle('sensory', v)} styles={styles} />
          <ChipGroup title="Travel assistance" options={ASSISTANCE_NEEDS} selected={a.assistance} onToggle={v => toggle('assistance', v)} styles={styles} />
        </div>
      </div>

      <div>
        <p style={sectionStyle}>Allergies & dietary</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          <ChipGroup title="Allergies" subtitle="So we can flag risks with meals, hotels, and activities." options={ALLERGIES} selected={a.allergies} onToggle={v => toggle('allergies', v)} styles={styles} />
          <ChipGroup title="Dietary preferences" options={DIETARY} selected={a.dietary} onToggle={v => toggle('dietary', v)} styles={styles} />
        </div>
      </div>

      <div>
        <p style={sectionStyle}>
          Medications
          <InfoTooltip title="Why we ask">
            Some medications are restricted or banned in certain countries. Once you add yours, Avanti checks each destination&apos;s import rules and tells you what&apos;s allowed, quantity limits, and any documents (like a doctor&apos;s letter or prescription copy) you should carry.
          </InfoTooltip>
        </p>
        <p style={{ fontSize: '12px', color: 'var(--muted-foreground)', marginBottom: '20px', lineHeight: 1.7 }}>
          Start typing and pick your medication from the list so we match it to the right rules. Add the dose you take.
        </p>

        {meds.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '16px' }}>
            {meds.map((m, i) => (
              <div key={i} style={{ border: '1px solid #e8e8e0', background: 'var(--card)', padding: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <label style={labelStyle}>Medication</label>
                    <MedicationAutocomplete
                      value={m.name}
                      onChange={name => updateMed(i, { name, rxcui: undefined })}
                      onPick={name => updateMed(i, { name })}
                      inputStyle={inputStyle}
                      s={s}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeMed(i)}
                    aria-label="Remove medication"
                    title="Remove"
                    style={{ flexShrink: 0, marginTop: '18px', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', borderRadius: '50%', background: 'transparent', color: 'var(--muted-foreground)', fontSize: '18px', lineHeight: 1, cursor: 'pointer', ...s }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#fbeaea'; e.currentTarget.style.color = '#a32d2d' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--muted-foreground)' }}
                  >
                    ×
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '14px' }}>
                  <div>
                    <label style={labelStyle}>Dosage</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      inputMode="decimal"
                      style={inputStyle}
                      value={m.dosage}
                      onChange={e => updateMed(i, { dosage: e.target.value })}
                      placeholder="e.g. 50"
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Unit</label>
                    <select style={selectStyle} value={m.unit} onChange={e => updateMed(i, { unit: e.target.value })}>
                      {DOSAGE_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={addMed}
          style={{ width: '100%', border: '1px dashed #d4d4c8', background: 'transparent', padding: '13px', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#083807', cursor: 'pointer', ...s }}
        >
          + Add a medication
        </button>
      </div>

      <div>
        <p style={sectionStyle}>Anything else</p>
        <label style={labelStyle}>Notes for your trips <span style={{ textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
        <textarea
          value={a.notes}
          maxLength={NOTES_MAX}
          onChange={e => updateAccessibility({ notes: e.target.value })}
          placeholder="e.g. I need a room close to the elevator, or I travel with medication that must stay refrigerated."
          rows={4}
          style={{
            width: '100%', border: '1px solid #d4d4c8', background: 'transparent', padding: '12px',
            fontSize: '15px', color: 'var(--foreground)', outline: 'none', resize: 'vertical',
            marginTop: '8px', ...s,
          }}
        />
        <p style={{ fontSize: '11px', color: '#b4b4a8', margin: '6px 0 0', textAlign: 'right' }}>{a.notes.length}/{NOTES_MAX}</p>
      </div>
    </div>
  )
}
