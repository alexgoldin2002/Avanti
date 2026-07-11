import type { CSSProperties } from 'react'

export type AirlineLoyalty = {
  airline: string
  frequent_flyer_number: string
  tier: string
  /** Co-branded credit cards the traveler holds from this airline. */
  credit_cards?: string[]
}

export type Medication = {
  /** Display name, validated against the RxNorm drug database on selection. */
  name: string
  /** RxNorm concept id when picked from the list; empty for manual free-text. */
  rxcui?: string
  dosage: string
  unit: string
}

export type ProfileDetails = {
  travel: {
    passport_country: string
    passport_expiry: string
    global_entry_number: string
    known_traveler_country: string
    redress_number: string
    redress_country: string
    redress_number_secondary: string
    redress_secondary_country: string
    clear: boolean
    military: boolean
    seat_preference: string
    cabin_class: string
    // Flight rules — personal defaults the Avanti travel agent applies to every trip
    home_airport: string
    backup_airports: string[]
    departure_window: string
    redeye_ok: boolean
    nonstop_max_extra_usd: number | null
    class_rule: string
    avoid_airlines: string[]
  }
  financial: {
    preferred_currency: string
    primary_bank: string
  }
  accessibility: {
    mobility: string[]
    sensory: string[]
    assistance: string[]
    allergies: string[]
    dietary: string[]
    notes: string
  }
  medications: Medication[]
  airline_loyalty: AirlineLoyalty[]
  address_verified: boolean
  address_place_id: string | null
}

export const EMPTY_DETAILS: ProfileDetails = {
  travel: {
    passport_country: '',
    passport_expiry: '',
    global_entry_number: '',
    known_traveler_country: '',
    redress_number: '',
    redress_country: '',
    redress_number_secondary: '',
    redress_secondary_country: '',
    clear: false,
    military: false,
    seat_preference: '',
    cabin_class: '',
    home_airport: '',
    backup_airports: [],
    departure_window: '',
    redeye_ok: true,
    nonstop_max_extra_usd: null,
    class_rule: '',
    avoid_airlines: [],
  },
  financial: {
    preferred_currency: '',
    primary_bank: '',
  },
  accessibility: {
    mobility: [],
    sensory: [],
    assistance: [],
    allergies: [],
    dietary: [],
    notes: '',
  },
  medications: [],
  airline_loyalty: [],
  address_verified: false,
  address_place_id: null,
}

/** Merge a partial details object onto the empty defaults. */
export function normalizeDetails(src: Partial<ProfileDetails> | null | undefined): ProfileDetails {
  const s = (src && typeof src === 'object' ? src : {}) as Partial<ProfileDetails>
  return {
    travel: { ...EMPTY_DETAILS.travel, ...(s.travel || {}) },
    financial: { ...EMPTY_DETAILS.financial, ...(s.financial || {}) },
    accessibility: { ...EMPTY_DETAILS.accessibility, ...(s.accessibility || {}) },
    medications: Array.isArray(s.medications) ? s.medications : [],
    airline_loyalty: Array.isArray(s.airline_loyalty) ? s.airline_loyalty : [],
    address_verified: !!s.address_verified,
    address_place_id: typeof s.address_place_id === 'string' ? s.address_place_id : null,
  }
}

/** Pull the namespaced profile keys out of the benefits_profile jsonb blob. */
export function detailsFromBenefits(raw: unknown): ProfileDetails {
  const b = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return normalizeDetails(b.profile_extras as Partial<ProfileDetails> | undefined)
}

/** Each saved traveler's rich profile is stored under the OWNER's benefits_profile
 *  (there is no rich-profile column on account_companions). */
export type CompanionProfileRecord = {
  credit_cards?: string[]
  details?: Partial<ProfileDetails>
}

export function readCompanionProfiles(raw: unknown): Record<string, CompanionProfileRecord> {
  const b = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const cp = b.companion_profiles
  return (cp && typeof cp === 'object' ? cp : {}) as Record<string, CompanionProfileRecord>
}

/** Merge the profile details back into an existing benefits_profile without clobbering
 *  keys owned by the Travel Benefits page (credit_cards, airlines, hotels, etc.). */
export function mergeDetailsIntoBenefits(
  existing: unknown,
  details: ProfileDetails
): Record<string, unknown> {
  const base = (existing && typeof existing === 'object' ? existing : {}) as Record<string, unknown>
  return { ...base, profile_extras: details }
}

export type ProfileForm = {
  full_name: string
  date_of_birth: string
  email: string
  country_of_residence: string
  address: string
  address_unit: string
  passport_number: string
  tsa_known_traveler: string
  credit_cards: string[]
  memberships: string[]
}

export type Styles = {
  s: CSSProperties
  inputStyle: CSSProperties
  labelStyle: CSSProperties
  selectStyle: CSSProperties
  sectionStyle: CSSProperties
  hintStyle: CSSProperties
}

export const COUNTRIES = ["Afghanistan","Albania","Algeria","Andorra","Angola","Antigua and Barbuda","Argentina","Armenia","Australia","Austria","Azerbaijan","Bahamas","Bahrain","Bangladesh","Barbados","Belarus","Belgium","Belize","Benin","Bhutan","Bolivia","Bosnia and Herzegovina","Botswana","Brazil","Brunei","Bulgaria","Burkina Faso","Burundi","Cabo Verde","Cambodia","Cameroon","Canada","Central African Republic","Chad","Chile","China","Colombia","Comoros","Congo","Costa Rica","Croatia","Cuba","Cyprus","Czech Republic","Denmark","Djibouti","Dominica","Dominican Republic","Ecuador","Egypt","El Salvador","Equatorial Guinea","Eritrea","Estonia","Eswatini","Ethiopia","Fiji","Finland","France","Gabon","Gambia","Georgia","Germany","Ghana","Greece","Grenada","Guatemala","Guinea","Guinea-Bissau","Guyana","Haiti","Honduras","Hungary","Iceland","India","Indonesia","Iran","Iraq","Ireland","Israel","Italy","Jamaica","Japan","Jordan","Kazakhstan","Kenya","Kiribati","Kuwait","Kyrgyzstan","Laos","Latvia","Lebanon","Lesotho","Liberia","Libya","Liechtenstein","Lithuania","Luxembourg","Madagascar","Malawi","Malaysia","Maldives","Mali","Malta","Marshall Islands","Mauritania","Mauritius","Mexico","Micronesia","Moldova","Monaco","Mongolia","Montenegro","Morocco","Mozambique","Myanmar","Namibia","Nauru","Nepal","Netherlands","New Zealand","Nicaragua","Niger","Nigeria","North Korea","North Macedonia","Norway","Oman","Pakistan","Palau","Palestine","Panama","Papua New Guinea","Paraguay","Peru","Philippines","Poland","Portugal","Qatar","Romania","Russia","Rwanda","Saint Kitts and Nevis","Saint Lucia","Saint Vincent and the Grenadines","Samoa","San Marino","Sao Tome and Principe","Saudi Arabia","Senegal","Serbia","Seychelles","Sierra Leone","Singapore","Slovakia","Slovenia","Solomon Islands","Somalia","South Africa","South Korea","South Sudan","Spain","Sri Lanka","Sudan","Suriname","Sweden","Switzerland","Syria","Taiwan","Tajikistan","Tanzania","Thailand","Timor-Leste","Togo","Tonga","Trinidad and Tobago","Tunisia","Turkey","Turkmenistan","Tuvalu","Uganda","Ukraine","United Arab Emirates","United Kingdom","United States","Uruguay","Uzbekistan","Vanuatu","Vatican City","Venezuela","Vietnam","Yemen","Zambia","Zimbabwe"]

export function chipStyle(selected: boolean, s: CSSProperties): CSSProperties {
  return {
    padding: '7px 14px',
    fontSize: '12px',
    cursor: 'pointer',
    border: `1px solid ${selected ? '#2d5a18' : '#d4d4c8'}`,
    background: selected ? '#2d5a18' : 'transparent',
    color: selected ? '#ffffff' : '#6a6a6a',
    borderRadius: '20px',
    transition: 'all 0.15s',
    ...s,
  }
}
