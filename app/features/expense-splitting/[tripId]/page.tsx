'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { fetchTripExpenses, createTripExpenses } from '@/lib/expenses/client-api'
import type { ExpenseInput } from '@/lib/expenses/types'
import AvantiLogo from '../../../components/AvantiLogo'
import SuitcaseLoader from '../../../components/SuitcaseLoader'

interface Person { id: string; name: string; color: string; isMe: boolean }
interface LineItem { id: string; name: string; originalName: string; priceUSD: number; participants: string[]; isCoverCharge: boolean }
interface Expense { id: string; description: string; amount: number; paidBy: string; date: string; participants: string[]; settled: boolean }

type Step = 'home' | 'choose' | 'scan_options' | 'manual' | 'scanning' | 'items' | 'finalize' | 'summary'

const COLORS = [
  '#1a6a3e','#2d6a4f','#3a7a14','#5a7a0a',
  '#6a7a0a','#4a7a10','#1a4a38','#2d5a2e',
  '#1a5a38','#2a5a1e'
]

function simplifyDebts(people: Person[], expenses: Expense[]) {
  const balances: Record<string, number> = {}
  people.forEach(p => { balances[p.id] = 0 })
  expenses.filter(e => !e.settled).forEach(exp => {
    if (exp.participants.length === 0) return
    const share = exp.amount / exp.participants.length
    exp.participants.forEach(pid => { if (balances[pid] !== undefined) balances[pid] -= share })
    if (balances[exp.paidBy] !== undefined) balances[exp.paidBy] += exp.amount
  })
  const creditors = Object.entries(balances).filter(([,v]) => v > 0.01).map(([id,amt]) => ({id,amt})).sort((a,b) => b.amt-a.amt)
  const debtors = Object.entries(balances).filter(([,v]) => v < -0.01).map(([id,amt]) => ({id,amt:Math.abs(amt)})).sort((a,b) => b.amt-a.amt)
  const txns: {from:string,to:string,amount:number}[] = []
  let i=0,j=0
  while(i<creditors.length && j<debtors.length) {
    const amt = Math.min(creditors[i].amt, debtors[j].amt)
    if(amt>0.01) txns.push({from:debtors[j].id,to:creditors[i].id,amount:amt})
    creditors[i].amt-=amt; debtors[j].amt-=amt
    if(creditors[i].amt<0.01) i++
    if(debtors[j].amt<0.01) j++
  }
  return txns
}

export default function TripExpenses() {
  const { tripId } = useParams() as { tripId: string }
  const router = useRouter()
  const [trip, setTrip] = useState<any>(null)
  const [people, setPeople] = useState<Person[]>([])
  const [myId, setMyId] = useState('')
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState<Step>('home')
  const [showSettings, setShowSettings] = useState(false)
  const [preferredCurrency, setPreferredCurrency] = useState('USD')
  const [preferredLanguage, setPreferredLanguage] = useState('English')
  const [expenseDesc, setExpenseDesc] = useState('')
  const [manualAmount, setManualAmount] = useState('')
  const [manualCurrency, setManualCurrency] = useState('USD')
  const [paidBy, setPaidBy] = useState('')
  const [splitType, setSplitType] = useState<'equal'|'byAmount'|'byPercent'|'byShares'>('equal')
  const [customSplits, setCustomSplits] = useState<Record<string,string>>({})
  const [selectedForEqual, setSelectedForEqual] = useState<string[]>([])
  const [lineItems, setLineItems] = useState<LineItem[]>([])
  const [taxMode, setTaxMode] = useState<'percent'|'amount'>('percent')
  const [taxValue, setTaxValue] = useState('')
  const [tipMode, setTipMode] = useState<'percent'|'amount'>('percent')
  const [tipValue, setTipValue] = useState('')
  const [receiptNotes, setReceiptNotes] = useState('')
  const [receiptDesc, setReceiptDesc] = useState('')
  const [saving, setSaving] = useState(false)
  const s = { fontFamily: 'var(--font-cormorant), Georgia, serif' }
  const inputStyle = { width:'100%', borderBottom:'1px solid #d4d4c8', background:'transparent', padding:'8px 0', fontSize:'15px', color:'#1a1a1a', outline:'none', ...s }
  const labelStyle = { fontSize:'10px', letterSpacing:'0.15em', textTransform:'uppercase' as const, color:'#9a9a8a', display:'block', marginBottom:'6px' }

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      const { data: profile } = await supabase.from('user_profiles').select('*').eq('user_id', user.id).single()
      const { data: tripData } = await supabase.from('trips').select('*').eq('id', tripId).single()
      const { data: travelerData } = await supabase.from('travelers').select('*').eq('trip_id', tripId)
      if (tripData) setTrip(tripData)
      if (travelerData) {
        const myTraveler = travelerData.find((t: { user_id?: string; email: string }) =>
          t.user_id === user.id || t.email === profile?.email
        )
        const meId = myTraveler?.id || 'me'
        setMyId(meId)
        setPaidBy(meId)
        setSelectedForEqual(travelerData.map((t: { id: string }) => t.id))
        const splits: Record<string,string> = {}
        travelerData.forEach((t: { id: string }) => { splits[t.id] = '' })
        setCustomSplits(splits)
        setPeople(travelerData.map((t: { id: string; nickname?: string; full_name?: string; email: string; user_id?: string }, i: number) => ({
          id: t.id,
          name: t.nickname || t.full_name?.split(' ')[0] || 'Unknown',
          color: COLORS[i % COLORS.length],
          isMe: t.user_id === user.id || t.email === profile?.email
        })))
      }
      try {
        const saved = await fetchTripExpenses(tripId)
        setExpenses(saved)
      } catch {
        setExpenses([])
      }
      setLoading(false)
    }
    load()
  }, [tripId, router])

  const getName = (id: string) => people.find(p => p.id === id)?.name || id
  const getColor = (id: string) => people.find(p => p.id === id)?.color || '#2d6a4f'
  const transactions = simplifyDebts(people, expenses)
  const myBalance = transactions.reduce((sum, t) => {
    if (t.to === myId) return sum + t.amount
    if (t.from === myId) return sum - t.amount
    return sum
  }, 0)

  const handleScan = async (file: File) => {
    setStep('scanning')
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const base64 = ev.target?.result as string
      try {
        const res = await fetch('/api/scan-receipt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64, currency: preferredCurrency }),
        })
        const data = await res.json()
        if (data.error || !data.items?.length) {
          alert(data.error || 'Could not read receipt. Try a clearer photo.')
          setStep('scan_options')
          return
        }
        setLineItems(data.items.map((item: { name: string; originalName?: string; price: number; isCoverCharge?: boolean }, i: number) => ({
          id: Date.now().toString() + i,
          name: item.name,
          originalName: item.originalName || '',
          priceUSD: item.price,
          participants: item.isCoverCharge ? people.map(p => p.id) : [],
          isCoverCharge: item.isCoverCharge || false,
        })))
        if (data.tax_percent > 0) { setTaxMode('percent'); setTaxValue(String(data.tax_percent)) }
        if (data.tip_percent > 0) { setTipMode('percent'); setTipValue(String(data.tip_percent)) }
        if (data.notes) setReceiptNotes(data.notes)
        setStep('items')
      } catch (e) {
        alert('Something went wrong. Try again.')
        setStep('scan_options')
      }
    }
    reader.readAsDataURL(file)
  }

  const toggleParticipant = (itemId: string, personId: string) => {
    setLineItems(items => items.map(item =>
      item.id === itemId
        ? { ...item, participants: item.participants.includes(personId)
            ? item.participants.filter(p => p !== personId)
            : [...item.participants, personId] }
        : item
    ))
  }

  const subtotal = lineItems.reduce((s, i) => s + i.priceUSD, 0)
  const getTaxAmount = () => {
    if (!taxValue || parseFloat(taxValue) === 0) return 0
    if (taxMode === 'percent') return subtotal * (parseFloat(taxValue) / 100)
    return parseFloat(taxValue) || 0
  }
  const getTipAmount = () => {
    if (!tipValue || parseFloat(tipValue) === 0) return 0
    if (tipMode === 'percent') return subtotal * (parseFloat(tipValue) / 100)
    return parseFloat(tipValue) || 0
  }
  const taxAmt = getTaxAmount()
  const tipAmt = getTipAmount()
  const grandTotal = subtotal + taxAmt + tipAmt

  const getPersonTotals = () => {
    const totals: Record<string, number> = {}
    people.forEach(p => { totals[p.id] = 0 })
    lineItems.forEach(item => {
      if (item.participants.length === 0) return
      const share = item.priceUSD / item.participants.length
      item.participants.forEach(pid => {
        if (totals[pid] !== undefined) totals[pid] += share
      })
    })
    if (subtotal > 0) {
      people.forEach(p => {
        const proportion = totals[p.id] / subtotal
        totals[p.id] += taxAmt * proportion
        totals[p.id] += tipAmt * proportion
      })
    }
    return totals
  }
  const personTotals = getPersonTotals()

  const finalizeReceiptExpense = async () => {
    if (!paidBy) return
    const newExpenses: ExpenseInput[] = lineItems
      .filter(item => item.participants.length > 0)
      .map(item => {
        const proportion = subtotal > 0 ? item.priceUSD / subtotal : 1 / lineItems.length
        const itemTax = taxAmt * proportion
        const itemTip = tipAmt * proportion
        return {
          description: item.name,
          amount: parseFloat((item.priceUSD + itemTax + itemTip).toFixed(2)),
          paidBy,
          date: new Date().toISOString().split('T')[0],
          participants: item.participants,
          settled: false,
        }
      })
    if (newExpenses.length === 0) return
    setSaving(true)
    try {
      const created = await createTripExpenses(tripId, newExpenses)
      setExpenses(e => [...e, ...created])
      setLineItems([])
      setTaxValue('')
      setTipValue('')
      setReceiptNotes('')
      setStep('home')
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not save expenses')
    } finally {
      setSaving(false)
    }
  }

  const finalizeManualExpense = async () => {
    if (!expenseDesc || !manualAmount || !paidBy) return
    let finalAmount = parseFloat(manualAmount)
    if (isNaN(finalAmount) || finalAmount <= 0) return
    if (manualCurrency !== 'USD') {
      try {
        const res = await fetch(`https://api.frankfurter.app/latest?from=${manualCurrency}&to=USD`)
        const data = await res.json()
        if (data.rates?.USD) finalAmount = parseFloat((finalAmount * data.rates.USD).toFixed(2))
      } catch(e) {}
    }
    const participants = splitType === 'equal'
      ? (selectedForEqual.length > 0 ? selectedForEqual : people.map(p => p.id))
      : Object.keys(customSplits).filter(id => parseFloat(customSplits[id] || '0') > 0)
    const input: ExpenseInput = {
      description: expenseDesc,
      amount: finalAmount,
      paidBy,
      date: new Date().toISOString().split('T')[0],
      participants: participants.length > 0 ? participants : people.map(p => p.id),
      settled: false,
    }
    setSaving(true)
    try {
      const created = await createTripExpenses(tripId, [input])
      setExpenses(e => [...e, ...created])
      setExpenseDesc('')
      setManualAmount('')
      setManualCurrency('USD')
      setSplitType('equal')
      setSelectedForEqual(people.map(p => p.id))
      setStep('home')
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not save expense')
    } finally {
      setSaving(false)
    }
  }

  const settleUp = (fromId: string, toId: string, amount: number) => {
    const toPerson = people.find(p => p.id === toId)
    const fromPerson = people.find(p => p.id === fromId)
    const note = encodeURIComponent(`${trip?.name || 'Trip'} expenses`)
    if (fromId === myId) {
      window.open(`venmo://paycharge?txn=pay&recipients=${toPerson?.name}&amount=${amount.toFixed(2)}&note=${note}`)
    } else {
      window.open(`venmo://paycharge?txn=charge&recipients=${fromPerson?.name}&amount=${amount.toFixed(2)}&note=${note}`)
    }
  }

  const CURRENCIES = ['USD','EUR','GBP','JPY','CAD','AUD','CHF','CNY','INR','MXN','BRL','KRW','THB','ILS','TRY','SEK','NOK','DKK']
  const LANGUAGES = ['English','Spanish','French','Italian','German','Portuguese','Japanese','Chinese','Korean','Arabic','Hindi','Dutch','Russian']

  if (loading) return <SuitcaseLoader message="Loading expenses" />
  if (!trip) return null

  const myTransactions = transactions.filter(t => t.from === myId || t.to === myId)

  const headerCard = (
    <div style={{ background:'#1a3a2a', borderRadius:'16px', padding:'28px', position:'relative', overflow:'hidden', marginBottom:'16px' }}>
      {trip.cover_image && <img src={trip.cover_image} alt="" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', opacity:0.2 }} />}
      <div style={{ position:'relative', zIndex:1 }}>
        <p style={{ fontSize:'10px', letterSpacing:'0.25em', textTransform:'uppercase', color:'rgba(255,255,255,0.5)', margin:'0 0 4px' }}>{trip.destination}</p>
        <h1 style={{ fontSize:'26px', fontWeight:300, color:'#fff', margin:'0 0 12px', ...s }}>{trip.name}</h1>
        {myBalance > 0.01 ? (
          <>
            <p style={{ fontSize:'12px', color:'rgba(255,255,255,0.6)', margin:'0 0 2px' }}>You are owed</p>
            <p style={{ fontSize:'32px', fontWeight:300, color:'#34c759', margin:'0 0 8px', ...s }}>${myBalance.toFixed(2)}</p>
          </>
        ) : myBalance < -0.01 ? (
          <>
            <p style={{ fontSize:'12px', color:'rgba(255,255,255,0.6)', margin:'0 0 2px' }}>You owe</p>
            <p style={{ fontSize:'32px', fontWeight:300, color:'#ff6b6b', margin:'0 0 8px', ...s }}>${Math.abs(myBalance).toFixed(2)}</p>
          </>
        ) : (
          <p style={{ fontSize:'18px', fontWeight:300, color:'rgba(255,255,255,0.5)', margin:'0 0 8px', ...s }}>All settled up ✓</p>
        )}
        {myTransactions.map((t, i) => (
          <p key={i} style={{ fontSize:'12px', color: t.to === myId ? '#34c759' : 'rgba(255,120,120,0.9)', margin:'2px 0 0' }}>
            {t.to === myId ? `${getName(t.from)} owes you $${t.amount.toFixed(2)}` : `You owe ${getName(t.to)} $${t.amount.toFixed(2)}`}
          </p>
        ))}
      </div>
    </div>
  )

  return (
    <main style={{ minHeight:'100vh', background:'#fafaf8', ...s }}>
      <div style={{ maxWidth:'480px', margin:'0 auto', padding:'48px 24px 100px' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'24px' }}>
          <AvantiLogo size="sm" />
          <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
            {step !== 'home' && (
              <button onClick={() => setStep('home')} style={{ fontSize:'10px', letterSpacing:'0.15em', textTransform:'uppercase', color:'#9a9a8a', background:'none', border:'none', cursor:'pointer', ...s }}>← Back</button>
            )}
            {step === 'home' && (
              <button onClick={() => router.back()} style={{ fontSize:'10px', letterSpacing:'0.15em', textTransform:'uppercase', color:'#9a9a8a', background:'none', border:'none', cursor:'pointer', ...s }}>← Trips</button>
            )}
            <button onClick={() => setShowSettings(!showSettings)} style={{ background:'none', border:'none', cursor:'pointer', padding:'4px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9a9a8a" strokeWidth="1.5" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            </button>
          </div>
        </div>

        {showSettings && (
          <div style={{ background:'#fff', border:'0.5px solid #e4e4d8', borderRadius:'12px', padding:'20px', marginBottom:'20px', display:'flex', flexDirection:'column', gap:'16px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <p style={{ fontSize:'10px', letterSpacing:'0.2em', textTransform:'uppercase', color:'#9a9a8a', margin:0 }}>Preferences</p>
              <button onClick={() => setShowSettings(false)} style={{ background:'none', border:'none', cursor:'pointer', color:'#b4b4a8', fontSize:'18px' }}>×</button>
            </div>
            <div>
              <label style={labelStyle}>Default currency</label>
              <select value={preferredCurrency} onChange={e => { setPreferredCurrency(e.target.value); setManualCurrency(e.target.value) }} style={{ ...inputStyle, appearance:'none' as const }}>
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Receipt language</label>
              <select value={preferredLanguage} onChange={e => setPreferredLanguage(e.target.value)} style={{ ...inputStyle, appearance:'none' as const }}>
                {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          </div>
        )}

        {step === 'home' && (
          <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
            {headerCard}
            {transactions.length > 0 && (
              <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                <p style={{ fontSize:'10px', letterSpacing:'0.2em', textTransform:'uppercase', color:'#9a9a8a', margin:0 }}>Settle up</p>
                {transactions.map((t, i) => (
                  <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 16px', background:'#fff', border:'0.5px solid #e4e4d8', borderRadius:'12px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                      <div style={{ display:'flex' }}>
                        <div style={{ width:'28px', height:'28px', borderRadius:'50%', background:getColor(t.from), display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:'11px', fontWeight:500, zIndex:1 }}>{getName(t.from).charAt(0)}</div>
                        <div style={{ width:'28px', height:'28px', borderRadius:'50%', background:getColor(t.to), display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:'11px', fontWeight:500, marginLeft:'-8px' }}>{getName(t.to).charAt(0)}</div>
                      </div>
                      <div>
                        <p style={{ fontSize:'13px', color:'#1a1a1a', margin:'0 0 1px' }}><strong>{getName(t.from)}</strong> → <strong>{getName(t.to)}</strong></p>
                        <p style={{ fontSize:'12px', color:'#9a9a8a', margin:0 }}>${t.amount.toFixed(2)}</p>
                      </div>
                    </div>
                    {(t.from === myId || t.to === myId) && (
                      <button onClick={() => settleUp(t.from, t.to, t.amount)} style={{ padding:'8px 16px', background: t.from === myId ? '#007aff' : '#1a3a2a', border:'none', color:'#fff', fontSize:'10px', letterSpacing:'0.1em', textTransform:'uppercase', cursor:'pointer', borderRadius:'20px', ...s }}>
                        {t.from === myId ? 'Pay on Venmo' : 'Request'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
              <p style={{ fontSize:'10px', letterSpacing:'0.2em', textTransform:'uppercase', color:'#9a9a8a', margin:0 }}>Activity</p>
              {expenses.length === 0 ? (
                <div style={{ textAlign:'center', padding:'40px 0' }}>
                  <p style={{ fontSize:'13px', color:'#b4b4a8', fontStyle:'italic' }}>No expenses yet.</p>
                  <p style={{ fontSize:'12px', color:'#b4b4a8' }}>Scan a receipt or add an expense.</p>
                </div>
              ) : (
                [...expenses].reverse().map(exp => {
                  const myShare = exp.participants.includes(myId) ? exp.amount / exp.participants.length : 0
                  const iPaid = exp.paidBy === myId
                  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
                  const d = new Date(exp.date)
                  return (
                    <div key={exp.id} style={{ display:'flex', alignItems:'center', gap:'12px', padding:'14px 16px', background:'#fff', border:'0.5px solid #e4e4d8', borderRadius:'12px' }}>
                      <div style={{ textAlign:'center', minWidth:'28px' }}>
                        <p style={{ fontSize:'9px', color:'#9a9a8a', margin:0, textTransform:'uppercase' }}>{months[d.getMonth()]}</p>
                        <p style={{ fontSize:'15px', fontWeight:500, color:'#1a1a1a', margin:0 }}>{d.getDate()}</p>
                      </div>
                      <div style={{ width:'32px', height:'32px', borderRadius:'8px', background:'#e8f5ee', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2d6a4f" strokeWidth="1.5"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
                      </div>
                      <div style={{ flex:1 }}>
                        <p style={{ fontSize:'13px', color:'#1a1a1a', margin:'0 0 2px' }}>{exp.description}</p>
                        <p style={{ fontSize:'11px', color:'#9a9a8a', margin:0 }}>{getName(exp.paidBy)} paid ${exp.amount.toFixed(2)}</p>
                      </div>
                      <div style={{ textAlign:'right', flexShrink:0 }}>
                        {iPaid && myShare < exp.amount ? (
                          <><p style={{ fontSize:'10px', color:'#9a9a8a', margin:'0 0 1px' }}>you lent</p><p style={{ fontSize:'13px', color:'#34c759', margin:0, fontWeight:500 }}>+${(exp.amount - myShare).toFixed(2)}</p></>
                        ) : myShare > 0 && !iPaid ? (
                          <><p style={{ fontSize:'10px', color:'#9a9a8a', margin:'0 0 1px' }}>you owe</p><p style={{ fontSize:'13px', color:'#ff6b6b', margin:0, fontWeight:500 }}>-${myShare.toFixed(2)}</p></>
                        ) : null}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}

        {step === 'choose' && (
          <div style={{ display:'flex', flexDirection:'column', gap:'20px' }}>
            <div>
              <p style={{ fontSize:'10px', letterSpacing:'0.25em', textTransform:'uppercase', color:'#9a9a8a', margin:'0 0 6px' }}>Add expense · {trip.name}</p>
              <h2 style={{ fontSize:'32px', fontWeight:300, color:'#1a1a1a', margin:0 }}>How?</h2>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
              <button onClick={() => setStep('scan_options')} style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'12px', padding:'28px 16px', background:'#e8f5ee', border:'1px solid #2d6a4f', borderRadius:'16px', cursor:'pointer', minHeight:'160px' }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#1a3a2a" strokeWidth="1.5" strokeLinecap="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                <div style={{ textAlign:'center' }}>
                  <p style={{ fontSize:'14px', fontWeight:500, color:'#1a3a2a', margin:'0 0 4px', ...s }}>Scan a receipt</p>
                  <p style={{ fontSize:'11px', color:'#2d6a4f', margin:0, lineHeight:1.4 }}>AI reads items, translates, converts currency</p>
                </div>
              </button>
              <button onClick={() => setStep('manual')} style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'12px', padding:'28px 16px', background:'#fff', border:'0.5px solid #e4e4d8', borderRadius:'16px', cursor:'pointer', minHeight:'160px' }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#9a9a8a" strokeWidth="1.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                <div style={{ textAlign:'center' }}>
                  <p style={{ fontSize:'14px', fontWeight:500, color:'#1a1a1a', margin:'0 0 4px', ...s }}>Enter manually</p>
                  <p style={{ fontSize:'11px', color:'#9a9a8a', margin:0, lineHeight:1.4 }}>Type in a description and amount</p>
                </div>
              </button>
            </div>
          </div>
        )}

        {step === 'scan_options' && (
          <div style={{ display:'flex', flexDirection:'column', gap:'20px' }}>
            <div>
              <p style={{ fontSize:'10px', letterSpacing:'0.25em', textTransform:'uppercase', color:'#9a9a8a', margin:'0 0 6px' }}>Scan receipt</p>
              <h2 style={{ fontSize:'32px', fontWeight:300, color:'#1a1a1a', margin:'0 0 6px' }}>Choose a source</h2>
              <p style={{ fontSize:'12px', color:'#9a9a8a', lineHeight:1.6 }}>Avanti translates, detects cover charges, and converts to {preferredCurrency}.</p>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
              <label style={{ display:'flex', alignItems:'center', gap:'14px', padding:'18px 20px', background:'#e8f5ee', border:'1px solid #2d6a4f', borderRadius:'12px', cursor:'pointer' }}>
                <div style={{ width:'40px', height:'40px', borderRadius:'10px', background:'#2d6a4f', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                </div>
                <div style={{ flex:1 }}>
                  <p style={{ fontSize:'14px', color:'#1a3a2a', margin:'0 0 2px', fontWeight:500, ...s }}>Take a photo</p>
                  <p style={{ fontSize:'11px', color:'#2d6a4f', margin:0 }}>Use camera right now</p>
                </div>
                <input type="file" accept="image/*" capture="environment" style={{ display:'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleScan(f) }} />
              </label>
              <label style={{ display:'flex', alignItems:'center', gap:'14px', padding:'18px 20px', background:'#fff', border:'0.5px solid #e4e4d8', borderRadius:'12px', cursor:'pointer' }}>
                <div style={{ width:'40px', height:'40px', borderRadius:'10px', background:'#f5f5f0', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9a9a8a" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                </div>
                <div style={{ flex:1 }}>
                  <p style={{ fontSize:'14px', color:'#1a1a1a', margin:'0 0 2px', fontWeight:500, ...s }}>Camera roll</p>
                  <p style={{ fontSize:'11px', color:'#9a9a8a', margin:0 }}>Choose from your photos</p>
                </div>
                <input type="file" accept="image/*" style={{ display:'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleScan(f) }} />
              </label>
              <label style={{ display:'flex', alignItems:'center', gap:'14px', padding:'18px 20px', background:'#fff', border:'0.5px solid #e4e4d8', borderRadius:'12px', cursor:'pointer' }}>
                <div style={{ width:'40px', height:'40px', borderRadius:'10px', background:'#f5f5f0', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9a9a8a" strokeWidth="1.5" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                </div>
                <div style={{ flex:1 }}>
                  <p style={{ fontSize:'14px', color:'#1a1a1a', margin:'0 0 2px', fontWeight:500, ...s }}>Upload a file</p>
                  <p style={{ fontSize:'11px', color:'#9a9a8a', margin:0 }}>JPG, PNG from computer</p>
                </div>
                <input type="file" accept="image/*,image/heic" style={{ display:'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleScan(f) }} />
              </label>
            </div>
          </div>
        )}

        {step === 'scanning' && (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'400px', gap:'20px' }}>
            <svg width="60" height="50" viewBox="0 0 80 64" fill="none">
              <style>{`@keyframes sc{0%{stroke-dashoffset:300;opacity:.2}60%{stroke-dashoffset:0;opacity:1}100%{stroke-dashoffset:-300;opacity:.2}}.sc{stroke-dasharray:300;animation:sc 2.4s ease-in-out infinite}`}</style>
              <rect className="sc" x="6" y="18" width="68" height="40" rx="4" stroke="#2d6a4f" strokeWidth="1.5" fill="none"/>
              <rect className="sc" x="26" y="6" width="28" height="14" rx="2" stroke="#2d6a4f" strokeWidth="1.5" fill="none" style={{ animationDelay: '0.2s' }}/>
              <line className="sc" x1="6" y1="32" x2="74" y2="32" stroke="#2d6a4f" strokeWidth="1" style={{ animationDelay: '0.4s' }}/>
              <circle cx="18" cy="62" r="3.5" stroke="#2d6a4f" strokeWidth="1.5" fill="none"/>
              <circle cx="62" cy="62" r="3.5" stroke="#2d6a4f" strokeWidth="1.5" fill="none"/>
            </svg>
            <p style={{ color:'#2d6a4f', fontSize:'11px', letterSpacing:'0.2em', textTransform:'uppercase' }}>Reading your receipt...</p>
            <p style={{ color:'#9a9a8a', fontSize:'12px', textAlign:'center', maxWidth:'260px', lineHeight:1.6 }}>Translating · detecting cover charges · converting to {preferredCurrency}</p>
          </div>
        )}

        {step === 'items' && (
          <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
            <div>
              <p style={{ fontSize:'10px', letterSpacing:'0.25em', textTransform:'uppercase', color:'#9a9a8a', margin:'0 0 6px' }}>Tap who had each item</p>
              <h2 style={{ fontSize:'28px', fontWeight:300, color:'#1a1a1a', margin:0 }}>Split the bill</h2>
              {receiptNotes && <p style={{ fontSize:'11px', color:'#9a9a8a', margin:'6px 0 0', fontStyle:'italic' }}>{receiptNotes}</p>}
            </div>
            <div>
              <label style={labelStyle}>Receipt name</label>
              <input style={inputStyle} value={receiptDesc} onChange={e => setReceiptDesc(e.target.value)} placeholder="Dinner at Nobu, Lunch, etc..." />
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
              {lineItems.map(item => (
                <div key={item.id} style={{ background:'#fff', border:`0.5px solid ${item.isCoverCharge ? '#a8d4b8' : '#e4e4d8'}`, borderRadius:'12px', padding:'14px', position:'relative' }}>
                  {item.isCoverCharge && <span style={{ position:'absolute', top:'10px', right:'12px', fontSize:'9px', letterSpacing:'0.1em', textTransform:'uppercase', background:'#e8f5ee', color:'#2d6a4f', padding:'2px 8px', borderRadius:'10px' }}>Everyone</span>}
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'8px' }}>
                    <div style={{ flex:1, paddingRight: item.isCoverCharge ? '70px' : '0' }}>
                      <p style={{ fontSize:'13px', color:'#1a1a1a', margin:'0 0 1px', fontWeight:400 }}>{item.name}</p>
                      {item.originalName && item.originalName !== item.name && (
                        <p style={{ fontSize:'11px', color:'#b4b4a8', margin:0, fontStyle:'italic' }}>{item.originalName}</p>
                      )}
                    </div>
                    <p style={{ fontSize:'13px', color:'#1a1a1a', margin:0, fontWeight:500, flexShrink:0 }}>${item.priceUSD.toFixed(2)}</p>
                  </div>
                  {!item.isCoverCharge ? (
                    <div style={{ display:'flex', flexWrap:'wrap', gap:'5px' }}>
                      {people.map(p => {
                        const sel = item.participants.includes(p.id)
                        return (
                          <button key={p.id} onClick={() => toggleParticipant(item.id, p.id)} style={{ display:'flex', alignItems:'center', gap:'4px', padding:'4px 10px', fontSize:'11px', border:`1px solid ${sel ? p.color : '#d4d4c8'}`, background: sel ? p.color + '22' : 'transparent', color: sel ? '#1a1a1a' : '#6a6a6a', cursor:'pointer', borderRadius:'20px', ...s }}>
                            <div style={{ width:'10px', height:'10px', borderRadius:'50%', background: sel ? p.color : '#d4d4c8', flexShrink:0 }} />
                            {p.isMe ? 'You' : p.name}
                            {sel && item.participants.length > 0 && <span style={{ color:'#9a9a8a', fontSize:'10px' }}> ${(item.priceUSD / item.participants.length).toFixed(2)}</span>}
                          </button>
                        )
                      })}
                    </div>
                  ) : (
                    <p style={{ fontSize:'11px', color:'#2d6a4f', margin:0 }}>Split equally · ${people.length > 0 ? (item.priceUSD / people.length).toFixed(2) : '0.00'}/person</p>
                  )}
                </div>
              ))}
            </div>
            <button onClick={() => setStep('finalize')} style={{ width:'100%', border:'1px solid #1a1a1a', padding:'14px', fontSize:'10px', letterSpacing:'0.25em', textTransform:'uppercase', color:'#1a1a1a', background:'transparent', cursor:'pointer', ...s }}>
              Continue to tax & tip →
            </button>
          </div>
        )}

        {step === 'finalize' && (
          <div style={{ display:'flex', flexDirection:'column', gap:'20px' }}>
            <div>
              <p style={{ fontSize:'10px', letterSpacing:'0.25em', textTransform:'uppercase', color:'#9a9a8a', margin:'0 0 6px' }}>Almost done</p>
              <h2 style={{ fontSize:'28px', fontWeight:300, color:'#1a1a1a', margin:0 }}>Tax, tip & payer</h2>
            </div>
            <div style={{ background:'#fff', border:'0.5px solid #e4e4d8', borderRadius:'12px', padding:'16px', display:'flex', flexDirection:'column', gap:'12px' }}>
              <p style={{ fontSize:'10px', letterSpacing:'0.2em', textTransform:'uppercase', color:'#9a9a8a', margin:0 }}>Tax</p>
              <div style={{ display:'flex', gap:'8px', marginBottom:'4px' }}>
                {(['percent','amount'] as const).map(mode => (
                  <button key={mode} onClick={() => { setTaxMode(mode); setTaxValue('') }} style={{ flex:1, padding:'8px', fontSize:'11px', letterSpacing:'0.08em', textTransform:'uppercase', border:`1px solid ${taxMode === mode ? '#1a3a2a' : '#d4d4c8'}`, background: taxMode === mode ? '#e8f5ee' : 'transparent', color: taxMode === mode ? '#1a3a2a' : '#6a6a6a', cursor:'pointer', borderRadius:'6px', ...s }}>
                    {mode === 'percent' ? 'By %' : 'By $'}
                  </button>
                ))}
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                <span style={{ fontSize:'15px', color:'#9a9a8a' }}>{taxMode === 'percent' ? '%' : '$'}</span>
                <input type="text" inputMode="decimal" style={inputStyle} value={taxValue} onChange={e => { const v = e.target.value; if (v === '' || /^\d*\.?\d{0,2}$/.test(v)) setTaxValue(v) }} placeholder={taxMode === 'percent' ? '0' : '0.00'} />
                {taxValue && <span style={{ fontSize:'13px', color:'#9a9a8a', flexShrink:0 }}>{taxMode === 'percent' ? `= $${getTaxAmount().toFixed(2)}` : `= ${subtotal > 0 ? ((parseFloat(taxValue)/subtotal)*100).toFixed(1) : 0}%`}</span>}
              </div>
            </div>
            <div style={{ background:'#fff', border:'0.5px solid #e4e4d8', borderRadius:'12px', padding:'16px', display:'flex', flexDirection:'column', gap:'12px' }}>
              <p style={{ fontSize:'10px', letterSpacing:'0.2em', textTransform:'uppercase', color:'#9a9a8a', margin:0 }}>Tip</p>
              <div style={{ display:'flex', gap:'8px', marginBottom:'4px' }}>
                {(['percent','amount'] as const).map(mode => (
                  <button key={mode} onClick={() => { setTipMode(mode); setTipValue('') }} style={{ flex:1, padding:'8px', fontSize:'11px', letterSpacing:'0.08em', textTransform:'uppercase', border:`1px solid ${tipMode === mode ? '#1a3a2a' : '#d4d4c8'}`, background: tipMode === mode ? '#e8f5ee' : 'transparent', color: tipMode === mode ? '#1a3a2a' : '#6a6a6a', cursor:'pointer', borderRadius:'6px', ...s }}>
                    {mode === 'percent' ? 'By %' : 'By $'}
                  </button>
                ))}
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                <span style={{ fontSize:'15px', color:'#9a9a8a' }}>{tipMode === 'percent' ? '%' : '$'}</span>
                <input type="text" inputMode="decimal" style={inputStyle} value={tipValue} onChange={e => { const v = e.target.value; if (v === '' || /^\d*\.?\d{0,2}$/.test(v)) setTipValue(v) }} placeholder={tipMode === 'percent' ? '0' : '0.00'} />
                {tipValue && <span style={{ fontSize:'13px', color:'#9a9a8a', flexShrink:0 }}>{tipMode === 'percent' ? `= $${getTipAmount().toFixed(2)}` : `= ${subtotal > 0 ? ((parseFloat(tipValue)/subtotal)*100).toFixed(1) : 0}%`}</span>}
              </div>
              <div style={{ display:'flex', gap:'6px' }}>
                {['15','18','20','22','25'].map(pct => (
                  <button key={pct} onClick={() => { setTipMode('percent'); setTipValue(pct) }} style={{ flex:1, padding:'6px 4px', fontSize:'11px', border:`1px solid ${tipMode === 'percent' && tipValue === pct ? '#1a3a2a' : '#d4d4c8'}`, background: tipMode === 'percent' && tipValue === pct ? '#e8f5ee' : 'transparent', color: tipMode === 'percent' && tipValue === pct ? '#1a3a2a' : '#6a6a6a', cursor:'pointer', borderRadius:'6px', ...s }}>
                    {pct}%
                  </button>
                ))}
              </div>
            </div>
            <div style={{ background:'#f5f5f0', borderRadius:'12px', padding:'16px', display:'flex', flexDirection:'column', gap:'6px' }}>
              {[['Subtotal', subtotal], ['Tax', taxAmt], ['Tip', tipAmt]].map(([l,v]) => (
                <div key={l as string} style={{ display:'flex', justifyContent:'space-between' }}>
                  <span style={{ fontSize:'12px', color:'#9a9a8a' }}>{l}</span>
                  <span style={{ fontSize:'12px', color:'#1a1a1a' }}>${(v as number).toFixed(2)}</span>
                </div>
              ))}
              <div style={{ display:'flex', justifyContent:'space-between', borderTop:'1px solid #e4e4d8', paddingTop:'8px', marginTop:'4px' }}>
                <span style={{ fontSize:'14px', fontWeight:500, color:'#1a1a1a' }}>Total</span>
                <span style={{ fontSize:'14px', fontWeight:500, color:'#1a1a1a' }}>${grandTotal.toFixed(2)}</span>
              </div>
            </div>
            <div>
              <label style={{ ...labelStyle, marginBottom:'10px' }}>Who paid the bill?</label>
              <div style={{ display:'flex', flexWrap:'wrap', gap:'8px' }}>
                {people.map(p => (
                  <button key={p.id} onClick={() => setPaidBy(p.id)} style={{ display:'flex', alignItems:'center', gap:'6px', padding:'8px 16px', fontSize:'12px', border:`1px solid ${paidBy === p.id ? '#1a3a2a' : '#d4d4c8'}`, background: paidBy === p.id ? '#e8f5ee' : 'transparent', color: paidBy === p.id ? '#1a3a2a' : '#6a6a6a', cursor:'pointer', borderRadius:'20px', ...s }}>
                    <div style={{ width:'14px', height:'14px', borderRadius:'50%', background:p.color }} />
                    {p.isMe ? 'You' : p.name}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={() => setStep('summary')} disabled={!paidBy} style={{ width:'100%', border:'1px solid #1a1a1a', padding:'14px', fontSize:'10px', letterSpacing:'0.25em', textTransform:'uppercase', color:'#1a1a1a', background:'transparent', cursor: paidBy ? 'pointer' : 'default', opacity: paidBy ? 1 : 0.4, ...s }}>
              See totals →
            </button>
          </div>
        )}

        {step === 'summary' && (
          <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
            <div>
              <p style={{ fontSize:'10px', letterSpacing:'0.25em', textTransform:'uppercase', color:'#9a9a8a', margin:'0 0 6px' }}>Summary</p>
              <h2 style={{ fontSize:'28px', fontWeight:300, color:'#1a1a1a', margin:0 }}>{receiptDesc || 'Expense'}</h2>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
              {people.map(p => {
                const total = personTotals[p.id] || 0
                const isPayer = p.id === paidBy
                const getsBack = isPayer ? grandTotal - total : 0
                return (
                  <div key={p.id} style={{ background:'#fff', border:'0.5px solid #e4e4d8', borderRadius:'12px', padding:'16px 18px' }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                        <div style={{ width:'34px', height:'34px', borderRadius:'50%', background:p.color, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:'13px', fontWeight:500, flexShrink:0 }}>
                          {p.name.charAt(0)}
                        </div>
                        <div>
                          <p style={{ fontSize:'14px', color:'#1a1a1a', margin:'0 0 2px', ...s }}>{p.isMe ? 'You' : p.name}</p>
                          <p style={{ fontSize:'11px', color:'#9a9a8a', margin:0 }}>
                            {isPayer ? `Paid · gets back $${getsBack.toFixed(2)}` : `Owes ${getName(paidBy)} $${total.toFixed(2)}`}
                          </p>
                        </div>
                      </div>
                      <span style={{ fontSize:'18px', fontWeight:300, color: isPayer ? '#34c759' : '#1a1a1a', ...s }}>
                        {isPayer ? `+$${getsBack.toFixed(2)}` : `$${total.toFixed(2)}`}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 18px', background:'#f5f5f0', borderRadius:'10px' }}>
              <span style={{ fontSize:'13px', color:'#9a9a8a' }}>Total</span>
              <span style={{ fontSize:'15px', fontWeight:500, color:'#1a1a1a' }}>${grandTotal.toFixed(2)} ✓</span>
            </div>
            <button onClick={finalizeReceiptExpense} style={{ width:'100%', border:'1px solid #1a3a2a', padding:'16px', fontSize:'10px', letterSpacing:'0.25em', textTransform:'uppercase', color:'#fafaf8', background:'#1a3a2a', cursor:'pointer', borderRadius:'8px', ...s }}>
              Submit expense →
            </button>
            <button onClick={() => setStep('finalize')} style={{ width:'100%', border:'0.5px solid #d4d4c8', padding:'14px', fontSize:'10px', letterSpacing:'0.25em', textTransform:'uppercase', color:'#9a9a8a', background:'transparent', cursor:'pointer', ...s }}>
              ← Edit tax & tip
            </button>
          </div>
        )}

        {step === 'manual' && (
          <div style={{ display:'flex', flexDirection:'column', gap:'20px' }}>
            <div>
              <p style={{ fontSize:'10px', letterSpacing:'0.25em', textTransform:'uppercase', color:'#9a9a8a', margin:'0 0 6px' }}>Manual expense</p>
              <h2 style={{ fontSize:'32px', fontWeight:300, color:'#1a1a1a', margin:0 }}>Add expense</h2>
            </div>
            <div>
              <label style={labelStyle}>Description</label>
              <input style={inputStyle} value={expenseDesc} onChange={e => setExpenseDesc(e.target.value)} placeholder="Dinner, Airbnb, Taxi..." autoFocus />
            </div>
            <div>
              <label style={labelStyle}>Amount</label>
              <div style={{ display:'flex', gap:'8px', alignItems:'flex-end' }}>
                <select value={manualCurrency} onChange={e => setManualCurrency(e.target.value)} style={{ borderBottom:'1px solid #d4d4c8', background:'transparent', padding:'8px 0', fontSize:'14px', color:'#1a1a1a', outline:'none', cursor:'pointer', appearance:'none' as const, minWidth:'60px', ...s }}>
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <input type="text" inputMode="decimal" style={{ ...inputStyle, flex:1 }} value={manualAmount} onChange={e => { const v = e.target.value; if (v === '' || /^\d*\.?\d{0,2}$/.test(v)) setManualAmount(v) }} placeholder="0.00" />
              </div>
              {manualCurrency !== 'USD' && manualAmount && parseFloat(manualAmount) > 0 && (
                <p style={{ fontSize:'11px', color:'#9a9a8a', margin:'6px 0 0', fontStyle:'italic' }}>Will convert to USD at current rate on save</p>
              )}
            </div>
            <div>
              <label style={labelStyle}>Paid by</label>
              <div style={{ display:'flex', flexWrap:'wrap', gap:'8px' }}>
                {people.map(p => (
                  <button key={p.id} onClick={() => setPaidBy(p.id)} style={{ display:'flex', alignItems:'center', gap:'6px', padding:'7px 14px', fontSize:'12px', border:`1px solid ${paidBy === p.id ? '#1a3a2a' : '#d4d4c8'}`, background: paidBy === p.id ? '#e8f5ee' : 'transparent', color: paidBy === p.id ? '#1a3a2a' : '#6a6a6a', cursor:'pointer', borderRadius:'20px', ...s }}>
                    <div style={{ width:'12px', height:'12px', borderRadius:'50%', background:p.color }} />
                    {p.isMe ? 'You' : p.name}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={labelStyle}>Split</label>
              <div style={{ display:'flex', gap:'6px', marginBottom:'14px' }}>
                {[{v:'equal',l:'Equally'},{v:'byAmount',l:'By $'},{v:'byPercent',l:'By %'},{v:'byShares',l:'Shares'}].map(opt => (
                  <button key={opt.v} onClick={() => setSplitType(opt.v as 'equal'|'byAmount'|'byPercent'|'byShares')} style={{ flex:1, padding:'8px 4px', fontSize:'10px', letterSpacing:'0.05em', textTransform:'uppercase', border:`1px solid ${splitType === opt.v ? '#1a3a2a' : '#d4d4c8'}`, background: splitType === opt.v ? '#e8f5ee' : 'transparent', color: splitType === opt.v ? '#1a3a2a' : '#6a6a6a', cursor:'pointer', borderRadius:'6px', ...s }}>
                    {opt.l}
                  </button>
                ))}
              </div>
              {splitType === 'equal' && (
                <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                  {people.map(p => (
                    <button key={p.id} onClick={() => setSelectedForEqual(s => s.includes(p.id) ? s.filter(x => x !== p.id) : [...s, p.id])} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px', border:`1px solid ${selectedForEqual.includes(p.id) ? '#1a3a2a' : '#e4e4d8'}`, background: selectedForEqual.includes(p.id) ? '#e8f5ee' : 'transparent', borderRadius:'8px', cursor:'pointer', ...s }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                        <div style={{ width:'24px', height:'24px', borderRadius:'50%', background:p.color, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:'11px' }}>{p.name.charAt(0)}</div>
                        <span style={{ fontSize:'13px', color:'#1a1a1a' }}>{p.isMe ? 'You' : p.name}</span>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                        {selectedForEqual.includes(p.id) && manualAmount && <span style={{ fontSize:'12px', color:'#9a9a8a' }}>${(parseFloat(manualAmount||'0')/selectedForEqual.length).toFixed(2)}</span>}
                        <div style={{ width:'18px', height:'18px', borderRadius:'50%', border:`2px solid ${selectedForEqual.includes(p.id) ? '#2d6a4f' : '#d4d4c8'}`, background: selectedForEqual.includes(p.id) ? '#2d6a4f' : 'transparent', display:'flex', alignItems:'center', justifyContent:'center' }}>
                          {selectedForEqual.includes(p.id) && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                        </div>
                      </div>
                    </button>
                  ))}
                  {selectedForEqual.length > 0 && manualAmount && <p style={{ fontSize:'12px', color:'#9a9a8a', textAlign:'center', margin:'4px 0 0' }}>${(parseFloat(manualAmount)/selectedForEqual.length).toFixed(2)}/person ({selectedForEqual.length} people)</p>}
                </div>
              )}
              {(splitType === 'byAmount' || splitType === 'byPercent' || splitType === 'byShares') && (
                <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                  {people.map(p => (
                    <div key={p.id} style={{ display:'flex', alignItems:'center', gap:'12px', padding:'10px 14px', border:'0.5px solid #e4e4d8', borderRadius:'8px', background:'#fff' }}>
                      <div style={{ width:'24px', height:'24px', borderRadius:'50%', background:p.color, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:'11px', flexShrink:0 }}>{p.name.charAt(0)}</div>
                      <span style={{ flex:1, fontSize:'13px', color:'#1a1a1a' }}>{p.isMe ? 'You' : p.name}</span>
                      <div style={{ display:'flex', alignItems:'center', gap:'4px' }}>
                        <span style={{ fontSize:'13px', color:'#9a9a8a' }}>{splitType === 'byPercent' ? '%' : splitType === 'byShares' ? '' : '$'}</span>
                        <input type="text" inputMode="decimal" value={customSplits[p.id] || ''} onChange={e => { const v = e.target.value; if (v === '' || /^\d*\.?\d{0,2}$/.test(v)) setCustomSplits(s => ({...s, [p.id]: v})) }} style={{ width:'70px', borderBottom:'1px solid #d4d4c8', background:'transparent', padding:'4px 0', fontSize:'14px', color:'#1a1a1a', outline:'none', textAlign:'right', ...s }} placeholder="0" />
                        {splitType === 'byShares' && <span style={{ fontSize:'13px', color:'#9a9a8a' }}>shares</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button onClick={finalizeManualExpense} disabled={!expenseDesc || !manualAmount || !paidBy} style={{ width:'100%', border:'1px solid #1a1a1a', padding:'14px', fontSize:'10px', letterSpacing:'0.2em', textTransform:'uppercase', color:'#1a1a1a', background:'transparent', cursor:'pointer', opacity: expenseDesc && manualAmount && paidBy ? 1 : 0.4, ...s }}>
              {manualCurrency !== 'USD' ? 'Convert & add expense →' : 'Add expense →'}
            </button>
          </div>
        )}

        {step === 'home' && (
          <div style={{ position:'fixed', bottom:'32px', right:'24px' }}>
            <button onClick={() => setStep('choose')} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'14px 22px', background:'#1a3a2a', border:'none', color:'#fff', fontSize:'12px', letterSpacing:'0.1em', textTransform:'uppercase', cursor:'pointer', borderRadius:'30px', boxShadow:'0 4px 20px rgba(26,58,42,0.35)', ...s }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add expense
            </button>
          </div>
        )}
      </div>
    </main>
  )
}
