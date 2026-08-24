/**
 * Logo — סמל MediTrack Clinic החדש (מותג "logo 4a") כ-SVG וקטורי חד בכל DPI.
 *
 * `CrossMark` — הסמל: ריבוע-מעוגל (squircle) בגרדיאנט טורקיז, כשהצלב הרפואי,
 *   קו-כותרת היומן וטבעות הכריכה חתוכים כ**שטח שלילי** (mask) — ולכן הסמל שקוף
 *   במקום הצלב ויושב על כל רקע. `BrandLockup` — הסמל + שם האפליקציה כטקסט חי.
 *
 * מקור נכסי המותג: `src/assets/brand/` (README + SVG לרקע כהה/בהיר + רכיבי React).
 * צבעים: gradient #5FE3D1→#0D8FA2 · CLINIC accent #2DD4BF(כהה)/#0F9488(בהיר) · גופן Poppins.
 */
import { useId } from 'react'

// גופן ה-wordmark של המותג (Poppins נטען ב-index.html), עם Heebo כחלופה.
const BRAND_FONT = "'Poppins', 'Heebo', Helvetica, Arial, sans-serif"

/**
 * CrossMark — הסמל בלבד (viewBox 200×200). גודל נשלט דרך className (מחלקות h ו-w).
 * ה-ids של הגרדיאנט וה-mask ייחודיים per-instance כדי שכמה סמלים באותו עמוד לא יתנגשו.
 */
export function CrossMark({ className, style, title = 'MediTrack' }) {
  const uid = useId().replace(/:/g, '')
  const grad = `mtGrad-${uid}`
  const mask = `mtMask-${uid}`
  return (
    <svg
      viewBox="0 0 200 200"
      className={className}
      style={style}
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{title}</title>
      <defs>
        <linearGradient id={grad} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5FE3D1" />
          <stop offset="1" stopColor="#0D8FA2" />
        </linearGradient>
        <mask id={mask}>
          <rect x="0" y="0" width="200" height="200" fill="#fff" />
          {/* קו-כותרת היומן */}
          <rect x="20" y="56" width="160" height="10" rx="5" fill="#000" />
          {/* הצלב הרפואי (שטח שלילי) */}
          <rect x="86" y="82" width="28" height="88" rx="14" fill="#000" />
          <rect x="56" y="112" width="88" height="28" rx="14" fill="#000" />
          {/* טבעות הכריכה */}
          <rect x="64" y="20" width="15" height="30" rx="7.5" fill="#000" />
          <rect x="121" y="20" width="15" height="30" rx="7.5" fill="#000" />
        </mask>
      </defs>
      {/* בסיס כהה (ink-900) מתחת למסכה → השטח השלילי (צלב/יומן) נקרא כהה, כמו במערכת. */}
      <rect x="14" y="30" width="172" height="156" rx="42" fill="#0c2627" />
      <rect x="14" y="30" width="172" height="156" rx="42" fill={`url(#${grad})`} mask={`url(#${mask})`} />
    </svg>
  )
}

/**
 * BrandLockup — הסמל לצד שם האפליקציה כטקסט חי (רזולוציה מלאה, חד).
 * @param variant 'dark' לרקע כהה (טקסט לבן) · 'light' לרקע בהיר (טקסט כהה).
 * @param size    גובה/רוחב הסמל בפיקסלים (ברירת מחדל 36; פורטל המטופל/מובייל = 32).
 */
export function BrandLockup({ variant = 'dark', className = '', size = 36 }) {
  const word = variant === 'dark' ? '#FFFFFF' : '#0B2A2B'
  const sub = variant === 'dark' ? '#2DD4BF' : '#0F9488'
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <CrossMark className="shrink-0" style={{ height: size, width: size }} />
      {/* גדלי הטקסט נגזרים מגובה הסמל (יחידות em מעל font-size=size) כדי שגובה שתי
          שורות הטקסט הנראה (מקצה MediTrack העליון ועד בסיס CLINIC) יתלכד עם גובה
          ה-squircle של הסמל בכל גודל. CLINIC ממורכז מתחת ל-MediTrack (textAlign:center);
          ה-marginRight השלילי מבטל את רווח-האותיות הנגרר כדי שהמרכוז יהיה מדויק. */}
      <div
        className="leading-none"
        style={{ fontFamily: BRAND_FONT, direction: 'ltr', textAlign: 'center', fontSize: size }}
      >
        <p className="font-semibold" style={{ color: word, fontSize: '0.46em' }}>
          MediTrack
        </p>
        <p
          className="font-medium"
          style={{ color: sub, fontSize: '0.31em', marginTop: '0.085em', letterSpacing: '0.34em', marginRight: '-0.17em' }}
        >
          CLINIC
        </p>
      </div>
    </div>
  )
}
