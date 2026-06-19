export const PHONE_COUNTRY_CODES = [
  { country: 'United States', code: '+1', flag: '🇺🇸' },
  { country: 'United Kingdom', code: '+44', flag: '🇬🇧' },
  { country: 'Canada', code: '+1', flag: '🇨🇦' },
  { country: 'Australia', code: '+61', flag: '🇦🇺' },
  { country: 'France', code: '+33', flag: '🇫🇷' },
  { country: 'Germany', code: '+49', flag: '🇩🇪' },
  { country: 'Italy', code: '+39', flag: '🇮🇹' },
  { country: 'Spain', code: '+34', flag: '🇪🇸' },
  { country: 'Greece', code: '+30', flag: '🇬🇷' },
  { country: 'Israel', code: '+972', flag: '🇮🇱' },
  { country: 'Japan', code: '+81', flag: '🇯🇵' },
  { country: 'China', code: '+86', flag: '🇨🇳' },
  { country: 'India', code: '+91', flag: '🇮🇳' },
  { country: 'Brazil', code: '+55', flag: '🇧🇷' },
  { country: 'Mexico', code: '+52', flag: '🇲🇽' },
  { country: 'South Africa', code: '+27', flag: '🇿🇦' },
  { country: 'UAE', code: '+971', flag: '🇦🇪' },
  { country: 'Turkey', code: '+90', flag: '🇹🇷' },
  { country: 'Netherlands', code: '+31', flag: '🇳🇱' },
  { country: 'Portugal', code: '+351', flag: '🇵🇹' },
  { country: 'Sweden', code: '+46', flag: '🇸🇪' },
  { country: 'Switzerland', code: '+41', flag: '🇨🇭' },
  { country: 'Other', code: '+', flag: '🌍' },
] as const

export function toE164(countryCode: string, localNumber: string): string | null {
  const codeDigits = countryCode.replace(/\D/g, '')
  const localDigits = localNumber.replace(/\D/g, '')
  if (!codeDigits || localDigits.length < 7) return null
  return `+${codeDigits}${localDigits}`
}

export function phoneToE164(phone: string | null | undefined): string | null {
  if (!phone) return null
  const trimmed = phone.trim()
  if (!trimmed) return null

  const compact = trimmed.replace(/[\s()-]/g, '')
  if (/^\+\d{10,15}$/.test(compact)) return compact

  const spaceIdx = trimmed.indexOf(' ')
  if (spaceIdx > 0 && trimmed.startsWith('+')) {
    return toE164(trimmed.slice(0, spaceIdx), trimmed.slice(spaceIdx + 1))
  }

  const digits = trimmed.replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return null
}

export function e164ToDisplay(phone: string): string {
  const e164 = phoneToE164(phone)
  if (!e164) return phone

  if (e164.startsWith('+1') && e164.length === 12) {
    const local = e164.slice(2)
    return `+1 ${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`
  }

  const match = e164.match(/^(\+\d{1,3})(\d+)$/)
  if (!match) return e164
  return `${match[1]} ${match[2]}`
}

export function parseStoredPhone(phone: string): { countryCode: string; localNumber: string } {
  const trimmed = phone.trim()
  if (trimmed.startsWith('+')) {
    const spaceIdx = trimmed.indexOf(' ')
    if (spaceIdx > 0) {
      return {
        countryCode: trimmed.slice(0, spaceIdx),
        localNumber: trimmed.slice(spaceIdx + 1),
      }
    }
    if (trimmed.startsWith('+1') && trimmed.length > 2) {
      return { countryCode: '+1', localNumber: trimmed.slice(2) }
    }
  }
  return { countryCode: '+1', localNumber: trimmed }
}
