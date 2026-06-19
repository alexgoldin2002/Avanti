'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import AvantiLogo from '../../components/AvantiLogo'
import SuitcaseLoader from '../../components/SuitcaseLoader'

const CREDIT_CARDS = [
  'Amex Platinum','Amex Gold','Amex Green',
  'Chase Sapphire Reserve','Chase Sapphire Preferred','Chase Freedom Unlimited',
  'Capital One Venture X','Capital One Venture',
  'Citi AAdvantage Executive','Citi AAdvantage Platinum',
  'Delta SkyMiles Reserve','Delta SkyMiles Platinum','Delta SkyMiles Gold',
  'United Club Infinite','United Explorer','United Gateway',
  'Southwest Rapid Rewards Priority','Southwest Rapid Rewards Plus',
  'Marriott Bonvoy Brilliant','Marriott Bonvoy Boundless',
  'Hilton Honors Aspire','Hilton Honors Surpass',
  'World of Hyatt Card',
  'Bank of America Premium Rewards',
  'Barclays Arrival+',
  'Other travel card',
]

const AIRLINES = [
  'United Airlines','Delta Air Lines','American Airlines','Southwest Airlines',
  'JetBlue','Alaska Airlines','Spirit','Frontier',
  'British Airways','Air France','KLM','Lufthansa','Swiss',
  'Emirates','Qatar Airways','Etihad',
  'Singapore Airlines','Cathay Pacific','ANA','JAL',
  'Air Canada','WestJet',
]

const AIRLINE_TIERS: Record<string, string[]> = {
  'United Airlines': ['Member','Silver','Gold','Platinum','1K'],
  'Delta Air Lines': ['Member','Silver Medallion','Gold Medallion','Platinum Medallion','Diamond Medallion'],
  'American Airlines': ['Member','Gold','Platinum','Platinum Pro','Executive Platinum','Concierge Key'],
  'Southwest Airlines': ['Member','A-List','A-List Preferred','Companion Pass'],
  'JetBlue': ['Member','Mosaic 1','Mosaic 2','Mosaic 3','Mosaic 4'],
  'Alaska Airlines': ['Member','MVP','MVP Gold','MVP Gold 75K'],
  'British Airways': ['Blue','Bronze','Silver','Gold','Gold Guest List'],
  'Air France': ['Flying Blue Explorer','Flying Blue Silver','Flying Blue Gold','Flying Blue Platinum'],
  'KLM': ['Flying Blue Explorer','Flying Blue Silver','Flying Blue Gold','Flying Blue Platinum'],
  'Lufthansa': ['Member','Frequent Traveller','Senator','HON Circle'],
  'Emirates': ['Blue','Silver','Gold','Platinum'],
  'Qatar Airways': ['Burgundy','Silver','Gold','Platinum'],
  'Singapore Airlines': ['KrisFlyer','Elite Silver','Elite Gold','PPS Club','Solitaire PPS'],
}

const DEFAULT_TIERS = ['Member','Silver','Gold','Platinum']

const HOTELS = [
  { name: 'Marriott Bonvoy', tiers: ['Member','Silver Elite','Gold Elite','Platinum Elite','Titanium Elite','Ambassador Elite'] },
  { name: 'Hilton Honors', tiers: ['Member','Silver','Gold','Diamond'] },
  { name: 'World of Hyatt', tiers: ['Member','Discoverist','Explorist','Globalist'] },
  { name: 'IHG One Rewards', tiers: ['Club','Silver Elite','Gold Elite','Platinum Elite','Diamond Elite'] },
  { name: 'Wyndham Rewards', tiers: ['Member','Gold','Platinum','Diamond'] },
  { name: 'Choice Privileges', tiers: ['Member','Gold','Platinum','Diamond'] },
  { name: 'Best Western Rewards', tiers: ['Member','Gold','Platinum','Diamond','Diamond Select'] },
]

const RENTAL_CARS = [
  { name: 'Hertz', tiers: ['Gold','Five Star','President\'s Circle'] },
  { name: 'National', tiers: ['Emerald Club','Executive','Executive Elite'] },
  { name: 'Enterprise Plus', tiers: ['Member','Silver','Gold','Platinum'] },
  { name: 'Avis Preferred', tiers: ['Member','Select','Chairman\'s Club'] },
  { name: 'Budget Fastbreak', tiers: ['Member','Fastbreak'] },
  { name: 'Alamo Insiders', tiers: ['Member'] },
  { name: 'Dollar Express', tiers: ['Member'] },
  { name: 'Thrifty Blue Chip', tiers: ['Member'] },
]

const MEMBERSHIPS = [
  'AAA','Costco (+ Costco Travel)','Sam\'s Club',
  'Amazon Prime','AARP',
  'Priority Pass (standalone)','Amex Centurion Lounge',
  'Clear','Global Entry',
  'Active Military','Veteran',
  'Travel Agent / IATA',
  'Airbnb Superhost',
]

interface BenefitsProfile {
  credit_cards: string[]
  airlines: { airline: string; tier: string }[]
  hotels: { hotel: string; tier: string }[]
  rental_cars: { company: string; tier: string }[]
  memberships: string[]
}

const EMPTY_PROFILE: BenefitsProfile = {
  credit_cards: [],
  airlines: [],
  hotels: [],
  rental_cars: [],
  memberships: [],
}

export default function TravelBenefits() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [profile, setProfile] = useState<BenefitsProfile>(EMPTY_PROFILE)
  const [openSection, setOpenSection] = useState<string | null>('credit_cards')
  const [newAirline, setNewAirline] = useState('')
  const [newAirlineTier, setNewAirlineTier] = useState('')
  const [newHotel, setNewHotel] = useState('')
  const [newHotelTier, setNewHotelTier] = useState('')
  const [newCar, setNewCar] = useState('')
  const [newCarTier, setNewCarTier] = useState('')

  const s = { fontFamily: 'var(--font-cormorant), Georgia, serif' }

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      const { data } = await supabase
        .from('user_profiles')
        .select('benefits_profile')
        .eq('user_id', user.id)
        .single()
      if (data?.benefits_profile) setProfile(data.benefits_profile)
      setLoading(false)
    }
    load()
  }, [router])

  const save = async () => {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('user_profiles').update({ benefits_profile: profile }).eq('user_id', user.id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const toggleCard = (card: string) => {
    setProfile(p => ({
      ...p,
      credit_cards: p.credit_cards.includes(card)
        ? p.credit_cards.filter(c => c !== card)
        : [...p.credit_cards, card]
    }))
  }

  const toggleMembership = (m: string) => {
    setProfile(p => ({
      ...p,
      memberships: p.memberships.includes(m)
        ? p.memberships.filter(x => x !== m)
        : [...p.memberships, m]
    }))
  }

  const addAirline = () => {
    if (!newAirline || !newAirlineTier) return
    if (profile.airlines.find(a => a.airline === newAirline)) return
    setProfile(p => ({ ...p, airlines: [...p.airlines, { airline: newAirline, tier: newAirlineTier }] }))
    setNewAirline('')
    setNewAirlineTier('')
  }

  const removeAirline = (airline: string) => {
    setProfile(p => ({ ...p, airlines: p.airlines.filter(a => a.airline !== airline) }))
  }

  const addHotel = () => {
    if (!newHotel || !newHotelTier) return
    if (profile.hotels.find(h => h.hotel === newHotel)) return
    setProfile(p => ({ ...p, hotels: [...p.hotels, { hotel: newHotel, tier: newHotelTier }] }))
    setNewHotel('')
    setNewHotelTier('')
  }

  const removeHotel = (hotel: string) => {
    setProfile(p => ({ ...p, hotels: p.hotels.filter(h => h.hotel !== hotel) }))
  }

  const addCar = () => {
    if (!newCar || !newCarTier) return
    if (profile.rental_cars.find(c => c.company === newCar)) return
    setProfile(p => ({ ...p, rental_cars: [...p.rental_cars, { company: newCar, tier: newCarTier }] }))
    setNewCar('')
    setNewCarTier('')
  }

  const removeCar = (company: string) => {
    setProfile(p => ({ ...p, rental_cars: p.rental_cars.filter(c => c.company !== company) }))
  }

  const sectionStyle = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '16px 20px', cursor: 'pointer', userSelect: 'none' as const,
    borderBottom: '0.5px solid #e4e4d8',
  }

  const chipStyle = (selected: boolean) => ({
    padding: '7px 14px', fontSize: '12px', cursor: 'pointer',
    border: `1px solid ${selected ? '#1a3a2a' : '#d4d4c8'}`,
    background: selected ? '#e8f5ee' : 'transparent',
    color: selected ? '#1a3a2a' : '#6a6a6a',
    borderRadius: '20px', ...s,
    transition: 'all 0.15s',
  })

  const selectStyle = {
    width: '100%', borderBottom: '1px solid #d4d4c8', background: 'transparent',
    padding: '8px 0', fontSize: '14px', color: '#1a1a1a', outline: 'none',
    cursor: 'pointer', appearance: 'none' as const, ...s,
  }

  if (loading) return <SuitcaseLoader message="Loading your benefits" />

  const sections = [
    { key: 'credit_cards', label: 'Credit cards', count: profile.credit_cards.length },
    { key: 'airlines', label: 'Airlines & status', count: profile.airlines.length },
    { key: 'hotels', label: 'Hotels & loyalty', count: profile.hotels.length },
    { key: 'rental_cars', label: 'Rental cars', count: profile.rental_cars.length },
    { key: 'memberships', label: 'Memberships & programs', count: profile.memberships.length },
  ]

  return (
    <main style={{ minHeight: '100vh', background: '#fafaf8', ...s }}>
      <div style={{ maxWidth: '560px', margin: '0 auto', padding: '48px 24px 80px' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
          <AvantiLogo size="sm" />
          <button onClick={() => router.back()} style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#9a9a8a', background: 'none', border: 'none', cursor: 'pointer', ...s }}>← Back</button>
        </div>

        <p style={{ fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', color: '#9a9a8a', margin: '0 0 6px' }}>Your profile</p>
        <h1 style={{ fontSize: '36px', fontWeight: 300, color: '#1a1a1a', margin: '0 0 8px' }}>Travel benefits</h1>
        <p style={{ fontSize: '13px', color: '#9a9a8a', margin: '0 0 32px', lineHeight: 1.7 }}>
          Avanti uses this to flag useful perks for your trips — free bags, lounge access, upgrades, discounts. Only surfaces something when it actually matters.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0', border: '0.5px solid #e4e4d8', borderRadius: '14px', overflow: 'hidden', marginBottom: '24px' }}>
          {sections.map((section, si) => (
            <div key={section.key} style={{ borderBottom: si < sections.length - 1 ? '0.5px solid #e4e4d8' : 'none' }}>
              <div style={sectionStyle} onClick={() => setOpenSection(openSection === section.key ? null : section.key)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <p style={{ fontSize: '15px', fontWeight: 400, color: '#1a1a1a', margin: 0, ...s }}>{section.label}</p>
                  {section.count > 0 && (
                    <span style={{ fontSize: '11px', background: '#e8f5ee', color: '#2d6a4f', padding: '2px 8px', borderRadius: '10px' }}>
                      {section.count} added
                    </span>
                  )}
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9a9a8a" strokeWidth="2" style={{ transform: openSection === section.key ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}>
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </div>

              {openSection === section.key && (
                <div style={{ padding: '20px', background: '#fafaf8', borderTop: '0.5px solid #f0f0e8' }}>

                  {section.key === 'credit_cards' && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {CREDIT_CARDS.map(card => (
                        <button key={card} onClick={() => toggleCard(card)} style={chipStyle(profile.credit_cards.includes(card))}>
                          {card}
                        </button>
                      ))}
                    </div>
                  )}

                  {section.key === 'airlines' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {profile.airlines.map(a => (
                        <div key={a.airline} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#fff', border: '0.5px solid #e4e4d8', borderRadius: '10px' }}>
                          <div>
                            <p style={{ fontSize: '14px', color: '#1a1a1a', margin: '0 0 2px', ...s }}>{a.airline}</p>
                            <p style={{ fontSize: '11px', color: '#2d6a4f', margin: 0 }}>{a.tier}</p>
                          </div>
                          <button onClick={() => removeAirline(a.airline)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#b4b4a8', fontSize: '18px' }}>×</button>
                        </div>
                      ))}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '14px', background: '#fff', border: '0.5px solid #e4e4d8', borderRadius: '10px' }}>
                        <p style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#9a9a8a', margin: 0 }}>Add an airline</p>
                        <select value={newAirline} onChange={e => { setNewAirline(e.target.value); setNewAirlineTier('') }} style={selectStyle}>
                          <option value="">Select airline...</option>
                          {AIRLINES.filter(a => !profile.airlines.find(p => p.airline === a)).map(a => (
                            <option key={a} value={a}>{a}</option>
                          ))}
                        </select>
                        {newAirline && (
                          <select value={newAirlineTier} onChange={e => setNewAirlineTier(e.target.value)} style={selectStyle}>
                            <option value="">Select your status...</option>
                            {(AIRLINE_TIERS[newAirline] || DEFAULT_TIERS).map(t => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>
                        )}
                        {newAirline && newAirlineTier && (
                          <button onClick={addAirline} style={{ padding: '10px', border: '1px solid #1a3a2a', background: '#1a3a2a', color: '#fff', fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '6px', ...s }}>
                            Add {newAirline}
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {section.key === 'hotels' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {profile.hotels.map(h => (
                        <div key={h.hotel} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#fff', border: '0.5px solid #e4e4d8', borderRadius: '10px' }}>
                          <div>
                            <p style={{ fontSize: '14px', color: '#1a1a1a', margin: '0 0 2px', ...s }}>{h.hotel}</p>
                            <p style={{ fontSize: '11px', color: '#2d6a4f', margin: 0 }}>{h.tier}</p>
                          </div>
                          <button onClick={() => removeHotel(h.hotel)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#b4b4a8', fontSize: '18px' }}>×</button>
                        </div>
                      ))}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '14px', background: '#fff', border: '0.5px solid #e4e4d8', borderRadius: '10px' }}>
                        <p style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#9a9a8a', margin: 0 }}>Add a hotel program</p>
                        <select value={newHotel} onChange={e => { setNewHotel(e.target.value); setNewHotelTier('') }} style={selectStyle}>
                          <option value="">Select program...</option>
                          {HOTELS.filter(h => !profile.hotels.find(p => p.hotel === h.name)).map(h => (
                            <option key={h.name} value={h.name}>{h.name}</option>
                          ))}
                        </select>
                        {newHotel && (
                          <select value={newHotelTier} onChange={e => setNewHotelTier(e.target.value)} style={selectStyle}>
                            <option value="">Select your tier...</option>
                            {(HOTELS.find(h => h.name === newHotel)?.tiers || []).map(t => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>
                        )}
                        {newHotel && newHotelTier && (
                          <button onClick={addHotel} style={{ padding: '10px', border: '1px solid #1a3a2a', background: '#1a3a2a', color: '#fff', fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '6px', ...s }}>
                            Add {newHotel}
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {section.key === 'rental_cars' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {profile.rental_cars.map(c => (
                        <div key={c.company} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#fff', border: '0.5px solid #e4e4d8', borderRadius: '10px' }}>
                          <div>
                            <p style={{ fontSize: '14px', color: '#1a1a1a', margin: '0 0 2px', ...s }}>{c.company}</p>
                            <p style={{ fontSize: '11px', color: '#2d6a4f', margin: 0 }}>{c.tier}</p>
                          </div>
                          <button onClick={() => removeCar(c.company)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#b4b4a8', fontSize: '18px' }}>×</button>
                        </div>
                      ))}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '14px', background: '#fff', border: '0.5px solid #e4e4d8', borderRadius: '10px' }}>
                        <p style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#9a9a8a', margin: 0 }}>Add a rental car program</p>
                        <select value={newCar} onChange={e => { setNewCar(e.target.value); setNewCarTier('') }} style={selectStyle}>
                          <option value="">Select program...</option>
                          {RENTAL_CARS.filter(c => !profile.rental_cars.find(p => p.company === c.name)).map(c => (
                            <option key={c.name} value={c.name}>{c.name}</option>
                          ))}
                        </select>
                        {newCar && (
                          <select value={newCarTier} onChange={e => setNewCarTier(e.target.value)} style={selectStyle}>
                            <option value="">Select your tier...</option>
                            {(RENTAL_CARS.find(c => c.name === newCar)?.tiers || []).map(t => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>
                        )}
                        {newCar && newCarTier && (
                          <button onClick={addCar} style={{ padding: '10px', border: '1px solid #1a3a2a', background: '#1a3a2a', color: '#fff', fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '6px', ...s }}>
                            Add {newCar}
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {section.key === 'memberships' && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {MEMBERSHIPS.map(m => (
                        <button key={m} onClick={() => toggleMembership(m)} style={chipStyle(profile.memberships.includes(m))}>
                          {m}
                        </button>
                      ))}
                    </div>
                  )}

                </div>
              )}
            </div>
          ))}
        </div>

        {(profile.credit_cards.length > 0 || profile.airlines.length > 0 || profile.hotels.length > 0 || profile.rental_cars.length > 0 || profile.memberships.length > 0) && (
          <div style={{ background: '#e8f5ee', border: '0.5px solid #a8d4b8', borderRadius: '12px', padding: '18px 20px', marginBottom: '20px' }}>
            <p style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#2d6a4f', margin: '0 0 10px' }}>Your benefits at a glance</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {profile.credit_cards.length > 0 && <p style={{ fontSize: '12px', color: '#1a3a2a', margin: 0 }}>💳 {profile.credit_cards.length} credit card{profile.credit_cards.length !== 1 ? 's' : ''}</p>}
              {profile.airlines.length > 0 && profile.airlines.map(a => <p key={a.airline} style={{ fontSize: '12px', color: '#1a3a2a', margin: 0 }}>✈️ {a.airline} — {a.tier}</p>)}
              {profile.hotels.length > 0 && profile.hotels.map(h => <p key={h.hotel} style={{ fontSize: '12px', color: '#1a3a2a', margin: 0 }}>🏨 {h.hotel} — {h.tier}</p>)}
              {profile.rental_cars.length > 0 && profile.rental_cars.map(c => <p key={c.company} style={{ fontSize: '12px', color: '#1a3a2a', margin: 0 }}>🚗 {c.company} — {c.tier}</p>)}
              {profile.memberships.length > 0 && <p style={{ fontSize: '12px', color: '#1a3a2a', margin: 0 }}>⭐ {profile.memberships.join(', ')}</p>}
            </div>
          </div>
        )}

        <button onClick={save} disabled={saving} style={{ width: '100%', border: '1px solid #1a1a1a', padding: '16px', fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', color: '#1a1a1a', background: saved ? '#e8f5ee' : 'transparent', cursor: 'pointer', transition: 'all 0.2s', ...s }}>
          {saving ? 'Saving...' : saved ? 'Saved ✓' : 'Save benefits profile →'}
        </button>

      </div>
    </main>
  )
}
