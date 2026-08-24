import { useEffect, useRef, useState } from 'react'
import { UserRound, UserPlus, Mail, Search, ChevronDown } from 'lucide-react'
import { useData } from '../data/store.jsx'
import { RequiredMark } from './ui.jsx'
import { clsx } from './clsx.js'
import { phoneValid, birthYearValid, isValidGender, GENDERS, emailValid } from '../lib/validation.js'
import { genderLabel } from '../lib/format.js'

// Shared patient selector for the secretary desk flows (Direct Booking + Escalation).
// Toggles between picking an EXISTING patient (searchable combobox) and registering a NEW
// one inline. Manages its own state and reports the current selection descriptor up via
// `onChange`: { mode, patientId, newPatient, ready }. The parent resolves it on submit —
// for a new patient it calls addPatient(newPatient) to get the id (same pattern the old
// PhoneRequestDialog used), so the patients row is written before the dependent insert.
export default function PatientPicker({ onChange, autoFocus = false }) {
  const { patients } = useData()
  const [mode, setMode] = useState('existing') // 'existing' | 'new'
  const [patientId, setPatientId] = useState('')
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newBirthYear, setNewBirthYear] = useState('')
  const [newGender, setNewGender] = useState('')
  const [newEmail, setNewEmail] = useState('')

  const newPhoneValid = phoneValid(newPhone)
  const newBirthYearValid = birthYearValid(newBirthYear)
  const newEmailInvalid = newEmail.trim().length > 0 && !emailValid(newEmail)
  const ready = mode === 'existing'
    ? !!patientId
    : (!!newName.trim() && newPhoneValid && newBirthYearValid && isValidGender(newGender) && !newEmailInvalid)

  // Report the current selection descriptor to the parent. `onChange` is expected to be a
  // stable setter (useState), so it stays out of the dependency list.
  useEffect(() => {
    onChange({
      mode,
      patientId: mode === 'existing' ? patientId : null,
      newPatient: mode === 'new'
        ? { name: newName.trim(), phone: newPhone.trim(), birthYear: Number(newBirthYear), gender: newGender, email: newEmail }
        : null,
      ready,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, patientId, newName, newPhone, newBirthYear, newGender, newEmail, ready])

  return (
    <div>
      <div className="flex gap-2 mb-2.5">
        <Toggle active={mode === 'existing'} onClick={() => setMode('existing')} icon={UserRound}>מטופל קיים</Toggle>
        <Toggle active={mode === 'new'} onClick={() => setMode('new')} icon={UserPlus}>מטופל חדש</Toggle>
      </div>
      {mode === 'existing' ? (
        <PatientCombobox patients={patients} value={patientId} onChange={setPatientId} />
      ) : (
        <div className="grid sm:grid-cols-2 gap-2">
          <label className="space-y-1">
            <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1">שם מלא <RequiredMark /></span>
            <input autoFocus={autoFocus} value={newName} onChange={(e) => setNewName(e.target.value)} required aria-required="true" placeholder="שם פרטי ומשפחה"
              className="w-full h-10 rounded-xl ring-1 ring-slate-300 px-3 text-sm outline-none focus:ring-2 focus:ring-teal-500" />
          </label>
          <label className="space-y-1">
            <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1">טלפון <RequiredMark /></span>
            <input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} required aria-required="true"
              aria-invalid={newPhone.trim().length > 0 && !newPhoneValid} placeholder="050-0000000" inputMode="tel"
              className={clsx(
                'w-full h-10 rounded-xl ring-1 px-3 text-sm tabular-nums outline-none focus:ring-2',
                newPhone.trim().length > 0 && !newPhoneValid ? 'ring-red-300 focus:ring-red-500' : 'ring-slate-300 focus:ring-teal-500',
              )} />
            {newPhone.trim().length > 0 && !newPhoneValid && (
              <span className="text-[11px] text-red-500">מספר טלפון נייד לא תקין</span>
            )}
          </label>
          <label className="space-y-1">
            <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1">שנת לידה <RequiredMark /></span>
            <input value={newBirthYear} onChange={(e) => setNewBirthYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
              required aria-required="true" aria-invalid={newBirthYear.trim().length > 0 && !newBirthYearValid}
              inputMode="numeric" maxLength={4} placeholder="1990"
              className={clsx(
                'w-full h-10 rounded-xl ring-1 px-3 text-sm tabular-nums outline-none focus:ring-2',
                newBirthYear.trim().length > 0 && !newBirthYearValid ? 'ring-red-300 focus:ring-red-500' : 'ring-slate-300 focus:ring-teal-500',
              )} />
            {newBirthYear.trim().length > 0 && !newBirthYearValid && (
              <span className="text-[11px] text-red-500">שנת לידה לא תקינה</span>
            )}
          </label>
          <div className="space-y-1">
            <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1">מין <RequiredMark /></span>
            <div className="flex gap-1.5">
              {GENDERS.map((g) => (
                <button type="button" key={g} onClick={() => setNewGender(g)} aria-pressed={newGender === g}
                  className={clsx(
                    'flex-1 h-10 rounded-xl ring-1 text-sm font-medium transition',
                    newGender === g ? 'bg-teal-600 text-white ring-teal-600' : 'bg-white text-slate-600 ring-slate-300 hover:ring-teal-300',
                  )}>
                  {genderLabel(g)}
                </button>
              ))}
            </div>
          </div>
          <label className="space-y-1 sm:col-span-2">
            <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1"><Mail size={12} /> אימייל <span className="text-slate-400">(רשות)</span></span>
            <input value={newEmail} onChange={(e) => setNewEmail(e.target.value)}
              aria-invalid={newEmailInvalid} type="email" inputMode="email" dir="ltr" placeholder="name@example.com"
              className={clsx(
                'w-full h-10 rounded-xl ring-1 px-3 text-sm text-right outline-none focus:ring-2',
                newEmailInvalid ? 'ring-red-300 focus:ring-red-500' : 'ring-slate-300 focus:ring-teal-500',
              )} />
            {newEmailInvalid && <span className="text-[11px] text-red-500">כתובת אימייל לא תקינה</span>}
          </label>
        </div>
      )}
    </div>
  )
}

// Searchable patient picker — type a name (or phone) for instant filtering. ↑/↓ move,
// Enter picks, Esc closes; closes on outside click.
function PatientCombobox({ patients, value, onChange }) {
  const selected = value ? patients.find((p) => p.id === value) : null
  const [query, setQuery] = useState(selected ? selected.name : '')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const boxRef = useRef(null)

  useEffect(() => { setQuery(selected ? selected.name : '') }, [selected])
  useEffect(() => {
    function onDoc(e) { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const q = query.trim().toLowerCase()
  const showAll = !q || (selected && query === selected.name)
  const matches = (showAll
    ? patients
    : patients.filter((p) => p.name.toLowerCase().includes(q) || (p.phone || '').includes(query.trim()))
  ).slice(0, 50)

  function pick(p) {
    onChange(p.id)
    setQuery(p.name)
    setOpen(false)
  }
  function onKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) setOpen(true)
      setActive((i) => Math.min(i + 1, matches.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      if (open && matches[active]) { e.preventDefault(); pick(matches[active]) }
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <Search size={15} className="absolute top-1/2 -translate-y-1/2 right-3 text-slate-400 pointer-events-none" />
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); if (value) onChange(''); setOpen(true); setActive(0) }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          placeholder="חיפוש מטופל/ת לפי שם או טלפון…"
          className="w-full h-10 rounded-xl ring-1 ring-slate-300 pr-9 pl-9 text-sm outline-none focus:ring-2 focus:ring-teal-500 bg-white"
        />
        <ChevronDown size={16} className={clsx('absolute top-1/2 -translate-y-1/2 left-3 text-slate-400 transition', open && 'rotate-180')} />
      </div>
      {open && (
        <ul role="listbox" className="absolute z-10 mt-1 w-full max-h-56 overflow-y-auto scroll-thin rounded-xl bg-white ring-1 ring-slate-200 shadow-lg py-1">
          {matches.length === 0 ? (
            <li className="px-3 py-2 text-sm text-slate-400">לא נמצאו מטופלים</li>
          ) : (
            matches.map((p, i) => (
              <li key={p.id} role="option" aria-selected={p.id === value}>
                <button
                  type="button"
                  onClick={() => pick(p)}
                  onMouseEnter={() => setActive(i)}
                  className={clsx(
                    'w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-right transition',
                    i === active ? 'bg-teal-50' : 'hover:bg-slate-50',
                    p.id === value && 'font-semibold text-teal-700',
                  )}
                >
                  <span className="truncate">{p.name}</span>
                  <span className="text-xs text-slate-400 tabular-nums shrink-0">{p.phone}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}

function Toggle({ active, onClick, icon: Icon, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium ring-1 transition',
        active ? 'bg-teal-600 text-white ring-teal-600' : 'bg-white text-slate-600 ring-slate-200 hover:ring-teal-300',
      )}
    >
      <Icon size={15} /> {children}
    </button>
  )
}
