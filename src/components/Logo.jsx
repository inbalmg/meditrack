/**
 * Logo — סמל MediTrack כ-SVG וקטורי (חד ב-DPI כלשהו, בניגוד ל-PNG שמטשטש בקטן).
 *
 * `CrossMark` — סמל הצלב הרפואי המעוגל בטורקיז המותג (#06A5A6), מבוסס אותו
 * וקטור של ה-favicon. `BrandLockup` — הסמל + שם האפליקציה כטקסט חי (חד לגמרי).
 */

const TEAL = '#06A5A6'

// גאומטריה זהה ל-public/meditrack-favicon.svg (viewBox 48×48): טבעת-צלב מעוגלת + נקודת מרכז.
const OUTER =
  'M 14.50 6.50 Q 14.50 2.00 19.00 2.00 L 29.00 2.00 Q 33.50 2.00 33.50 6.50 L 33.50 11.50 Q 33.50 14.50 36.50 14.50 L 41.50 14.50 Q 46.00 14.50 46.00 19.00 L 46.00 29.00 Q 46.00 33.50 41.50 33.50 L 36.50 33.50 Q 33.50 33.50 33.50 36.50 L 33.50 41.50 Q 33.50 46.00 29.00 46.00 L 19.00 46.00 Q 14.50 46.00 14.50 41.50 L 14.50 36.50 Q 14.50 33.50 11.50 33.50 L 6.50 33.50 Q 2.00 33.50 2.00 29.00 L 2.00 19.00 Q 2.00 14.50 6.50 14.50 L 11.50 14.50 Q 14.50 14.50 14.50 11.50 Z'
const INNER =
  'M 19.50 10.00 Q 19.50 7.00 22.50 7.00 L 25.50 7.00 Q 28.50 7.00 28.50 10.00 L 28.50 17.50 Q 28.50 19.50 30.50 19.50 L 38.00 19.50 Q 41.00 19.50 41.00 22.50 L 41.00 25.50 Q 41.00 28.50 38.00 28.50 L 30.50 28.50 Q 28.50 28.50 28.50 30.50 L 28.50 38.00 Q 28.50 41.00 25.50 41.00 L 22.50 41.00 Q 19.50 41.00 19.50 38.00 L 19.50 30.50 Q 19.50 28.50 17.50 28.50 L 10.00 28.50 Q 7.00 28.50 7.00 25.50 L 7.00 22.50 Q 7.00 19.50 10.00 19.50 L 17.50 19.50 Q 19.50 19.50 19.50 17.50 Z'

export function CrossMark({ className, color = TEAL, title = 'MediTrack' }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      role="img"
      aria-label={title}
      fill={color}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{title}</title>
      <path fillRule="evenodd" d={`${OUTER} ${INNER}`} />
      <circle cx="24" cy="24" r="2.7" />
    </svg>
  )
}

/**
 * BrandLockup — הסמל הווקטורי לצד שם האפליקציה כטקסט חי (רזולוציה מלאה, חד).
 * @param variant 'dark' לרקע כהה (טקסט לבן) · 'light' לרקע בהיר (טקסט כהה).
 */
export function BrandLockup({ variant = 'dark', className = '' }) {
  const name = variant === 'dark' ? 'text-white' : 'text-slate-800'
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <CrossMark className="h-10 w-10 shrink-0" />
      <div className="leading-none">
        <p className={`font-extrabold text-[20px] tracking-tight ${name}`}>MediTrack</p>
        <p className="mt-1 text-[12px] font-semibold tracking-[0.22em] text-teal-400">Clinic</p>
      </div>
    </div>
  )
}
