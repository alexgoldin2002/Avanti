export type ConsiderationSection = {
  title: string
  items: string[]
}

/** Everything Avanti weighs when recommending or comparing destinations. */
export const DESTINATION_CONSIDERATIONS: ConsiderationSection[] = [
  {
    title: 'Hard constraints & deal-breakers',
    items: [
      'Stated deal-breakers treated as filters — long flights, extreme heat or cold, crowds, visa hassle, safety concerns, or anything you explicitly ruled out',
      'Budget ceiling — total trip cost including flights, lodging, food, and activities must fit what the group can spend',
      'Trip purpose — vacation, honeymoon, family, adventure, digital nomad, cultural, or closest fit inferred from your story',
      'Domestic vs. international scope and regions you are open to',
      'Popularity preference — well-known icons vs. under-the-radar picks',
      'Unusual local laws that could affect your group — alcohol restrictions, dress enforcement, photography taboos',
    ],
  },
  {
    title: 'Budget & true cost',
    items: [
      'Estimated total per person — flights, lodging, food, and activities in USD',
      'What share of budget goes to getting there vs. being there — a cheap destination with expensive flights is not always the best value',
      'Daily expense tier — luxury, mid-range, or budget — matched to your stated budget',
      'Hidden costs flagged honestly — transport from a cheap hotel to where you actually go out, resort fees, tourist taxes',
      'Peak-season price spikes and availability-driven surges during your dates',
      'Multi-stop combined cost — cheapest pairing vs. splurge-and-balance pairing strategies',
    ],
  },
  {
    title: 'Flights & logistics',
    items: [
      'Routing from each departure city in the group — not just one person\'s airport',
      'Total travel time and layovers — direct vs. one-stop vs. multi-segment',
      'Days on the ground vs. days in transit — especially for short trips where long-haul eats the itinerary',
      'Long-haul fit — for trips of 7 nights or fewer, destinations within ~8 hours each way are preferred unless you explicitly chose that region',
      'Ferry, train, and inter-city connections for multi-stop routes',
      'Visa and entry requirements for every passport in the group',
      'Sub-group routing when travelers depart from different cities',
      'Group fare opportunities when 9+ travelers qualify',
      'Credit card benefits across the group — free bags, lounge access, travel credits',
    ],
  },
  {
    title: 'Weather & timing',
    items: [
      'Actual forecast for your specific travel dates — temperatures in °F, rain, humidity, night temps',
      'Rainy season, monsoon, or extreme heat during your exact window',
      'Hurricane, flood, or disaster risk — only flagged when there is a real threat during your dates',
      'Major festivals, events, religious holidays, or government holidays that change crowds, prices, or availability — as a risk or as a bonus',
      'Shoulder vs. peak season tradeoffs for your window',
    ],
  },
  {
    title: 'Experience & activities',
    items: [
      'Beach and water, mountains and nature, food scene, nightlife, relaxation and wellness — scored against what you asked for',
      'Whether the destination has enough to do for the number of nights you have — honest if a place needs more time than you allocated',
      'Named, specific activities — neighborhoods, landmarks, markets, trails — not generic "explore local culture"',
      'Touristy and easy vs. off-the-beaten-path — matched to your vibe and comfort level',
      'Insider picks — places locals love that most tourists skip, with an honest tradeoff',
      'Unique selling point — the one thing each destination does better than the alternatives on your list',
    ],
  },
  {
    title: 'Group fit',
    items: [
      'Group size — accommodation availability and organized activities for your headcount',
      'Trip type — couples, bachelorette, family reunion, friends trip, and whether the destination caters to it',
      'Vibe and pace — upscale-casual, party energy, slow wellness, adventure-forward',
      'Accommodation style preference from your inputs',
      'Whether everyone\'s date windows actually overlap — not just the organizer\'s',
      'What each traveler would gain vs. give up in each option',
    ],
  },
  {
    title: 'Safety & entry',
    items: [
      'Safety assessment for your traveler profile — identity, gender, sexuality, religion, ethnicity, nationality',
      'Political stability and geopolitical risk',
      'Health and travel advisories when relevant',
      'Entry documentation and passport validity requirements',
    ],
  },
  {
    title: 'Cultural & local context',
    items: [
      'Alcohol accessibility and local drinking customs',
      'Dress codes, tipping norms, and social expectations',
      'Language barrier severity for your group',
      'Overtourism hotspots and crowd pressure during your dates',
      'Ethical tourism — exploitative animal experiences, cultural sites that require respectful behavior',
      'Local sensitivities that could affect how comfortable your group feels',
    ],
  },
  {
    title: 'Trip shape & multi-stop routes',
    items: [
      'One base vs. two stops vs. three stops — inferred from your dates and preference',
      'Whether your trip length supports multiple bases without feeling rushed — short trips favor one base; ~6–9 nights often suit two; ~21+ can support three',
      'Travel simplicity pairings — easiest routing, direct flights, minimal connections',
      'Budget pairings — cheapest combined route vs. splurge destination balanced with a value stop',
      'Activity and vibe pairings — complementary contrast, not redundant sameness',
      'Cross-country pairings when routing is practical — not limited to one country',
      'Night split across stops and transit time between them',
      'Absurd geography skipped — no back-to-back antipodes with no logical routing',
    ],
  },
  {
    title: 'Scoring & comparison',
    items: [
      'Weighted matrix across budget fit (~25%), weather (~15%), logistics (~20%), experience quality (~25%), and must-have / deal-breaker compliance (~15%)',
      'Every stated deal-breaker heavily penalized in the score',
      'Honest tradeoff on every option — the biggest downside for your group, not softened',
      'Side-by-side comparison when you bring a list of places you are already considering',
      'Recommended stop count and top pick with reasoning — not just a ranked list',
    ],
  },
]

export const UPCOMING_CONSIDERATION_PHASES = [
  'Booking flights & ground transport',
  'Choosing accommodation',
  'Planning activities & dining',
]
