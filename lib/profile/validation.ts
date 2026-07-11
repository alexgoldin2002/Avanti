// Profile field validation + option lists.
// Every free-text field that Avanti relies on (passport, KTN, Global Entry,
// frequent flyer, etc.) is validated against a real format so junk can't be saved.

export type FieldValidation = {
  valid: boolean
  message?: string
  /** Cleaned value to store when valid (e.g. uppercased, stripped). */
  normalized?: string
}

const ok = (normalized: string): FieldValidation => ({ valid: true, normalized })
const bad = (message: string): FieldValidation => ({ valid: false, message })

/** Empty is always "valid" (optional field) unless a caller marks it required. */
function emptyOk(value: string): FieldValidation | null {
  return value.trim() === '' ? ok('') : null
}

/** Passport numbers: 5–9 letters/digits, no spaces or symbols. */
export function validatePassport(value: string): FieldValidation {
  const empty = emptyOk(value)
  if (empty) return empty
  const v = value.trim().toUpperCase().replace(/\s+/g, '')
  if (!/^[A-Z0-9]{5,9}$/.test(v)) {
    return bad('Passport numbers are 5–9 letters and numbers — no spaces or symbols.')
  }
  return ok(v)
}

/** TSA Known Traveler / PreCheck number: 8–12 letters/digits. */
export function validateKnownTraveler(value: string): FieldValidation {
  const empty = emptyOk(value)
  if (empty) return empty
  const v = value.trim().toUpperCase().replace(/\s+/g, '')
  if (!/^[A-Z0-9]{8,12}$/.test(v)) {
    return bad('A Known Traveler Number is 8–12 letters/numbers (check your TSA PreCheck card).')
  }
  return ok(v)
}

/** Global Entry / NEXUS / SENTRI PASSID: exactly 9 digits. */
export function validateGlobalEntry(value: string): FieldValidation {
  const empty = emptyOk(value)
  if (empty) return empty
  const v = value.trim().replace(/\s+/g, '')
  if (!/^\d{9}$/.test(v)) {
    return bad('Global Entry / PASSID numbers are exactly 9 digits.')
  }
  return ok(v)
}

/** DHS Redress Control Number: 7–13 digits. */
export function validateRedress(value: string): FieldValidation {
  const empty = emptyOk(value)
  if (empty) return empty
  const v = value.trim().replace(/\s+/g, '')
  if (!/^\d{7,13}$/.test(v)) {
    return bad('Redress numbers are 7–13 digits.')
  }
  return ok(v)
}

/** Frequent flyer numbers vary by airline: 5–16 letters/digits. */
export function validateFrequentFlyer(value: string): FieldValidation {
  const empty = emptyOk(value)
  if (empty) return empty
  const v = value.trim().toUpperCase().replace(/\s+/g, '')
  if (!/^[A-Z0-9]{5,16}$/.test(v)) {
    return bad('Frequent flyer numbers are 5–16 letters/numbers — no spaces or symbols.')
  }
  return ok(v)
}

/** Basic email shape. */
export function validateEmail(value: string): FieldValidation {
  const empty = emptyOk(value)
  if (empty) return empty
  const v = value.trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) {
    return bad('Enter a valid email address.')
  }
  return ok(v)
}

/** Phone national number (country code handled separately): 6–15 digits. */
export function validatePhoneNumber(value: string): FieldValidation {
  const empty = emptyOk(value)
  if (empty) return empty
  const digits = value.replace(/[^\d]/g, '')
  if (digits.length < 6 || digits.length > 15) {
    return bad('Enter a valid phone number.')
  }
  return ok(value.trim())
}

export type ValidationKind =
  | 'passport'
  | 'known_traveler'
  | 'global_entry'
  | 'redress'
  | 'frequent_flyer'
  | 'email'
  | 'phone'

export function validateField(kind: ValidationKind, value: string): FieldValidation {
  switch (kind) {
    case 'passport':
      return validatePassport(value)
    case 'known_traveler':
      return validateKnownTraveler(value)
    case 'global_entry':
      return validateGlobalEntry(value)
    case 'redress':
      return validateRedress(value)
    case 'frequent_flyer':
      return validateFrequentFlyer(value)
    case 'email':
      return validateEmail(value)
    case 'phone':
      return validatePhoneNumber(value)
    default:
      return ok(value.trim())
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Option lists
// ─────────────────────────────────────────────────────────────────────────────

export const SEAT_PREFERENCES = ['Window', 'Aisle', 'Middle', 'No preference'] as const
export const CABIN_CLASSES = [
  'Economy',
  'Premium economy',
  'Business',
  'First',
  'No preference',
] as const

export const AIRLINES = [
  'United Airlines', 'Delta Air Lines', 'American Airlines', 'Southwest Airlines',
  'JetBlue', 'Alaska Airlines', 'Hawaiian Airlines', 'Spirit', 'Frontier',
  'Air Canada', 'WestJet',
  'British Airways', 'Virgin Atlantic', 'Air France', 'KLM', 'Lufthansa', 'Swiss',
  'Iberia', 'Aer Lingus', 'TAP Air Portugal', 'Turkish Airlines',
  'Emirates', 'Qatar Airways', 'Etihad',
  'Singapore Airlines', 'Cathay Pacific', 'ANA', 'JAL', 'Korean Air', 'Qantas',
] as const

export const AIRLINE_TIERS: Record<string, string[]> = {
  'United Airlines': ['Member', 'Premier Silver', 'Premier Gold', 'Premier Platinum', 'Premier 1K'],
  'Delta Air Lines': ['Member', 'Silver Medallion', 'Gold Medallion', 'Platinum Medallion', 'Diamond Medallion'],
  'American Airlines': ['Member', 'Gold', 'Platinum', 'Platinum Pro', 'Executive Platinum', 'Concierge Key'],
  'Southwest Airlines': ['Member', 'A-List', 'A-List Preferred', 'Companion Pass'],
  'JetBlue': ['Member', 'Mosaic 1', 'Mosaic 2', 'Mosaic 3', 'Mosaic 4'],
  'Alaska Airlines': ['Member', 'MVP', 'MVP Gold', 'MVP Gold 75K', 'MVP Gold 100K'],
  'British Airways': ['Blue', 'Bronze', 'Silver', 'Gold', 'Gold Guest List'],
  'Air France': ['Explorer', 'Silver', 'Gold', 'Platinum'],
  'KLM': ['Explorer', 'Silver', 'Gold', 'Platinum'],
  'Lufthansa': ['Member', 'Frequent Traveller', 'Senator', 'HON Circle'],
  'Emirates': ['Blue', 'Silver', 'Gold', 'Platinum'],
  'Qatar Airways': ['Burgundy', 'Silver', 'Gold', 'Platinum'],
  'Singapore Airlines': ['KrisFlyer', 'Elite Silver', 'Elite Gold', 'PPS Club', 'Solitaire PPS'],
}

export const DEFAULT_AIRLINE_TIERS = ['Member', 'Silver', 'Gold', 'Platinum']

/** Co-branded credit cards, keyed by airline. Powers the "cards from this airline"
 *  dropdown under each frequent-flyer entry. Airlines with no co-brand map to []. */
export const AIRLINE_CREDIT_CARDS: Record<string, string[]> = {
  'United Airlines': ['United Club Infinite', 'United Quest', 'United Explorer', 'United Gateway', 'United Business'],
  'Delta Air Lines': ['Delta SkyMiles Reserve', 'Delta SkyMiles Platinum', 'Delta SkyMiles Gold', 'Delta SkyMiles Blue', 'Delta SkyMiles Reserve Business', 'Delta SkyMiles Platinum Business'],
  'American Airlines': ['Citi AAdvantage Executive', 'Citi AAdvantage Platinum Select', 'AAdvantage Aviator Red', 'AAdvantage Aviator Business', 'Citi AAdvantage Business'],
  'Southwest Airlines': ['Southwest Rapid Rewards Priority', 'Southwest Rapid Rewards Premier', 'Southwest Rapid Rewards Plus', 'Southwest Rapid Rewards Performance Business'],
  'JetBlue': ['JetBlue Plus', 'JetBlue Card', 'JetBlue Business'],
  'Alaska Airlines': ['Alaska Airlines Visa Signature', 'Alaska Airlines Business Visa'],
  'Hawaiian Airlines': ['Hawaiian Airlines World Elite Mastercard'],
  'Air Canada': ['TD Aeroplan Visa Infinite', 'CIBC Aeroplan Visa Infinite', 'Amex Aeroplan Reserve', 'Chase Aeroplan'],
  'WestJet': ['WestJet RBC World Elite Mastercard'],
  'British Airways': ['British Airways Visa Signature'],
  'Virgin Atlantic': ['Virgin Atlantic World Elite Mastercard'],
  'Air France': ['Air France KLM World Elite Mastercard'],
  'KLM': ['Air France KLM World Elite Mastercard'],
  'Lufthansa': ['Miles & More World Elite Mastercard'],
  'Emirates': ['Emirates Skywards Premium World Elite', 'Emirates Skywards Rewards'],
  'Qatar Airways': ['Qatar Airways Privilege Club Card'],
  'Turkish Airlines': ['Miles&Smiles Signature'],
  'Singapore Airlines': ['KrisFlyer UOB Card', 'Singapore Airlines Krisflyer (Amex)'],
  'Cathay Pacific': ['Cathay Mastercard'],
  'Qantas': ['Qantas Premier Platinum', 'Qantas American Express Ultimate'],
}

// ─── Flight rules (Travel tab → feeds the Avanti travel agent) ───
export const DEPARTURE_WINDOWS = [
  'No preference',
  'Mornings (7–11am)',
  'Midday (11am–3pm)',
  'Afternoon (3–6pm)',
  'Evening (6–10pm)',
] as const

export const CLASS_RULES = [
  'No preference',
  'Always economy',
  'Economy under 5h, premium economy or business for 5h+',
  'Premium economy on 5h+',
  'Business/first for overnight & long-haul',
  'Always business or first',
] as const

export const CURRENCIES: { code: string; label: string }[] = [
  { code: 'USD', label: 'USD — US Dollar' },
  { code: 'EUR', label: 'EUR — Euro' },
  { code: 'GBP', label: 'GBP — British Pound' },
  { code: 'CAD', label: 'CAD — Canadian Dollar' },
  { code: 'AUD', label: 'AUD — Australian Dollar' },
  { code: 'JPY', label: 'JPY — Japanese Yen' },
  { code: 'CHF', label: 'CHF — Swiss Franc' },
  { code: 'CNY', label: 'CNY — Chinese Yuan' },
  { code: 'INR', label: 'INR — Indian Rupee' },
  { code: 'MXN', label: 'MXN — Mexican Peso' },
  { code: 'BRL', label: 'BRL — Brazilian Real' },
  { code: 'AED', label: 'AED — UAE Dirham' },
  { code: 'SGD', label: 'SGD — Singapore Dollar' },
  { code: 'HKD', label: 'HKD — Hong Kong Dollar' },
  { code: 'THB', label: 'THB — Thai Baht' },
  { code: 'SEK', label: 'SEK — Swedish Krona' },
  { code: 'NOK', label: 'NOK — Norwegian Krone' },
  { code: 'DKK', label: 'DKK — Danish Krone' },
  { code: 'NZD', label: 'NZD — New Zealand Dollar' },
  { code: 'ZAR', label: 'ZAR — South African Rand' },
]

// Curated bank list (constrains input so ATM/benefit logic can match a real bank).
export const BANKS = [
  'Chase', 'Bank of America', 'Wells Fargo', 'Citibank', 'Capital One',
  'U.S. Bank', 'PNC Bank', 'TD Bank', 'Truist', 'Charles Schwab',
  'Fidelity', 'American Express', 'Discover', 'Ally Bank', 'HSBC',
  'Barclays', 'Santander', 'Navy Federal Credit Union', 'USAA', 'SoFi',
  'Revolut', 'Wise', 'Chime', 'Other',
]

export const CREDIT_CARDS = [
  'Amex Platinum', 'Amex Gold', 'Amex Green',
  'Chase Sapphire Reserve', 'Chase Sapphire Preferred', 'Chase Freedom Unlimited',
  'Capital One Venture X', 'Capital One Venture',
  'Citi AAdvantage Executive', 'Citi Premier',
  'Delta SkyMiles Reserve', 'Delta SkyMiles Platinum', 'Delta SkyMiles Gold',
  'United Club Infinite', 'United Explorer',
  'Southwest Rapid Rewards Priority',
  'Marriott Bonvoy Brilliant', 'Marriott Bonvoy Boundless',
  'Hilton Honors Aspire', 'Hilton Honors Surpass',
  'World of Hyatt Card',
  'Bank of America Premium Rewards',
  'Other travel card',
]

// ─── Accessibility & needs (Extra tab) ───
export const MOBILITY_NEEDS = [
  'I use a wheelchair (I bring my own)',
  'Need wheelchair assistance at the airport',
  'Cannot climb stairs',
  'Limited walking distance',
  'Need an accessible room / roll-in shower',
  'Need ground-floor or elevator access',
]

export const SENSORY_NEEDS = [
  'Blind or low vision',
  'Deaf or hard of hearing',
  'Sensory sensitivities (e.g. autism)',
  'Prefer written / text instructions',
  'Need visual or vibrating alerts',
]

export const ASSISTANCE_NEEDS = [
  'Traveling with a service animal',
  'Traveling with a care attendant',
  'Need airport meet-and-assist / escort',
  'Need extra time to board',
  'Need help with luggage',
]

export const ALLERGIES = [
  'Peanuts', 'Tree nuts', 'Shellfish', 'Fish', 'Eggs', 'Dairy',
  'Soy', 'Gluten / Wheat', 'Sesame', 'Latex', 'Bee / insect stings', 'Penicillin',
]

export const DIETARY = [
  'Vegetarian', 'Vegan', 'Halal', 'Kosher', 'Gluten-free', 'Dairy-free',
  'Nut-free', 'Pescatarian', 'No pork', 'No beef', 'Low sodium', 'Diabetic',
]

// Dosage units for the medications list (Extra tab).
export const DOSAGE_UNITS = [
  'mg', 'mcg', 'g', 'mL', 'IU', 'units', '%',
  'tablet(s)', 'capsule(s)', 'puff(s)', 'spray(s)', 'drop(s)',
  'patch(es)', 'injection(s)', 'suppository(ies)', 'tsp', 'tbsp',
]
