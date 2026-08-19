import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle } from 'lucide-react'
import { Card, Button } from './ui.jsx'
import { clsx } from './clsx.js'

// Confirmation gate for destructive / irreversible actions (cancel appointment,
// reject request, no-show, delete …). Backdrop-click or Escape dismisses; the
// action runs only on an explicit confirm. Mirrors the app's existing modal
// pattern (fixed backdrop + Card with stopPropagation) and adds Escape-to-close.
export default function ConfirmDialog({
  title,
  message,
  confirmLabel = 'אישור',
  cancelLabel = 'ביטול',
  tone = 'danger',
  onConfirm,
  onClose,
}) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const iconTone = tone === 'danger' ? 'bg-red-100 text-red-600' : 'bg-teal-100 text-teal-600'

  // Portal to <body>: page wrappers keep a persistent transform (animate-fade with
  // fill-mode: both), which would otherwise make the wrapper the containing block for
  // this fixed overlay — pinning inset-0 to the tall page box and pushing the centered
  // card off-screen (bottom-anchored / clipped). Same pattern as ScheduleDialog.
  return createPortal(
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fade"
      onClick={onClose}
    >
      <Card
        role="dialog"
        aria-modal="true"
        className="w-full max-w-sm p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <span className={clsx('grid place-items-center h-10 w-10 rounded-xl shrink-0', iconTone)}>
            <AlertTriangle size={20} />
          </span>
          <div className="min-w-0">
            <h3 className="font-semibold text-slate-800">{title}</h3>
            {message && <p className="text-sm text-slate-500 mt-1 leading-relaxed">{message}</p>}
          </div>
        </div>
        <div className="mt-5 flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>{cancelLabel}</Button>
          <Button variant={tone} onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </Card>
    </div>,
    document.body,
  )
}
