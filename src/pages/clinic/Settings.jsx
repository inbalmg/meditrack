import { useState } from 'react'
import { Bell, Users, Stethoscope, Trash2, UserPlus, Zap, Plus } from 'lucide-react'
import { useData } from '../../data/store.jsx'
import { ROLES } from '../../session.jsx'
import { Card, CardHeader, Button, Badge } from '../../components/ui.jsx'
import { clsx } from '../../components/clsx.js'

const THERAPIST_COLORS = ['#0d9488', '#2563eb', '#9333ea', '#f59e0b', '#ef4444', '#0ea5e9']
const DURATIONS = [20, 30, 45, 60]
// Staff roles that can be assigned from Settings (patients aren't staff).
const STAFF_ROLES = ['secretary', 'therapist', 'manager']

export default function Settings() {
  const {
    settings, updateSettings,
    therapists, updateTherapist,
    treatments, addTreatment, updateTreatment, removeTreatment,
    staff, addStaff, updateStaff, removeStaff,
  } = useData()

  const [newName, setNewName] = useState('')
  const [newRole, setNewRole] = useState('secretary')
  const [newTreatment, setNewTreatment] = useState('')

  function handleAddTreatment() {
    if (!newTreatment.trim()) return
    addTreatment({ name: newTreatment.trim(), durationMin: 30, therapistIds: therapists[0] ? [therapists[0].id] : [] })
    setNewTreatment('')
  }
  function toggleProvider(tr, therapistId) {
    const has = tr.therapistIds.includes(therapistId)
    updateTreatment(tr.id, {
      therapistIds: has ? tr.therapistIds.filter((x) => x !== therapistId) : [...tr.therapistIds, therapistId],
    })
  }

  function handleAddStaff() {
    if (!newName.trim()) return
    addStaff({ name: newName.trim(), roleId: newRole })
    setNewName('')
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
            hint="שליחת תזכורת בוואטסאפ/SMS לפני התור"
            checked={settings.remindersEnabled}
            onChange={(v) => updateSettings({ remindersEnabled: v })}
          />
          <NumberRow
            label="שליחת תזכורת"
            suffix="שעות לפני התור"
            value={settings.reminderHours}
            min={1}
            max={72}
            disabled={!settings.remindersEnabled}
            onChange={(v) => updateSettings({ reminderHours: v })}
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
        </div>
      </Card>

      {/* --- Therapists & visit types --- */}
      <Card className="overflow-hidden">
        <CardHeader dark title="מטפלים וסוגי טיפול" icon={Stethoscope} />
        <div className="p-5 space-y-5">
          <div>
            <h3 className="text-sm font-medium text-slate-700 mb-2.5">מטפלים</h3>
            <div className="space-y-2">
              {therapists.map((t) => (
                <div key={t.id} className="flex items-center gap-2 flex-wrap rounded-xl ring-1 ring-slate-200 p-3">
                  <input
                    value={t.name}
                    onChange={(e) => updateTherapist(t.id, { name: e.target.value })}
                    className="h-9 flex-1 min-w-[140px] rounded-lg ring-1 ring-slate-300 px-3 text-sm outline-none focus:ring-2 focus:ring-teal-500"
                  />
                  <input
                    value={t.specialty}
                    onChange={(e) => updateTherapist(t.id, { specialty: e.target.value })}
                    className="h-9 w-36 rounded-lg ring-1 ring-slate-300 px-3 text-sm text-slate-600 outline-none focus:ring-2 focus:ring-teal-500"
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
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-2">הצבע והשם מתעדכנים מיד ביומן ובבורר המשבצות.</p>
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
                    {therapists.map((t) => {
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
        <CardHeader dark title="משתמשי צוות" icon={Users}
          action={<Badge tone="teal">{staff.length} משתמשים</Badge>} />
        <div className="p-5 space-y-3">
          {staff.map((s) => (
            <div key={s.id} className="flex items-center gap-2 rounded-xl ring-1 ring-slate-200 p-3">
              <span className="flex-1 min-w-0 text-sm font-medium text-slate-800 truncate">{s.name}</span>
              <select
                value={s.roleId}
                onChange={(e) => updateStaff(s.id, { roleId: e.target.value })}
                className="h-9 w-36 rounded-lg ring-1 ring-slate-300 px-2 text-sm bg-white outline-none focus:ring-2 focus:ring-teal-500"
              >
                {STAFF_ROLES.map((r) => (
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
          <div className="flex items-center gap-2 rounded-xl border-2 border-dashed border-slate-200 p-3">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddStaff()}
              placeholder="שם המשתמש החדש"
              className="h-9 flex-1 min-w-0 rounded-lg ring-1 ring-slate-300 px-3 text-sm outline-none focus:ring-2 focus:ring-teal-500"
            />
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              className="h-9 w-36 rounded-lg ring-1 ring-slate-300 px-2 text-sm bg-white outline-none focus:ring-2 focus:ring-teal-500"
            >
              {STAFF_ROLES.map((r) => (
                <option key={r} value={r}>{ROLES[r].label}</option>
              ))}
            </select>
            <Button size="sm" disabled={!newName.trim()} onClick={handleAddStaff}>
              <UserPlus size={15} /> הוספה
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}

function ToggleRow({ label, hint, checked, onChange, badge }) {
  return (
    <div className="flex items-center justify-between gap-4">
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
        onClick={() => onChange(!checked)}
        className={clsx(
          'relative h-6 w-11 rounded-full transition shrink-0',
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
