/**
 * Welcome — מסך הנחיתה/כניסה של MediTrack Clinic.
 *
 * מימוש נאמן-למקור של העיצוב שיובא מ-Claude Design ("MediTrack Welcome"):
 * קנבס כהה אחד (גרדיאנט רדיאלי טורקיז→ink) עם רשת "קונסטלציה" עדינה ברקע,
 * צד ימין = מיתוג (לוגו + כותרת שיווקית + מודול אבטחה), צד שמאל = "ברוכים הבאים"
 * וכרטיסי כניסה לבנים. RTL מלא, טיפוגרפיה ב-em עם font-size נזיל (clamp) בשורש —
 * כך כל המסך מתכווץ/מתרחב יחסית לרוחב החלון. במסכים צרים העמודות נערמות (flex-wrap).
 *
 * הצבעים/גרדיאנטים כאן הם ערכי המקור המדויקים של העיצוב המיובא ולכן נכתבים ישירות
 * (חריג מקומי למוסכמת טוקני-Tailwind של הפרויקט — כדי לשמר את המראה במדויק).
 *
 * שימוש: <Welcome heading="..." onBack={...}> <WelcomeCard .../> ... </Welcome>
 */
// גופן כותרות: Heebo (נטען ב-index.html), עם 'Assistant' כחלופה.
const FONT = "'Heebo', 'Assistant', 'Rubik', system-ui, sans-serif"

/* מצבים אינטראקטיביים (hover/focus) + נגישות תנועה — מוזרקים פעם אחת. */
const CSS = `
.mtw-card{
  cursor:pointer; border:0; background:#ffffff; width:100%;
  font-family:inherit; text-align:right; -webkit-tap-highlight-color:transparent;
  transition:transform .24s cubic-bezier(.22,.61,.36,1), box-shadow .24s ease;
}
.mtw-card:hover{
  transform:translateY(-0.32em) scale(1.012);
  box-shadow:0 0 0 2px rgba(94,211,192,0.6), 0 1.5em 3em rgba(4,20,26,0.5), 0 0.25em 0.5em rgba(4,20,26,0.22);
}
.mtw-card:active{ transform:translateY(-0.1em) scale(0.997); }
.mtw-card:focus-visible{ outline:2px solid #5ed3c0; outline-offset:3px; }
.mtw-iconwrap{ transition:background .24s ease, transform .24s cubic-bezier(.22,.61,.36,1); }
.mtw-card:hover .mtw-iconwrap{ background:#d3ece5; transform:scale(1.06); }
.mtw-chev{ transition:transform .24s cubic-bezier(.22,.61,.36,1), color .24s ease; }
.mtw-card:hover .mtw-chev{ transform:translateX(-0.4em); color:#0d9488; }
.mtw-back{
  display:inline-flex; align-items:center; gap:0.35em;
  border:0; background:transparent; cursor:pointer; padding:0;
  font-family:inherit; font-size:1.05em; color:rgba(205,224,229,0.72);
  margin-bottom:0.9em; transition:color .18s ease;
}
.mtw-back:hover{ color:#dcecf0; }
.mtw-back:focus-visible{ outline:2px solid #5ed3c0; outline-offset:3px; border-radius:0.3em; }
@media (prefers-reduced-motion: reduce){
  .mtw-card, .mtw-chev, .mtw-iconwrap, .mtw-back{ transition:none; }
  .mtw-card:hover{ transform:none; }
  .mtw-card:hover .mtw-chev{ transform:none; }
  .mtw-card:hover .mtw-iconwrap{ transform:none; }
}

/* מודול האבטחה של המובייל מוסתר כברירת מחדל (דסקטופ) — מוצג רק ב-media למטה */
.mtw-trust-mobile{ display:none; }

/* ----------------------------------------------------------------------------
   מובייל (< md / 768px) בלבד. הפריסה הדסקטופית היא שני טורים עם היסטים קשיחים
   (translateX/Y, space-between על 100vh) — כאן מנטרלים אותם, מכווצים את ההירו
   לכותרת-מותג קומפקטית, מנקים את הרקע (ללא קונסטלציה/נצנוץ/קו-מפריד), ומעבירים
   את מודול האבטחה אל מתחת לכרטיסים. אינו משפיע על ≥768px.
---------------------------------------------------------------------------- */
@media (max-width: 767.98px){
  /* שני הטורים נערמים; אורזים אותם לראש כדי שלא יימתחו למלוא הגובה (מונע פער ריק) */
  .mtw-root{ align-content:flex-start !important; }

  /* רקע נקי: הסרת רשת "קונסטלציה", הקו המפריד האנכי, ומודול-האבטחה-בהירו (נצנוץ) */
  .mtw-constellation, .mtw-divider, .mtw-trust-hero{ display:none !important; }

  /* ביטול ההיסטים הדסקטופיים → ציר מרכזי משותף */
  .mtw-hero-title, .mtw-panel-inner{ transform:none !important; }

  /* ההירו הופך לכותרת עליונה קומפקטית (לא נפרש על כל הגובה) */
  .mtw-hero{
    flex:0 0 auto !important;
    justify-content:flex-start !important;
    gap:1.6em;
    padding:2.2em 1.6em 0.6em !important;
  }
  .mtw-logo{
    align-self:center !important;
    width:12.5em !important;
    margin-bottom:0.2em;
  }

  /* היררכיה טיפוגרפית מאוזנת יותר */
  .mtw-hero-title{ margin:0 !important; }
  .mtw-hero-title h1{ font-size:2.15em !important; line-height:1.28 !important; }
  .mtw-hero-title p{ font-size:1.15em !important; margin-top:0.5em !important; }

  /* הפאנל: ממורכז, אותו רוחב/פדינג כמו ההירו */
  .mtw-panel{
    flex:1 1 auto !important;
    justify-content:flex-start !important;
    padding:0.6em 1.6em 2.4em !important;
  }
  .mtw-panel-inner{
    max-width:26em !important;
    gap:1.4em !important;
  }
  .mtw-heading{ font-size:2.05em !important; }

  /* כרטיסים מעודנים — אותו מבנה, פחות אוויר, אייקון קטן יותר → כותרת בשורה אחת */
  .mtw-card{ padding:1.15em 1.35em !important; gap:1em !important; border-radius:1em !important; }
  .mtw-iconwrap{ width:4.6em !important; height:4.6em !important; }
  .mtw-card .mtw-chev{ width:1.9em !important; height:1.9em !important; }

  /* מודול האבטחה — מתחת לכרטיסים, גרסה נקייה (ללא נצנוץ) */
  .mtw-trust-mobile{ display:block !important; margin-top:0.3em; }
  .mtw-trust-mobile p{ font-size:1.05em !important; }
}
`

/* ------------------------------- Logo mark --------------------------------- */

/**
 * LogoMark — לוגו MediTrack Clinic הרשמי (מותג "logo 4a"), גרסת רקע-כהה.
 * פריסה (RTL): **הסמל מימין** ל-wordmark; "MediTrack" (לבן) ו-"CLINIC" (accent
 * טורקיז) **ממורכזים זה מתחת לזה** באותו ציר. הסמל = ריבוע-מעוגל בגרדיאנט טורקיז
 * עם צלב/יומן חתוכים כשטח שלילי (mask). מבוסס על `src/assets/brand/`.
 */
const BRAND_FONT = "'Poppins', 'Heebo', Helvetica, Arial, sans-serif"

function LogoMark({ style, className }) {
  // ציר-מרכז משותף ל-MediTrack ו-CLINIC (CLINIC ממורכז בדיוק מתחת ל-MediTrack).
  const TEXT_CX = 170
  return (
    <svg viewBox="0 0 455 200" role="img" aria-label="MediTrack Clinic" style={style} className={className}>
      <title>MediTrack Clinic</title>
      <defs>
        <linearGradient id="mtGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5FE3D1" />
          <stop offset="1" stopColor="#0D8FA2" />
        </linearGradient>
        <mask id="mtMask">
          <rect x="0" y="0" width="200" height="200" fill="#fff" />
          <rect x="20" y="56" width="160" height="10" rx="5" fill="#000" />
          <rect x="86" y="82" width="28" height="88" rx="14" fill="#000" />
          <rect x="56" y="112" width="88" height="28" rx="14" fill="#000" />
          <rect x="64" y="20" width="15" height="30" rx="7.5" fill="#000" />
          <rect x="121" y="20" width="15" height="30" rx="7.5" fill="#000" />
        </mask>
      </defs>

      {/* wordmark (משמאל) — direction:ltr כדי שהטקסט הלטיני לא יידחף ב-RTL */}
      <text
        x={TEXT_CX}
        y="96"
        textAnchor="middle"
        direction="ltr"
        fontFamily={BRAND_FONT}
        fontSize="53"
        fontWeight="600"
        fill="#FFFFFF"
      >
        MediTrack
      </text>
      <text
        x={TEXT_CX}
        y="134"
        textAnchor="middle"
        direction="ltr"
        fontFamily={BRAND_FONT}
        fontSize="22"
        fontWeight="500"
        letterSpacing="8"
        fill="#2DD4BF"
      >
        CLINIC
      </text>

      {/* הסמל (מימין) — גובהו מיושר בדיוק לגובה הנראה של שתי שורות הטקסט (מקצה
          ה-M העליון ב-MediTrack ועד בסיס האותיות ב-CLINIC), לא לתיבת ה-line-box.
          מרווח קטן מה-wordmark וממורכז אנכית מולו.
          בסיס כהה (ink-900) מתחת למסכה → הצלב/היומן נקראים כהה על כל רקע, זהה ל-favicon. */}
      <g transform="translate(325 38) scale(0.52)">
        <rect x="14" y="30" width="172" height="156" rx="42" fill="#0c2627" />
        <rect x="14" y="30" width="172" height="156" rx="42" fill="url(#mtGrad)" mask="url(#mtMask)" />
      </g>
    </svg>
  )
}

/* ----------------------------------- Icons ----------------------------------- */

// אייקון "צוות הקליניקה" — שלוש דמויות מעל לוח משבצות (יומן/משמרות).
export function StaffIcon() {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ width: '3.4em', height: '3.4em', display: 'block', color: '#3d8b82' }}
      aria-hidden="true"
    >
      <circle cx="20" cy="9" r="3.4" />
      <circle cx="10" cy="12.5" r="2.9" />
      <circle cx="30" cy="12.5" r="2.9" />
      <path d="M14.5 18.5 C15.6 16.2 17.6 14.9 20 14.9 C22.4 14.9 24.4 16.2 25.5 18.5" />
      <path d="M5.4 21.5 C6.2 19.4 7.9 18.1 10 18.1 C11 18.1 11.9 18.4 12.7 18.9" />
      <path d="M34.6 21.5 C33.8 19.4 32.1 18.1 30 18.1 C29 18.1 28.1 18.4 27.3 18.9" />
      <rect x="11" y="21.5" width="18" height="13.5" rx="2.2" />
      <path d="M11 26 H29" />
      <path d="M16 21.5 V19.4" />
      <path d="M24 21.5 V19.4" />
      <path d="M15.4 29.6 H17.2" />
      <path d="M19.2 29.6 H21" />
      <path d="M23 29.6 H24.8" />
      <path d="M15.4 32.4 H17.2" />
      <path d="M19.2 32.4 H21" />
    </svg>
  )
}

// אייקון "פורטל מטופלים" — דמות עם לב (טיפול/מעקב).
export function PatientIcon() {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ width: '3.4em', height: '3.4em', display: 'block', color: '#3d8b82' }}
      aria-hidden="true"
    >
      <circle cx="18.5" cy="12" r="5.6" />
      <path d="M7 33 C7 25.8 12.1 20.4 18.5 20.4 C21 20.4 23.3 21.2 25.2 22.6" />
      <path d="M27.6 34 C24.1 31.6 21.8 29.7 21.8 27 C21.8 24.9 23.3 23.5 25.2 23.5 C26.3 23.5 27.1 24.1 27.6 25 C28.1 24.1 28.9 23.5 30 23.5 C31.9 23.5 33.4 24.9 33.4 27 C33.4 29.7 31.1 31.6 27.6 34 Z" />
    </svg>
  )
}

// שברון פנימה (בכיוון RTL — שמאלה) בכרטיס.
function CardChevron() {
  return (
    <svg
      className="mtw-chev"
      viewBox="0 0 24 24"
      style={{
        width: '2.25em',
        height: '2.25em',
        display: 'block',
        flex: 'none',
        marginInlineStart: 'auto',
        color: '#8aa5ab',
      }}
      aria-hidden="true"
    >
      <path
        d="M15 4 L8 12 L15 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// שברון "חזרה" (בכיוון RTL — ימינה).
function BackChevron() {
  return (
    <svg viewBox="0 0 24 24" style={{ width: '1.1em', height: '1.1em', display: 'block' }} aria-hidden="true">
      <path
        d="M9 4 L16 12 L9 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// מגן עם לב — מודול האבטחה בתחתית ההירו.
function ShieldIcon() {
  return (
    <svg
      viewBox="0 0 28 32"
      style={{ width: '2.55em', height: '2.9em', display: 'block', flex: 'none' }}
      aria-hidden="true"
    >
      <path
        d="M14 1.6 L25.6 6 V16.4 C25.6 23.4 20.6 28.5 14 30.4 C7.4 28.5 2.4 23.4 2.4 16.4 V6 Z"
        fill="rgba(95,211,191,0.10)"
        stroke="rgba(133,199,189,0.95)"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M14 21.4 C11 19.3 9 17.7 9 15.4 C9 13.6 10.3 12.4 11.9 12.4 C12.8 12.4 13.6 12.9 14 13.6 C14.4 12.9 15.2 12.4 16.1 12.4 C17.7 12.4 19 13.6 19 15.4 C19 17.7 17 19.3 14 21.4 Z"
        fill="rgba(155,222,210,0.95)"
      />
    </svg>
  )
}

// כוכב-נצנוץ מעל קו המפריד של מודול האבטחה.
function SparkleIcon() {
  return (
    <svg viewBox="0 0 40 40" style={{ width: '100%', height: '100%', display: 'block' }} aria-hidden="true">
      <path
        d="M20 0 C22 13.5 26.5 18 40 20 C26.5 22 22 26.5 20 40 C18 26.5 13.5 22 0 20 C13.5 18 18 13.5 20 0 Z"
        fill="rgba(196,232,232,0.42)"
      />
    </svg>
  )
}

// רשת קווים גיאומטרית ("קונסטלציה") ברקע הקנבס.
const CONSTELLATION_PATHS = [
  'M120 60 L300 120 L250 260 L60 210 Z',
  'M300 120 L470 40 L610 130 L520 300 L250 260',
  'M610 130 L700 300 L520 300',
  'M60 210 L110 420 L300 470 L520 300',
  'M110 420 L40 620 L230 700 L390 610 L300 470',
  'M390 610 L560 690 L700 560 L520 300',
  'M470 40 L520 300',
  'M230 700 L300 470',
]
const CONSTELLATION_NODES = [
  [120, 60, 2.6], [300, 120, 3.2], [470, 40, 2.4], [610, 130, 3], [250, 260, 2.6],
  [60, 210, 2.2], [520, 300, 3.4], [700, 300, 2.2], [110, 420, 2.6], [300, 470, 3],
  [40, 620, 2.2], [230, 700, 2.6], [390, 610, 3], [560, 690, 2.4], [700, 560, 2.2],
]

function Constellation() {
  return (
    <svg
      className="mtw-constellation"
      viewBox="0 0 720 800"
      preserveAspectRatio="none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        opacity: 0.5,
      }}
      aria-hidden="true"
    >
      <g stroke="rgba(150,215,215,0.22)" strokeWidth="0.8" fill="none">
        {CONSTELLATION_PATHS.map((d, i) => (
          <path key={i} d={d} />
        ))}
        {CONSTELLATION_NODES.map(([cx, cy, r], i) => (
          <circle key={`n${i}`} cx={cx} cy={cy} r={r} />
        ))}
      </g>
    </svg>
  )
}

/**
 * SecurityModule — מודול האבטחה (מגן + "המערכת מאובטחת / הנתונים שלכם מוגנים").
 * מופיע פעמיים: בדסקטופ בתחתית ההירו (`sparkle` דלוק), ובמובייל **מתחת לכרטיסים**
 * בגרסה נקייה (ללא נצנוץ). `className`/`style` מאפשרים למקם/להסתיר לפי breakpoint.
 */
function SecurityModule({ className, style, sparkle = false }) {
  return (
    <div className={className} style={{ position: 'relative', width: '100%', ...style }}>
      {sparkle && (
        <div style={{ position: 'absolute', top: '-2.1em', right: '5.6em', width: '2.9em', height: '2.9em', pointerEvents: 'none' }}>
          <SparkleIcon />
        </div>
      )}
      <div
        style={{
          height: '1px',
          width: '100%',
          marginBottom: '1.6em',
          background:
            'linear-gradient(to left, rgba(205,250,250,0) 0%, rgba(160,225,225,0.16) 42%, rgba(215,255,255,0.85) 88%, rgba(215,255,255,0) 100%)',
          boxShadow: '0 0 0.9em rgba(180,240,240,0.28)',
        }}
      />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.85em' }}>
        <ShieldIcon />
        <p style={{ margin: 0, fontSize: '1.25em', lineHeight: 1.45, color: '#a9c2c8', textAlign: 'right' }}>
          המערכת מאובטחת
          <br />
          הנתונים שלכם מוגנים
        </p>
      </div>
    </div>
  )
}

/* ------------------------------- Entry card -------------------------------- */

/**
 * WelcomeCard — כרטיס כניסה לבן (כפתור נגיש).
 * @param icon      אלמנט אייקון (למשל <StaffIcon/>) שממורכז בעיגול הטורקיז.
 * @param title     כותרת הכרטיס.
 * @param subtitle  שורת משנה.
 * @param onClick   פעולה בלחיצה.
 */
export function WelcomeCard({ icon, title, subtitle, onClick }) {
  return (
    <button
      type="button"
      className="mtw-card"
      onClick={onClick}
      style={{
        borderRadius: '1.05em',
        padding: '1.4em 1.9em',
        display: 'flex',
        alignItems: 'center',
        gap: '1.4em',
        boxShadow: '0 0.7em 1.9em rgba(4,20,26,0.32), 0 0.1em 0.3em rgba(4,20,26,0.14)',
      }}
    >
      <span
        className="mtw-iconwrap"
        style={{
          flex: 'none',
          width: '6.4em',
          height: '6.4em',
          borderRadius: '50%',
          background: '#eaf5f2',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {icon}
      </span>
      <span style={{ flex: '0 1 auto', textAlign: 'right' }}>
        <span
          style={{
            display: 'block',
            margin: '0 0 0.14em',
            fontSize: '1.4em',
            fontWeight: 700,
            lineHeight: 1.3,
            color: '#12414c',
          }}
        >
          {title}
        </span>
        <span
          style={{
            display: 'block',
            margin: 0,
            fontSize: '1.2em',
            fontWeight: 400,
            lineHeight: 1.38,
            color: '#5f7f87',
          }}
        >
          {subtitle}
        </span>
      </span>
      <CardChevron />
    </button>
  )
}

/* --------------------------------- Layout ---------------------------------- */

/**
 * Welcome — פריסת מסך הכניסה המלאה. ה-hero (מיתוג) קבוע; הפאנל השמאלי מקבל
 * כותרת (heading), כפתור-חזרה אופציונלי (onBack) וכרטיסים (children).
 */
export default function Welcome({ heading, onBack, children }) {
  return (
    <div
      dir="rtl"
      className="mtw-root"
      style={{
        fontFamily: FONT,
        fontSize: 'clamp(12px, 1.111vw, 16px)',
        width: '100%',
        minHeight: '100vh',
        boxSizing: 'border-box',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'stretch',
        position: 'relative',
        overflow: 'hidden',
        background:
          'radial-gradient(115% 85% at 78% 46%, #164751 0%, #103440 34%, #0a1d26 68%, #071219 100%), #08161e',
      }}
    >
      <style>{CSS}</style>

      {/* שכבות זוהר רדיאליות */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background:
            'radial-gradient(52% 62% at 10% 82%, rgba(41,120,130,0.55) 0%, rgba(20,60,70,0.18) 55%, rgba(0,0,0,0) 78%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background:
            'radial-gradient(38% 46% at 88% 12%, rgba(30,96,108,0.42) 0%, rgba(0,0,0,0) 72%)',
        }}
      />
      {/* קו מפריד אנכי במרכז */}
      <div
        className="mtw-divider"
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: '50%',
          width: '1px',
          pointerEvents: 'none',
          background:
            'linear-gradient(to bottom, rgba(168,226,226,0) 0%, rgba(168,226,226,0.20) 18%, rgba(168,226,226,0.07) 50%, rgba(168,226,226,0.20) 84%, rgba(168,226,226,0) 100%)',
        }}
      />
      {/* קרדיט הפרויקט — פינה שמאלית-תחתונה */}
      <p
        dir="rtl"
        style={{
          position: 'absolute',
          bottom: '2.4em',
          left: '2.6em',
          margin: 0,
          fontSize: '1.05em',
          fontWeight: 400,
          lineHeight: 1.4,
          letterSpacing: '0.01em',
          color: 'rgba(200,218,224,0.6)',
        }}
      >
        פרויקט גמר · קורס מיישם AI · אוגוסט 2026
      </p>
      <Constellation />

      {/* ---------- HERO (ימין) ---------- */}
      <section
        className="mtw-hero"
        style={{
          position: 'relative',
          flex: '1 1 50%',
          minWidth: '24em',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '2.9em 2em 2.4em',
          boxSizing: 'border-box',
        }}
      >
        <LogoMark
          className="mtw-logo"
          style={{
            width: '17.5em',
            height: 'auto',
            display: 'block',
            flex: 'none',
            alignSelf: 'flex-start',
            transform: 'translateX(0.7em)',
          }}
        />

        <div className="mtw-hero-title" style={{ transform: 'translateX(2.8em) translateY(-4.2em)', textAlign: 'center', maxWidth: '38em', margin: 'auto 0' }}>
          <h1
            style={{
              margin: 0,
              fontSize: '3.7em',
              fontWeight: 800,
              lineHeight: 1.36,
              letterSpacing: '-0.01em',
              color: '#ffffff',
              textWrap: 'balance',
              fontFamily: FONT,
            }}
          >
            {'ניהול קליניקה '}
            <span style={{ color: '#06A5A6' }}>חכם</span>
            <br />
            {'פשוט '}
            <span style={{ color: '#06A5A6' }}>ואוטומטי</span>
          </h1>
          <p
            style={{
              margin: '0.62em 0 0',
              fontSize: '1.85em',
              fontWeight: 800,
              lineHeight: 1.36,
              color: '#e8f4f6',
              fontFamily: FONT,
            }}
          >
            ניהול תורים, בקשות ומשימות
            <br />
            במערכת דיגיטלית אחת
          </p>
        </div>

        {/* מודול אבטחה — דסקטופ: בתחתית ההירו (מוסתר במובייל) */}
        <SecurityModule className="mtw-trust-hero" style={{ transform: 'translateX(2.8em)', flex: 'none' }} sparkle />
      </section>

      {/* ---------- ברוכים הבאים + כרטיסים (שמאל) ---------- */}
      <section
        className="mtw-panel"
        style={{
          position: 'relative',
          flex: '1 1 50%',
          minWidth: '24em',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '3.5em 2em',
          boxSizing: 'border-box',
        }}
      >
        <div
          className="mtw-panel-inner"
          style={{
            transform: 'translateX(1.2em) translateY(-2.6em)',
            width: '100%',
            maxWidth: '31.9em',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'stretch',
            gap: '2.2em',
          }}
        >
          <div>
            {onBack && (
              <button type="button" className="mtw-back" onClick={onBack}>
                <BackChevron />
                חזרה
              </button>
            )}
            <h2
              className="mtw-heading"
              style={{
                margin: 0,
                fontSize: '2.5em',
                fontWeight: 700,
                letterSpacing: '0.01em',
                color: '#dcecf0',
                textAlign: 'right',
              }}
            >
              {heading}
            </h2>
          </div>
          {children}
          {/* מודול אבטחה — מובייל: מתחת לכרטיסים, גרסה נקייה (מוסתר בדסקטופ) */}
          <SecurityModule className="mtw-trust-mobile" />
        </div>
      </section>
    </div>
  )
}
