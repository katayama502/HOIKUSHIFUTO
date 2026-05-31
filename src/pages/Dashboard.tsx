import { useMemo, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CalendarDays, Users, AlertTriangle,
  ChevronRight, TrendingUp, Sun, LayoutGrid,
  GripVertical, Eye, EyeOff, ChevronUp, ChevronDown,
  Settings2, RotateCcw, Check, SlidersHorizontal,
} from 'lucide-react'
import { format, getDaysInMonth, parseISO, getDay } from 'date-fns'
import { ja } from 'date-fns/locale'
import { useStore } from '../store/useStore'
import { getYearMonth, calcMonthlyHours, getDaySlots } from '../utils/shift'
import type { DashboardCardId, DashboardCard } from '../types'
import HintTooltip from '../components/HintTooltip'

// ─── Card metadata ────────────────────────────────────────────────────────────
const CARD_LABELS: Record<DashboardCardId, string> = {
  stats:        'KPI指標',
  today:        '今日の配置状況',
  progress:     '今月シフト進捗',
  hours:        '職員別勤務時間',
  quickActions: 'クイックアクション',
  calendar:     'カレンダーハイライト',
}

const DEFAULT_CARDS: DashboardCard[] = [
  { id: 'stats',        visible: true },
  { id: 'today',        visible: true },
  { id: 'progress',     visible: true },
  { id: 'hours',        visible: true },
  { id: 'quickActions', visible: true },
  { id: 'calendar',     visible: true },
]

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const { staff, shifts, shiftPatterns, orgSettings, uiSettings, updateUISettings } = useStore()
  const today = new Date()
  const yearMonth = getYearMonth(today)
  const fullMonthLabel = format(today, 'yyyy年M月', { locale: ja })
  const todayLabel = format(today, 'yyyy年M月d日（E）', { locale: ja })
  const daysInMonth = getDaysInMonth(parseISO(`${yearMonth}-01`))

  // Ensure dashboardCards exists (migration safety for old persisted state)
  const cards: DashboardCard[] = uiSettings.dashboardCards ?? DEFAULT_CARDS

  // ── Edit mode state ──────────────────────────────────────────────────────
  const [editMode, setEditMode] = useState(false)
  const [dragId, setDragId] = useState<DashboardCardId | null>(null)
  const [dragOverId, setDragOverId] = useState<DashboardCardId | null>(null)

  // ── Data computations ─────────────────────────────────────────────────────
  const staffHours = useMemo(() =>
    staff.map((s) => ({
      ...s,
      hours: calcMonthlyHours(yearMonth, s.id, shifts, shiftPatterns),
    })),
    [staff, shifts, shiftPatterns, yearMonth]
  )

  const patternMap = useMemo(
    () => Object.fromEntries(shiftPatterns.map((p) => [p.id, p])),
    [shiftPatterns],
  )

  const todayWorkingStaff = useMemo(() =>
    staff.flatMap((s) => {
      const staffData = shifts[yearMonth]?.[s.id] ?? {}
      const slots = getDaySlots(staffData, today.getDate())
      const workSlots = slots.filter((sl) => !patternMap[sl.patternId]?.isOff)
      if (workSlots.length === 0) return []
      // Show staff once with their first work pattern
      const firstSlot = workSlots[0]
      const pattern = patternMap[firstSlot.patternId] ?? null
      return [{ ...s, pattern, entry: firstSlot }]
    }),
    [staff, shifts, shiftPatterns, yearMonth, today, patternMap]
  )

  const dailyShiftCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (let d = 1; d <= daysInMonth; d++) {
      const uniqueStaff = new Set(
        staff.filter((s) => {
          const slots = getDaySlots(shifts[yearMonth]?.[s.id] ?? {}, d)
          return slots.some((sl) => !patternMap[sl.patternId]?.isOff)
        }).map((s) => s.id),
      )
      counts[String(d)] = uniqueStaff.size
    }
    return counts
  }, [staff, shifts, shiftPatterns, yearMonth, daysInMonth, patternMap])

  const staffCount = staff.length
  const totalCells = staffCount * daysInMonth
  const filledCells = useMemo(() => {
    let count = 0
    for (let d = 1; d <= daysInMonth; d++) {
      staff.forEach((s) => {
        const slots = getDaySlots(shifts[yearMonth]?.[s.id] ?? {}, d)
        if (slots.some((sl) => !patternMap[sl.patternId]?.isOff)) count++
      })
    }
    return count
  }, [staff, shifts, yearMonth, daysInMonth, patternMap])
  const fillRate = totalCells > 0 ? Math.round((filledCells / totalCells) * 100) : 0

  const shortDays = useMemo(() => {
    let count = 0
    for (let d = 1; d <= daysInMonth; d++) {
      const working = dailyShiftCounts[String(d)] ?? 0
      if (working > 0 && working < Math.ceil(staffCount / 2)) count++
    }
    return count
  }, [dailyShiftCounts, daysInMonth, staffCount])

  const activeDays = useMemo(() => {
    let count = 0
    for (let d = 1; d <= daysInMonth; d++) {
      if ((dailyShiftCounts[String(d)] ?? 0) > 0) count++
    }
    return count
  }, [dailyShiftCounts, daysInMonth])

  const unfilledDays = daysInMonth - activeDays
  const allFilled = unfilledDays === 0

  // ── Card order / visibility mutations ─────────────────────────────────────
  function toggleVisibility(id: DashboardCardId) {
    updateUISettings({
      dashboardCards: cards.map((c) => c.id === id ? { ...c, visible: !c.visible } : c),
    })
  }

  function moveCard(id: DashboardCardId, dir: 'up' | 'down') {
    const idx = cards.findIndex((c) => c.id === id)
    const nextIdx = dir === 'up' ? idx - 1 : idx + 1
    if (nextIdx < 0 || nextIdx >= cards.length) return
    const next = [...cards]
    ;[next[idx], next[nextIdx]] = [next[nextIdx], next[idx]]
    updateUISettings({ dashboardCards: next })
  }

  function handleDrop(targetId: DashboardCardId) {
    if (!dragId || dragId === targetId) { setDragId(null); setDragOverId(null); return }
    const from = cards.findIndex((c) => c.id === dragId)
    const to   = cards.findIndex((c) => c.id === targetId)
    const next = [...cards]
    const [removed] = next.splice(from, 1)
    next.splice(to, 0, removed)
    updateUISettings({ dashboardCards: next })
    setDragId(null)
    setDragOverId(null)
  }

  function resetLayout() {
    updateUISettings({ dashboardCards: DEFAULT_CARDS })
  }

  // ── Card content renderers ─────────────────────────────────────────────────
  function renderCard(id: DashboardCardId) {
    switch (id) {
      case 'stats':
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard icon={<Users className="w-5 h-5 text-white" />}         label="職員数"           value={`${staffCount}`} unit="名" gradient="from-orange-400 to-orange-500" />
            <StatCard icon={<CalendarDays className="w-5 h-5 text-white" />}  label="今月シフト入力率" value={`${fillRate}`}    unit="%" gradient="from-sky-400 to-sky-500" />
            <StatCard icon={<AlertTriangle className="w-5 h-5 text-white" />} label="配置不足日数"     value={`${shortDays}`}  unit="日" gradient="from-amber-400 to-amber-500" alert={shortDays > 0} />
            <StatCard icon={<CalendarDays className="w-5 h-5 text-white" />}  label="有効シフト日数"   value={`${activeDays}`} unit="日" gradient="from-emerald-400 to-emerald-500" />
          </div>
        )

      case 'today':
        return (
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sun className="w-4 h-4 text-amber-400" />
                <h2 className="font-bold text-gray-700 text-sm">今日の配置状況</h2>
              </div>
              <span className="text-xs text-gray-400">{format(today, 'M月d日（E）', { locale: ja })}</span>
            </div>
            <p className="text-xs text-gray-500 mb-3">
              現在: <span className="font-semibold text-gray-700">{todayWorkingStaff.length}名</span>
              <span className="mx-1 text-gray-300">/</span>
              職員数: <span className="font-semibold text-gray-700">{staffCount}名</span>
            </p>
            {todayWorkingStaff.length === 0 ? (
              <p className="text-sm text-gray-400 py-2">今日の出勤者データがありません</p>
            ) : (
              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                {todayWorkingStaff.map((s) => (
                  <div key={s.id} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-gray-100 bg-gray-50">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ backgroundColor: s.color }}>
                      {s.name[0]}
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-700 leading-tight">{s.name.split(' ')[0]}</p>
                      {s.pattern && <p className="text-[10px] leading-tight" style={{ color: s.pattern.color }}>{s.pattern.name}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )

      case 'progress':
        return (
          <div className="card">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-primary-500" />
              <h2 className="font-bold text-gray-700 text-sm">今月シフト進捗</h2>
              <span className="ml-auto text-xs font-semibold text-primary-600">{fillRate}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-3 mb-3">
              <div className="h-3 rounded-full transition-all duration-700 ease-out bg-primary-400" style={{ width: `${fillRate}%` }} />
            </div>
            {allFilled ? (
              <p className="text-sm text-emerald-600 font-medium">全日程 入力済み ✓</p>
            ) : (
              <p className="text-sm text-gray-500">あと <span className="font-semibold text-gray-700">{unfilledDays}日分</span> 入力が必要です</p>
            )}
            <Link to="/shift-calendar" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors">
              シフトを入力する <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        )

      case 'hours':
        return (
          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-primary-500" />
              <h2 className="font-bold text-gray-700">{fullMonthLabel}の勤務時間</h2>
            </div>
            <div className="space-y-3">
              {staffHours.map((s) => {
                const isOver = (s.hours / 4) > 40
                const pct = Math.min(100, (s.hours / (s.weeklyHours * 4)) * 100)
                return (
                  <div key={s.id} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ backgroundColor: s.color }}>
                      {s.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-700 truncate">{s.name}</span>
                        <span className={`text-sm font-bold shrink-0 ml-2 ${isOver ? 'text-red-500' : 'text-gray-700'}`}>{s.hours.toFixed(0)}h</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div className={`h-2 rounded-full transition-all duration-700 ease-out ${isOver ? 'bg-red-400' : 'bg-primary-400'}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )

      case 'quickActions':
        return (
          <div className="space-y-2.5">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">クイックアクション</p>
            <div className="grid grid-cols-1 gap-2 sm:gap-3 md:grid-cols-3">
              <QuickLink to="/shift-calendar" icon={<LayoutGrid className="w-5 h-5 text-orange-500" />}       label="カレンダー配置"   desc="シフトをカレンダーで管理" color="bg-orange-100" />
              <QuickLink to="/shift"          icon={<CalendarDays className="w-5 h-5 text-sky-500" />}        label="シフト表（一覧）" desc={fullMonthLabel}           color="bg-sky-100" />
              <QuickLink to="/staff-constraints" icon={<SlidersHorizontal className="w-5 h-5 text-violet-500" />} label="出勤条件設定"  desc="職員ごとの制約管理"       color="bg-violet-100" />
            </div>
          </div>
        )

      case 'calendar':
        return (
          <MonthCalendarHighlight
            yearMonth={yearMonth}
            today={today}
            daysInMonth={daysInMonth}
            dailyShiftCounts={dailyShiftCounts}
            totalStaff={staffCount}
          />
        )
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 max-w-2xl mx-auto md:max-w-none">

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-800">{orgSettings.name}</h1>
          <p className="text-sm text-gray-400 mt-0.5">{todayLabel}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setEditMode((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl border transition-all active:scale-95 shrink-0 cursor-pointer ${
              editMode
                ? 'bg-primary-500 text-white border-primary-500 shadow-sm'
                : 'text-gray-500 bg-white border-gray-200 hover:bg-gray-50 shadow-sm'
            }`}
          >
            <Settings2 className="w-3.5 h-3.5" />
            {editMode ? 'カスタマイズ中' : 'カスタマイズ'}
          </button>
          <HintTooltip
            title="ダッシュボードのカスタマイズ"
            content={
              <ul className="space-y-1.5">
                <li>• 「カスタマイズ」ボタンで編集モードになります</li>
                <li>• カードを<strong className="text-white">ドラッグ</strong>、または<strong className="text-white">▲▼ボタン</strong>で順番を入れ替えられます</li>
                <li>• 目のアイコンで各カードを<strong className="text-white">表示/非表示</strong>できます</li>
                <li>• 「リセット」で元の並び順に戻せます</li>
              </ul>
            }
          />
        </div>
      </div>

      {/* Edit mode banner */}
      {editMode && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 bg-primary-50 border border-primary-200 rounded-2xl">
          <div className="flex items-center gap-2 min-w-0">
            <Settings2 className="w-4 h-4 text-primary-500 shrink-0" />
            <p className="text-sm text-primary-700 font-medium leading-tight">
              <span className="hidden sm:inline">カードをドラッグ、または </span>
              ▲▼ で並び替え・目のアイコンで表示/非表示
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={resetLayout}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium text-gray-500 hover:bg-white border border-transparent hover:border-gray-200 transition-all active:scale-95 cursor-pointer"
              title="レイアウトをリセット"
            >
              <RotateCcw className="w-3 h-3" />
              <span className="hidden sm:inline">リセット</span>
            </button>
            <button
              onClick={() => setEditMode(false)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-primary-500 hover:bg-primary-600 transition-all active:scale-95 cursor-pointer shadow-sm"
            >
              <Check className="w-3.5 h-3.5" />
              完了
            </button>
          </div>
        </div>
      )}

      {/* Cards */}
      <div className={`space-y-5 ${editMode ? 'select-none' : ''}`}>
        {cards.map((card, idx) => {
          if (!editMode && !card.visible) return null
          const isDragging = dragId === card.id
          const isDragOver = dragOverId === card.id && dragId !== card.id
          return (
            <div
              key={card.id}
              draggable={editMode}
              onDragStart={editMode ? () => setDragId(card.id) : undefined}
              onDragOver={editMode ? (e) => { e.preventDefault(); setDragOverId(card.id) } : undefined}
              onDrop={editMode ? (e) => { e.preventDefault(); handleDrop(card.id) } : undefined}
              onDragEnd={editMode ? () => { setDragId(null); setDragOverId(null) } : undefined}
              className={`transition-all duration-200 ${
                isDragging ? 'opacity-40 scale-[0.98]' : ''
              } ${
                isDragOver ? 'ring-2 ring-primary-400 ring-offset-2 rounded-2xl' : ''
              }`}
            >
              {/* Edit mode toolbar */}
              {editMode && (
                <div className={`flex items-center gap-1.5 px-1 mb-1.5 ${!card.visible ? 'opacity-50' : ''}`}>
                  {/* Drag handle */}
                  <GripVertical className="w-4 h-4 text-gray-300 cursor-grab active:cursor-grabbing shrink-0" />
                  {/* Label */}
                  <span className="text-xs font-semibold text-gray-500 flex-1 truncate">
                    {CARD_LABELS[card.id]}
                  </span>
                  {/* Up */}
                  <button
                    onClick={() => moveCard(card.id, 'up')}
                    disabled={idx === 0}
                    className="w-7 h-7 flex items-center justify-center rounded-xl hover:bg-gray-100 disabled:opacity-20 transition-all active:scale-90 cursor-pointer"
                    aria-label="上に移動"
                  >
                    <ChevronUp className="w-3.5 h-3.5 text-gray-500" />
                  </button>
                  {/* Down */}
                  <button
                    onClick={() => moveCard(card.id, 'down')}
                    disabled={idx === cards.length - 1}
                    className="w-7 h-7 flex items-center justify-center rounded-xl hover:bg-gray-100 disabled:opacity-20 transition-all active:scale-90 cursor-pointer"
                    aria-label="下に移動"
                  >
                    <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
                  </button>
                  {/* Visibility toggle */}
                  <button
                    onClick={() => toggleVisibility(card.id)}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold transition-all active:scale-90 cursor-pointer border ${
                      card.visible
                        ? 'bg-white text-gray-500 border-gray-200 hover:bg-red-50 hover:text-red-500 hover:border-red-200'
                        : 'bg-primary-50 text-primary-600 border-primary-200 hover:bg-primary-100'
                    }`}
                  >
                    {card.visible
                      ? <><EyeOff className="w-3 h-3 shrink-0" /><span>非表示</span></>
                      : <><Eye className="w-3 h-3 shrink-0" /><span>表示</span></>
                    }
                  </button>
                </div>
              )}

              {/* Card content */}
              <div className={`transition-opacity duration-200 ${editMode && !card.visible ? 'opacity-30 pointer-events-none' : ''}`}>
                {renderCard(card.id)}
              </div>
            </div>
          )
        })}
      </div>

      {/* Hidden cards hint (non-edit mode) */}
      {!editMode && cards.some((c) => !c.visible) && (
        <button
          onClick={() => setEditMode(true)}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl text-xs text-gray-400 border border-dashed border-gray-200 hover:border-primary-300 hover:text-primary-500 transition-all cursor-pointer"
        >
          <EyeOff className="w-3.5 h-3.5" />
          {cards.filter((c) => !c.visible).length}個のカードが非表示 — タップして編集
        </button>
      )}
    </div>
  )
}

// ─── Sub components ────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, unit, gradient, alert }: {
  icon: React.ReactNode; label: string; value: string; unit: string
  gradient: string; alert?: boolean
}) {
  const [displayed, setDisplayed] = useState(0)
  const numericValue = parseInt(value, 10)
  const isNumeric = !isNaN(numericValue)
  const prevRef = useRef(0)

  useEffect(() => {
    if (!isNumeric) return
    const start = prevRef.current
    const end = numericValue
    if (start === end) return
    const duration = 600
    const startTime = performance.now()
    const tick = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplayed(Math.round(start + (end - start) * eased))
      if (progress < 1) requestAnimationFrame(tick)
      else prevRef.current = end
    }
    requestAnimationFrame(tick)
  }, [numericValue, isNumeric])

  return (
    <div className={`relative overflow-hidden rounded-2xl shadow-sm border ${alert ? 'border-amber-300' : 'border-transparent'} transition-transform duration-100 active:scale-[0.98]`}>
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-90`} />
      <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full bg-white opacity-10" />
      <div className="absolute -right-1 -bottom-5 w-14 h-14 rounded-full bg-white opacity-10" />
      <div className="relative p-4 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="w-9 h-9 rounded-xl bg-white bg-opacity-25 flex items-center justify-center">{icon}</div>
          {alert && <span className="w-2 h-2 rounded-full bg-white animate-pulse" />}
        </div>
        <div>
          <p className="text-xs text-white text-opacity-80 truncate">{label}</p>
          <p className="text-2xl font-bold text-white leading-tight">
            {isNumeric ? displayed : value}
            <span className="text-sm font-medium ml-0.5 opacity-80">{unit}</span>
          </p>
        </div>
      </div>
    </div>
  )
}

function QuickLink({ to, icon, label, desc, color }: {
  to: string; icon: React.ReactNode; label: string; desc: string; color: string
}) {
  return (
    <Link to={to} className="card flex items-center gap-4 p-4 hover:shadow-md active:scale-[0.98] transition-all duration-150">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${color}`}>{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-800 text-sm">{label}</p>
        <p className="text-xs text-gray-400 truncate">{desc}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
    </Link>
  )
}

function MonthCalendarHighlight({
  yearMonth, today, daysInMonth, dailyShiftCounts, totalStaff,
}: {
  yearMonth: string; today: Date; daysInMonth: number
  dailyShiftCounts: Record<string, number>; totalStaff: number
}) {
  const firstDow = getDay(parseISO(`${yearMonth}-01`))
  const todayNum = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') === yearMonth
    ? today.getDate() : -1

  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const weeks = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))

  const DOW_LABELS = ['日', '月', '火', '水', '木', '金', '土']

  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-3">
        <CalendarDays className="w-4 h-4 text-primary-500" />
        <h2 className="font-bold text-gray-700 text-sm">今月のカレンダーハイライト</h2>
      </div>
      <div className="flex items-center gap-3 mb-3 text-[10px] text-gray-400">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary-400 inline-block" />多め</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary-200 inline-block" />少なめ</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-200 inline-block" />未登録</span>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {DOW_LABELS.map((d, i) => (
          <div key={d} className={`text-center text-[10px] font-medium pb-1 ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'}`}>{d}</div>
        ))}
      </div>
      <div className="space-y-1">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-0.5">
            {week.map((day, di) => {
              if (day === null) return <div key={di} />
              const count = dailyShiftCounts[String(day)] ?? 0
              const isToday = day === todayNum
              const ratio = totalStaff > 0 ? count / totalStaff : 0
              const dotColor = count === 0 ? 'bg-gray-200' : ratio >= 0.6 ? 'bg-primary-400' : ratio >= 0.3 ? 'bg-primary-300' : 'bg-primary-200'
              const isSun = di === 0
              const isSat = di === 6
              return (
                <div key={di} className="flex flex-col items-center py-1">
                  <span className={`text-[11px] font-medium leading-tight w-6 h-6 flex items-center justify-center rounded-full transition-all ${isToday ? 'bg-primary-500 text-white font-bold' : isSun ? 'text-red-400' : isSat ? 'text-blue-400' : 'text-gray-600'}`}>
                    {day}
                  </span>
                  <span className={`mt-0.5 w-1.5 h-1.5 rounded-full ${dotColor}`} title={`${count}名出勤`} />
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
