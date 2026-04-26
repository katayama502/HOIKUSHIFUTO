import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import ShiftPage from './pages/ShiftPage'
import StaffPage from './pages/StaffPage'
import RequestsPage from './pages/RequestsPage'
import MyRequestPage from './pages/MyRequestPage'
import SettingsPage from './pages/SettingsPage'
import { useStore } from './store/useStore'

function ProtectedAdmin({ children }: { children: React.ReactNode }) {
  const { currentRole } = useStore()
  if (currentRole !== 'admin') return <Navigate to="/" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="shift" element={<ShiftPage />} />
          <Route path="requests" element={
            <ProtectedAdmin><RequestsPage /></ProtectedAdmin>
          } />
          <Route path="staff" element={
            <ProtectedAdmin><StaffPage /></ProtectedAdmin>
          } />
          <Route path="settings" element={
            <ProtectedAdmin><SettingsPage /></ProtectedAdmin>
          } />
          <Route path="my-request" element={<MyRequestPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
