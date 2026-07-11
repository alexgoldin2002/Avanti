'use client'

import DateOfBirthSelect from '../components/DateOfBirthSelect'
import AddressAutocomplete from '../components/AddressAutocomplete'
import ValidatedTextInput from '../components/ValidatedTextInput'
import { PHONE_COUNTRY_CODES } from '@/lib/phone'
import { PLACEHOLDERS } from '@/lib/form-placeholders'
import { COUNTRIES, type ProfileForm, type ProfileDetails, type Styles } from './shared'

type Props = {
  form: ProfileForm
  updateForm: (patch: Partial<ProfileForm>) => void
  details: ProfileDetails
  updateDetails: (patch: Partial<ProfileDetails>) => void
  phoneCode: string
  setPhoneCode: (v: string) => void
  phoneNumber: string
  setPhoneNumber: (v: string) => void
  smsEnabled: boolean
  setSmsEnabled: (v: boolean) => void
  setValidity: (field: string, valid: boolean) => void
  styles: Styles
}

export default function BasicInfoTab({
  form,
  updateForm,
  details,
  updateDetails,
  phoneCode,
  setPhoneCode,
  phoneNumber,
  setPhoneNumber,
  smsEnabled,
  setSmsEnabled,
  setValidity,
  styles,
}: Props) {
  const { inputStyle, labelStyle, selectStyle, sectionStyle, hintStyle } = styles

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
      <div>
        <p style={sectionStyle}>Identity</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={labelStyle}>Full legal name *</label>
            <p style={hintStyle}>Exactly as it appears on your passport or government ID</p>
            <input style={inputStyle} value={form.full_name} onChange={e => updateForm({ full_name: e.target.value })} placeholder={PLACEHOLDERS.fullName} />
          </div>
          <div>
            <label style={labelStyle}>Date of birth</label>
            <DateOfBirthSelect
              value={form.date_of_birth}
              onChange={date_of_birth => updateForm({ date_of_birth })}
              selectStyle={selectStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Email</label>
            <ValidatedTextInput
              kind="email"
              value={form.email}
              onChange={(email, valid) => { updateForm({ email }); setValidity('email', valid) }}
              inputStyle={inputStyle}
              inputMode="email"
              placeholder={PLACEHOLDERS.email}
            />
          </div>
          <div>
            <label style={labelStyle}>Phone number</label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
              <div style={{ minWidth: '140px' }}>
                <select value={phoneCode} onChange={e => setPhoneCode(e.target.value)} style={{ ...selectStyle, width: '100%' }}>
                  {PHONE_COUNTRY_CODES.map(p => <option key={p.country} value={p.code}>{p.flag} {p.code} {p.country}</option>)}
                </select>
              </div>
              <input style={{ ...inputStyle, flex: 1 }} value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} placeholder={PLACEHOLDERS.phone} type="tel" />
            </div>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginTop: '14px', cursor: 'pointer' }}>
              <input type="checkbox" checked={smsEnabled} onChange={e => setSmsEnabled(e.target.checked)} style={{ marginTop: '2px' }} />
              <span>
                <span style={{ ...labelStyle, marginBottom: '4px' }}>Text notifications</span>
                <span style={{ display: 'block', fontSize: '12px', color: '#9a9a8a', lineHeight: 1.6 }}>
                  Get trip invites, reminders, and nudges by text message.
                </span>
              </span>
            </label>
          </div>
        </div>
      </div>

      <div>
        <p style={sectionStyle}>Where you live</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={labelStyle}>Country of residence</label>
            <select style={selectStyle} value={form.country_of_residence} onChange={e => updateForm({ country_of_residence: e.target.value })}>
              {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Street address</label>
            <p style={hintStyle}>Start typing and choose your address from the dropdown so we can verify it.</p>
            <AddressAutocomplete
              value={form.address}
              verified={details.address_verified}
              onChange={next => {
                updateForm({ address: next.address })
                updateDetails({ address_verified: next.verified, address_place_id: next.placeId })
              }}
              inputStyle={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Apt / unit <span style={{ textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
            <input style={inputStyle} value={form.address_unit} onChange={e => updateForm({ address_unit: e.target.value })} placeholder={PLACEHOLDERS.apartment} />
          </div>
        </div>
      </div>
    </div>
  )
}
