import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Bell, MessageCircleQuestion, UserX, X } from 'lucide-react'
import { useData } from '../data/store.jsx'

// Transient live notifications. Today's only source: a NEW patient request arriving over
// Realtime while a secretary/manager has the clinic open (store.applyRequest pushes it).
// Driven by store.toasts; each card auto-dismisses. Portaled to <body>, pinned to the
// bottom-start corner, and non-blocking (pointer-events live only on the cards themselves).
export default function Toaster() {
  const { toasts, dismissToast, revertNoShow } = useData()
  if (!toasts.length) return null
  return createPortal(
    <div className="fixed bottom-4 left-4 z-[60] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} onDismiss={() => dismissToast(t.id)} onRevertNoShow={revertNoShow} />
      ))}
    </div>,
    document.body,
  )
}

const AUTO_DISMISS_MS = 6000

function ToastCard({ toast, onDismiss, onRevertNoShow }) {
  const navigate = useNavigate()
  // Keep a live ref to onDismiss so the timer is armed exactly once per toast (keyed on
  // its id), not reset every time a sibling toast is added/removed.
  const onDismissRef = useRef(onDismiss)
  onDismissRef.current = onDismiss
  useEffect(() => {
    const id = setTimeout(() => onDismissRef.current(), toast.duration ?? AUTO_DISMISS_MS)
    return () => clearTimeout(id)
  }, [toast.id])

  // Undo toast: reversing a no-show mis-click. No navigation; offers a "בטל" action.
  const isUndo = toast.kind === 'undo'
  const Icon = isUndo ? UserX : toast.kind === 'inquiry' ? MessageCircleQuestion : Bell
  const subtitle = isUndo
    ? toast.subtitle
    : toast.name ? `מ${toast.name}` : 'התקבלה בפורטל המטופלים'

  return (
    <div
      role="status"
      onClick={isUndo ? undefined : () => { if (toast.to) navigate(toast.to); onDismissRef.current() }}
      className={`pointer-events-auto w-80 max-w-[calc(100vw-2rem)] flex items-start gap-3 rounded-xl bg-white ring-1 ring-slate-200 shadow-lg px-4 py-3 text-right animate-toast${isUndo ? '' : ' cursor-pointer'}`}
    >
      <span className={`grid place-items-center h-9 w-9 shrink-0 rounded-full ${isUndo ? 'bg-red-100 text-red-600' : 'bg-teal-100 text-teal-600'}`}>
        <Icon size={18} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800">{toast.title}</p>
        {subtitle && <p className="text-xs text-slate-500 truncate">{subtitle}</p>}
        {isUndo && (
          <button
            onClick={(e) => { e.stopPropagation(); onRevertNoShow(toast.undoApptId); onDismissRef.current() }}
            className="mt-1.5 inline-flex items-center text-sm font-semibold text-teal-700 hover:text-teal-800 transition"
          >
            בטל
          </button>
        )}
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onDismissRef.current() }}
        className="p-1 -m-1 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
        aria-label="סגירה"
      >
        <X size={16} />
      </button>
    </div>
  )
}
