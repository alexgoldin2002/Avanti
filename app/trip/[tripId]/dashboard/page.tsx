'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
export default function Dashboard() {
  const params = useParams()
  const tripId = params.tripId as string
  const [trip, setTrip] = useState<any>(null)
  const [travelers, setTravelers] = useState<any[]>([])
  const [itinerary, setItinerary] = useState<any>(null)
  const [generating, setGenerating] = useState(false)
  const [activeDay, setActiveDay] = useState(0)
  useEffect(() => {
    const load = async () => {
      const { data: tripData } = await supabase.from('trips').select('*').eq('id', tripId).single()
      const { data: travelerData } = await supabase.from('travelers').select('*').eq('trip_id', tripId)
      const { data: itinData } = await supabase.from('itineraries').select('*').eq('trip_id', tripId).maybeSingle()
      if (tripData) setTrip(tripData)
      if (travelerData) setTravelers(travelerData)
      if (itinData?.content) setItinerary(itinData.content)
    }
    load()
  }, [tripId])
  const generateItinerary = async () => {
    setGenerating(true)
    try {
      const res = await fetch('/api/itinerary', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ trip, travelers }) })
      const { itinerary: itin } = await res.json()
      setItinerary(itin)
      await supabase.from('itineraries').upsert({ trip_id: tripId, content: itin, generated_at: new Date().toISOString() })
    } catch (e) { alert('Error generating itinerary. Check your API key.') }
    setGenerating(false)
  }
  if (!trip) return <div className="min-h-screen bg-stone-50 flex items-center justify-center"><p className="text-stone-400 text-sm">Loading...</p></div>
  const inviteUrl = typeof window !== 'undefined' ? `${window.location.origin}/join/${trip.invite_code}` : ''
  return (
    <main className="min-h-screen bg-stone-50">
      <div className="max-w-2xl mx-auto p-6">
        <div className="flex items-center justify-between mb-8"><div><h1 className="text-2xl font-medium text-stone-900">{trip.name}</h1><p className="text-stone-400 text-sm">{trip.destination} · {trip.start_date} to {trip.end_date}</p></div><span className="text-xs font-medium text-stone-900">avanti</span></div>
        <div className="bg-white rounded-2xl border border-stone-200 p-5 mb-4"><p className="text-xs font-medium text-stone-400 uppercase tracking-widest mb-3">Invite your group</p><div className="flex gap-2"><input readOnly value={inviteUrl} className="flex-1 border border-stone-200 rounded-lg px-3 py-2 text-xs text-stone-600 bg-stone-50" /><button onClick={() => navigator.clipboard.writeText(inviteUrl)} className="px-4 py-2 bg-stone-900 text-white rounded-lg text-xs font-medium">Copy</button></div><p className="text-xs text-stone-400 mt-2">{travelers.length} traveler{travelers.length !== 1 ? 's' : ''} joined · {travelers.filter(t => t.profile_complete).length} profiles complete</p></div>
        {!itinerary ? (
          <div className="bg-white rounded-2xl border border-stone-200 p-8 text-center">
            <div className="w-12 h-12 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-4"><span className="text-xl">✦</span></div>
            <p className="text-stone-900 font-medium mb-2">Ready to build your itinerary</p>
            <p className="text-stone-400 text-sm mb-6">Avanti will generate a day-by-day plan based on your group preferences.</p>
            <button onClick={generateItinerary} disabled={generating} className="bg-stone-900 text-white rounded-lg px-6 py-3 text-sm font-medium disabled:opacity-50 hover:bg-stone-700 transition-colors">{generating ? 'Avanti is planning your trip...' : 'Generate itinerary →'}</button>
          </div>
        ) : (
          <div>
            <div className="bg-white rounded-2xl border border-stone-200 p-5 mb-4"><p className="text-sm text-stone-600 italic">{itinerary.summary}</p></div>
            <div className="flex gap-2 overflow-x-auto pb-2 mb-4">{itinerary.days?.map((day: any, i: number) => (<button key={i} onClick={() => setActiveDay(i)} className={`flex-shrink-0 px-4 py-2 rounded-xl text-xs font-medium border transition-all ${activeDay === i ? 'bg-stone-900 text-white border-stone-900' : 'bg-white border-stone-200 text-stone-600'}`}>{new Date(day.date + 'T12:00:00').toLocaleDateString('en-US', {month: 'short', day: 'numeric'})}</button>))}</div>
            {itinerary.days?.[activeDay] && (
              <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
                <div className="p-5 border-b border-stone-100"><p className="font-medium text-stone-900">{itinerary.days[activeDay].title}</p><p className="text-xs text-stone-400 mt-1">{itinerary.days[activeDay].date}</p></div>
                {itinerary.days[activeDay].morning_briefing && <div className="px-5 py-3 bg-amber-50 border-b border-amber-100"><p className="text-xs font-medium text-amber-700 mb-1">Morning briefing</p><p className="text-xs text-amber-600">{itinerary.days[activeDay].morning_briefing}</p></div>}
                <div className="divide-y divide-stone-50">{itinerary.days[activeDay].items?.map((item: any, j: number) => (<div key={j} className="flex gap-4 px-5 py-4"><span className="text-xs text-stone-400 min-w-[52px] pt-0.5">{item.time}</span><div className="flex-1"><p className="text-sm font-medium text-stone-900">{item.name}</p><p className="text-xs text-stone-400 mt-0.5 leading-relaxed">{item.detail}</p></div><span className={`text-xs px-2 py-1 rounded-full h-fit ${item.type === 'food' ? 'bg-orange-50 text-orange-600' : item.type === 'activity' ? 'bg-blue-50 text-blue-600' : item.type === 'transport' ? 'bg-purple-50 text-purple-600' : 'bg-stone-100 text-stone-500'}`}>{item.type}</span></div>))}</div>
                {itinerary.days[activeDay].evening_note && <div className="px-5 py-3 bg-purple-50 border-t border-purple-100"><p className="text-xs font-medium text-purple-700 mb-1">Tonight</p><p className="text-xs text-purple-600">{itinerary.days[activeDay].evening_note}</p></div>}
              </div>
            )}
            <button onClick={generateItinerary} disabled={generating} className="w-full mt-4 border border-stone-200 text-stone-600 rounded-xl py-3 text-sm hover:bg-stone-50 transition-colors disabled:opacity-50">{generating ? 'Regenerating...' : '↻ Regenerate itinerary'}</button>
          </div>
        )}
      </div>
    </main>
  )
}
