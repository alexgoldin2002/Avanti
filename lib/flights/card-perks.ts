/** Known bag/lounge perks by card name — used in AI prompt context, not legal advice. */
export const CARD_FLIGHT_PERKS: Record<string, string[]> = {
  'Amex Platinum': ['$200 airline fee credit', 'Clear credit', 'Centurion lounge access'],
  'Amex Gold': ['$120 Uber credit', 'No checked bag credit'],
  'Chase Sapphire Reserve': ['$300 travel credit', 'Priority Pass'],
  'Chase Sapphire Preferred': ['Trip delay insurance', 'No free bags'],
  'Capital One Venture X': ['$300 travel credit', 'Priority Pass', '2 lounge visits'],
  'United Club Infinite': ['United Club access', '2 checked bags on United'],
  'United Explorer': ['1st checked bag free on United', 'Priority boarding'],
  'Delta SkyMiles Reserve': ['Delta Sky Club access', 'Companion certificate'],
  'Delta SkyMiles Platinum': ['Companion certificate', '1st bag free on Delta'],
  'Delta SkyMiles Gold': ['1st bag free on Delta'],
  'Citi AAdvantage Executive': ['Admirals Club access', '1st bag free on AA'],
  'Citi AAdvantage Platinum': ['1st bag free on AA', 'Preferred boarding'],
}

export function perksForCards(cards: string[]): string[] {
  const out: string[] = []
  for (const c of cards) {
    const perks = CARD_FLIGHT_PERKS[c]
    if (perks) out.push(`${c}: ${perks.join('; ')}`)
  }
  return out
}

export function statusPerks(airline: string, tier: string): string[] {
  if (!airline || tier === 'Member') return []
  return [`${airline} ${tier} — priority boarding, extra bags possible, upgrade space varies`]
}
