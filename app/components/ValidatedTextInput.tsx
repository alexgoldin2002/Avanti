'use client'

import { useState, type CSSProperties } from 'react'
import { validateField, type ValidationKind } from '@/lib/profile/validation'

type ValidatedTextInputProps = {
  kind: ValidationKind
  value: string
  /** Called on every change with the raw value and whether it currently validates. */
  onChange: (value: string, valid: boolean) => void
  inputStyle: CSSProperties
  placeholder?: string
  /** Force uppercase display for document numbers. */
  uppercase?: boolean
  inputMode?: 'text' | 'numeric' | 'email' | 'tel'
}

export default function ValidatedTextInput({
  kind,
  value,
  onChange,
  inputStyle,
  placeholder,
  uppercase = false,
  inputMode = 'text',
}: ValidatedTextInputProps) {
  const [touched, setTouched] = useState(false)
  const result = validateField(kind, value)
  const showError = touched && value.trim() !== '' && !result.valid

  return (
    <div>
      <input
        type="text"
        inputMode={inputMode}
        value={value}
        placeholder={placeholder}
        onChange={e => {
          const next = uppercase ? e.target.value.toUpperCase() : e.target.value
          onChange(next, validateField(kind, next).valid)
        }}
        onBlur={() => setTouched(true)}
        aria-invalid={showError}
        style={{
          ...inputStyle,
          textTransform: uppercase ? 'uppercase' : 'none',
          borderBottom: `1px solid ${showError ? '#c0392b' : (inputStyle.borderBottom as string) || '#d4d4c8'}`,
        }}
      />
      {showError && result.message && (
        <p role="alert" style={{ fontSize: '12px', color: '#c0392b', margin: '8px 0 0', lineHeight: 1.5, fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
          {result.message}
        </p>
      )}
    </div>
  )
}
