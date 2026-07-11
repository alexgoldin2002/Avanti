'use client'

type ChatMessage = { role: 'user' | 'assistant'; content: string }

type Step2ChatBarProps = {
  chatInput: string
  onChatInputChange: (value: string) => void
  onSend: () => void
  chatLoading: boolean
  chatMessages: ChatMessage[]
  onRefreshChat: () => void
  refreshingChat: boolean
}

export default function Step2ChatBar({
  chatInput,
  onChatInputChange,
  onSend,
  chatLoading,
  chatMessages,
  onRefreshChat,
  refreshingChat,
}: Step2ChatBarProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-[#f5f4f0] border-t border-border/40 px-6 py-4 sm:py-5 z-50">
      <div className="max-w-xl mx-auto">
        {(chatMessages.length > 0 || chatLoading) && (
          <div className="flex justify-end mb-2">
            <button
              type="button"
              onClick={onRefreshChat}
              disabled={chatLoading || refreshingChat}
              className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground bg-transparent border-0 cursor-pointer disabled:opacity-40 disabled:cursor-default font-serif hover:text-foreground transition-colors"
            >
              Refresh chat
            </button>
          </div>
        )}
        {chatMessages.length > 0 && (
          <div className="max-h-40 overflow-y-auto mb-2.5 flex flex-col gap-2">
            {chatMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] px-3.5 py-2 text-[13px] leading-relaxed font-serif ${
                    msg.role === 'user'
                      ? 'bg-forest-deep text-cream'
                      : 'bg-cream text-foreground border border-border/30'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {chatLoading && (
              <div className="flex gap-1 px-3.5 py-2">
                {[0, 1, 2].map(i => (
                  <div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-pulse"
                    style={{ animationDelay: `${i * 0.2}s` }}
                  />
                ))}
              </div>
            )}
          </div>
        )}
        <div className="flex gap-3 items-center">
          <input
            value={chatInput}
            onChange={e => onChatInputChange(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && onSend()}
            placeholder="Ask Avanti anything about this trip..."
            className="flex-1 border-0 border-b border-border/50 bg-transparent py-2 text-sm text-foreground outline-none font-serif placeholder:text-muted-foreground/60"
          />
          <button
            type="button"
            onClick={onSend}
            disabled={!chatInput.trim() || chatLoading}
            className="px-5 py-2.5 bg-forest-deep border-0 text-cream text-[10px] uppercase tracking-[0.18em] cursor-pointer disabled:opacity-40 disabled:cursor-default font-serif hover:bg-forest-soft transition-colors shrink-0"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
