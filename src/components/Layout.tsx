import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, CalendarDays, Users, Settings,
  ClipboardList, Baby, ChevronDown, ChevronRight,
  PanelLeftClose, PanelLeftOpen, BarChart3, Palette, LayoutGrid,
} from 'lucide-react'
import { useStore } from '../store/useStore'
import { useState } from 'react'
import UICustomizePanel from './UICustomizePanel'

const adminNav = [
  { to: '/',         icon: LayoutDashboard, label: 'ホーム' },
  { to: '/shift',    icon: CalendarDays,    label: 'シフト表' },
  { to: '/requests', icon: ClipboardList,   label: '申請一覧' },
  { to: '/staff',    icon: Users,           label: '職員管理' },
  { to: '/summary',        icon: BarChart3,   label: '勤怠サマリー' },
  { to: '/shift-calendar', icon: LayoutGrid, label: 'カレンダー配置' },
  { to: '/settings',       icon: Settings,   label: '設定' },
]

const staffNav = [
  { to: '/',           icon: LayoutDashboard, label: 'ホーム' },
  { to: '/shift',      icon: CalendarDays,    label: 'シフト確認' },
  { to: '/my-request', icon: ClipboardList,   label: '希望休申請' },
]

// テーマ表示ラベル
const themeLabels: Record<string, { label: string; dot: string }> = {
  warm:   { label: 'ウォーム', dot: 'bg-orange-400' },
  cool:   { label: 'クール',   dot: 'bg-sky-400' },
  green:  { label: 'グリーン', dot: 'bg-emerald-400' },
  purple: { label: 'パープル', dot: 'bg-violet-400' },
}

const themeOrder: Array<'warm' | 'cool' | 'green' | 'purple'> = ['warm', 'cool', 'green', 'purple']

export default function Layout() {
  const { currentRole, setRole, staff, currentStaffId, orgSettings, uiSettings, updateUISettings } = useStore()
  const navItems = currentRole === 'admin' ? adminNav : staffNav
  const currentStaff = staff.find((s) => s.id === currentStaffId)
  const location = useLocation()
  const [roleMenuOpen, setRoleMenuOpen] = useState(false)
  const [customizePanelOpen, setCustomizePanelOpen] = useState(false)

  const collapsed = uiSettings.sidebarCollapsed

  // 現在のページタイトル
  const pageTitle = [...adminNav, ...staffNav].find((n) =>
    n.to === '/' ? location.pathname === '/' : location.pathname.startsWith(n.to)
  )?.label ?? 'ほいくシフト'

  const toggleCollapse = () => updateUISettings({ sidebarCollapsed: !collapsed })

  const cycleTheme = () => {
    const idx = themeOrder.indexOf(uiSettings.theme)
    const next = themeOrder[(idx + 1) % themeOrder.length]
    updateUISettings({ theme: next })
  }

  const currentTheme = themeLabels[uiSettings.theme] ?? themeLabels.warm

  return (
    <div
      className="flex h-screen overflow-hidden bg-orange-50"
      data-theme={uiSettings.theme}
    >

      {/* ===== Desktop Sidebar ===== */}
      <aside
        className={`hidden md:flex flex-col h-screen bg-white border-r border-orange-100 shrink-0 transition-all duration-200 ease-in-out ${collapsed ? 'w-[72px]' : 'w-64'}`}
      >

        {/* Logo */}
        <div className={`flex items-center gap-3 border-b border-orange-100 shrink-0 ${collapsed ? 'px-3 py-5 justify-center' : 'px-5 py-5'}`}>
          <div className="w-10 h-10 bg-primary-500 rounded-xl flex items-center justify-center shrink-0">
            <Baby className="w-6 h-6 text-white" />
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="font-bold text-gray-800 text-sm leading-tight truncate">{orgSettings.name}</p>
              <p className="text-xs text-gray-400">ほいくシフト</p>
            </div>
          )}
        </div>

        {/* Role switcher */}
        {!collapsed && (
          <div className="px-4 py-3 border-b border-orange-100 shrink-0">
            <p className="text-xs text-gray-400 mb-2">表示モード</p>
            <div className="flex gap-2">
              <button
                onClick={() => setRole('admin')}
                className={`flex-1 text-xs py-2 rounded-xl font-medium transition-colors duration-100 ${
                  currentRole === 'admin'
                    ? 'bg-primary-500 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                👩‍💼 管理者
              </button>
              <button
                onClick={() => setRole('staff', staff.find((s) => s.role === 'staff')?.id ?? staff[0]?.id)}
                className={`flex-1 text-xs py-2 rounded-xl font-medium transition-colors duration-100 ${
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
        )}

        {/* Collapsed role indicator */}
        {collapsed && (
          <div className="px-3 py-3 border-b border-orange-100 shrink-0 flex justify-center">
            <button
              onClick={() => setRole(currentRole === 'admin' ? 'staff' : 'admin', currentRole === 'admin' ? (staff.find((s) => s.role === 'staff')?.id ?? staff[0]?.id) : undefined)}
              className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center text-base hover:bg-primary-100 transition-colors duration-100"
              title={currentRole === 'admin' ? '管理者モード' : '職員モード'}
            >
              {currentRole === 'admin' ? '👩‍💼' : '🌸'}
            </button>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl text-sm font-medium transition-all duration-150
                ${collapsed ? 'px-0 py-3 justify-center' : 'px-4 py-3'}
                ${isActive
                  ? 'bg-primary-500 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-orange-50 hover:text-primary-600'
                }`
              }
              title={collapsed ? label : undefined}
            >
              {({ isActive }) => (
                <>
                  <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-white' : ''}`} />
                  {!collapsed && <span>{label}</span>}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Theme quick-switch + collapse toggle footer */}
        <div className="p-3 border-t border-orange-100 shrink-0 space-y-2">
          {/* Theme indicator */}
          {!collapsed && (
            <button
              onClick={cycleTheme}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-orange-50 active:scale-95 transition-all duration-100 text-left"
              title="テーマを切り替え"
            >
              <span className={`w-3 h-3 rounded-full shrink-0 ${currentTheme.dot}`} />
              <span className="text-xs text-gray-500 flex-1">{currentTheme.label}テーマ</span>
              <ChevronRight className="w-3 h-3 text-gray-300" />
            </button>
          )}
          {collapsed && (
            <button
              onClick={cycleTheme}
              className="w-full flex items-center justify-center py-2 rounded-xl hover:bg-orange-50 transition-colors duration-100"
              title={`テーマ: ${currentTheme.label}`}
            >
              <span className={`w-3 h-3 rounded-full ${currentTheme.dot}`} />
            </button>
          )}

          {/* User card (non-collapsed) */}
          {!collapsed && (
            currentRole === 'staff' && currentStaff ? (
              <div className="flex items-center gap-3 px-3 py-2.5 bg-orange-50 rounded-xl">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                  style={{ backgroundColor: currentStaff.color }}
                >
                  {currentStaff.name[0]}
                </div>
                <div className="min-w-0 flex-1">
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
                  <p className="text-xs text-gray-400 truncate max-w-[120px]">{orgSettings.name}</p>
                </div>
              </div>
            )
          )}

          {/* Collapse toggle button */}
          <button
            onClick={toggleCollapse}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-gray-400 hover:bg-orange-50 hover:text-gray-600 active:scale-95 transition-all duration-100 ${collapsed ? 'justify-center' : ''}`}
            title={collapsed ? 'サイドバーを展開' : 'サイドバーを折りたたむ'}
          >
            {collapsed
              ? <PanelLeftOpen className="w-4 h-4" />
              : <>
                  <PanelLeftClose className="w-4 h-4" />
                  <span className="text-xs">折りたたむ</span>
                </>
            }
          </button>
        </div>
      </aside>

      {/* ===== Main content area ===== */}
      <div className="flex-1 flex flex-col min-w-0 h-screen">

        {/* Mobile top header */}
        <header className="md:hidden bg-white border-b border-orange-100 px-4 py-3 flex items-center justify-between shrink-0 sticky top-0 z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center shrink-0">
              <Baby className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <span className="font-bold text-gray-800 text-sm block leading-tight">{pageTitle}</span>
              <span className="text-[10px] text-gray-400 block leading-tight">{orgSettings.name}</span>
            </div>
          </div>

          {/* Role switcher (mobile) */}
          <div className="relative">
            <button
              onClick={() => setRoleMenuOpen(!roleMenuOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 rounded-xl text-xs font-medium text-gray-600 border border-orange-200 active:scale-95 transition-all duration-100"
            >
              {currentRole === 'admin' ? '👩‍💼 管理者' : `🌸 ${currentStaff?.name?.split(' ')[0] ?? '職員'}`}
              <ChevronDown className={`w-3 h-3 transition-transform duration-150 ${roleMenuOpen ? 'rotate-180' : ''}`} />
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

        {/* Page content */}
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

      {/* ===== UIカスタマイズ フローティングボタン ===== */}
      <button
        onClick={() => setCustomizePanelOpen(true)}
        className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-30 w-12 h-12 bg-white border border-orange-200 rounded-2xl shadow-lg flex items-center justify-center hover:bg-orange-50 hover:shadow-xl active:scale-95 transition-all duration-150 print:hidden"
        aria-label="UIカスタマイズを開く"
        title="UIカスタマイズ"
      >
        <Palette className="w-5 h-5 text-primary-500" />
      </button>

      {/* UIカスタマイズパネル */}
      <UICustomizePanel open={customizePanelOpen} onClose={() => setCustomizePanelOpen(false)} />
    </div>
  )
}
