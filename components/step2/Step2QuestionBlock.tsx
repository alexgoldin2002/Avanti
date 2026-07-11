import type { ReactNode } from 'react'

export default function Step2QuestionBlock({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-3.5 items-start mb-4">
      <div className="w-10 h-10 rounded-full bg-forest-deep shrink-0 mt-0.5" aria-hidden />
      <p className="font-serif text-base sm:text-[17px] text-foreground leading-[1.65] m-0 flex-1 min-w-0">
        {children}
      </p>
    </div>
  )
}
