'use client'
import Link from 'next/link'
import type { ReactNode } from 'react'

type Differentiator = {
  number: string
  title: string
  description: ReactNode
}

const differentiators: Differentiator[] = [
  {
    number: '01',
    title: 'Not another AI chat',
    description: (
      <>
        Ask ChatGPT for ideas and you get a list. Avanti is built for travel decisions — programmed to weigh dozens of factors
        most people never think to ask about. You may not see that work because we&apos;ve already done it.{' '}
        <Link
          href="/why-us/considerations/destinations"
          className="text-forest-deep underline underline-offset-2 decoration-forest-deep/30 hover:opacity-70 transition-opacity"
        >
          See everything we consider when finding a destination
        </Link>
        {' '}— so you don&apos;t have to.
      </>
    ),
  },
  {
    number: '02',
    title: 'Everything in one place',
    description:
      'No travel agent, booking app, spreadsheet, or group chat does the whole job. Avanti connects preferences, destination research, group voting, bookings, and day-of logistics in a single flow. No copy-pasting between tools. No lost threads. One trip, one home.',
  },
  {
    number: '03',
    title: 'Built for groups, not solo travelers',
    description:
      'Most travel tools assume one person decides. Avanti collects everyone\'s input — departure city, dates, documents, priorities — runs structured votes, and moves decisions forward without making anyone the bad guy.',
  },
  {
    number: '04',
    title: 'Thinks ahead of you',
    description:
      'Hidden airline credits. Status benefits you\'re not using. The real cost of that "cheap" flight. Whether six people can actually make those dates work. Avanti surfaces what you didn\'t know to ask — and flags what you didn\'t know to worry about.',
  },
  {
    number: '05',
    title: 'Does the work, not just the research',
    description:
      'Avanti doesn\'t stop at ideas. It narrows options, gets your group aligned, and keeps building — accommodation, activities, dining — until the trip is actually planned. You just show up.',
  },
]

export default function WhyUs() {
  return (
    <>
      <p className="eyebrow text-muted-foreground mb-3">Why us?</p>
      <h1 className="font-serif text-4xl sm:text-5xl font-light text-foreground mb-4 leading-tight">
        More than a chatbot. More than a travel agent.
      </h1>
      <p className="text-base text-muted-foreground mb-16 leading-relaxed max-w-xl">
        Regular AI gives you suggestions. A travel agent handles one booking at a time. Avanti is the only thing that thinks through your whole trip — with your whole group — and keeps building until you&apos;re wheels up.
      </p>

      <div className="flex flex-col">
        {differentiators.map((item) => (
          <div
            key={item.number}
            className="relative ml-5 pl-8 pb-10 border-l border-forest-deep/15 last:border-l-0 last:pb-0 group"
          >
            <div className="absolute -left-5 top-0 grid h-10 w-10 place-items-center rounded-none bg-forest-deep text-cream avanti-box transition-transform duration-200 group-hover:scale-105">
              <span className="font-serif text-sm">{item.number}</span>
            </div>
            <div className="pt-1">
              <h3 className="font-serif text-xl text-foreground mb-2">{item.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="avanti-box mt-12 rounded-none bg-forest-deep text-cream border-forest-deep px-8 py-10 text-center">
        <h2 className="font-serif text-2xl sm:text-3xl font-light mb-3">Ready to plan your next trip?</h2>
        <p className="text-sm text-cream/70 mb-6">Free during beta. No credit card required.</p>
        <Link href="/" className="avanti-btn-primary inline-block no-underline hover:-translate-y-px transition-transform">
          Get started →
        </Link>
      </div>
    </>
  )
}
