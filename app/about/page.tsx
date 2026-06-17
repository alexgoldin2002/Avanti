'use client'

export default function About() {
  const paragraphs = [
    'Too many people. Too many opinions. Too many moving parts. And somehow it all lands on one person.',
    'Avanti handles the hard parts. The decisions nobody wants to finalize. The back-and-forth. The money, the logistics. The nudging people to voice an opinion or fill out their information and vote. The reminding. The tracking. And everything in between.',
    'And for everyone in the group — whether you\'re the one who checks every detail or the one who says "I\'m honestly up for anything" — Avanti makes sure you have exactly as much say as you want. No more, no less.',
    'When it\'s time to decide, Avanti makes the call. So nobody has to be the bad guy.',
    'At the same time, Avanti is finding everything you didn\'t know to look for. The hidden benefits. The smarter route. The better hotel. The trip that\'s more enjoyable, more affordable, and more you — than anything the group chat could have figured out on its own.',
    'You can have a better trip than you think you can. Avanti makes sure of it.',
  ]

  return (
    <>
      <p className="eyebrow text-muted-foreground mb-3">Our story</p>
      <h1 className="font-serif text-4xl sm:text-5xl font-light text-foreground mb-8 leading-tight">
        Group travel is an absolute nightmare.
      </h1>

      <div className="flex flex-col gap-6 mb-16">
        {paragraphs.map(text => (
          <p key={text.slice(0, 24)} className="text-base text-foreground/85 leading-relaxed">{text}</p>
        ))}
        <p className="font-serif italic text-lg text-forest-deep leading-relaxed">
          The trip everyone wanted. The planning nobody did.
        </p>
      </div>

      <div className="avanti-box rounded-none border border-border bg-forest-mist px-6 py-5">
        <div className="flex items-center gap-2">
          <span className="font-serif text-xl text-foreground">Alexandra Goldin</span>
          <a href="https://www.linkedin.com/in/alexandragoldin" target="_blank" rel="noopener noreferrer" className="opacity-60 hover:opacity-100 transition-opacity">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-muted-foreground">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
            </svg>
          </a>
        </div>
        <p className="text-xs text-muted-foreground mt-1 tracking-wide font-serif">UMich &apos;26</p>
      </div>
    </>
  )
}
