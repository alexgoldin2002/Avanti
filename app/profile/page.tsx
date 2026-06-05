'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import AvantiLogo from '../components/AvantiLogo'
import SuitcaseLoader from '../components/SuitcaseLoader'

const COUNTRIES = ["Afghanistan","Albania","Algeria","Andorra","Angola","Antigua and Barbuda","Argentina","Armenia","Australia","Austria","Azerbaijan","Bahamas","Bahrain","Bangladesh","Barbados","Belarus","Belgium","Belize","Benin","Bhutan","Bolivia","Bosnia and Herzegovina","Botswana","Brazil","Brunei","Bulgaria","Burkina Faso","Burundi","Cabo Verde","Cambodia","Cameroon","Canada","Central African Republic","Chad","Chile","China","Colombia","Comoros","Congo","Costa Rica","Croatia","Cuba","Cyprus","Czech Republic","Denmark","Djibouti","Dominica","Dominican Republic","Ecuador","Egypt","El Salvador","Equatorial Guinea","Eritrea","Estonia","Eswatini","Ethiopia","Fiji","Finland","France","Gabon","Gambia","Georgia","Germany","Ghana","Greece","Grenada","Guatemala","Guinea","Guinea-Bissau","Guyana","Haiti","Honduras","Hungary","Iceland","India","Indonesia","Iran","Iraq","Ireland","Israel","Italy","Jamaica","Japan","Jordan","Kazakhstan","Kenya","Kiribati","Kuwait","Kyrgyzstan","Laos","Latvia","Lebanon","Lesotho","Liberia","Libya","Liechtenstein","Lithuania","Luxembourg","Madagascar","Malawi","Malaysia","Maldives","Mali","Malta","Marshall Islands","Mauritania","Mauritius","Mexico","Micronesia","Moldova","Monaco","Mongolia","Montenegro","Morocco","Mozambique","Myanmar","Namibia","Nauru","Nepal","Netherlands","New Zealand","Nicaragua","Niger","Nigeria","North Korea","North Macedonia","Norway","Oman","Pakistan","Palau","Palestine","Panama","Papua New Guinea","Paraguay","Peru","Philippines","Poland","Portugal","Qatar","Romania","Russia","Rwanda","Saint Kitts and Nevis","Saint Lucia","Saint Vincent and the Grenadines","Samoa","San Marino","Sao Tome and Principe","Saudi Arabia","Senegal","Serbia","Seychelles","Sierra Leone","Singapore","Slovakia","Slovenia","Solomon Islands","Somalia","South Africa","South Korea","South Sudan","Spain","Sri Lanka","Sudan","Suriname","Sweden","Switzerland","Syria","Taiwan","Tajikistan","Tanzania","Thailand","Timor-Leste","Togo","Tonga","Trinidad and Tobago","Tunisia","Turkey","Turkmenistan","Tuvalu","Uganda","Ukraine","United Arab Emirates","United Kingdom","United States","Uruguay","Uzbekistan","Vanuatu","Vatican City","Venezuela","Vietnam","Yemen","Zambia","Zimbabwe"]

const PHONE_CODES = [
  { country: "United States", code: "+1", flag: "🇺🇸" },
  { country: "United Kingdom", code: "+44", flag: "🇬🇧" },
  { country: "Canada", code: "+1", flag: "🇨🇦" },
  { country: "Australia", code: "+61", flag: "🇦🇺" },
  { country: "France", code: "+33", flag: "🇫🇷" },
  { country: "Germany", code: "+49", flag: "🇩🇪" },
  { country: "Italy", code: "+39", flag: "🇮🇹" },
  { country: "Spain", code: "+34", flag: "🇪🇸" },
  { country: "Greece", code: "+30", flag: "🇬🇷" },
  { country: "Israel", code: "+972", flag: "🇮🇱" },
  { country: "Japan", code: "+81", flag: "🇯🇵" },
  { country: "China", code: "+86", flag: "🇨🇳" },
  { country: "India", code: "+91", flag: "🇮🇳" },
  { country: "Brazil", code: "+55", flag: "🇧🇷" },
  { country: "Mexico", code: "+52", flag: "🇲🇽" },
  { country: "South Africa", code: "+27", flag: "🇿🇦" },
  { country: "UAE", code: "+971", flag: "🇦🇪" },
  { country: "Turkey", code: "+90", flag: "🇹🇷" },
  { country: "Netherlands", code: "+31", flag: "🇳🇱" },
  { country: "Portugal", code: "+351", flag: "🇵🇹" },
  { country: "Sweden", code: "+46", flag: "🇸🇪" },
  { country: "Switzerland", code: "+41", flag: "🇨🇭" },
  { country: "Austria", code: "+43", flag: "🇦🇹" },
  { country: "Belgium", code: "+32", flag: "🇧🇪" },
  { country: "Denmark", code: "+45", flag: "🇩🇰" },
  { country: "Norway", code: "+47", flag: "🇳🇴" },
  { country: "Poland", code: "+48", flag: "🇵🇱" },
  { country: "Russia", code: "+7", flag: "🇷🇺" },
  { country: "Argentina", code: "+54", flag: "🇦🇷" },
  { country: "Colombia", code: "+57", flag: "🇨🇴" },
  { country: "Other", code: "+", flag: "🌍" },
]

const CARDS = ['Amex Platinum', 'Amex Gold', 'Chase Sapphire Reserve', 'Chase Sapphire Preferred', 'United Explorer', 'Delta SkyMiles Gold', 'Delta SkyMiles Reserve', 'Capital One Venture X', 'Citi AAdvantage', 'Southwest Rapid Rewards', 'Other']
const MEMBERSHIPS = ['TSA PreCheck', 'Global Entry', 'CLEAR', 'AAA', 'Active Military / Veteran', 'AARP']

export default function ProfileSetup() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [phoneCode, setPhoneCode] = useState('+1')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [form, setForm] = useState({
    full_name: '',
    date_of_birth: '',
    phone: '',
    email: '',
    country_of_residence: 'United States',
    address: '',
    address_unit: '',
    passport_number: '',
    tsa_known_traveler: '',
    credit_cards: [] as string[],
    memberships: [] as string[],
  })

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      setUserId(user.id)
      setForm(f => ({ ...f, email: user.email || '' }))
      const { data: existing } = await supabase.from('user_profiles').select('*').eq('user_id', user.id).maybeSingle()
      if (existing) {
        setForm(f => ({ ...f, ...existing }))
        if (existing.phone) {
          const parts = existing.phone.split(' ')
          if (parts.length > 1) { setPhoneCode(parts[0]); setPhoneNumber(parts.slice(1).join(' ')) }
        }
      }
      setLoading(false)
    }
    getUser()
  }, [router])

  const toggle = (key: 'credit_cards' | 'memberships', val: string) =>
    setForm(f => ({ ...f, [key]: (f[key] as string[]).includes(val) ? (f[key] as string[]).filter(v => v !== val) : [...(f[key] as string[]), val] }))

  const handleSave = async () => {
    setSaving(true)
    const fullPhone = `${phoneCode} ${phoneNumber}`
    const fullAddress = form.address_unit ? `${form.address}, ${form.address_unit}` : form.address
    await supabase.from('user_profiles').upsert({
      user_id: userId,
      ...form,
      phone: fullPhone,
      address: fullAddress,
      profile_complete: true
    })
    router.push('/dashboard')
  }

  const inputStyle = { width: '100%', borderBottom: '1px solid #d4d4c8', background: 'transparent', padding: '10px 0', fontSize: '15px', color: '#1a1a1a', outline: 'none', fontFamily: 'var(--font-cormorant), Georgia, serif' }
  const labelStyle = { fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase' as const, color: '#9a9a8a', display: 'block', marginBottom: '6px' }
  const selectStyle = { ...inputStyle, cursor: 'pointer', appearance: 'none' as const, backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%239a9a8a' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 4px center', paddingRight: '24px' }
  const sectionStyle = { fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase' as const, color: '#9a9a8a', borderBottom: '1px solid #e8e8e0', paddingBottom: '8px', marginBottom: '20px' }

  if (loading) return <SuitcaseLoader message="Setting up your account" />

  return (
    <main style={{ minHeight: '100vh', background: '#fafaf8', paddingBottom: '80px' }}>
      <div style={{ maxWidth: '560px', margin: '0 auto', padding: '48px 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <AvantiLogo size="sm" />
          <p style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#9a9a8a', marginTop: '16px' }}>Your traveler profile</p>
          <p style={{ fontSize: '13px', color: '#9a9a8a', marginTop: '8px', lineHeight: 1.7 }}>Fill this in once. Avanti uses it across every trip.</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>

          <div>
            <p style={sectionStyle}>Identity</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={labelStyle}>Full legal name *</label>
                <p style={{ fontSize: '11px', color: '#b4b4a8', marginBottom: '6px', fontStyle: 'italic' }}>Exactly as it appears on your passport or government ID</p>
                <input style={inputStyle} value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} placeholder="Alexandra Sarah Goldin" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={labelStyle}>Date of birth</label>
                  <input type="date" style={inputStyle} value={form.date_of_birth} onChange={e => setForm({...form, date_of_birth: e.target.value})} />
                </div>
                <div>
                  <label style={labelStyle}>Email</label>
                  <input type="email" style={inputStyle} value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Phone number</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                  <div style={{ minWidth: '140px' }}>
                    <select value={phoneCode} onChange={e => setPhoneCode(e.target.value)} style={{ ...selectStyle, width: '100%' }}>
                      {PHONE_CODES.map(p => (
                        <option key={p.country} value={p.code}>{p.flag} {p.code} {p.country}</option>
                      ))}
                    </select>
                  </div>
                  <input style={{ ...inputStyle, flex: 1 }} value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} placeholder="312 555 0192" type="tel" />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Country of residence</label>
                <select style={selectStyle} value={form.country_of_residence} onChange={e => setForm({...form, country_of_residence: e.target.value})}>
                  {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Street address</label>
                <input style={inputStyle} value={form.address} onChange={e => setForm({...form, address: e.target.value})} placeholder="123 Main Street, Chicago, IL 60601" />
              </div>

              <div>
                <label style={labelStyle}>Apartment / unit / floor <span style={{ textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
                <input style={inputStyle} value={form.address_unit} onChange={e => setForm({...form, address_unit: e.target.value})} placeholder="Apt 4B" />
              </div>
            </div>
          </div>

          <div>
            <p style={sectionStyle}>Travel documents</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={labelStyle}>Passport number</label>
                <p style={{ fontSize: '11px', color: '#b4b4a8', marginBottom: '6px', fontStyle: 'italic' }}>Required for airline bookings made through Avanti</p>
                <input style={inputStyle} value={form.passport_number} onChange={e => setForm({...form, passport_number: e.target.value})} placeholder="A12345678" />
              </div>
              <div>
                <label style={labelStyle}>TSA Known Traveler / PreCheck number</label>
                <input style={inputStyle} value={form.tsa_known_traveler} onChange={e => setForm({...form, tsa_known_traveler: e.target.value})} placeholder="12345678" />
              </div>
            </div>
          </div>

          <div>
            <p style={sectionStyle}>Credit cards</p>
            <p style={{ fontSize: '12px', color: '#9a9a8a', marginBottom: '16px', lineHeight: 1.7 }}>Avanti flags free bag benefits, lounge access, and travel credits on your bookings.</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {CARDS.map(card => (
                <button key={card} onClick={() => toggle('credit_cards', card)}
                  style={{ padding: '6px 14px', fontSize: '11px', letterSpacing: '0.05em', border: `1px solid ${form.credit_cards.includes(card) ? '#1a1a1a' : '#d4d4c8'}`, background: form.credit_cards.includes(card) ? '#1a1a1a' : 'transparent', color: form.credit_cards.includes(card) ? '#fafaf8' : '#6a6a6a', cursor: 'pointer', transition: 'all 0.2s', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
                  {card}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p style={sectionStyle}>Memberships & programs</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {MEMBERSHIPS.map(m => (
                <button key={m} onClick={() => toggle('memberships', m)}
                  style={{ padding: '6px 14px', fontSize: '11px', letterSpacing: '0.05em', border: `1px solid ${form.memberships.includes(m) ? '#1a1a1a' : '#d4d4c8'}`, background: form.memberships.includes(m) ? '#1a1a1a' : 'transparent', color: form.memberships.includes(m) ? '#fafaf8' : '#6a6a6a', cursor: 'pointer', transition: 'all 0.2s', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
                  {m}
                </button>
              ))}
            </div>
          </div>

          <button onClick={handleSave} disabled={saving}
            style={{ width: '100%', border: '1px solid #1a1a1a', padding: '16px', fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', color: saving ? '#9a9a8a' : '#1a1a1a', background: 'transparent', cursor: 'pointer', fontFamily: 'var(--font-cormorant), Georgia, serif', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Saving...' : 'Save profile & continue →'}
          </button>

        </div>
      </div>
    </main>
  )
}
