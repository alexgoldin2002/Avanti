const MIN_LENGTH = 10

const COMMON_PASSWORDS = new Set([
  'password',
  'password1',
  'password123',
  '123456',
  '12345678',
  '123456789',
  '1234567890',
  'qwerty',
  'qwerty123',
  'abc123',
  'letmein',
  'welcome',
  'welcome1',
  'monkey',
  'dragon',
  'master',
  'login',
  'admin',
  'admin123',
  'iloveyou',
  'sunshine',
  'princess',
  'football',
  'baseball',
  'trustno1',
  'shadow',
  'superman',
  'batman',
  'passw0rd',
  'hello123',
  'freedom',
  'whatever',
  'qazwsx',
  '654321',
  '111111',
  '000000',
  'avanti',
  'avanti123',
])

export const SIGNUP_PASSWORD_HINT =
  'At least 10 characters with uppercase, lowercase, and a number. Avoid common passwords.'

export function validateSignupPassword(password: string, email?: string): string | null {
  const trimmed = password.trim()
  if (trimmed.length < MIN_LENGTH) {
    return `Password must be at least ${MIN_LENGTH} characters.`
  }

  if (!/[a-z]/.test(trimmed)) {
    return 'Password must include at least one lowercase letter.'
  }

  if (!/[A-Z]/.test(trimmed)) {
    return 'Password must include at least one uppercase letter.'
  }

  if (!/[0-9]/.test(trimmed)) {
    return 'Password must include at least one number.'
  }

  const normalized = trimmed.toLowerCase()
  if (COMMON_PASSWORDS.has(normalized)) {
    return 'That password is too common. Choose something harder to guess.'
  }

  const emailLocal = email?.trim().split('@')[0]?.toLowerCase()
  if (emailLocal && emailLocal.length >= 3 && normalized.includes(emailLocal)) {
    return 'Password cannot include your email address.'
  }

  return null
}
