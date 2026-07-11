'use client'
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { PLACEHOLDERS } from '@/lib/form-placeholders'
const VIBES = [
  { group: 'Evenings', options: ['Aperitivo in a piazza', 'Dinner that goes late', 'Bar-hopping', 'Clubbing / dancing', 'Rooftop drinks at sunset'] },
  { group: 'Beaches', options: ['Lounging with a book', 'Beach club scene', 'Boat days', 'Swimming & snorkeling', 'Water sports'] },
  { group: 'Food', options: ['Long dinners good wine', 'Local holes in the wall', 'Gelato and wandering', 'Food markets', 'Fine dining splurge'] },
  { group: 'Exploring', options: ['Wandering without a plan', 'Golden hour photo spots', 'Museums and history', 'Getting lost in old towns', 'Shopping'] },
]
const CARDS = ['Chase Sapphire', 'Amex Platinum', 'United Explorer', 'Delta SkyMiles', 'Capital One Venture', 'Other']
export default function ProfilePage() {
  const router = useRouter()
  const params = useParams()
  const tripId = params.tripId as string
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [travelerId, setTravelerId] = useState<string | null>(null)
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', date_of_birth: '', passport_number: '', passport_expiry: '', nationality: 'United States', departure_city: '', budget_per_day: 200, accommodation_preference: 'either', dietary_restrictions: '', credit_cards: [] as string[], vibes: [] as string[], budget_categories: { hotel: 100, dinner: 60, boat: 120, activities: 50, beach_club: 50 } })
  useEffect(() => {
    const fetchTraveler = async () => {
      const { data } = await supabase.from('travelers').select('*').eq('trip_id', tripId).order('created_at', { ascending: true }).limit(1).single()
      if (data) { setTravelerId(data.id); setForm(f => ({...f, full_name: data.full_name || '', email: data.email || ''})) }
    }
    fetchTraveler()
  }, [tripId])
  const toggleVibe = (vibe: string) => setForm(f => ({...f, vibes: f.vibes.includes(vibe) ? f.vibes.filter(v => v !== vibe) : [...f.vibes, vibe]}))
  const toggleCard = (card: string) => setForm(f => ({...f, credit_cards: f.credit_cards.includes(card) ? f.credit_cards.filter(c => c !== card) : [...f.credit_cards, card]}))
  const handleFinish = async () => {
    setLoading(true)
    if (travelerId) await supabase.from('travelers').update({...form, profile_complete: true}).eq('id', travelerId)
    router.push(`/trip/${tripId}/dashboard`)
  }
  return (
    <main className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-medium text-stone-900 mb-1">avanti</h1>
          <p className="text-stone-400 text-xs">Step {step} of 4</p>
          <div className="flex gap-1.5 justify-center mt-3">{Array.from({length: 4}).map((_, i) => (<div key={i} className={`h-1 rounded-full transition-all ${i < step ? 'bg-stone-900 w-6' : 'bg-stone-200 w-4'}`} />))}</div>
        </div>
        <div className="bg-white rounded-2xl border border-stone-200 p-8">
          {step === 1 && (<div className="space-y-4"><p className="text-base font-medium text-stone-900">Your documents</p><p className="text-xs text-stone-400 mb-4">Needed for transfers and bookings. Private and encrypted.</p>{[{label:'Full legal name',key:'full_name',placeholder:PLACEHOLDERS.fullName},{label:'Email',key:'email',placeholder:PLACEHOLDERS.email},{label:'Phone',key:'phone',placeholder:PLACEHOLDERS.phone},{label:'Date of birth',key:'date_of_birth',placeholder:'MM/DD/YYYY'},{label:'Passport number',key:'passport_number',placeholder:PLACEHOLDERS.passport},{label:'Passport expiry',key:'passport_expiry',placeholder:'MM/YYYY'},{label:'Departure city',key:'departure_city',placeholder:PLACEHOLDERS.eventLocation}].map(field => (<div key={field.key} className="mb-3"><label className="text-xs text-stone-500 mb-1 block">{field.label}</label><input type="text" placeholder={field.placeholder} value={(form as any)[field.key]} onChange={e => setForm({...form, [field.key]: e.target.value})} className="w-full border border-stone-200 rounded-lg px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-300 focus:outline-none focus:border-stone-400" /></div>))}<button onClick={() => setStep(2)} className="w-full bg-stone-900 text-white rounded-lg py-3 text-sm font-medium">Continue →</button></div>)}
          {step === 2 && (<div className="space-y-4"><p className="text-base font-medium text-stone-900">Your travel style</p><p className="text-xs text-stone-400 mb-4">Avanti uses this to plan your trip.</p><div><label className="text-xs text-stone-500 mb-2 block">Daily budget per person</label><div className="flex items-center gap-3"><input type="range" min="50" max="500" step="10" value={form.budget_per_day} onChange={e => setForm({...form, budget_per_day: parseInt(e.target.value)})} className="flex-1" /><span className="text-sm font-medium text-stone-900 min-w-[48px]">€{form.budget_per_day}</span></div></div><div><label className="text-xs text-stone-500 mb-2 block">Accommodation preference</label><div className="flex gap-2">{['Hotel','Airbnb','Either'].map(opt => (<button key={opt} onClick={() => setForm({...form, accommodation_preference: opt.toLowerCase()})} className={`flex-1 py-2 rounded-lg text-sm border transition-all ${form.accommodation_preference === opt.toLowerCase() ? 'bg-stone-900 text-white border-stone-900' : 'border-stone-200 text-stone-600'}`}>{opt}</button>))}</div></div><div><label className="text-xs text-stone-500 mb-2 block">Dietary restrictions / allergies</label><input type="text" placeholder="e.g. shellfish, nuts..." value={form.dietary_restrictions} onChange={e => setForm({...form, dietary_restrictions: e.target.value})} className="w-full border border-stone-200 rounded-lg px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-300 focus:outline-none focus:border-stone-400" /></div><div><label className="text-xs text-stone-500 mb-2 block">Credit cards</label><div className="flex flex-wrap gap-2">{CARDS.map(card => (<button key={card} onClick={() => toggleCard(card)} className={`px-3 py-1.5 rounded-full text-xs border transition-all ${form.credit_cards.includes(card) ? 'bg-stone-900 text-white border-stone-900' : 'border-stone-200 text-stone-600'}`}>{card}</button>))}</div></div><div className="flex gap-3 pt-2"><button onClick={() => setStep(1)} className="flex-1 border border-stone-200 text-stone-600 rounded-lg py-3 text-sm">← Back</button><button onClick={() => setStep(3)} className="flex-1 bg-stone-900 text-white rounded-lg py-3 text-sm font-medium">Continue →</button></div></div>)}
          {step === 3 && (<div className="space-y-4"><p className="text-base font-medium text-stone-900">What is your vibe?</p><p className="text-xs text-stone-400 mb-4">Tap everything that sounds like you.</p>{VIBES.map(group => (<div key={group.group} className="mb-3"><p className="text-xs font-medium text-stone-400 uppercase tracking-widest mb-2">{group.group}</p><div className="flex flex-wrap gap-2">{group.options.map(vibe => (<button key={vibe} onClick={() => toggleVibe(vibe)} className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${form.vibes.includes(vibe) ? 'bg-stone-900 text-white border-stone-900' : 'border-stone-200 text-stone-600'}`}>{vibe}</button>))}</div></div>))}<div className="flex gap-3 pt-2"><button onClick={() => setStep(2)} className="flex-1 border border-stone-200 text-stone-600 rounded-lg py-3 text-sm">← Back</button><button onClick={() => setStep(4)} className="flex-1 bg-stone-900 text-white rounded-lg py-3 text-sm font-medium">Continue →</button></div></div>)}
          {step === 4 && (<div className="space-y-4"><p className="text-base font-medium text-stone-900">Your spending comfort</p><p className="text-xs text-stone-400 mb-4">Set a ceiling per category.</p>{[{key:'hotel',label:'Hotel per night',max:400},{key:'dinner',label:'Dinner out',max:200},{key:'boat',label:'Boat day',max:300},{key:'activities',label:'Per activity',max:200},{key:'beach_club',label:'Beach club min spend',max:150}].map(item => (<div key={item.key} className="mb-3"><div className="flex justify-between mb-1"><label className="text-xs text-stone-500">{item.label}</label><span className="text-xs font-medium text-stone-900">€{(form.budget_categories as any)[item.key]}</span></div><input type="range" min="0" max={item.max} step="5" value={(form.budget_categories as any)[item.key]} onChange={e => setForm({...form, budget_categories: {...form.budget_categories, [item.key]: parseInt(e.target.value)}})} className="w-full" /></div>))}<div className="flex gap-3 pt-2"><button onClick={() => setStep(3)} className="flex-1 border border-stone-200 text-stone-600 rounded-lg py-3 text-sm">← Back</button><button onClick={handleFinish} disabled={loading} className="flex-1 bg-stone-900 text-white rounded-lg py-3 text-sm font-medium disabled:opacity-50">{loading ? 'Saving...' : 'Build my itinerary →'}</button></div></div>)}
        </div>
      </div>
    </main>
  )
}
