import { useState, useEffect } from 'react'
import { Bell, Users, Stethoscope, Trash2, UserPlus, Zap, Plus, RotateCcw, ChevronDown, Archive } from 'lucide-react'
import { useData } from '../../data/store.jsx'
import { ROLES } from '../../session.jsx'
import { Card, CardHeader, Button, Badge } from '../../components/ui.jsx'
import { clsx } from '../../components/clsx.js'
import { validateStaffName, isValidStaffRole, NAME_MAX, validateTherapistName, validateSpecialty, THERAPIST_NAME_MAX, SPECIALTY_MAX, validateOverdueGraceHours, OVERDUE_GRACE_MIN, OVERDUE_GRACE_MAX } from '../../lib/validation.js'

const THERAPIST_COLORS = ['#0d9488', '#2563eb', '#9333ea', '#f59e0b', '#ef4444', '#0ea5e9']
const DURATIONS = [20, 30, 45, 60]
// The staff roster is office-only: clinical providers live in `therapists` and are
// managed in the Therapists section. (patients aren't staff.)
const OFFICE_ROLES = ['secretary', 'manager']

export default function Settings() {
  const {
    settings, updateSettings,
    therapists, activeTherapists, addTherapist, updateTherapist,
    treatments, addTreatment, updateTreatment, removeTreatment,
    staff, addStaff, updateStaff, removeStaff,
  } = useData()

  const archivedTherapists = therapists.filter((t) => t.active === false)

  const [newName, setNewName] = useState('')
  const [newRole, setNewRole] = useState('secretary')
  const [newTreatment, setNewTreatment] = useState('')
  // Archived-therapists section — collapsed by default so it doesn't clutter the
  // day-to-day Settings view; opened on demand to view/restore.
  const [archiveOpen, setArchiveOpen] = useState(false)

  // Add-therapist form state.
  const [newTherName, setNewTherName] = useState('')
  const [newTherSpecialty, setNewTherSpecialty] = useState('')
  const [newTherColor, setNewTherColor] = useState(THERAPIST_COLORS[0])

  // Derived so feedback is reactive as the user types (only once they've typed).
  const nameError = newName ? validateStaffName(newName) : ''
  const therNameError = newTherName ? validateTherapistName(newTherName, therapists.map((t) => t.name)) : ''
  // Specialty is required; only surface the error once the user has typed, but the
  // Add button below stays disabled while it's blank.
  const therSpecialtyError = newTherSpecialty ? validateSpecialty(newTherSpecialty) : ''

  // Only office staff belong in the Staff Users list (therapists have their own section).
  const officeStaff = staff.filter((s) => OFFICE_ROLES.includes(s.roleId))

  function handleAddTreatment() {
    if (!newTreatment.trim()) return
    addTreatment({ name: newTreatment.trim(), durationMin: 30, therapistIds: activeTherapists[0] ? [activeTherapists[0].id] : [] })
    setNewTreatment('')
  }
  function toggleProvider(tr, therapistId) {
    const has = tr.therapistIds.includes(therapistId)
    updateTreatment(tr.id, {
      therapistIds: has ? tr.therapistIds.filter((x) => x !== therapistId) : [...tr.therapistIds, therapistId],
    })
  }

  function handleAddStaff() {
    if (nameError || !newName || !isValidStaffRole(newRole)) return
    addStaff({ name: newName, roleId: newRole })
    setNewName('')
  }

  function handleAddTherapist() {
    if (!newTherName || !newTherSpecialty.trim() || therNameError || therSpecialtyError) return
    addTherapist({ name: newTherName, specialty: newTherSpecialty, color: newTherColor })
    setNewTherName('')
    setNewTherSpecialty('')
    setNewTherColor(THERAPIST_COLORS[0])
  }

  return (
    <div className="space-y-6 animate-fade max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">הגדרות</h1>
        <p className="text-slate-500 mt-0.5">הגדרות תפעוליות של הקליניקה · שינויים נכנסים לתוקף מיד</p>
      </div>

      {/* --- Automations & reminders --- */}
      <Card className="overflow-hidden">
        <CardHeader dark title="אוטומציות ותזכורות" icon={Bell} />
        <div className="p-5 space-y-4">
          <ToggleRow
            label="תזכורות אוטומטיות למטופלים"
            hint="שליחת תזכורת במייל / וואטסאפ יום לפני מועד התור"
            checked={settings.remindersEnabled}
            onChange={(v) => updateSettings({ remindersEnabled: v })}
          />

          <div className="border-t border-slate-100 pt-4 space-y-4">
            <ToggleRow
              label="סימון אי-הגעה אוטומטי"
              hint="סימון התור כ״לא הגיע״ אם המטופל לא הגיע"
              checked={settings.autoNoShow}
              onChange={(v) => updateSettings({ autoNoShow: v })}
            />
            <NumberRow
              label="סימון אי-הגעה"
              suffix="דקות אחרי מועד התור"
              value={settings.noShowMinutes}
              min={5}
              max={60}
              disabled={!settings.autoNoShow}
              onChange={(v) => updateSettings({ noShowMinutes: v })}
            />
            <ToggleRow
              label="יצירת משימת פולו-אפ באי-הגעה"
              hint="פתיחת משימה אוטומטית למזכירות ליצירת קשר ותיאום מחדש"
              checked={settings.followUpOnNoShow}
              onChange={(v) => updateSettings({ followUpOnNoShow: v })}
              badge={<Badge tone="purple"><Zap size={12} /> אוטומציה</Badge>}
            />
          </div>

          <div className="border-t border-slate-100 pt-4 space-y-4">
            <ToggleRow
              label="סימון משימות באיחור"
              hint="צביעה אדומה וספירה של משימות פתוחות שעבר מועד היעד שלהן, בדשבורד ובדוחות"
              checked={settings.overdueEnabled}
              onChange={(v) => updateSettings({ overdueEnabled: v })}
            />
            <OverdueGraceRow
              value={settings.overdueGraceHours}
              disabled={!settings.overdueEnabled}
              onCommit={(v) => updateSettings({ overdueGraceHours: v })}
            />
            <p className={clsx('text-xs text-slate-400', !settings.overdueEnabled && 'opacity-50')}>
              משימה פתוחה נספרת כ״באיחור״ רק אחרי שחלף הזמן שנקבע ממועד היעד. 0 = סימון מיידי ברגע שהמועד עובר.
            </p>
          </div>
        </div>
      </Card>

      {/* --- Therapists & visit types --- */}
      <Card className="overflow-hidden">
        <CardHeader dark title="מטפלים וסוגי טיפול" icon={Stethoscope} />
        <div className="p-5 space-y-5">
          <div>
            <h3 className="text-sm font-medium text-slate-700 mb-2.5">מטפלים</h3>
            <div className="space-y-2">
              {activeTherapists.map((t) => {
                // Required-field enforcement on inline edits: name (unique) + specialty.
                // The store skips persisting an invalid value; here we flag it visually.
                const rowNameError = validateTherapistName(t.name, therapists.filter((x) => x.id !== t.id).map((x) => x.name))
                const rowSpecialtyError = validateSpecialty(t.specialty)
                return (
                <div key={t.id} className="rounded-xl ring-1 ring-slate-200 p-3">
                  <div className="flex items-center gap-2 flex-wrap">
                  <input
                    value={t.name}
                    onChange={(e) => updateTherapist(t.id, { name: e.target.value })}
                    aria-invalid={!!rowNameError}
                    className={clsx(
                      'h-9 flex-1 min-w-[120px] rounded-lg ring-1 px-3 text-sm outline-none focus:ring-2',
                      rowNameError ? 'ring-red-400 focus:ring-red-500' : 'ring-slate-300 focus:ring-teal-500',
                    )}
                  />
                  <input
                    value={t.specialty ?? ''}
                    onChange={(e) => updateTherapist(t.id, { specialty: e.target.value })}
                    placeholder="התמחות (חובה)"
                    aria-invalid={!!rowSpecialtyError}
                    className={clsx(
                      'h-9 w-48 rounded-lg ring-1 px-3 text-sm text-slate-600 outline-none focus:ring-2',
                      rowSpecialtyError ? 'ring-red-400 focus:ring-red-500' : 'ring-slate-300 focus:ring-teal-500',
                    )}
                  />
                  <div className="flex items-center gap-1.5">
                    {THERAPIST_COLORS.map((c) => (
                      <button
                        key={c}
                        title={`צבע ${c}`}
                        onClick={() => updateTherapist(t.id, { color: c })}
                        className={clsx(
                          'h-6 w-6 rounded-full transition ring-offset-2',
                          t.color === c ? 'ring-2 ring-slate-800' : 'hover:scale-110',
                        )}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                  <button
                    onClick={() => updateTherapist(t.id, { active: false })}
                    title="העברה לארכיון — הסתרה מהזמנה, מהיומן ומבוררי המטפלים (ההיסטוריה נשמרת)"
                    className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  >
                    <Trash2 size={16} />
                  </button>
                  </div>
                  {(rowNameError || rowSpecialtyError) && (
                    <p className="text-xs text-red-500 mt-1.5 px-1">{rowNameError || rowSpecialtyError}</p>
                  )}
                </div>
                )
              })}

              {/* Add therapist — the only way to create a bookable provider. */}
              <div className="rounded-xl border-2 border-dashed border-slate-200 p-3 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    value={newTherName}
                    onChange={(e) => setNewTherName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddTherapist()}
                    maxLength={THERAPIST_NAME_MAX}
                    placeholder="שם המטפל החדש"
                    aria-invalid={!!therNameError}
                    className={clsx(
                      'h-9 flex-1 min-w-[120px] rounded-lg ring-1 px-3 text-sm outline-none focus:ring-2',
                      therNameError ? 'ring-red-400 focus:ring-red-500' : 'ring-slate-300 focus:ring-teal-500',
                    )}
                  />
                  <input
                    value={newTherSpecialty}
                    onChange={(e) => setNewTherSpecialty(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddTherapist()}
                    maxLength={SPECIALTY_MAX}
                    placeholder="התמחות (חובה)"
                    aria-invalid={!!therSpecialtyError}
                    className={clsx(
                      'h-9 w-48 rounded-lg ring-1 px-3 text-sm text-slate-600 outline-none focus:ring-2',
                      therSpecialtyError ? 'ring-red-400 focus:ring-red-500' : 'ring-slate-300 focus:ring-teal-500',
                    )}
                  />
                  <div className="flex items-center gap-1.5">
                    {THERAPIST_COLORS.map((c) => (
                      <button
                        key={c}
                        title={`צבע ${c}`}
                        onClick={() => setNewTherColor(c)}
                        className={clsx(
                          'h-6 w-6 rounded-full transition ring-offset-2',
                          newTherColor === c ? 'ring-2 ring-slate-800' : 'hover:scale-110',
                        )}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                  <Button size="sm" disabled={!newTherName || !newTherSpecialty.trim() || !!therNameError || !!therSpecialtyError} onClick={handleAddTherapist}>
                    <UserPlus size={15} /> הוספת מטפל
                  </Button>
                </div>
                {(therNameError || therSpecialtyError) && (
                  <p className="text-xs text-red-500 px-1">{therNameError || therSpecialtyError}</p>
                )}
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-2">הצבע והשם מתעדכנים מיד ביומן ובבורר המשבצות. מטפל חדש יופיע מיד ביומן; כדי לאפשר הזמנה עצמית, שייכו לו סוג טיפול למטה.</p>

            {archivedTherapists.length > 0 && (
              <div className="mt-4 rounded-xl ring-1 ring-slate-200 overflow-hidden">
                {/* Collapsible archive — closed by default; opens to view/restore. */}
                <button
                  type="button"
                  onClick={() => setArchiveOpen((o) => !o)}
                  aria-expanded={archiveOpen}
                  className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-right hover:bg-slate-50 transition"
                >
                  <span className="flex items-center gap-2 text-xs font-medium text-slate-500">
                    <Archive size={14} className="text-slate-400" />
                    בארכיון ({archivedTherapists.length})
                  </span>
                  <ChevronDown size={16} className={clsx('text-slate-400 transition-transform shrink-0', archiveOpen ? '' : '-rotate-90')} />
                </button>
                {archiveOpen && (
                  <div className="px-3 pb-3 pt-1 border-t border-slate-100">
                    <div className="space-y-2 mt-2">
                      {archivedTherapists.map((t) => (
                        <div key={t.id} className="flex items-center gap-2 rounded-xl ring-1 ring-slate-200 bg-slate-50 p-3">
                          <span className="h-3 w-3 rounded-full shrink-0 opacity-50" style={{ backgroundColor: t.color }} />
                          <span className="flex-1 min-w-0 text-sm text-slate-500 truncate">
                            {t.name}{t.specialty ? ` · ${t.specialty}` : ''}
                          </span>
                          <button
                            onClick={() => updateTherapist(t.id, { active: true })}
                            title="שחזור מהארכיון"
                            className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs text-teal-700 ring-1 ring-teal-200 hover:bg-teal-50"
                          >
                            <RotateCcw size={14} /> שחזור
                          </button>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-slate-400 mt-2">מטפלים בארכיון מוסתרים מהזמנה ומהיומן; התורים ההיסטוריים שלהם נשמרים.</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="border-t border-slate-100 pt-4">
            <h3 className="text-sm font-medium text-slate-700 mb-2.5">סוגי טיפול — משך ושיוך למטפל</h3>
            <div className="space-y-2">
              {treatments.map((tr) => (
                <div key={tr.id} className="rounded-xl ring-1 ring-slate-200 p-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      value={tr.name}
                      onChange={(e) => updateTreatment(tr.id, { name: e.target.value })}
                      className="h-9 flex-1 min-w-[160px] rounded-lg ring-1 ring-slate-300 px-3 text-sm outline-none focus:ring-2 focus:ring-teal-500"
                    />
                    <select
                      value={tr.durationMin}
                      onChange={(e) => updateTreatment(tr.id, { durationMin: Number(e.target.value) })}
                      className="h-9 rounded-lg ring-1 ring-slate-300 px-2 text-sm bg-white outline-none focus:ring-2 focus:ring-teal-500"
                    >
                      {DURATIONS.map((d) => (<option key={d} value={d}>{d} דק׳</option>))}
                    </select>
                    <button onClick={() => removeTreatment(tr.id)} title="הסרת טיפול" className="p-2 rounded-lg text-red-500 hover:bg-red-50"><Trash2 size={16} /></button>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap mt-2">
                    <span className="text-xs text-slate-400 ml-1">ניתן אצל:</span>
                    {activeTherapists.map((t) => {
                      const on = tr.therapistIds.includes(t.id)
                      return (
                        <button
                          key={t.id}
                          onClick={() => toggleProvider(tr, t.id)}
                          className={clsx('inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs ring-1 transition',
                            on ? 'ring-teal-500 bg-teal-50 text-teal-700' : 'ring-slate-200 text-slate-500')}
                        >
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: t.color }} />
                          {t.name}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
              {/* Add treatment */}
              <div className="flex items-center gap-2 rounded-xl border-2 border-dashed border-slate-200 p-3">
                <input
                  value={newTreatment}
                  onChange={(e) => setNewTreatment(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddTreatment()}
                  placeholder="שם טיפול חדש"
                  className="h-9 flex-1 min-w-0 rounded-lg ring-1 ring-slate-300 px-3 text-sm outline-none focus:ring-2 focus:ring-teal-500"
                />
                <Button size="sm" disabled={!newTreatment.trim()} onClick={handleAddTreatment}><Plus size={15} /> הוספה</Button>
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-2">המשך והשיוך קובעים אילו טיפולים המטופל יכול להזמין ואת אורך המשבצת ביומן.</p>
          </div>
        </div>
      </Card>

      {/* --- Staff users --- */}
      <Card className="overflow-hidden">
        <CardHeader dark title="משתמשי צוות (מזכירות והנהלה)" icon={Users}
          action={<Badge tone="teal">{officeStaff.length} משתמשים</Badge>} />
        <div className="p-5 space-y-3">
          {officeStaff.map((s) => (
            <div key={s.id} className="flex items-center gap-2 rounded-xl ring-1 ring-slate-200 p-3">
              <span className="flex-1 min-w-0 text-sm font-medium text-slate-800 truncate">{s.name}</span>
              <select
                value={s.roleId}
                onChange={(e) => updateStaff(s.id, { roleId: e.target.value })}
                className="h-9 w-36 rounded-lg ring-1 ring-slate-300 px-2 text-sm bg-white outline-none focus:ring-2 focus:ring-teal-500"
              >
                {OFFICE_ROLES.map((r) => (
                  <option key={r} value={r}>{ROLES[r].label}</option>
                ))}
              </select>
              <button
                onClick={() => removeStaff(s.id)}
                title="הסרת משתמש"
                className="p-2 rounded-lg text-red-500 hover:bg-red-50"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}

          {/* Add row */}
          <div>
            <div className="flex items-center gap-2 rounded-xl border-2 border-dashed border-slate-200 p-3">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddStaff()}
                maxLength={NAME_MAX}
                placeholder="שם המשתמש החדש"
                aria-invalid={!!nameError}
                className={clsx(
                  'h-9 flex-1 min-w-0 rounded-lg ring-1 px-3 text-sm outline-none focus:ring-2',
                  nameError ? 'ring-red-400 focus:ring-red-500' : 'ring-slate-300 focus:ring-teal-500',
                )}
              />
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                className="h-9 w-36 rounded-lg ring-1 ring-slate-300 px-2 text-sm bg-white outline-none focus:ring-2 focus:ring-teal-500"
              >
                {OFFICE_ROLES.map((r) => (
                  <option key={r} value={r}>{ROLES[r].label}</option>
                ))}
              </select>
              <Button size="sm" disabled={!!validateStaffName(newName)} onClick={handleAddStaff}>
                <UserPlus size={15} /> הוספה
              </Button>
            </div>
            {nameError && <p className="text-xs text-red-500 mt-1.5 px-1">{nameError}</p>}
          </div>
        </div>
      </Card>
    </div>
  )
}

function ToggleRow({ label, hint, checked, onChange, badge, disabled }) {
  return (
    <div className={clsx('flex items-center justify-between gap-4', disabled && 'opacity-50')}>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-slate-700">{label}</p>
          {badge}
        </div>
        {hint && <p className="text-xs text-slate-400 mt-0.5">{hint}</p>}
      </div>
      <button
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={clsx(
          'relative h-6 w-11 rounded-full transition shrink-0 disabled:cursor-not-allowed',
          checked ? 'bg-teal-600' : 'bg-slate-300',
        )}
      >
        <span
          className={clsx(
            'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all',
            checked ? 'right-0.5' : 'right-[22px]',
          )}
        />
      </button>
    </div>
  )
}

// Overdue grace, in hours — text field with real validation (whole number, no
// leading zeros, in range). Keeps its own draft so an invalid keystroke can be
// shown with an error without corrupting the stored setting; only valid values
// are committed. Re-syncs if the stored value changes elsewhere (e.g. reset).
function OverdueGraceRow({ value, disabled, onCommit }) {
  const [text, setText] = useState(String(value))
  useEffect(() => { setText(String(value)) }, [value])
  const { error } = validateOverdueGraceHours(text)

  function handleChange(raw) {
    setText(raw)
    const res = validateOverdueGraceHours(raw)
    if (!res.error) onCommit(res.value)
  }

  return (
    <div className={clsx(disabled && 'opacity-50')}>
      <div className="flex items-center justify-between gap-4">
        <label htmlFor="overdue-grace" className="text-sm text-slate-700">סימון משימה כ״באיחור״</label>
        <div className="flex items-center gap-2 shrink-0">
          <input
            id="overdue-grace"
            type="text"
            inputMode="numeric"
            dir="ltr"
            value={text}
            disabled={disabled}
            aria-invalid={!disabled && !!error}
            min={OVERDUE_GRACE_MIN}
            max={OVERDUE_GRACE_MAX}
            onChange={(e) => handleChange(e.target.value)}
            className={clsx(
              'h-9 w-20 rounded-lg ring-1 px-3 text-sm text-center tabular-nums outline-none focus:ring-2 disabled:bg-slate-50',
              !disabled && error ? 'ring-red-400 focus:ring-red-500' : 'ring-slate-300 focus:ring-teal-500',
            )}
          />
          <span className="text-sm text-slate-500">שעות אחרי מועד היעד</span>
        </div>
      </div>
      {!disabled && error && <p className="text-xs text-red-500 mt-1.5 text-left">{error}</p>}
    </div>
  )
}

function NumberRow({ label, suffix, value, min, max, disabled, onChange }) {
  return (
    <div className={clsx('flex items-center justify-between gap-4', disabled && 'opacity-50')}>
      <p className="text-sm text-slate-700">{label}</p>
      <div className="flex items-center gap-2 shrink-0">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-9 w-20 rounded-lg ring-1 ring-slate-300 px-3 text-sm text-center tabular-nums outline-none focus:ring-2 focus:ring-teal-500 disabled:bg-slate-50"
        />
        <span className="text-sm text-slate-500">{suffix}</span>
      </div>
    </div>
  )
}
