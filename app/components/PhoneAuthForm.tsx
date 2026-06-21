'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { PHONE_COUNTRY_CODES, toE164 } from '@/lib/phone'
import { syncUserPhoneToProfile } from '@/lib/auth/sync-user-phone'

type PhoneAuthFormProps = {
  onSuccess: () => void | Promise<void>
  variant?: 'tailwind' | 'legacy'
  loading?: boolean
  setLoading?: (loading: boolean) => void
  error?: string
  setError?: (error: string) => void
}

export default function PhoneAuthForm({
  onSuccess,
  variant = 'tailwind',
  loading: externalLoading,
  setLoading: setExternalLoading,
  error: externalError,
  setError: setExternalError,
}: PhoneAuthFormProps) {
  const [step, setStep] = useState<'number' | 'code'>('number')
  const [phoneCode, setPhoneCode] = useState('+1')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [otp, setOtp] = useState('')
  const [internalLoading, setInternalLoading] = useState(false)
  const [internalError, setInternalError] = useState('')

  const loading = externalLoading ?? internalLoading
  const setLoading = setExternalLoading ?? setInternalLoading
  const error = externalError ?? internalError
  const setError = setExternalError ?? setInternalError

  const isLegacy = variant === 'legacy'
  const inputClass = isLegacy
    ? 'w-full border-b border-border bg-transparent py-2 text-[15px] text-foreground outline-none'
    : 'w-full border-b border-border bg-transparent py-2 font-serif text-foreground outline-none'
  const labelClass = isLegacy
    ? 'text-[10px] tracking-[0.15em] uppercase text-muted-foreground block mb-1.5'
    : 'eyebrow text-muted-foreground block mb-2'
  const selectClass = isLegacy
    ? `${inputClass} cursor-pointer appearance-none pr-6`
    : `${inputClass} cursor-pointer appearance-none pr-6`
  const buttonClass = isLegacy
    ? 'w-full border border-forest-deep bg-forest-deep text-white py-3.5 text-[10px] tracking-[0.25em] uppercase cursor-pointer disabled:opacity-60 mt-2'
    : 'w-full bg-forest-deep text-cream eyebrow py-4 hover:opacity-90 transition disabled:opacity-50'

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const phone = toE164(phoneCode, phoneNumber)
    if (!phone) {
      setError('Enter a valid phone number')
      return
    }

    setLoading(true)
    const { error: otpError } = await supabase.auth.signInWithOtp({ phone })
    setLoading(false)

    if (otpError) {
      setError(otpError.message)
      return
    }

    setStep('code')
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const phone = toE164(phoneCode, phoneNumber)
    if (!phone) {
      setError('Enter a valid phone number')
      return
    }

    setLoading(true)
    const { data, error: verifyError } = await supabase.auth.verifyOtp({
      phone,
      token: otp.trim(),
      type: 'sms',
    })

    if (verifyError) {
      setLoading(false)
      setError(verifyError.message)
      return
    }

    if (data.user) {
      await syncUserPhoneToProfile(data.user.id, phone)
    }

    await onSuccess()
    setLoading(false)
  }

  if (step === 'code') {
    return (
      <form onSubmit={handleVerify} className="flex flex-col gap-4">
        {error && (
          <p className={`text-sm text-center ${isLegacy ? '' : ''}`} style={isLegacy ? { color: '#c0392b' } : { color: 'var(--destructive)' }}>
            {error}
          </p>
        )}
        <p className={`text-sm ${isLegacy ? 'text-muted-foreground' : 'text-muted-foreground text-center'}`}>
          Enter the 6-digit code we sent to {phoneCode} {phoneNumber}
        </p>
        <div>
          <label className={labelClass}>Verification code</label>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            value={otp}
            onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            className={`${inputClass} text-center tracking-[0.35em]`}
            placeholder="123456"
            maxLength={6}
          />
        </div>
        <button type="submit" disabled={loading || otp.length < 6} className={buttonClass}>
          {loading ? 'Please wait...' : 'Verify & continue'}
        </button>
        <button
          type="button"
          onClick={() => {
            setStep('number')
            setOtp('')
            setError('')
          }}
          className={`w-full text-center text-[11px] text-muted-foreground bg-transparent border-0 cursor-pointer ${isLegacy ? '' : 'eyebrow'}`}
        >
          Use a different number
        </button>
      </form>
    )
  }

  return (
    <form onSubmit={handleSendCode} className="flex flex-col gap-4">
      {error && (
        <p className="text-sm text-center" style={{ color: isLegacy ? '#c0392b' : 'var(--destructive)' }}>
          {error}
        </p>
      )}
      <div>
        <label className={labelClass}>Phone number</label>
        <div className="flex gap-2 items-end">
          <select
            value={phoneCode}
            onChange={e => setPhoneCode(e.target.value)}
            className={`${selectClass} min-w-[120px]`}
            style={isLegacy ? { fontFamily: 'var(--font-cormorant), Georgia, serif' } : undefined}
          >
            {PHONE_COUNTRY_CODES.map(entry => (
              <option key={entry.country} value={entry.code}>
                {entry.flag} {entry.code}
              </option>
            ))}
          </select>
          <input
            type="tel"
            required
            value={phoneNumber}
            onChange={e => setPhoneNumber(e.target.value)}
            className={`${inputClass} flex-1`}
            placeholder="312 555 0192"
            style={isLegacy ? { fontFamily: 'var(--font-cormorant), Georgia, serif' } : undefined}
          />
        </div>
      </div>
      <button type="submit" disabled={loading} className={buttonClass}>
        {loading ? 'Please wait...' : 'Send verification code'}
      </button>
    </form>
  )
}
