'use client'

type Step = {
  title: string
  body: React.ReactNode
  confirmLabel: string
}

export default function DangerConfirmModal({
  steps,
  stepIndex,
  onCancel,
  onContinue,
  processing,
}: {
  steps: Step[]
  stepIndex: number
  onCancel: () => void
  onContinue: () => void
  processing?: boolean
}) {
  const step = steps[stepIndex]
  if (!step) return null

  const isFinal = stepIndex === steps.length - 1

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="danger-modal-title"
    >
      <div className="avanti-box w-full max-w-md rounded-none border border-border bg-cream px-7 py-8">
        <p className="eyebrow mb-2 text-destructive">Warning</p>
        <h2 id="danger-modal-title" className="font-serif text-2xl font-light text-foreground mb-4">
          {step.title}
        </h2>
        <div className="text-sm leading-relaxed text-muted-foreground font-serif italic mb-8">
          {step.body}
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={processing}
            className="avanti-btn-ghost flex-1 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onContinue}
            disabled={processing}
            className="flex-1 rounded-none border border-destructive bg-transparent px-4 py-3 text-[10px] tracking-[0.2em] uppercase text-destructive transition-colors hover:bg-destructive hover:text-white disabled:opacity-50"
          >
            {processing ? 'Please wait...' : step.confirmLabel}
          </button>
        </div>
        {!isFinal && (
          <p className="mt-4 text-center text-[10px] tracking-[0.12em] uppercase text-muted-foreground/70">
            Step {stepIndex + 1} of {steps.length}
          </p>
        )}
      </div>
    </div>
  )
}
