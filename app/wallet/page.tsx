'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import AvantiLogo from '../components/AvantiLogo'
import SuitcaseLoader from '../components/SuitcaseLoader'
import Footer from '../components/Footer'

export default function Wallet() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [pin, setPin] = useState('')
  const [pinConfirm, setPinConfirm] = useState('')
  const [pinSet, setPinSet] = useState(false)
  const [pinEntered, setPinEntered] = useState(false)
  const [pinError, setPinError] = useState('')
  const [wallet, setWallet] = useState<any>(null)
  const [showAddCard, setShowAddCard] = useState(false)
  const [showAddAccount, setShowAddAccount] = useState(false)
  const [newCard, setNewCard] = useState({ nickname: '', last_four: '', type: 'visa' })
  const [newAccount, setNewAccount] = useState({ platform: 'venmo', handle: '' })

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      setUserId(user.id)
      const { data } = await supabase.from('user_wallets').select('*').eq('user_id', user.id).maybeSingle()
      if (data) { setWallet(data); if (data.pin_hash) setPinSet(true) }
      setLoading(false)
    }
    load()
  }, [router])

  const handleSetPin = async () => {
    if (pin.length < 4) { setPinError('PIN must be at least 4 digits'); return }
    if (pin !== pinConfirm) { setPinError('PINs do not match'); return }
    await supabase.from('user_wallets').upsert({ user_id: userId, pin_hash: btoa(pin), security_method: 'pin', payment_methods: wallet?.payment_methods || [], linked_accounts: wallet?.linked_accounts || [] })
    setPinSet(true)
    setPinEntered(true)
    setPinError('')
  }

  const handleEnterPin = async () => {
    const { data } = await supabase.from('user_wallets').select('pin_hash').eq('user_id', userId).single()
    if (data?.pin_hash === btoa(pin)) { setPinEntered(true); setPinError('') }
    else { setPinError('Incorrect PIN') }
  }

  const handleAddCard = async () => {
    const current = wallet?.payment_methods || []
    const updated = [...current, { ...newCard, id: Date.now() }]
    await supabase.from('user_wallets').upsert({ user_id: userId, payment_methods: updated, linked_accounts: wallet?.linked_accounts || [], pin_hash: wallet?.pin_hash, security_method: 'pin' })
    setWallet({ ...wallet, payment_methods: updated })
    setShowAddCard(false)
    setNewCard({ nickname: '', last_four: '', type: 'visa' })
  }

  const handleAddAccount = async () => {
    const current = wallet?.linked_accounts || []
    const updated = [...current, { ...newAccount, id: Date.now() }]
    await supabase.from('user_wallets').upsert({ user_id: userId, linked_accounts: updated, payment_methods: wallet?.payment_methods || [], pin_hash: wallet?.pin_hash, security_method: 'pin' })
    setWallet({ ...wallet, linked_accounts: updated })
    setShowAddAccount(false)
    setNewAccount({ platform: 'venmo', handle: '' })
  }

  const inputStyle = { width: '100%', borderBottom: '1px solid var(--border)', background: 'transparent', padding: '10px 0', fontSize: '15px', color: 'var(--foreground)', outline: 'none', fontFamily: 'var(--font-cormorant), Georgia, serif' }
  const labelStyle = { fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase' as const, color: 'var(--muted-foreground)', display: 'block', marginBottom: '6px' }

  if (loading) return <SuitcaseLoader message="Opening your wallet" />

  if (!pinSet || !pinEntered) return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: '100%', background: 'var(--cream)', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '320px', textAlign: 'center' }}>
        <AvantiLogo size="sm" />
        <p style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted-foreground)', margin: '20px 0 8px' }}>Wallet</p>
        <p style={{ fontSize: '13px', color: 'var(--muted-foreground)', marginBottom: '40px', lineHeight: 1.7 }}>{pinSet ? 'Enter your wallet PIN to continue' : 'Set a PIN to secure your wallet'}</p>
        {pinError && <p style={{ fontSize: '12px', color: '#c0392b', marginBottom: '16px' }}>{pinError}</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
          <div>
            <label style={labelStyle}>{pinSet ? 'Enter PIN' : 'Create PIN (4+ digits)'}</label>
            <input type="password" value={pin} onChange={e => setPin(e.target.value)} placeholder="••••" maxLength={8}
              style={{ ...inputStyle, textAlign: 'center', fontSize: '24px', letterSpacing: '0.3em' }} />
          </div>
          {!pinSet && (
            <div>
              <label style={labelStyle}>Confirm PIN</label>
              <input type="password" value={pinConfirm} onChange={e => setPinConfirm(e.target.value)} placeholder="••••" maxLength={8}
                style={{ ...inputStyle, textAlign: 'center', fontSize: '24px', letterSpacing: '0.3em' }} />
            </div>
          )}
        </div>
        <button onClick={pinSet ? handleEnterPin : handleSetPin}
          style={{ width: '100%', border: '1px solid var(--foreground)', padding: '14px', fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', color: 'var(--foreground)', background: 'transparent', cursor: 'pointer', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
          {pinSet ? 'Unlock wallet →' : 'Set PIN & continue →'}
        </button>
        <button onClick={() => router.push('/dashboard')}
          style={{ width: '100%', marginTop: '12px', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--muted-foreground)', background: 'none', border: 'none', cursor: 'pointer' }}>
          ← Back to dashboard
        </button>
      </div>
      </div>
      <Footer />
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: '100%', background: 'var(--cream)', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
      <div style={{ maxWidth: '560px', margin: '0 auto', padding: '48px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '48px' }}>
          <AvantiLogo size="sm" />
          <button onClick={() => router.push('/dashboard')} style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--muted-foreground)', background: 'none', border: 'none', cursor: 'pointer' }}>← Dashboard</button>
        </div>
        <h2 style={{ fontSize: '32px', fontWeight: 300, color: 'var(--foreground)', marginBottom: '8px' }}>Wallet</h2>
        <p style={{ fontSize: '12px', color: 'var(--muted-foreground)', marginBottom: '48px' }}>Payment methods and linked accounts. PIN required for any transaction.</p>

        <div style={{ marginBottom: '40px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <p style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>Payment cards</p>
            <button onClick={() => setShowAddCard(true)} style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--foreground)', background: 'none', border: '1px solid var(--foreground)', padding: '6px 12px', cursor: 'pointer', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>+ Add</button>
          </div>
          {(wallet?.payment_methods || []).length === 0 ? (
            <p style={{ fontSize: '13px', color: 'var(--muted-foreground)', padding: '20px 0' }}>No cards added yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {(wallet?.payment_methods || []).map((card: any) => (
                <div key={card.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', border: '1px solid var(--border)', background: '#fff' }}>
                  <div>
                    <p style={{ fontSize: '14px', color: 'var(--foreground)', margin: '0 0 2px' }}>{card.nickname}</p>
                    <p style={{ fontSize: '11px', color: 'var(--muted-foreground)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{card.type} •••• {card.last_four}</p>
                  </div>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4ade80' }}></div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <p style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>Linked accounts</p>
            <button onClick={() => setShowAddAccount(true)} style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--foreground)', background: 'none', border: '1px solid var(--foreground)', padding: '6px 12px', cursor: 'pointer', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>+ Add</button>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--muted-foreground)', marginBottom: '16px' }}>Link Venmo, PayPal, or Zelle for bill splitting and group payments.</p>
          {(wallet?.linked_accounts || []).length === 0 ? (
            <p style={{ fontSize: '13px', color: 'var(--muted-foreground)', padding: '20px 0' }}>No accounts linked yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {(wallet?.linked_accounts || []).map((acc: any) => (
                <div key={acc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', border: '1px solid var(--border)', background: '#fff' }}>
                  <div>
                    <p style={{ fontSize: '14px', color: 'var(--foreground)', margin: '0 0 2px', textTransform: 'capitalize' }}>{acc.platform}</p>
                    <p style={{ fontSize: '11px', color: 'var(--muted-foreground)', margin: 0 }}>{acc.handle}</p>
                  </div>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4ade80' }}></div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showAddCard && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: 'var(--cream)', padding: '40px', width: '100%', maxWidth: '400px', margin: '24px' }}>
            <p style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted-foreground)', marginBottom: '24px' }}>Add payment card</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
              <div><label style={labelStyle}>Card nickname</label><input style={inputStyle} value={newCard.nickname} onChange={e => setNewCard({...newCard, nickname: e.target.value})} placeholder="Chase Sapphire Reserve" /></div>
              <div><label style={labelStyle}>Last 4 digits</label><input style={inputStyle} value={newCard.last_four} onChange={e => setNewCard({...newCard, last_four: e.target.value})} placeholder="4242" maxLength={4} /></div>
              <div><label style={labelStyle}>Card type</label>
                <select value={newCard.type} onChange={e => setNewCard({...newCard, type: e.target.value})} style={{ ...inputStyle, cursor: 'pointer' }}>
                  <option value="visa">Visa</option><option value="mastercard">Mastercard</option><option value="amex">Amex</option><option value="discover">Discover</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setShowAddCard(false)} style={{ flex: 1, border: '1px solid var(--border)', padding: '14px', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted-foreground)', background: 'transparent', cursor: 'pointer', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>Cancel</button>
              <button onClick={handleAddCard} style={{ flex: 1, border: '1px solid var(--foreground)', padding: '14px', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--foreground)', background: 'transparent', cursor: 'pointer', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>Add card</button>
            </div>
          </div>
        </div>
      )}

      {showAddAccount && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: 'var(--cream)', padding: '40px', width: '100%', maxWidth: '400px', margin: '24px' }}>
            <p style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted-foreground)', marginBottom: '24px' }}>Link payment account</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
              <div><label style={labelStyle}>Platform</label>
                <select value={newAccount.platform} onChange={e => setNewAccount({...newAccount, platform: e.target.value})} style={{ ...inputStyle, cursor: 'pointer' }}>
                  <option value="venmo">Venmo</option><option value="paypal">PayPal</option><option value="zelle">Zelle</option><option value="cashapp">Cash App</option>
                </select>
              </div>
              <div><label style={labelStyle}>Username / handle / email</label><input style={inputStyle} value={newAccount.handle} onChange={e => setNewAccount({...newAccount, handle: e.target.value})} placeholder="@alexgoldin" /></div>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setShowAddAccount(false)} style={{ flex: 1, border: '1px solid var(--border)', padding: '14px', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted-foreground)', background: 'transparent', cursor: 'pointer', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>Cancel</button>
              <button onClick={handleAddAccount} style={{ flex: 1, border: '1px solid var(--foreground)', padding: '14px', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--foreground)', background: 'transparent', cursor: 'pointer', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>Link account</button>
            </div>
          </div>
        </div>
      )}
      <Footer />
    </div>
  )
}
