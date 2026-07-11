'use client'

import { useState } from 'react'
import ValidatedTextInput from '../components/ValidatedTextInput'
import InfoTooltip from '../components/InfoTooltip'
import {
  AIRLINES,
  AIRLINE_TIERS,
  AIRLINE_CREDIT_CARDS,
  DEFAULT_AIRLINE_TIERS,
  SEAT_PREFERENCES,
  CABIN_CLASSES,
  DEPARTURE_WINDOWS,
  CLASS_RULES,
} from '@/lib/profile/validation'
import { COUNTRIES, chipStyle, type ProfileForm, type ProfileDetails, type AirlineLoyalty, type Styles } from './shared'

const AIRLINES_SORTED = [...AIRLINES].sort((a, b) => a.localeCompare(b))

type Props = {
  form: ProfileForm
  updateForm: (patch: Partial<ProfileForm>) => void
  details: ProfileDetails
  updateTravel: (patch: Partial<ProfileDetails['travel']>) => void
  setAirlineLoyalty: (list: AirlineLoyalty[]) => void
  setValidity: (field: string, valid: boolean) => void
  styles: Styles
}

export default function TravelInfoTab({
  form,
  updateForm,
  details,
  updateTravel,
  setAirlineLoyalty,
  setValidity,
  styles,
}: Props) {
  const { s, inputStyle, labelStyle, selectStyle, sectionStyle } = styles

  const [confirmPassport, setConfirmPassport] = useState('')
  const [showSecondaryRedress, setShowSecondaryRedress] = useState(
    !!details.travel.redress_number_secondary
  )

  const passportMismatch =
    confirmPassport.trim() !== '' &&
    confirmPassport.trim().toUpperCase() !== form.passport_number.trim().toUpperCase()

  const toggleChoice = (current: string, value: string, apply: (v: string) => void) =>
    apply(current === value ? '' : value)

  // ── Airline loyalty (inline, add-as-many-as-you-like) ──
  const entries = details.airline_loyalty
  const usedAirlines = (exceptIdx: number) =>
    entries.filter((_, i) => i !== exceptIdx).map(e => e.airline)

  const updateEntry = (idx: number, patch: Partial<AirlineLoyalty>) =>
    setAirlineLoyalty(entries.map((e, i) => (i === idx ? { ...e, ...patch } : e)))
  const addEntry = () =>
    setAirlineLoyalty([...entries, { airline: '', frequent_flyer_number: '', tier: '', credit_cards: [] }])
  const removeEntry = (idx: number) => setAirlineLoyalty(entries.filter((_, i) => i !== idx))

  const labelInline = { ...labelStyle, display: 'inline-flex', alignItems: 'center' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
      {/* ─────────── Secure traveler information ─────────── */}
      <div>
        <p style={sectionStyle}>Secure traveler information</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'start' }}>
            <div>
              <label style={labelInline}>
                Known traveler number
                <InfoTooltip title="Known Traveler Number">
                  Your TSA PreCheck / Known Traveler Number is 8–12 letters and numbers, printed on your PreCheck approval letter. Adding it puts PreCheck on your boarding passes.
                </InfoTooltip>
              </label>
              <ValidatedTextInput
                kind="known_traveler"
                value={form.tsa_known_traveler}
                uppercase
                onChange={(v, valid) => { updateForm({ tsa_known_traveler: v }); setValidity('tsa_known_traveler', valid) }}
                inputStyle={inputStyle}
                placeholder="TT1234567"
              />
            </div>
            <div>
              <label style={labelStyle}>Issuing country</label>
              <select style={selectStyle} value={details.travel.known_traveler_country} onChange={e => updateTravel({ known_traveler_country: e.target.value })}>
                <option value="">Select a country…</option>
                {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'start' }}>
            <div>
              <label style={labelInline}>
                Global Entry / NEXUS / SENTRI
                <InfoTooltip title="Trusted traveler PASSID">
                  Global Entry, NEXUS, and SENTRI PASSIDs are exactly 9 digits and also grant TSA PreCheck.
                </InfoTooltip>
              </label>
              <ValidatedTextInput
                kind="global_entry"
                value={details.travel.global_entry_number}
                onChange={(v, valid) => { updateTravel({ global_entry_number: v }); setValidity('global_entry_number', valid) }}
                inputStyle={inputStyle}
                inputMode="numeric"
                placeholder="123456789"
              />
            </div>
            <div />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'start' }}>
            <div>
              <label style={labelInline}>
                Redress number
                <InfoTooltip title="Redress number">
                  A redress number is a unique, up to 13-digit number that helps the TSA verify your identity and prevent watch list misidentification. If you filed an inquiry and received a redress number, you can enter it here.
                </InfoTooltip>
              </label>
              <ValidatedTextInput
                kind="redress"
                value={details.travel.redress_number}
                onChange={(v, valid) => { updateTravel({ redress_number: v }); setValidity('redress_number', valid) }}
                inputStyle={inputStyle}
                inputMode="numeric"
                placeholder="1234567"
              />
            </div>
            <div>
              <label style={labelStyle}>Issuing country</label>
              <select style={selectStyle} value={details.travel.redress_country} onChange={e => updateTravel({ redress_country: e.target.value })}>
                <option value="">Select a country…</option>
                {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {showSecondaryRedress ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'start' }}>
              <div>
                <label style={labelStyle}>Secondary redress number</label>
                <ValidatedTextInput
                  kind="redress"
                  value={details.travel.redress_number_secondary}
                  onChange={(v) => updateTravel({ redress_number_secondary: v })}
                  inputStyle={inputStyle}
                  inputMode="numeric"
                  placeholder="1234567"
                />
              </div>
              <div>
                <label style={labelStyle}>Issuing country</label>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <select style={{ ...selectStyle, flex: 1 }} value={details.travel.redress_secondary_country} onChange={e => updateTravel({ redress_secondary_country: e.target.value })}>
                    <option value="">Select a country…</option>
                    {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <button
                    type="button"
                    onClick={() => { setShowSecondaryRedress(false); updateTravel({ redress_number_secondary: '', redress_secondary_country: '' }) }}
                    style={{ background: 'none', border: 'none', color: '#2d6a4f', fontSize: '12px', cursor: 'pointer', ...s }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowSecondaryRedress(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: '#2d6a4f', fontSize: '13px', cursor: 'pointer', padding: 0, ...s }}
            >
              <span style={{ fontSize: '16px', lineHeight: 1 }}>⊕</span> Add secondary redress number
            </button>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
            <button type="button" onClick={() => updateTravel({ clear: !details.travel.clear })} style={chipStyle(details.travel.clear, s)}>
              CLEAR member
            </button>
            <button type="button" onClick={() => updateTravel({ military: !details.travel.military })} style={chipStyle(details.travel.military, s)}>
              Active military / veteran
            </button>
          </div>
        </div>
      </div>

      {/* ─────────── International documents ─────────── */}
      <div>
        <p style={sectionStyle}>International documents</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'start' }}>
            <div>
              <label style={labelInline}>
                Passport number
                <InfoTooltip title="Passport number">
                  Enter your passport number exactly as printed (5–9 letters and numbers). Avanti uses it to pre-fill bookings and check entry requirements.
                </InfoTooltip>
              </label>
              <ValidatedTextInput
                kind="passport"
                value={form.passport_number}
                uppercase
                onChange={(v, valid) => { updateForm({ passport_number: v }); setValidity('passport_number', valid) }}
                inputStyle={inputStyle}
                placeholder="A1234567"
              />
            </div>
            <div>
              <label style={labelStyle}>Confirm passport number</label>
              <input
                type="text"
                value={confirmPassport}
                onChange={e => setConfirmPassport(e.target.value.toUpperCase())}
                placeholder="A1234567"
                aria-invalid={passportMismatch}
                style={{ ...inputStyle, textTransform: 'uppercase', borderBottom: `1px solid ${passportMismatch ? '#c0392b' : '#d4d4c8'}` }}
              />
              {passportMismatch && (
                <p role="alert" style={{ fontSize: '12px', color: '#c0392b', margin: '8px 0 0', lineHeight: 1.5, ...s }}>
                  Passport numbers don&apos;t match.
                </p>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'start' }}>
            <div>
              <label style={labelStyle}>Expiration date</label>
              <input type="date" style={inputStyle} value={details.travel.passport_expiry} onChange={e => updateTravel({ passport_expiry: e.target.value })} />
            </div>
            <div>
              <label style={labelStyle}>Passport nationality</label>
              <select style={selectStyle} value={details.travel.passport_country} onChange={e => updateTravel({ passport_country: e.target.value })}>
                <option value="">Select a country…</option>
                {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* ─────────── Airline loyalty & cards ─────────── */}
      <div>
        <p style={sectionStyle}>Airline loyalty &amp; cards</p>
        <p style={{ fontSize: '12px', color: 'var(--muted-foreground)', marginBottom: '16px', lineHeight: 1.7 }}>
          Add each airline you fly, your frequent flyer number and status, and any credit cards you hold from that airline. Add as many as you like.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {entries.map((entry, idx) => {
            const tiers = AIRLINE_TIERS[entry.airline] || DEFAULT_AIRLINE_TIERS
            const cardsForAirline = AIRLINE_CREDIT_CARDS[entry.airline] || []
            const selectedCards = entry.credit_cards || []
            const availableCards = cardsForAirline.filter(c => !selectedCards.includes(c))
            const airlineOptions = AIRLINES_SORTED.filter(
              a => a === entry.airline || !usedAirlines(idx).includes(a)
            )

            return (
              <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px', background: 'var(--card)', border: '1px solid #e8e8e0', borderRadius: '2px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#9a9a8a' }}>
                    Airline {idx + 1}
                  </span>
                  <button type="button" onClick={() => removeEntry(idx)} aria-label="Remove airline"
                    style={{ background: 'none', border: 'none', color: '#2d6a4f', fontSize: '12px', cursor: 'pointer', ...s }}>
                    Delete
                  </button>
                </div>

                <div>
                  <label style={labelStyle}>Frequent flyer program</label>
                  <select
                    value={entry.airline}
                    onChange={e => updateEntry(idx, { airline: e.target.value, tier: '', credit_cards: [] })}
                    style={selectStyle}
                  >
                    <option value="">Select an airline…</option>
                    {airlineOptions.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>

                {entry.airline && (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'start' }}>
                      <div>
                        <label style={labelStyle}>Frequent flyer number</label>
                        <ValidatedTextInput
                          kind="frequent_flyer"
                          value={entry.frequent_flyer_number}
                          uppercase
                          onChange={v => updateEntry(idx, { frequent_flyer_number: v })}
                          inputStyle={inputStyle}
                          placeholder="Account number"
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>Status / tier</label>
                        <select value={entry.tier} onChange={e => updateEntry(idx, { tier: e.target.value })} style={selectStyle}>
                          <option value="">Select status…</option>
                          {tiers.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label style={labelInline}>
                        {entry.airline} credit cards
                        <InfoTooltip title="Airline credit cards">
                          Select any cards you hold from {entry.airline}. Avanti uses these to surface free bags, priority boarding, and lounge access on your trips.
                        </InfoTooltip>
                      </label>

                      {selectedCards.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', margin: '2px 0 10px' }}>
                          {selectedCards.map(card => (
                            <span key={card} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '20px', border: '1px solid #2d5a18', background: '#2d5a18', color: '#ffffff', fontSize: '12px', ...s }}>
                              {card}
                              <button type="button" aria-label={`Remove ${card}`} onClick={() => updateEntry(idx, { credit_cards: selectedCards.filter(c => c !== card) })}
                                style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', fontSize: '14px', lineHeight: 1, padding: 0 }}>
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      )}

                      {cardsForAirline.length === 0 ? (
                        <p style={{ fontSize: '12px', color: '#b4b4a8', margin: '4px 0 0', fontStyle: 'italic' }}>
                          No co-branded cards for {entry.airline}. General travel cards live in the Financial tab.
                        </p>
                      ) : availableCards.length > 0 ? (
                        <select
                          value=""
                          onChange={e => { if (e.target.value) updateEntry(idx, { credit_cards: [...selectedCards, e.target.value] }) }}
                          style={selectStyle}
                        >
                          <option value="">Add a card…</option>
                          {availableCards.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      ) : (
                        <p style={{ fontSize: '12px', color: '#b4b4a8', margin: '4px 0 0', fontStyle: 'italic' }}>
                          All {entry.airline} cards added.
                        </p>
                      )}
                    </div>
                  </>
                )}
              </div>
            )
          })}

          <button
            type="button"
            onClick={addEntry}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', alignSelf: 'flex-start', padding: '10px 16px', border: '1px solid #2d5a18', background: 'transparent', color: '#2d5a18', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '20px', ...s }}
          >
            <span style={{ fontSize: '15px', lineHeight: 1 }}>⊕</span>
            {entries.length === 0 ? 'Add an airline' : 'Add another airline'}
          </button>
        </div>
      </div>

      {/* ─────────── Seat & cabin preferences ─────────── */}
      <div>
        <p style={sectionStyle}>Seat &amp; cabin preferences</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={labelStyle}>Seat preference</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {SEAT_PREFERENCES.map(opt => (
                <button key={opt} type="button" onClick={() => toggleChoice(details.travel.seat_preference, opt, v => updateTravel({ seat_preference: v }))} style={chipStyle(details.travel.seat_preference === opt, s)}>
                  {opt}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label style={labelStyle}>Cabin class preference</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {CABIN_CLASSES.map(opt => (
                <button key={opt} type="button" onClick={() => toggleChoice(details.travel.cabin_class, opt, v => updateTravel({ cabin_class: v }))} style={chipStyle(details.travel.cabin_class === opt, s)}>
                  {opt}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ─────────── Flight rules ─────────── */}
      <div>
        <p style={sectionStyle}>Flight rules</p>
        <p style={{ fontSize: '12px', color: 'var(--muted-foreground)', marginBottom: '16px', lineHeight: 1.7 }}>
          Your defaults for every trip. Avanti&apos;s travel agent follows these when it plans flights — you can still override them on a specific trip.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={labelInline}>
                Home airport
                <InfoTooltip title="Home airport">
                  Your default departure airport. Avanti also checks nearby airports for cheaper or shorter options.
                </InfoTooltip>
              </label>
              <input style={inputStyle} value={details.travel.home_airport} onChange={e => updateTravel({ home_airport: e.target.value })} placeholder="ORD — Chicago O'Hare" />
            </div>
            <div>
              <label style={labelStyle}>Backup airports</label>
              <input
                style={inputStyle}
                value={details.travel.backup_airports.join(', ')}
                onChange={e => updateTravel({ backup_airports: e.target.value.split(',').map(v => v.trim()).filter(Boolean) })}
                placeholder="MDW, MKE"
              />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Preferred departure time</label>
            <select style={selectStyle} value={details.travel.departure_window} onChange={e => updateTravel({ departure_window: e.target.value })}>
              <option value="">No preference</option>
              {DEPARTURE_WINDOWS.map(w => <option key={w} value={w}>{w}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Cabin class rule by flight length</label>
            <select style={selectStyle} value={details.travel.class_rule} onChange={e => updateTravel({ class_rule: e.target.value })}>
              <option value="">No preference</option>
              {CLASS_RULES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label style={labelInline}>
              Nonstop is worth paying up to
              <InfoTooltip title="Nonstop premium">
                The most extra you&apos;ll pay for a nonstop over a connection. Avanti keeps connections when the nonstop costs more than this.
              </InfoTooltip>
            </label>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <span style={{ fontSize: '15px', color: 'var(--muted-foreground)' }}>$</span>
              <input
                type="number"
                min={0}
                style={{ ...inputStyle, flex: 1 }}
                value={details.travel.nonstop_max_extra_usd ?? ''}
                onChange={e => updateTravel({ nonstop_max_extra_usd: e.target.value === '' ? null : Math.max(0, Number(e.target.value)) })}
                placeholder="200"
              />
              <span style={{ fontSize: '13px', color: 'var(--muted-foreground)', whiteSpace: 'nowrap' }}>more vs a connection</span>
            </div>
          </div>
          <div>
            <button type="button" onClick={() => updateTravel({ redeye_ok: !details.travel.redeye_ok })} style={chipStyle(details.travel.redeye_ok, s)}>
              {details.travel.redeye_ok ? 'Red-eyes OK' : 'No red-eyes'}
            </button>
          </div>
          <div>
            <label style={labelStyle}>Airlines to avoid</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
              {AIRLINES_SORTED.map(a => {
                const on = details.travel.avoid_airlines.includes(a)
                return (
                  <button key={a} type="button"
                    onClick={() => updateTravel({ avoid_airlines: on ? details.travel.avoid_airlines.filter(x => x !== a) : [...details.travel.avoid_airlines, a] })}
                    style={chipStyle(on, s)}>
                    {a}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
