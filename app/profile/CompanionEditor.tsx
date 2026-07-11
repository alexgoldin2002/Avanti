'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { upsertAccountCompanion, type AccountCompanion } from '@/lib/account-companions'
import DateOfBirthSelect from '../components/DateOfBirthSelect'
import TravelInfoTab from './TravelInfoTab'
import FinancialTab from './FinancialTab'
import ExtraTab from './ExtraTab'
import { PLACEHOLDERS } from '@/lib/form-placeholders'
import {
  normalizeDetails,
  readCompanionProfiles,
  type ProfileForm,
  type ProfileDetails,
  type AirlineLoyalty,
  type Medication,
  type Styles,
} from './shared'

const EMPTY_FORM: ProfileForm = {
  full_name: '', date_of_birth: '', email: '',
  country_of_residence: '', address: '', address_unit: '',
  passport_number: '', tsa_known_traveler: '',
  credit_cards: [], memberships: [],
}

type Props = {
  companion: AccountCompanion
  userId: string
  activeTab: 'basic' | 'travel' | 'financial' | 'extra'
  styles: Styles
  getBenefits: () => Record<string, unknown>
  persistBenefits: (next: Record<string, unknown>) => Promise<unknown>
  onBaseSaved: () => void
}

export default function CompanionEditor({
  companion,
  userId,
  activeTab,
  styles,
  getBenefits,
  persistBenefits,
  onBaseSaved,
}: Props) {
  const { inputStyle, labelStyle, sectionStyle, selectStyle } = styles

  const [form, setForm] = useState<ProfileForm>(EMPTY_FORM)
  const [nickname, setNickname] = useState('')
  const [relationship, setRelationship] = useState('')
  const [details, setDetails] = useState<ProfileDetails>(normalizeDetails(null))
  const [saved, setSaved] = useState(false)

  const loadedIdRef = useRef<string | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dirtyRef = useRef(false)

  // Load whenever a different companion is selected.
  useEffect(() => {
    const rec = readCompanionProfiles(getBenefits())[companion.id]
    setForm({
      ...EMPTY_FORM,
      full_name: companion.full_name || '',
      date_of_birth: companion.date_of_birth || '',
      passport_number: companion.passport_number || '',
      tsa_known_traveler: companion.tsa_known_traveler || '',
      credit_cards: Array.isArray(rec?.credit_cards) ? rec!.credit_cards! : [],
    })
    setNickname(companion.nickname || '')
    setRelationship(companion.relationship || '')
    setDetails(normalizeDetails(rec?.details))
    loadedIdRef.current = companion.id
    dirtyRef.current = false
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companion.id])

  const persist = async (
    f: ProfileForm,
    d: ProfileDetails,
    nick: string,
    rel: string
  ) => {
    // Identity → account_companions
    await upsertAccountCompanion(supabase, userId, {
      id: companion.id,
      full_name: f.full_name.trim() || 'Traveler',
      nickname: nick,
      relationship: rel,
      date_of_birth: f.date_of_birth || undefined,
      passport_number: f.passport_number,
      tsa_known_traveler: f.tsa_known_traveler,
    })
    // Rich profile → owner's benefits_profile.companion_profiles[id]
    const benefits = getBenefits()
    const next = {
      ...benefits,
      companion_profiles: {
        ...readCompanionProfiles(benefits),
        [companion.id]: { credit_cards: f.credit_cards, details: d },
      },
    }
    await persistBenefits(next)
    dirtyRef.current = false
    onBaseSaved()
    setSaved(true)
    setTimeout(() => setSaved(false), 1600)
  }

  const scheduleSave = (f: ProfileForm, d: ProfileDetails, nick: string, rel: string) => {
    if (loadedIdRef.current !== companion.id) return
    dirtyRef.current = true
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => persist(f, d, nick, rel), 900)
  }

  const updateForm = (patch: Partial<ProfileForm>) =>
    setForm(prev => { const next = { ...prev, ...patch }; scheduleSave(next, details, nickname, relationship); return next })
  const updateTravel = (patch: Partial<ProfileDetails['travel']>) =>
    setDetails(prev => { const next = { ...prev, travel: { ...prev.travel, ...patch } }; scheduleSave(form, next, nickname, relationship); return next })
  const updateFinancial = (patch: Partial<ProfileDetails['financial']>) =>
    setDetails(prev => { const next = { ...prev, financial: { ...prev.financial, ...patch } }; scheduleSave(form, next, nickname, relationship); return next })
  const updateAccessibility = (patch: Partial<ProfileDetails['accessibility']>) =>
    setDetails(prev => { const next = { ...prev, accessibility: { ...prev.accessibility, ...patch } }; scheduleSave(form, next, nickname, relationship); return next })
  const setAirlineLoyalty = (list: AirlineLoyalty[]) =>
    setDetails(prev => { const next = { ...prev, airline_loyalty: list }; scheduleSave(form, next, nickname, relationship); return next })
  const setMedications = (list: Medication[]) =>
    setDetails(prev => { const next = { ...prev, medications: list }; scheduleSave(form, next, nickname, relationship); return next })
  const updateNickname = (v: string) => { setNickname(v); scheduleSave(form, details, v, relationship) }
  const updateRelationship = (v: string) => { setRelationship(v); scheduleSave(form, details, nickname, v) }
  const noop = () => {}

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {saved && (
        <p style={{ fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#2d5a18', textAlign: 'right', marginBottom: '-16px' }}>✓ Saved</p>
      )}

      {activeTab === 'basic' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
          <div>
            <p style={sectionStyle}>Identity</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={labelStyle}>Full legal name *</label>
                <input style={inputStyle} value={form.full_name} onChange={e => updateForm({ full_name: e.target.value })} placeholder={PLACEHOLDERS.companionName} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={labelStyle}>Nickname</label>
                  <input style={inputStyle} value={nickname} onChange={e => updateNickname(e.target.value)} placeholder={PLACEHOLDERS.companionNickname} />
                </div>
                <div>
                  <label style={labelStyle}>Relationship</label>
                  <input style={inputStyle} value={relationship} onChange={e => updateRelationship(e.target.value)} placeholder={PLACEHOLDERS.companionRelation} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Date of birth</label>
                <DateOfBirthSelect
                  value={form.date_of_birth}
                  onChange={date_of_birth => updateForm({ date_of_birth })}
                  selectStyle={selectStyle}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'travel' && (
        <TravelInfoTab
          form={form} updateForm={updateForm}
          details={details} updateTravel={updateTravel}
          setAirlineLoyalty={setAirlineLoyalty} setValidity={noop} styles={styles}
        />
      )}

      {activeTab === 'financial' && (
        <FinancialTab form={form} updateForm={updateForm} details={details} updateFinancial={updateFinancial} styles={styles} />
      )}

      {activeTab === 'extra' && (
        <ExtraTab details={details} updateAccessibility={updateAccessibility} setMedications={setMedications} styles={styles} />
      )}
    </div>
  )
}
