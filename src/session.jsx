import { createContext, useContext, useState } from 'react'

// The clinic staff roles (from the permissions matrix in the spec).
export const ROLES = {
  secretary: {
    id: 'secretary',
    label: 'מזכירות',
    desc: 'ניהול צינור הבקשות, יומן ומשימות',
    home: '/clinic',
    canReports: false,
    canApprove: true,
    scopeAllTherapists: true,
  },
  therapist: {
    id: 'therapist',
    label: 'רופא / מטפל',
    desc: 'צפייה ביומן ובמשימות שלי בלבד',
    home: '/doctor',
    canReports: false,
    canApprove: false,
    scopeAllTherapists: false,
    therapistId: 't1', // signed-in doctor = ד"ר מאיה אבני
  },
  manager: {
    id: 'manager',
    label: 'מנהל/ת קליניקה',
    desc: 'גישה מלאה + דוחות ואנליטיקה',
    home: '/clinic',
    canReports: true,
    canApprove: true,
    scopeAllTherapists: true,
  },
  patient: {
    id: 'patient',
    label: 'מטופל',
    desc: 'בקשת תור ומעקב',
    home: '/patient',
    isPatient: true,
  },
}

const SessionContext = createContext(null)

export function SessionProvider({ children }) {
  const [role, setRole] = useState(null) // null = logged out

  function login(roleId) {
    setRole(ROLES[roleId] || null)
  }
  function logout() {
    setRole(null)
  }

  return (
    <SessionContext.Provider value={{ role, login, logout }}>
      {children}
    </SessionContext.Provider>
  )
}

export function useSession() {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession must be used within SessionProvider')
  return ctx
}
