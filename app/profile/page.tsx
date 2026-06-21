'use client'
import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import SuitcaseLoader from '../components/SuitcaseLoader'
import Footer from '../components/Footer'
import { BackLink } from '../components/SubpageShell'
import { hasPreviewAnswers, isPendingShare } from '@/lib/preview-trip-storage'
import { PHONE_COUNTRY_CODES } from '@/lib/phone'
import TravelersTab from './TravelersTab'
import DateOfBirthSelect from '../components/DateOfBirthSelect'

const COUNTRIES = ["Afghanistan","Albania","Algeria","Andorra","Angola","Antigua and Barbuda","Argentina","Armenia","Australia","Austria","Azerbaijan","Bahamas","Bahrain","Bangladesh","Barbados","Belarus","Belgium","Belize","Benin","Bhutan","Bolivia","Bosnia and Herzegovina","Botswana","Brazil","Brunei","Bulgaria","Burkina Faso","Burundi","Cabo Verde","Cambodia","Cameroon","Canada","Central African Republic","Chad","Chile","China","Colombia","Comoros","Congo","Costa Rica","Croatia","Cuba","Cyprus","Czech Republic","Denmark","Djibouti","Dominica","Dominican Republic","Ecuador","Egypt","El Salvador","Equatorial Guinea","Eritrea","Estonia","Eswatini","Ethiopia","Fiji","Finland","France","Gabon","Gambia","Georgia","Germany","Ghana","Greece","Grenada","Guatemala","Guinea","Guinea-Bissau","Guyana","Haiti","Honduras","Hungary","Iceland","India","Indonesia","Iran","Iraq","Ireland","Israel","Italy","Jamaica","Japan","Jordan","Kazakhstan","Kenya","Kiribati","Kuwait","Kyrgyzstan","Laos","Latvia","Lebanon","Lesotho","Liberia","Libya","Liechtenstein","Lithuania","Luxembourg","Madagascar","Malawi","Malaysia","Maldives","Mali","Malta","Marshall Islands","Mauritania","Mauritius","Mexico","Micronesia","Moldova","Monaco","Mongolia","Montenegro","Morocco","Mozambique","Myanmar","Namibia","Nauru","Nepal","Netherlands","New Zealand","Nicaragua","Niger","Nigeria","North Korea","North Macedonia","Norway","Oman","Pakistan","Palau","Palestine","Panama","Papua New Guinea","Paraguay","Peru","Philippines","Poland","Portugal","Qatar","Romania","Russia","Rwanda","Saint Kitts and Nevis","Saint Lucia","Saint Vincent and the Grenadines","Samoa","San Marino","Sao Tome and Principe","Saudi Arabia","Senegal","Serbia","Seychelles","Sierra Leone","Singapore","Slovakia","Slovenia","Solomon Islands","Somalia","South Africa","South Korea","South Sudan","Spain","Sri Lanka","Sudan","Suriname","Sweden","Switzerland","Syria","Taiwan","Tajikistan","Tanzania","Thailand","Timor-Leste","Togo","Tonga","Trinidad and Tobago","Tunisia","Turkey","Turkmenistan","Tuvalu","Uganda","Ukraine","United Arab Emirates","United Kingdom","United States","Uruguay","Uzbekistan","Vanuatu","Vatican City","Venezuela","Vietnam","Yemen","Zambia","Zimbabwe"]

const CARDS = ['Amex Platinum', 'Amex Gold', 'Chase Sapphire Reserve', 'Chase Sapphire Preferred', 'United Explorer', 'Delta SkyMiles Gold', 'Delta SkyMiles Reserve', 'Capital One Venture X', 'Citi AAdvantage', 'Southwest Rapid Rewards', 'Other']
const MEMBERSHIPS = ['TSA PreCheck', 'Global Entry', 'CLEAR', 'AAA', 'Active Military / Veteran', 'AARP']

function ProfileSetupInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isNewUser, setIsNewUser] = useState(false)
  const [showWelcome, setShowWelcome] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [phoneCode, setPhoneCode] = useState('+1')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [smsNotificationsEnabled, setSmsNotificationsEnabled] = useState(true)
  const saveTimer = useRef<any>(null)
  const [autoSaved, setAutoSaved] = useState(false)
  const [form, setForm] = useState({
    full_name: '', date_of_birth: '', phone: '', email: '',
    country_of_residence: 'United States', address: '', address_unit: '',
    passport_number: '', tsa_known_traveler: '',
    credit_cards: [] as string[], memberships: [] as string[],
  })

  const autoSaveProfile = (updatedForm: typeof form) => {
    if (!userId) return
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      const fullPhone = `${phoneCode} ${updatedForm.phone || phoneNumber}`
      const fullAddress = updatedForm.address_unit ? `${updatedForm.address}, ${updatedForm.address_unit}` : updatedForm.address
      await supabase.from('user_profiles').upsert({
        user_id: userId,
        ...updatedForm,
        phone: fullPhone,
        address: fullAddress,
        profile_complete: true,
        sms_notifications_enabled: smsNotificationsEnabled,
      })
      setAutoSaved(true)
      setTimeout(() => setAutoSaved(false), 2000)
    }, 1500)
  }

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      const fromInvite = searchParams.get('fromInvite')
      const inviteCode = searchParams.get('code')
      if (fromInvite && inviteCode) {
        localStorage.setItem('pending_join_code', inviteCode)
      }
      setUserId(user.id)
      setForm(f => ({ ...f, email: user.email || '' }))
      const { data: existing } = await supabase.from('user_profiles').select('*').eq('user_id', user.id).maybeSingle()
      if (existing) {
        setForm(f => ({ ...f, ...existing }))
        if (typeof existing.sms_notifications_enabled === 'boolean') {
          setSmsNotificationsEnabled(existing.sms_notifications_enabled)
        }
        if (existing.phone) {
          const parts = existing.phone.split(' ')
          if (parts.length > 1) { setPhoneCode(parts[0]); setPhoneNumber(parts.slice(1).join(' ')) }
        }
      }
      if (!existing || !existing.profile_complete) {
        setIsNewUser(true)
        setShowWelcome(true)
      }
      setLoading(false)
    }
    getUser()
  }, [router, searchParams])

  const toggle = (key: 'credit_cards' | 'memberships', val: string) => {
    const updated = { ...form, [key]: (form[key] as string[]).includes(val) ? (form[key] as string[]).filter(v => v !== val) : [...(form[key] as string[]), val] }
    setForm(updated)
    autoSaveProfile(updated)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        alert('Session expired - please sign in again')
        router.push('/')
        return
      }
      const fullPhone = phoneNumber ? `${phoneCode} ${phoneNumber}` : form.phone || ''
      const { error } = await supabase.from('user_profiles').upsert({
        user_id: user.id,
        full_name: form.full_name,
        date_of_birth: form.date_of_birth,
        phone: fullPhone || form.phone,
        email: form.email,
        country_of_residence: form.country_of_residence,
        address: form.address,
        address_unit: form.address_unit,
        passport_number: form.passport_number,
        tsa_known_traveler: form.tsa_known_traveler,
        credit_cards: form.credit_cards,
        memberships: form.memberships,
        profile_complete: true,
        sms_notifications_enabled: smsNotificationsEnabled,
      }, { onConflict: 'user_id' })
      if (error) {
        alert('Error saving: ' + error.message)
        setSaving(false)
        return
      }
      const pendingCode = localStorage.getItem('pending_join_code')
      if (pendingCode) {
        localStorage.removeItem('pending_join_code')
        router.push(`/join/${pendingCode}`)
        return
      }
      if (hasPreviewAnswers() && isPendingShare()) {
        router.push('/create')
        return
      }
      router.push('/dashboard')
    } catch (e: any) {
      alert('Something went wrong: ' + e.message)
      setSaving(false)
    }
  }

  const s = { fontFamily: 'var(--font-cormorant), Georgia, serif' }
  const inputStyle = { width: '100%', borderBottom: '1px solid #d4d4c8', background: 'transparent', padding: '10px 0', fontSize: '15px', color: 'var(--foreground)', outline: 'none', ...s }
  const labelStyle = { fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase' as const, color: 'var(--muted-foreground)', display: 'block', marginBottom: '6px' }
  const selectStyle = { ...inputStyle, cursor: 'pointer', appearance: 'none' as const, backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%239a9a8a' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 4px center', paddingRight: '24px' }
  const sectionStyle = { fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase' as const, color: 'var(--muted-foreground)', borderBottom: '1px solid #e8e8e0', paddingBottom: '8px', marginBottom: '20px' }

  const activeTab = searchParams.get('tab') === 'travelers' ? 'travelers' : 'profile'

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
          First, let's set up your traveler profile.<br />
          <span style={{ fontSize: '12px', color: '#b4b4a8' }}>Takes about 2 minutes. Fill in what you know.</span>
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px' }}>
          {[
            { icon: '🛂', text: 'Your passport and travel documents' },
            { icon: '✈️', text: 'Credit cards and benefits' },
          ].map(item => (
            <div key={item.text} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '0', textAlign: 'left' }}>
              <span style={{ fontSize: '20px' }}>{item.icon}</span>
              <p style={{ fontSize: '13px', color: '#3a3a3a', margin: 0 }}>{item.text}</p>
            </div>
          ))}
        </div>
        <button onClick={() => setShowWelcome(false)}
          style={{ width: '100%', border: '1px solid #182D09', background: '#182D09', color: '#fff', padding: '16px', fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '0', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
          Let's get started →
        </button>
      </div>
      </div>
      <Footer />
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: '100%', background: 'transparent', paddingBottom: '80px', ...s }}>
      <div style={{ maxWidth: '560px', margin: '0 auto', padding: '48px 24px' }}>
        <BackLink href="/dashboard" wrapperClassName="mb-8 flex justify-end" />
        <h1 style={{ fontSize: '36px', fontWeight: 300, color: '#083807', margin: '0 0 32px', ...s }}>My profile</h1>

        <div style={{ display: 'flex', borderBottom: '1px solid #e8e8e0', marginBottom: '32px' }}>
          {[{ key: 'profile', label: 'Profile' }, { key: 'travelers', label: 'Travelers' }].map(tab => (
              <button key={tab.key} onClick={() => router.push(tab.key === 'travelers' ? '/profile?tab=travelers' : '/profile')}
                style={{ flex: 1, padding: '10px 0', fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', color: activeTab === tab.key ? '#1a1a1a' : '#9a9a8a', background: 'none', border: 'none', borderBottom: `2px solid ${activeTab === tab.key ? '#083807' : 'transparent'}`, cursor: 'pointer', ...s }}>
                {tab.label}
              </button>
            ))}
        </div>

        {activeTab === 'travelers' && userId ? (
          <TravelersTab userId={userId} />
        ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
          {autoSaved && (
            <p style={{ fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#2d5a18', textAlign: 'right', marginBottom: '-24px' }}>✓ Saved</p>
          )}
          <div>
            <p style={sectionStyle}>Identity</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={labelStyle}>Full legal name *</label>
                <p style={{ fontSize: '11px', color: '#b4b4a8', marginBottom: '6px', fontStyle: 'italic' }}>Exactly as it appears on your passport or government ID</p>
                <input style={inputStyle} value={form.full_name} onChange={e => { const updated = {...form, full_name: e.target.value}; setForm(updated); autoSaveProfile(updated) }} placeholder="Alexandra Sarah Goldin" />
              </div>
              <div>
                <label style={labelStyle}>Date of birth</label>
                <DateOfBirthSelect
                  value={form.date_of_birth}
                  onChange={date_of_birth => {
                    const updated = { ...form, date_of_birth }
                    setForm(updated)
                    autoSaveProfile(updated)
                  }}
                  selectStyle={selectStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Email</label>
                <input type="email" style={inputStyle} value={form.email} onChange={e => { const updated = {...form, email: e.target.value}; setForm(updated); autoSaveProfile(updated) }} />
              </div>
              <div>
                <label style={labelStyle}>Phone number</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                  <div style={{ minWidth: '140px' }}>
                    <select value={phoneCode} onChange={e => { setPhoneCode(e.target.value); autoSaveProfile(form) }} style={{ ...selectStyle, width: '100%' }}>
                      {PHONE_COUNTRY_CODES.map(p => <option key={p.country} value={p.code}>{p.flag} {p.code} {p.country}</option>)}
                    </select>
                  </div>
                  <input style={{ ...inputStyle, flex: 1 }} value={phoneNumber} onChange={e => { setPhoneNumber(e.target.value); autoSaveProfile(form) }} placeholder="312 555 0192" type="tel" />
                </div>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginTop: '14px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={smsNotificationsEnabled}
                    onChange={e => {
                      setSmsNotificationsEnabled(e.target.checked)
                      autoSaveProfile(form)
                    }}
                    style={{ marginTop: '2px' }}
                  />
                  <span>
                    <span style={{ ...labelStyle, marginBottom: '4px' }}>Text notifications</span>
                    <span style={{ display: 'block', fontSize: '12px', color: '#9a9a8a', lineHeight: 1.6 }}>
                      Get trip invites, reminders, and nudges by text message.
                    </span>
                  </span>
                </label>
              </div>
              <div>
                <label style={labelStyle}>Country of residence</label>
                <select style={selectStyle} value={form.country_of_residence} onChange={e => { const updated = {...form, country_of_residence: e.target.value}; setForm(updated); autoSaveProfile(updated) }}>
                  {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Street address</label>
                <input style={inputStyle} value={form.address} onChange={e => { const updated = {...form, address: e.target.value}; setForm(updated); autoSaveProfile(updated) }} placeholder="123 Main Street, Chicago, IL 60601" />
              </div>
              <div>
                <label style={labelStyle}>Apt / unit <span style={{ textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
                <input style={inputStyle} value={form.address_unit} onChange={e => { const updated = {...form, address_unit: e.target.value}; setForm(updated); autoSaveProfile(updated) }} placeholder="Apt 4B" />
              </div>
            </div>
          </div>

          <div>
            <p style={sectionStyle}>Travel documents</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={labelStyle}>Passport number</label>
                <input style={inputStyle} value={form.passport_number} onChange={e => { const updated = {...form, passport_number: e.target.value}; setForm(updated); autoSaveProfile(updated) }} placeholder="A12345678" />
              </div>
              <div>
                <label style={labelStyle}>TSA Known Traveler / PreCheck</label>
                <input style={inputStyle} value={form.tsa_known_traveler} onChange={e => { const updated = {...form, tsa_known_traveler: e.target.value}; setForm(updated); autoSaveProfile(updated) }} onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }} placeholder="12345678" />
              </div>
            </div>
          </div>

          <div>
            <p style={sectionStyle}>Credit cards</p>
            <p style={{ fontSize: '12px', color: 'var(--muted-foreground)', marginBottom: '16px', lineHeight: 1.7 }}>Avanti flags free bag benefits, lounge access, and travel credits automatically.</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {CARDS.map(card => (
                <button key={card} onClick={() => toggle('credit_cards', card)}
                  style={{ padding: '6px 14px', fontSize: '11px', border: `1px solid ${form.credit_cards.includes(card) ? '#2d5a18' : '#d4d4c8'}`, background: form.credit_cards.includes(card) ? '#2d5a18' : 'transparent', color: form.credit_cards.includes(card) ? '#fafaf8' : '#6a6a6a', cursor: 'pointer', transition: 'all 0.2s', ...s }}>
                  {card}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p style={sectionStyle}>Memberships</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {MEMBERSHIPS.map(m => (
                <button key={m} onClick={() => toggle('memberships', m)}
                  style={{ padding: '6px 14px', fontSize: '11px', border: `1px solid ${form.memberships.includes(m) ? '#2d5a18' : '#d4d4c8'}`, background: form.memberships.includes(m) ? '#2d5a18' : 'transparent', color: form.memberships.includes(m) ? '#fafaf8' : '#6a6a6a', cursor: 'pointer', transition: 'all 0.2s', ...s }}>
                  {m}
                </button>
              ))}
            </div>
          </div>

          <button onClick={handleSave} disabled={saving}
            style={{ width: '100%', border: '1px solid #2d5a18', padding: '16px', fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', color: saving ? '#9a9a8a' : '#2d5a18', background: 'transparent', cursor: 'pointer', opacity: saving ? 0.6 : 1, ...s }}>
            {saving ? 'Saving...' : 'Save profile →'}
          </button>
        </div>
        )}
      </div>

      <div style={{ maxWidth: '560px', margin: '0 auto', padding: '0 24px 48px', textAlign: 'center' }}>
        <button onClick={async () => { await supabase.auth.signOut(); router.push('/') }}
          style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--muted-foreground)', background: 'none', border: 'none', cursor: 'pointer', ...s }}>
          Sign out
        </button>
      </div>
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
