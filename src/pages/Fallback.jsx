import { useNavigate } from 'react-router-dom'
import { useSession } from '../session.jsx'
import { Button } from '../components/ui.jsx'

/**
 * Fallback — מסך ידידותי לשני מצבי "מבוי סתום" בניווט (במקום Navigate שקט):
 *   • kind="notfound"  — נתיב לא מוכר (404).
 *   • kind="forbidden" — משתמש מחובר שניסה להיכנס לאזור שאינו של תפקידו.
 * מציג הסבר קצר וכפתור חזרה למסך הבית לפי התפקיד (או ל-Login אם לא מחובר).
 */
const COPY = {
  notfound: {
    emoji: '🧭',
    title: 'העמוד לא נמצא',
    body: 'ייתכן שהקישור ישן או שגוי. אפשר לחזור למסך הראשי ולהמשיך משם.',
  },
  forbidden: {
    emoji: '🔒',
    title: 'אין לך הרשאה לאזור הזה',
    body: 'החשבון שלך מקושר לתפקיד אחר במערכת. הנה חזרה למסך הראשי שלך.',
  },
}

export default function Fallback({ kind = 'notfound' }) {
  const { role } = useSession()
  const navigate = useNavigate()
  const home = role ? role.home : '/login'
  const label = role ? 'חזרה למסך הראשי' : 'למסך ההתחברות'
  const { emoji, title, body } = COPY[kind] || COPY.notfound

  return (
    <div dir="rtl" className="min-h-screen grid place-items-center bg-canvas px-6 py-12">
      <div className="max-w-sm text-center">
        <div className="text-5xl mb-4" aria-hidden="true">{emoji}</div>
        <h1 className="text-2xl font-bold text-ink-900 mb-2">{title}</h1>
        <p className="text-ink-500 leading-relaxed mb-7">{body}</p>
        <Button variant="primary" onClick={() => navigate(home, { replace: true })}>
          {label}
        </Button>
      </div>
    </div>
  )
}
