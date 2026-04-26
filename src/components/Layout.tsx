import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, CalendarDays, Users, Settings,
  ClipboardList, Baby, ChevronDown,
} from 'lucide-react'
import { useStore } from '../store/useStore'
import { useState } from 'react'

const adminNav = [
  { to: '/',           icon: LayoutDashboard, label: 'ホーム' },
  { to: '/shift',      icon: CalendarDays,    label: 'シフト表' },
  { to: '/requests',   icon: ClipboardList,   label: '申請一覧' },
  { to: '/staff',      icon: Users,           label: '職員管理' },
  { to: '/settings',   icon: Settings,        label: '設定' },
]

const staffNav = [
  { to: '/',           icon: LayoutDashboard, label: 'ホーム' },
  { to: '/shift',      icon: CalendarDays,    label: 'シフト確認' },
  { to: '/my-request', icon: ClipboardList,   label: '希望休申請' },
]

export default function Layout() {
  const { currentRole, setRole, staff, currentStaffId, orgSettings } = useStore()
  const navItems = currentRole === 'admin' ? adminNav : staffNav
  const currentStaff = staff.find((s) => s.id === currentStaffId)
  const location = useLocation()
  const [roleMenuOpen, setRoleMenuOpen] = useState(false)

  // 現在のページタイトル
  const pageTitle = [...adminNav, ...staffNav].find((n) =>
    n.to === '/' ? location.pathname === '/' : location.pathname.startsWith(n.to)
  )?.label ?? 'ほいくシフト'

  return (
    <div className="flex h-screen overflow-hidden bg-orange-50">

      {/* ===== Desktop Sidebar ===== */}
      <aside className="hidden md:flex flex-col w-64 h-screen bg-white border-r border-orange-100 shrink-0">

        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-orange-100">
          <div className="w-10 h-10 bg-primary-500 rounded-xl flex items-center justify-center shrink-0">
            <Baby className="w-6 h-6 text-white" />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-gray-800 text-sm leading-tight truncate">{orgSettings.name}</p>
            <p className="text-xs text-gray-400">ほいくシフト</p>
          </div>
        </div>

        {/* Role switcher */}
        <div className="px-4 py-3 border-b border-orange-100 shrink-0">
          <p className="text-xs text-gray-400 mb-2">表示モード</p>
          <div className="flex gap-2">
            <button
              onClick={() => setRole('admin')}
              className={`flex-1 text-xs py-2 rounded-xl font-medium transition-colors ${
                currentRole === 'admin'
                  ? 'bg-primary-500 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              👩‍💼 管理者
            </button>
            <button
              onClick={() => setRole('staff', staff.find((s) => s.role === 'staff')?.id ?? staff[0]?.id)}
              className={`flex-1 text-xs py-2 rounded-xl font-medium transition-colors ${
                currentRole === 'staff'
                  ? 'bg-primary-500 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              🌸 職員
            </button>
          </div>
          {currentRole === 'staff' && (
            <select
              className="mt-2 w-full text-xs border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary-300"
              value={currentStaffId ?? ''}
              onChange={(e) => setRole('staff', e.target.value)}
            >
              {staff.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          )}
        </div>

        {/* Nav — flex-1 + overflow-y-auto で切れずにスクロール */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150
                ${isActive
                  ? 'bg-primary-500 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-orange-50 hover:text-primary-600'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-white' : ''}`} />
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer user card */}
        <div className="p-4 border-t border-orange-100 shrink-0">
          {currentRole === 'staff' && currentStaff ? (
            <div className="flex items-center gap-3 px-3 py-2.5 bg-orange-50 rounded-xl">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                style={{ backgroundColor: currentStaff.color }}
              >
                {currentStaff.name[0]}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-700 truncate">{currentStaff.name}</p>
                <p className="text-xs text-gray-400">{currentStaff.employment === 'fulltime' ? '正社員' : 'パート'}</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 px-3 py-2.5 bg-orange-50 rounded-xl">
              <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
                <span className="text-sm">👩‍💼</span>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">管理者モード</p>
                <p className="text-xs text-gray-400">{orgSettings.name}</p>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* ===== Main content area ===== */}
      <div className="flex-1 flex flex-col min-w-0 h-screen">

        {/* Mobile top header */}
        <header className="md:hidden bg-white border-b border-orange-100 px-4 py-3 flex items-center justify-between shrink-0 sticky top-0 z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center">
              <Baby className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-gray-800 text-base">{pageTitle}</span>
          </div>

          {/* Role switcher (mobile) */}
          <div className="relative">
            <button
              onClick={() => setRoleMenuOpen(!roleMenuOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 rounded-xl text-xs font-medium text-gray-600 border border-orange-200"
            >
              {currentRole === 'admin' ? '👩‍💼 管理者' : `🌸 ${currentStaff?.name ?? '職員'}`}
              <ChevronDown className={`w-3 h-3 transition-transform ${roleMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            {roleMenuOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setRoleMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-1 w-52 bg-white rounded-2xl shadow-xl border border-orange-100 z-40 overflow-hidden">
                  <div className="p-2">
                    <p className="text-xs text-gray-400 px-3 py-1.5">表示モードを切り替え</p>
                    <button
                      onClick={() => { setRole('admin'); setRoleMenuOpen(false) }}
                      className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${currentRole === 'admin' ? 'bg-primary-50 text-primary-600' : 'hover:bg-gray-50 text-gray-700'}`}
                    >
                      👩‍💼 管理者モード
                    </button>
                    <p className="text-xs text-gray-400 px-3 pt-2 pb-1">職員として表示</p>
                    {staff.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => { setRole('staff', s.id); setRoleMenuOpen(false) }}
                        className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-colors flex items-center gap-2 ${currentRole === 'staff' && currentStaffId === s.id ? 'bg-primary-50 text-primary-600 font-medium' : 'hover:bg-gray-50 text-gray-700'}`}
                      >
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ backgroundColor: s.color }}>
                          {s.name[0]}
                        </div>
                        {s.name}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </header>

        {/* Page content — overflow-y-auto + pb-24 でボトムナビと重ならない */}
        <main className="flex-1 overflow-y-auto p-4 pb-24 md:p-6 md:pb-6">
          <Outlet />
        </main>
      </div>

      {/* ===== Mobile Bottom Navigation ===== */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-orange-100 safe-bottom">
        <div className="flex items-stretch">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center justify-center gap-1 py-2.5 transition-colors relative
                ${isActive ? 'text-primary-500' : 'text-gray-400'}`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary-500 rounded-full" />
                  )}
                  <Icon className={`w-5 h-5 ${isActive ? 'text-primary-500' : 'text-gray-400'}`} />
                  <span className={`text-[10px] font-medium leading-tight ${isActive ? 'text-primary-500' : 'text-gray-400'}`}>
                    {label}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </div>
        {/* iOS safe area */}
        <div className="h-safe-bottom bg-white" />
      </nav>
    </div>
  )
}
