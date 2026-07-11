'use client'
import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getPostAuthPath } from '@/lib/preview-trip-storage'
import SuitcaseLoader from '../components/SuitcaseLoader'
import Footer from '../components/Footer'
import { BackLink } from '../components/SubpageShell'
import BasicInfoTab from './BasicInfoTab'
import TravelInfoTab from './TravelInfoTab'
import FinancialTab from './FinancialTab'
import ExtraTab from './ExtraTab'
import CompanionEditor from './CompanionEditor'
import {
  EMPTY_DETAILS,
  detailsFromBenefits,
  mergeDetailsIntoBenefits,
  readCompanionProfiles,
  type ProfileForm,
  type ProfileDetails,
  type AirlineLoyalty,
  type Medication,
  type Styles,
} from './shared'
import {
  listAccountCompanions,
  upsertAccountCompanion,
  deleteAccountCompanion,
  type AccountCompanion,
} from '@/lib/account-companions'
import {
  validatePassport,
  validateKnownTraveler,
  validateGlobalEntry,
  validateRedress,
  validateEmail,
} from '@/lib/profile/validation'

const EMPTY_FORM: ProfileForm = {
  full_name: '', date_of_birth: '', email: '',
  country_of_residence: 'United States', address: '', address_unit: '',
  passport_number: '', tsa_known_traveler: '',
  credit_cards: [], memberships: [],
}

const TABS = [
  { key: 'basic', label: 'Basic' },
  { key: 'travel', label: 'Travel' },
  { key: 'financial', label: 'Financial' },
  { key: 'extra', label: 'Extra' },
] as const

type TabKey = (typeof TABS)[number]['key']

function ProfileSetupInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showWelcome, setShowWelcome] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [phoneCode, setPhoneCode] = useState('+1')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [smsNotificationsEnabled, setSmsNotificationsEnabled] = useState(true)
  const [autoSaved, setAutoSaved] = useState(false)
  const [form, setForm] = useState<ProfileForm>(EMPTY_FORM)
  const [details, setDetails] = useState<ProfileDetails>(EMPTY_DETAILS)

  // People: 'self' = your own profile; otherwise a saved-traveler (companion) id.
  const [companions, setCompanions] = useState<AccountCompanion[]>([])
  const [selectedPerson, setSelectedPerson] = useState<string>('self')
  const [confirmDelete, setConfirmDelete] = useState<AccountCompanion | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [addingTraveler, setAddingTraveler] = useState(false)

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rawBenefitsRef = useRef<Record<string, unknown>>({})
  const savedDetailsRef = useRef<ProfileDetails>(EMPTY_DETAILS)
  const loadedRef = useRef(false)

  // Build a sanitized upsert payload: validated free-text fields are only written
  // when they pass their format check, so junk never lands in the database.
  const buildUpsert = (f: ProfileForm, d: ProfileDetails) => {
    const payload: Record<string, unknown> = {
      user_id: userId,
      full_name: f.full_name,
      date_of_birth: f.date_of_birth || null,
      country_of_residence: f.country_of_residence,
      address_unit: f.address_unit,
      credit_cards: f.credit_cards,
      memberships: f.memberships,
      profile_complete: true,
      sms_notifications_enabled: smsNotificationsEnabled,
    }

    const email = validateEmail(f.email)
    if (email.valid) payload.email = email.normalized

    const phoneDigits = phoneNumber.replace(/[^\d]/g, '')
    if (phoneDigits.length >= 6 && phoneDigits.length <= 15) {
      payload.phone = `${phoneCode} ${phoneNumber}`
    }

    // Address only persists once verified via Google Places.
    if (d.address_verified && f.address.trim() !== '') payload.address = f.address
    else if (f.address.trim() === '') payload.address = ''

    const passport = validatePassport(f.passport_number)
    if (passport.valid) payload.passport_number = passport.normalized

    const ktn = validateKnownTraveler(f.tsa_known_traveler)
    if (ktn.valid) payload.tsa_known_traveler = ktn.normalized

    // Sanitize nested validated details, falling back to last-saved valid values.
    const cleanDetails: ProfileDetails = {
      ...d,
      travel: {
        ...d.travel,
        global_entry_number: validateGlobalEntry(d.travel.global_entry_number).valid
          ? d.travel.global_entry_number
          : savedDetailsRef.current.travel.global_entry_number,
        redress_number: validateRedress(d.travel.redress_number).valid
          ? d.travel.redress_number
          : savedDetailsRef.current.travel.redress_number,
      },
    }

    payload.benefits_profile = mergeDetailsIntoBenefits(rawBenefitsRef.current, cleanDetails)
    return { payload, cleanDetails }
  }

  const persist = async (f: ProfileForm, d: ProfileDetails) => {
    if (!userId) return
    const { payload, cleanDetails } = buildUpsert(f, d)
    const { error } = await supabase.from('user_profiles').upsert(payload, { onConflict: 'user_id' })
    if (!error) {
      rawBenefitsRef.current = payload.benefits_profile as Record<string, unknown>
      savedDetailsRef.current = cleanDetails
    }
    return error
  }

  const scheduleSave = (f: ProfileForm, d: ProfileDetails) => {
    if (!userId || !loadedRef.current) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      const error = await persist(f, d)
      if (!error) {
        setAutoSaved(true)
        setTimeout(() => setAutoSaved(false), 2000)
      }
    }, 1200)
  }

  // Persist whenever phone/sms change too (they live outside form/details).
  useEffect(() => {
    if (loadedRef.current) scheduleSave(form, details)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phoneCode, phoneNumber, smsNotificationsEnabled])

  const updateForm = (patch: Partial<ProfileForm>) => {
    setForm(prev => { const next = { ...prev, ...patch }; scheduleSave(next, details); return next })
  }
  const updateDetails = (patch: Partial<ProfileDetails>) => {
    setDetails(prev => { const next = { ...prev, ...patch }; scheduleSave(form, next); return next })
  }
  const updateTravel = (patch: Partial<ProfileDetails['travel']>) => {
    setDetails(prev => { const next = { ...prev, travel: { ...prev.travel, ...patch } }; scheduleSave(form, next); return next })
  }
  const updateFinancial = (patch: Partial<ProfileDetails['financial']>) => {
    setDetails(prev => { const next = { ...prev, financial: { ...prev.financial, ...patch } }; scheduleSave(form, next); return next })
  }
  const updateAccessibility = (patch: Partial<ProfileDetails['accessibility']>) => {
    setDetails(prev => { const next = { ...prev, accessibility: { ...prev.accessibility, ...patch } }; scheduleSave(form, next); return next })
  }
  const setAirlineLoyalty = (list: AirlineLoyalty[]) => {
    setDetails(prev => { const next = { ...prev, airline_loyalty: list }; scheduleSave(form, next); return next })
  }
  const setMedications = (list: Medication[]) => {
    setDetails(prev => { const next = { ...prev, medications: list }; scheduleSave(form, next); return next })
  }
  const setValidity = () => {}

  // ---- Saved travelers (companions) ----------------------------------------
  const loadCompanions = async (uid?: string | null) => {
    const id = uid || userId
    if (!id) return
    try {
      const rows = await listAccountCompanions(supabase, id)
      setCompanions(rows)
    } catch {
      /* non-fatal — rail just shows no travelers */
    }
  }

  // CompanionEditor reads/writes the owner's benefits_profile blob directly.
  const getBenefits = () => rawBenefitsRef.current
  const persistBenefits = async (next: Record<string, unknown>) => {
    if (!userId) return
    const { error } = await supabase
      .from('user_profiles')
      .upsert({ user_id: userId, benefits_profile: next }, { onConflict: 'user_id' })
    if (!error) rawBenefitsRef.current = next
    return error
  }

  const addTraveler = async () => {
    if (!userId || addingTraveler) return
    setAddingTraveler(true)
    try {
      const created = await upsertAccountCompanion(supabase, userId, { full_name: 'New traveler' })
      await loadCompanions()
      setSelectedPerson(created.id)
      router.push('/profile')
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not add traveler')
    } finally {
      setAddingTraveler(false)
    }
  }

  const handleDeleteTraveler = async () => {
    if (!confirmDelete || !userId) return
    setDeleting(true)
    try {
      await deleteAccountCompanion(supabase, userId, confirmDelete.id)
      const benefits = rawBenefitsRef.current
      const cp = readCompanionProfiles(benefits)
      if (cp[confirmDelete.id]) {
        const rest = { ...cp }
        delete rest[confirmDelete.id]
        await persistBenefits({ ...benefits, companion_profiles: rest })
      }
      if (selectedPerson === confirmDelete.id) setSelectedPerson('self')
      setConfirmDelete(null)
      await loadCompanions()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not remove traveler')
    } finally {
      setDeleting(false)
    }
  }

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth?mode=signin&next=/profile'); return }
      const fromInvite = searchParams.get('fromInvite')
      const inviteCode = searchParams.get('code')
      if (fromInvite && inviteCode) localStorage.setItem('pending_join_code', inviteCode)
      setUserId(user.id)
      loadCompanions(user.id)

      const { data: existing } = await supabase.from('user_profiles').select('*').eq('user_id', user.id).maybeSingle()

      const nextForm: ProfileForm = {
        ...EMPTY_FORM,
        email: user.email || '',
      }
      if (existing) {
        nextForm.full_name = existing.full_name || ''
        nextForm.date_of_birth = existing.date_of_birth || ''
        nextForm.email = existing.email || user.email || ''
        nextForm.country_of_residence = existing.country_of_residence || 'United States'
        nextForm.address = existing.address || ''
        nextForm.address_unit = existing.address_unit || ''
        nextForm.passport_number = existing.passport_number || ''
        nextForm.tsa_known_traveler = existing.tsa_known_traveler || ''
        nextForm.credit_cards = Array.isArray(existing.credit_cards) ? existing.credit_cards : []
        nextForm.memberships = Array.isArray(existing.memberships) ? existing.memberships : []

        if (typeof existing.sms_notifications_enabled === 'boolean') setSmsNotificationsEnabled(existing.sms_notifications_enabled)
        if (existing.phone) {
          const parts = String(existing.phone).split(' ')
          if (parts.length > 1) { setPhoneCode(parts[0]); setPhoneNumber(parts.slice(1).join(' ')) }
          else setPhoneNumber(existing.phone)
        }

        const loadedDetails = detailsFromBenefits(existing.benefits_profile)
        // An address already on file was entered before verification existed — treat as verified.
        if (existing.address && !loadedDetails.address_verified) loadedDetails.address_verified = true
        rawBenefitsRef.current = (existing.benefits_profile && typeof existing.benefits_profile === 'object'
          ? existing.benefits_profile
          : {}) as Record<string, unknown>
        savedDetailsRef.current = loadedDetails
        setDetails(loadedDetails)
      }
      setForm(nextForm)

      if (!existing || !existing.profile_complete) setShowWelcome(true)
      setLoading(false)
      loadedRef.current = true
    }
    getUser()
  }, [router, searchParams])

  const handleSave = async () => {
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { alert('Session expired - please sign in again'); router.push('/'); return }
      const error = await persist(form, details)
      if (error) { alert('Error saving: ' + error.message); setSaving(false); return }
      const pendingCode = localStorage.getItem('pending_join_code')
      if (pendingCode) { localStorage.removeItem('pending_join_code'); router.push(`/join/${pendingCode}`); return }
      router.push(getPostAuthPath(true))
    } catch (e) {
      alert('Something went wrong: ' + (e instanceof Error ? e.message : String(e)))
      setSaving(false)
    }
  }

  const s = { fontFamily: 'var(--font-cormorant), Georgia, serif' as const }
  const inputStyle = { width: '100%', borderBottom: '1px solid #d4d4c8', background: 'transparent', padding: '10px 0', fontSize: '15px', color: 'var(--foreground)', outline: 'none', ...s }
  const labelStyle = { fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase' as const, color: 'var(--muted-foreground)', display: 'block', marginBottom: '6px' }
  const selectStyle = { ...inputStyle, cursor: 'pointer', appearance: 'none' as const, backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%239a9a8a' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 4px center', paddingRight: '24px' }
  const sectionStyle = { fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase' as const, color: 'var(--muted-foreground)', borderBottom: '1px solid #e8e8e0', paddingBottom: '8px', marginBottom: '20px' }
  const hintStyle = { fontSize: '11px', color: '#b4b4a8', marginBottom: '6px', fontStyle: 'italic' as const }
  const styles: Styles = { s, inputStyle, labelStyle, selectStyle, sectionStyle, hintStyle }

  const tabParam = searchParams.get('tab') as TabKey | null
  const activeTab: TabKey = TABS.some(t => t.key === tabParam) ? (tabParam as TabKey) : 'basic'

  const selectedCompanion =
    selectedPerson === 'self' ? null : companions.find(c => c.id === selectedPerson) || null
  const isSelf = !selectedCompanion
  const goToTab = (key: TabKey) => router.push(key === 'basic' ? '/profile' : `/profile?tab=${key}`)

  if (loading) return <SuitcaseLoader message="Loading your profile" />

  if (showWelcome) return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: '100%', background: 'transparent', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
      <div style={{ maxWidth: '560px', margin: '0 auto', padding: '48px 24px 0', width: '100%' }}>
        <BackLink href="/dashboard" wrapperClassName="mb-8 flex justify-end" />
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ width: '100%', maxWidth: '400px', textAlign: 'center' }}>
          <h1 style={{ fontSize: '36px', fontWeight: 300, color: 'var(--foreground)', margin: '0 0 12px', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>Welcome to Avanti</h1>
          <p style={{ fontSize: '14px', color: 'var(--muted-foreground)', lineHeight: 1.8, marginBottom: '40px' }}>
            Avanti handles everything — you just show up.<br />
            First, let&apos;s set up your traveler profile.<br />
            <span style={{ fontSize: '12px', color: '#b4b4a8' }}>Takes about 2 minutes. Fill in what you know.</span>
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px' }}>
            {[
              { icon: '🛂', text: 'Your passport and travel documents' },
              { icon: '✈️', text: 'Credit cards, benefits, and preferences' },
            ].map(item => (
              <div key={item.text} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '0', textAlign: 'left' }}>
                <span style={{ fontSize: '20px' }}>{item.icon}</span>
                <p style={{ fontSize: '13px', color: '#3a3a3a', margin: 0 }}>{item.text}</p>
              </div>
            ))}
          </div>
          <button onClick={() => setShowWelcome(false)}
            style={{ width: '100%', border: '1px solid #182D09', background: '#182D09', color: '#fff', padding: '16px', fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '0', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
            Let&apos;s get started →
          </button>
        </div>
      </div>
      <Footer />
    </div>
  )

  const personRail = (
    <aside style={{ width: '100%', ...s }} className="lg:w-60 lg:flex-shrink-0">
      <div style={{ border: '1px solid #e8e8e0', background: 'var(--card)' }}>
        <button
          type="button"
          onClick={() => { setSelectedPerson('self'); goToTab('basic') }}
          style={{
            width: '100%', textAlign: 'left', padding: '16px 16px', cursor: 'pointer',
            border: 'none', borderLeft: `3px solid ${isSelf ? '#083807' : 'transparent'}`,
            background: isSelf ? '#f2f5ef' : 'transparent', ...s,
          }}
        >
          <p style={{ fontSize: '9px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#9a9a8a', margin: '0 0 3px' }}>You</p>
          <p style={{ fontSize: '17px', color: isSelf ? '#083807' : 'var(--foreground)', margin: 0 }}>My profile</p>
        </button>

        <div style={{ borderTop: '1px solid #e8e8e0', padding: '14px 16px 6px' }}>
          <p style={{ fontSize: '9px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#9a9a8a', margin: 0 }}>Saved travelers</p>
        </div>

        {companions.length === 0 && (
          <p style={{ fontSize: '12px', color: 'var(--muted-foreground)', lineHeight: 1.6, padding: '0 16px 12px', margin: 0 }}>
            Add partners, kids, or anyone you travel with. Their details count toward the group.
          </p>
        )}

        {companions.map(c => {
          const active = selectedPerson === c.id
          return (
            <div
              key={c.id}
              style={{
                display: 'flex', alignItems: 'center',
                borderLeft: `3px solid ${active ? '#083807' : 'transparent'}`,
                background: active ? '#f2f5ef' : 'transparent',
              }}
            >
              <button
                type="button"
                onClick={() => { setSelectedPerson(c.id); goToTab('basic') }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0,
                  border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left',
                  padding: '11px 8px 11px 13px', ...s,
                }}
              >
                <span style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#e8f0e4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', color: '#083807', flexShrink: 0 }}>
                  {(c.nickname || c.full_name || '?').charAt(0).toUpperCase()}
                </span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: '14px', color: active ? '#083807' : 'var(--foreground)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.full_name || 'New traveler'}</span>
                  {c.relationship && <span style={{ display: 'block', fontSize: '11px', color: 'var(--muted-foreground)' }}>{c.relationship}</span>}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(c)}
                aria-label={`Remove ${c.full_name}`}
                title="Remove traveler"
                style={{ flexShrink: 0, width: '30px', height: '30px', marginRight: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', borderRadius: '50%', background: 'transparent', color: 'var(--muted-foreground)', fontSize: '17px', lineHeight: 1, cursor: 'pointer', ...s }}
                onMouseEnter={e => { e.currentTarget.style.background = '#fbeaea'; e.currentTarget.style.color = '#a32d2d' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--muted-foreground)' }}
              >
                ×
              </button>
            </div>
          )
        })}

        <div style={{ padding: '10px 12px 14px', borderTop: companions.length ? '1px solid #f0f0e8' : 'none' }}>
          <button
            type="button"
            onClick={addTraveler}
            disabled={addingTraveler}
            style={{ width: '100%', border: '1px dashed #d4d4c8', background: 'transparent', padding: '11px', fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#083807', cursor: addingTraveler ? 'default' : 'pointer', opacity: addingTraveler ? 0.6 : 1, ...s }}
          >
            {addingTraveler ? 'Adding…' : '+ Add a traveler'}
          </button>
        </div>
      </div>
    </aside>
  )

  const tabBar = (
    <div style={{ display: 'flex', borderBottom: '1px solid #e8e8e0', marginBottom: '32px', overflowX: 'auto' }}>
      {TABS.map(tab => (
        <button key={tab.key} onClick={() => goToTab(tab.key)}
          style={{ flex: '1 0 auto', minWidth: '76px', padding: '10px 8px', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', color: activeTab === tab.key ? '#1a1a1a' : '#9a9a8a', background: 'none', border: 'none', borderBottom: `2px solid ${activeTab === tab.key ? '#083807' : 'transparent'}`, cursor: 'pointer', whiteSpace: 'nowrap', ...s }}>
          {tab.label}
        </button>
      ))}
    </div>
  )

  const editor = (
    <div style={{ flex: 1, minWidth: 0 }}>
      <h1 style={{ fontSize: '36px', fontWeight: 300, color: '#083807', margin: '0 0 4px', ...s }}>
        {isSelf ? 'My profile' : (selectedCompanion?.full_name || 'New traveler')}
      </h1>
      <p style={{ fontSize: '13px', color: 'var(--muted-foreground)', margin: '0 0 28px' }}>
        {isSelf ? 'Your traveler profile' : `Saved traveler${selectedCompanion?.relationship ? ` · ${selectedCompanion.relationship}` : ''}`}
      </p>

      {tabBar}

      {isSelf ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {autoSaved && (
            <p style={{ fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#2d5a18', textAlign: 'right', marginBottom: '-16px' }}>✓ Saved</p>
          )}

          {activeTab === 'basic' && (
            <BasicInfoTab
              form={form} updateForm={updateForm}
              details={details} updateDetails={updateDetails}
              phoneCode={phoneCode} setPhoneCode={setPhoneCode}
              phoneNumber={phoneNumber} setPhoneNumber={setPhoneNumber}
              smsEnabled={smsNotificationsEnabled} setSmsEnabled={setSmsNotificationsEnabled}
              setValidity={setValidity} styles={styles}
            />
          )}
          {activeTab === 'travel' && (
            <TravelInfoTab
              form={form} updateForm={updateForm}
              details={details} updateTravel={updateTravel}
              setAirlineLoyalty={setAirlineLoyalty} setValidity={setValidity} styles={styles}
            />
          )}
          {activeTab === 'financial' && (
            <FinancialTab form={form} updateForm={updateForm} details={details} updateFinancial={updateFinancial} styles={styles} />
          )}
          {activeTab === 'extra' && (
            <ExtraTab details={details} updateAccessibility={updateAccessibility} setMedications={setMedications} styles={styles} />
          )}

          <button onClick={handleSave} disabled={saving}
            style={{ width: '100%', border: '1px solid #2d5a18', padding: '16px', fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', color: saving ? '#9a9a8a' : '#2d5a18', background: 'transparent', cursor: 'pointer', opacity: saving ? 0.6 : 1, ...s }}>
            {saving ? 'Saving...' : 'Save & continue →'}
          </button>
        </div>
      ) : userId && selectedCompanion ? (
        <CompanionEditor
          key={selectedCompanion.id}
          companion={selectedCompanion}
          userId={userId}
          activeTab={activeTab}
          styles={styles}
          getBenefits={getBenefits}
          persistBenefits={persistBenefits}
          onBaseSaved={loadCompanions}
        />
      ) : null}
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: '100%', background: 'transparent', paddingBottom: '80px', ...s }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '48px 24px', width: '100%' }}>
        <BackLink href="/dashboard" wrapperClassName="mb-8 flex justify-end" />
        <div className="flex flex-col gap-8 lg:flex-row-reverse lg:gap-12 lg:items-start">
          {personRail}
          {editor}
        </div>
      </div>

      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '0 24px 48px', textAlign: 'center' }}>
        <button onClick={async () => { await supabase.auth.signOut(); router.push('/') }}
          style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--muted-foreground)', background: 'none', border: 'none', cursor: 'pointer', ...s }}>
          Sign out
        </button>
      </div>

      {confirmDelete && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => !deleting && setConfirmDelete(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(8, 24, 12, 0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', zIndex: 1000 }}
        >
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--card)', border: '1px solid #e8e8e0', maxWidth: '420px', width: '100%', padding: '28px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', ...s }}>
            <p style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#a32d2d', margin: '0 0 12px' }}>Remove traveler</p>
            <p style={{ fontSize: '18px', color: 'var(--foreground)', margin: '0 0 10px' }}>Remove {confirmDelete.full_name}?</p>
            <p style={{ fontSize: '13px', color: 'var(--muted-foreground)', lineHeight: 1.6, margin: '0 0 24px' }}>
              This permanently deletes their saved profile — passport, travel, financial, and accessibility details — from your account. It won&apos;t change trips they&apos;ve already been added to. This can&apos;t be undone.
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="button" onClick={handleDeleteTraveler} disabled={deleting}
                style={{ flex: 1, border: '1px solid #a32d2d', background: '#a32d2d', color: '#fff', padding: '14px', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', cursor: deleting ? 'default' : 'pointer', opacity: deleting ? 0.6 : 1, ...s }}>
                {deleting ? 'Removing…' : 'Remove traveler'}
              </button>
              <button type="button" onClick={() => setConfirmDelete(null)} disabled={deleting}
                style={{ padding: '14px 18px', border: '1px solid #d4d4c8', background: 'transparent', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--muted-foreground)', cursor: deleting ? 'default' : 'pointer', ...s }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  )
}

export default function ProfileSetup() {
  return (
    <Suspense fallback={null}>
      <ProfileSetupInner />
    </Suspense>
  )
}
