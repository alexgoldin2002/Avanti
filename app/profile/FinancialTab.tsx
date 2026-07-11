'use client'

import { CURRENCIES, BANKS, CREDIT_CARDS } from '@/lib/profile/validation'
import { chipStyle, type ProfileForm, type ProfileDetails, type Styles } from './shared'

type Props = {
  form: ProfileForm
  updateForm: (patch: Partial<ProfileForm>) => void
  details: ProfileDetails
  updateFinancial: (patch: Partial<ProfileDetails['financial']>) => void
  styles: Styles
}

export default function FinancialTab({ form, updateForm, details, updateFinancial, styles }: Props) {
  const { s, labelStyle, selectStyle, sectionStyle, hintStyle } = styles

  const toggleCard = (card: string) => {
    const has = form.credit_cards.includes(card)
    updateForm({ credit_cards: has ? form.credit_cards.filter(c => c !== card) : [...form.credit_cards, card] })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
      <div>
        <p style={sectionStyle}>Money & currency</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={labelStyle}>Preferred currency</label>
            <p style={hintStyle}>We show prices and budgets in this currency.</p>
            <select style={selectStyle} value={details.financial.preferred_currency} onChange={e => updateFinancial({ preferred_currency: e.target.value })}>
              <option value="">Select…</option>
              {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Primary bank</label>
            <p style={hintStyle}>Lets Avanti recommend the best ATMs and flag foreign-transaction fees abroad.</p>
            <select style={selectStyle} value={details.financial.primary_bank} onChange={e => updateFinancial({ primary_bank: e.target.value })}>
              <option value="">Select…</option>
              {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div>
        <p style={sectionStyle}>Credit cards</p>
        <p style={{ fontSize: '12px', color: 'var(--muted-foreground)', marginBottom: '16px', lineHeight: 1.7 }}>
          Avanti flags free bag benefits, lounge access, travel credits, and insurance automatically — and never shows card numbers.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {CREDIT_CARDS.map(card => (
            <button key={card} type="button" onClick={() => toggleCard(card)} style={chipStyle(form.credit_cards.includes(card), s)}>
              {card}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
