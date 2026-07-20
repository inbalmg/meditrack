import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { SessionProvider, useSession } from './session.jsx'
import Login from './pages/Login.jsx'
import ClinicLayout from './layouts/ClinicLayout.jsx'
import DoctorLayout from './layouts/DoctorLayout.jsx'
import PatientLayout from './layouts/PatientLayout.jsx'

import Dashboard from './pages/clinic/Dashboard.jsx'
import Calendar from './pages/clinic/Calendar.jsx'
import TasksBoard from './pages/clinic/TasksBoard.jsx'
import Reports from './pages/clinic/Reports.jsx'
import Settings from './pages/clinic/Settings.jsx'

import DoctorDay from './pages/doctor/DoctorDay.jsx'
import DoctorCalendar from './pages/doctor/DoctorCalendar.jsx'
import VisitCard from './pages/doctor/VisitCard.jsx'

import NewRequest from './pages/patient/NewRequest.jsx'
import MyAppointments from './pages/patient/MyAppointments.jsx'

function RequireRole({ area, children }) {
  const { role } = useSession()
  const location = useLocation()
  if (!role) return <Navigate to="/login" replace state={{ from: location }} />
  if (area === 'clinic' && (role.id === 'secretary' || role.id === 'manager')) return children
  if (area === 'doctor' && role.id === 'therapist') return children
  if (area === 'patient' && role.id === 'patient') return children
  // Signed in but wrong area → send home.
  return <Navigate to={role.home} replace />
}

function AppRoutes() {
  const { role } = useSession()
  return (
    <Routes>
      <Route path="/login" element={role ? <Navigate to={role.home} replace /> : <Login />} />

      <Route
        path="/clinic"
        element={
          <RequireRole area="clinic">
            <ClinicLayout />
          </RequireRole>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="calendar" element={<Calendar />} />
        <Route path="tasks" element={<TasksBoard />} />
        <Route path="reports" element={<Reports />} />
        <Route path="settings" element={<Settings />} />
      </Route>

      <Route
        path="/doctor"
        element={
          <RequireRole area="doctor">
            <DoctorLayout />
          </RequireRole>
        }
      >
        <Route index element={<DoctorDay />} />
        <Route path="calendar" element={<DoctorCalendar />} />
        <Route path="visit/:apptId" element={<VisitCard />} />
      </Route>

      <Route
        path="/patient"
        element={
          <RequireRole area="patient">
            <PatientLayout />
          </RequireRole>
        }
      >
        <Route index element={<MyAppointments />} />
        <Route path="new" element={<NewRequest />} />
      </Route>

      <Route path="*" element={<Navigate to={role ? role.home : '/login'} replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <SessionProvider>
      <AppRoutes />
    </SessionProvider>
  )
}
