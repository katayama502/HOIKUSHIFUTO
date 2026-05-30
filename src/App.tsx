import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import ShiftPage from './pages/ShiftPage'
import StaffPage from './pages/StaffPage'
import SettingsPage from './pages/SettingsPage'
import SummaryPage from './pages/SummaryPage'
import ShiftCalendarPage from './pages/ShiftCalendarPage'
import StaffConstraintPage from './pages/StaffConstraintPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="shift-calendar" element={<ShiftCalendarPage />} />
          <Route path="shift" element={<ShiftPage />} />
          <Route path="staff" element={<StaffPage />} />
          <Route path="staff-constraints" element={<StaffConstraintPage />} />
          <Route path="summary" element={<SummaryPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
