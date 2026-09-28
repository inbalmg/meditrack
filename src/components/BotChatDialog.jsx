import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Bot, X, Send, User } from 'lucide-react'
import { Card, Button } from './ui.jsx'
import { clsx } from './clsx.js'

// "שיחה עם הבוט" — a self-contained chat modal wired to the n8n Front-Desk agent
// (Stage 4). DEV-ONLY: the caller renders this only when import.meta.env.DEV AND
// VITE_N8N_CHAT_URL is set, so it is stripped from production builds entirely.
//
// Deliberately isolated from the store: it does NOT touch requests / submitInquiry /
// the existing "פנייה לצוות" mechanism. It only POSTs to the n8n chat webhook and keeps
// its own local conversation state.
//
// Portal to <body> (mirrors InquiryDialog): the page wrapper keeps a persistent
// transform (animate-fade) that would otherwise capture this fixed overlay.

const GREETING = 'שלום 👋 אני נועה, עוזרת ה-AI של MediTrack. אפשר לשאול אותי על הטיפולים ושעות הפעילות, או לתאר מה חשוב לך — ואעזור לך להבין אילו אפשרויות קיימות במערכת. איך אפשר לעזור?'
const ERROR_MSG = 'מצטערים, אירעה תקלה זמנית בחיבור לעוזר/ת. נסו שוב בעוד רגע.'

export default function BotChatDialog({ onClose }) {
  // A conversation is one session for the agent's memory (see Session Memory node).
  const [sessionId] = useState(() =>
    (crypto?.randomUUID ? crypto.randomUUID() : `s-${Date.now()}-${Math.random().toString(16).slice(2)}`),
  )
  const [messages, setMessages] = useState([{ role: 'bot', text: GREETING }])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef(null)

  // Keep the latest message in view as the conversation grows / "typing…" appears.
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, sending])

  async function send() {
    const text = input.trim()
    if (!text || sending) return
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', text }])
    setSending(true)
    try {
      // n8n chat trigger (embedded mode) expects {action,sessionId,chatInput} and
      // replies with {output} (older builds: {text}).
      const res = await fetch(import.meta.env.VITE_N8N_CHAT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sendMessage', sessionId, chatInput: text }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json().catch(() => ({}))
      const reply = (data.output ?? data.text ?? '').toString().trim() || ERROR_MSG
      setMessages((prev) => [...prev, { role: 'bot', text: reply }])
    } catch {
      // Fail soft — surface a friendly bubble, never throw / never touch other state.
      setMessages((prev) => [...prev, { role: 'bot', text: ERROR_MSG }])
    } finally {
      setSending(false)
    }
  }

  function onKeyDown(e) {
    // Enter sends; Shift+Enter for a newline.
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-center items-start p-4 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}>
      <Card className="w-full max-w-md p-0 overflow-hidden max-h-[calc(100vh-2rem)] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <span className="grid place-items-center h-10 w-10 rounded-xl bg-teal-100 text-teal-600 shrink-0"><Bot size={20} /></span>
            <div>
              <h3 className="font-bold text-slate-800 text-lg leading-tight">שיחה עם נועה</h3>
              <p className="text-sm text-slate-400">עוזר/ת ה-AI של הקליניקה</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="סגירה" className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"><X size={18} /></button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto scroll-thin px-4 py-4 space-y-3 bg-slate-50/50">
          {messages.map((m, i) => (
            <Bubble key={i} role={m.role} text={m.text} />
          ))}
          {sending && (
            <div className="flex items-center gap-2 text-slate-400 text-sm px-1">
              <span className="grid place-items-center h-7 w-7 rounded-full bg-teal-100 text-teal-600 shrink-0"><Bot size={15} /></span>
              <span className="inline-flex gap-1">
                <Dot /> <Dot /> <Dot />
              </span>
            </div>
          )}
        </div>

        {/* Composer */}
        <div className="px-4 py-3 border-t border-slate-100 flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            maxLength={1000}
            placeholder="כתבו הודעה…"
            className="flex-1 resize-none rounded-xl ring-1 ring-slate-300 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-teal-500 max-h-28 leading-relaxed"
          />
          <Button size="icon" disabled={!input.trim() || sending} onClick={send} aria-label="שליחה">
            <Send size={16} />
          </Button>
        </div>
      </Card>
    </div>,
    document.body,
  )
}

// A single chat bubble. User = teal, aligned to the start (right in RTL); bot = white
// card with an avatar, aligned to the opposite side.
function Bubble({ role, text }) {
  const isUser = role === 'user'
  return (
    <div className={clsx('flex items-end gap-2', isUser ? 'flex-row-reverse' : 'flex-row')}>
      <span className={clsx('grid place-items-center h-7 w-7 rounded-full shrink-0', isUser ? 'bg-slate-200 text-slate-500' : 'bg-teal-100 text-teal-600')}>
        {isUser ? <User size={15} /> : <Bot size={15} />}
      </span>
      <div
        className={clsx(
          'max-w-[78%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words',
          isUser ? 'bg-teal-600 text-white rounded-br-md' : 'bg-white text-slate-700 ring-1 ring-slate-200 rounded-bl-md',
        )}
      >
        {text}
      </div>
    </div>
  )
}

// One bouncing dot of the "typing…" indicator.
function Dot() {
  return <span className="h-1.5 w-1.5 rounded-full bg-slate-300 animate-bounce" style={{ animationDuration: '1s' }} />
}
