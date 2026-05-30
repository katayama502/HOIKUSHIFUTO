import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import {
  ChevronLeft, ChevronRight, AlertTriangle, CheckCircle,
  Trash2, X, Filter,
} from 'lucide-react'
import { format, addMonths, subMonths, getDay, getDaysInMonth, parseISO } from 'date-fns'
import { ja } from 'date-fns/locale'
import { useStore } from '../store/useStore'
import { calcWorkHours, getYearMonth } from '../utils/shift'
import { AGE_RATIO } from '../types'
import type { ShiftPattern } from '../types'

// ─── StaffConstraint interface (added by Agent 2) ───────────────────────────
interface StaffConstraint {
  staffId: string
  availableDays: number[]
  unavailableDates: string[]
  minDaysPerMonth: number
  maxDaysPerMonth: number
  preferredPatternIds: string[]
}

// ─── Drag payload type ───────────────────────────────────────────────────────
interface DragPayload {
  type: 'from-panel' | 'from-cell'
  staffId: string
  patternId: string
  sourceDay?: string
}

// ─── Popover state ────────────────────────────────────────────────────────────
interface PopoverState {
  staffId: string
  day: string
  x: number
  y: number
}

// ─── Day names (Mon–Sun) ─────────────────────────────────────────────────────
const DAY_NAMES = ['月', '火', '水', '木', '金', '土', '日']

// ─── Build calendar grid (Mon-start) ─────────────────────────────────────────
function buildCalendarGrid(yearMonth: string): (Date | null)[][] {
  const base = parseISO(`${yearMonth}-01`)
  const daysInMonth = getDaysInMonth(base)
  const firstDow = getDay(base) // 0=Sun … 6=Sat
  // convert to Mon-based offset (Mon=0 … Sun=6)
  const offset = (firstDow + 6) % 7

  const cells: (Date | null)[] = [
    ...Array(offset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => {
      const d = new Date(base)
      d.setDate(i + 1)
      return d
    }),
  ]
  // fill to multiple of 7
  while (cells.length % 7 !== 0) cells.push(null)

  const rows: (Date | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7))
  return rows
}

// ─── Constraint helpers ────────────────────────────────────────────────────
function isUnavailableDate(constraint: StaffConstraint | undefined, dateStr: string): boolean {
  if (!constraint) return false
  return constraint.unavailableDates.includes(dateStr)
}

function isUnavailableDay(constraint: StaffConstraint | undefined, date: Date): boolean {
  if (!constraint) return false
  const dow = date.getDay() // 0=Sun … 6=Sat
  return !constraint.availableDays.includes(dow)
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ShiftCalendarPage() {
  const {
    staff, shiftPatterns, shifts, classRooms,
    setShiftEntry, clearShiftEntry,
  } = useStore()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const staffConstraints: Record<string, StaffConstraint> = (useStore() as any).staffConstraints ?? {}

  const [currentDate, setCurrentDate] = useState(new Date())
  const [dragPayload, setDragPayload] = useState<DragPayload | null>(null)
  const [dragOverDay, setDragOverDay] = useState<string | null>(null)
  const [popover, setPopover] = useState<PopoverState | null>(null)
  const [filterMode, setFilterMode] = useState<'all' | 'constrained'>('all')
  const [showViolations, setShowViolations] = useState(true)
  const [selectedPatterns, setSelectedPatterns] = useState<Record<string, string>>({})
  const popoverRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const yearMonth = getYearMonth(currentDate)
  const calendarGrid = useMemo(() => buildCalendarGrid(yearMonth), [yearMonth])
  const today = new Date()
  const todayStr = format(today, 'yyyy-MM-dd')

  const patternMap = useMemo(
    () => Object.fromEntries(shiftPatterns.map((p) => [p.id, p])),
    [shiftPatterns]
  )

  const totalRequired = useMemo(
    () => classRooms.reduce((sum, cr) => sum + Math.ceil(cr.childrenCount / (AGE_RATIO[cr.ageGroup] ?? 6)), 0),
    [classRooms]
  )

  // Monthly stats per staff
  const staffStats = useMemo(() => {
    const result: Record<string, { workDays: number; totalHours: number }> = {}
    for (const s of staff) {
      const monthData = shifts[yearMonth]?.[s.id] ?? {}
      let workDays = 0
      let totalHours = 0
      for (const entry of Object.values(monthData)) {
        const p = patternMap[entry.patternId]
        if (!p) continue
        if (!p.isOff) {
          workDays++
          totalHours += calcWorkHours(p)
        }
      }
      result[s.id] = { workDays, totalHours }
    }
    return result
  }, [staff, shifts, yearMonth, patternMap])

  // Placement count per day
  const placementCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    const daysInMonth = getDaysInMonth(parseISO(`${yearMonth}-01`))
    for (let d = 1; d <= daysInMonth; d++) {
      const dayStr = String(d)
      counts[dayStr] = staff.filter((s) => {
        const entry = shifts[yearMonth]?.[s.id]?.[dayStr]
        if (!entry) return false
        const p = patternMap[entry.patternId]
        return p && !p.isOff
      }).length
    }
    return counts
  }, [staff, shifts, yearMonth, patternMap])

  // Unscheduled staff count
  const unscheduledCount = useMemo(() => {
    return staff.filter((s) => {
      const stats = staffStats[s.id]
      return !stats || stats.workDays === 0
    }).length
  }, [staff, staffStats])

  // Constraint status for a staff member
  function getConstraintStatus(staffId: string): 'ok' | 'warning' | 'error' {
    const constraint = staffConstraints[staffId]
    const stats = staffStats[staffId]
    if (!constraint || !stats) return 'ok'
    if (stats.workDays > constraint.maxDaysPerMonth) return 'error'
    if (stats.workDays < constraint.minDaysPerMonth) {
      // check if there's still time (days remaining in month)
      const daysInMonth = getDaysInMonth(parseISO(`${yearMonth}-01`))
      const remaining = daysInMonth - (today.getMonth() + 1 === currentDate.getMonth() + 1 && today.getFullYear() === currentDate.getFullYear()
        ? today.getDate()
        : daysInMonth)
      if (remaining >= constraint.minDaysPerMonth - stats.workDays) return 'warning'
      return 'error'
    }
    if (stats.workDays >= constraint.maxDaysPerMonth - 1) return 'warning'
    return 'ok'
  }

  // Constraint check for a specific assignment
  function getChipConstraintStatus(staffId: string, date: Date): 'ok' | 'unavailable-date' | 'unavailable-day' {
    const dateStr = format(date, 'yyyy-MM-dd')
    const constraint = staffConstraints[staffId]
    if (isUnavailableDate(constraint, dateStr)) return 'unavailable-date'
    if (isUnavailableDay(constraint, date)) return 'unavailable-day'
    return 'ok'
  }

  // Filter staff
  const displayStaff = useMemo(() => {
    if (filterMode === 'constrained') {
      return staff.filter((s) => staffConstraints[s.id] !== undefined)
    }
    return staff
  }, [staff, filterMode, staffConstraints])

  // Default pattern for a staff member
  function getDefaultPattern(staffId: string): string {
    if (selectedPatterns[staffId]) return selectedPatterns[staffId]
    const constraint = staffConstraints[staffId]
    if (constraint?.preferredPatternIds?.length > 0) return constraint.preferredPatternIds[0]
    return shiftPatterns.find((p) => !p.isOff)?.id ?? shiftPatterns[0]?.id ?? ''
  }

  // ─── Drag handlers ──────────────────────────────────────────────────────────
  function handlePanelDragStart(e: React.DragEvent, staffId: string) {
    const patternId = getDefaultPattern(staffId)
    const payload: DragPayload = { type: 'from-panel', staffId, patternId }
    setDragPayload(payload)
    e.dataTransfer.setData('application/json', JSON.stringify(payload))
    e.dataTransfer.effectAllowed = 'copy'

    // Drag image: colored circle
    const canvas = document.createElement('canvas')
    canvas.width = 36; canvas.height = 36
    const ctx = canvas.getContext('2d')
    if (ctx) {
      const s = staff.find((st) => st.id === staffId)
      ctx.beginPath()
      ctx.arc(18, 18, 16, 0, Math.PI * 2)
      ctx.fillStyle = s?.color ?? '#fb923c'
      ctx.fill()
      ctx.fillStyle = '#fff'
      ctx.font = 'bold 16px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(s?.name?.[0] ?? '?', 18, 18)
    }
    e.dataTransfer.setDragImage(canvas, 18, 18)
  }

  function handleChipDragStart(e: React.DragEvent, staffId: string, day: string, patternId: string) {
    e.stopPropagation()
    const payload: DragPayload = { type: 'from-cell', staffId, patternId, sourceDay: day }
    setDragPayload(payload)
    e.dataTransfer.setData('application/json', JSON.stringify(payload))
    e.dataTransfer.effectAllowed = 'move'

    const canvas = document.createElement('canvas')
    canvas.width = 36; canvas.height = 36
    const ctx = canvas.getContext('2d')
    if (ctx) {
      const s = staff.find((st) => st.id === staffId)
      ctx.beginPath()
      ctx.arc(18, 18, 16, 0, Math.PI * 2)
      ctx.fillStyle = s?.color ?? '#fb923c'
      ctx.fill()
      ctx.fillStyle = '#fff'
      ctx.font = 'bold 16px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(s?.name?.[0] ?? '?', 18, 18)
    }
    e.dataTransfer.setDragImage(canvas, 18, 18)
  }

  function handleCellDragOver(e: React.DragEvent, dayStr: string) {
    e.preventDefault()
    e.dataTransfer.dropEffect = dragPayload?.type === 'from-panel' ? 'copy' : 'move'
    setDragOverDay(dayStr)
  }

  function handleCellDrop(e: React.DragEvent, dayStr: string) {
    e.preventDefault()
    setDragOverDay(null)

    let payload: DragPayload | null = null
    try {
      payload = JSON.parse(e.dataTransfer.getData('application/json')) as DragPayload
    } catch {
      payload = dragPayload
    }
    if (!payload) return

    if (payload.type === 'from-panel') {
      setShiftEntry(yearMonth, payload.staffId, dayStr, { patternId: payload.patternId, note: '' })
    } else if (payload.type === 'from-cell' && payload.sourceDay) {
      if (payload.sourceDay !== dayStr) {
        // Move: copy to new day, clear old day
        setShiftEntry(yearMonth, payload.staffId, dayStr, { patternId: payload.patternId, note: '' })
        clearShiftEntry(yearMonth, payload.staffId, payload.sourceDay)
      }
    }
    setDragPayload(null)
  }

  function handlePanelDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOverDay(null)
    let payload: DragPayload | null = null
    try {
      payload = JSON.parse(e.dataTransfer.getData('application/json')) as DragPayload
    } catch {
      payload = dragPayload
    }
    if (!payload) return
    // Drop on panel: remove if from-cell
    if (payload.type === 'from-cell' && payload.sourceDay) {
      clearShiftEntry(yearMonth, payload.staffId, payload.sourceDay)
    }
    setDragPayload(null)
  }

  function handleDragEnd() {
    setDragOverDay(null)
    setDragPayload(null)
  }

  // ─── Popover ──────────────────────────────────────────────────────────────
  const openPopover = useCallback((e: React.MouseEvent, staffId: string, day: string) => {
    e.stopPropagation()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    // Compute position, keep inside viewport
    let x = rect.right + 8
    let y = rect.top
    if (x + 200 > window.innerWidth) x = rect.left - 208
    if (y + 300 > window.innerHeight) y = window.innerHeight - 310
    setPopover({ staffId, day, x, y })
  }, [])

  function handlePopoverPattern(patternId: string) {
    if (!popover) return
    setShiftEntry(yearMonth, popover.staffId, popover.day, { patternId, note: '' })
    setPopover(null)
  }

  function handlePopoverDelete() {
    if (!popover) return
    clearShiftEntry(yearMonth, popover.staffId, popover.day)
    setPopover(null)
  }

  // Close popover on outside click or Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setPopover(null) }
    function onMouseDown(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setPopover(null)
      }
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onMouseDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onMouseDown)
    }
  }, [])

  // ─── Violation computation ─────────────────────────────────────────────────
  const violations = useMemo(() => {
    const list: { type: 'staff-max' | 'staff-min' | 'day-short'; message: string; severity: 'error' | 'warning' }[] = []

    for (const s of staff) {
      const constraint = staffConstraints[s.id]
      const stats = staffStats[s.id]
      if (!stats) continue
      if (constraint) {
        if (stats.workDays > constraint.maxDaysPerMonth) {
          list.push({
            type: 'staff-max',
            message: `${s.name}: 今月 ${stats.workDays}日配置（上限${constraint.maxDaysPerMonth}日）`,
            severity: 'error',
          })
        } else if (stats.workDays < constraint.minDaysPerMonth) {
          list.push({
            type: 'staff-min',
            message: `${s.name}: 今月 ${stats.workDays}日配置（下限${constraint.minDaysPerMonth}日）`,
            severity: 'warning',
          })
        }
      }
    }

    const daysInMonth = getDaysInMonth(parseISO(`${yearMonth}-01`))
    for (let d = 1; d <= daysInMonth; d++) {
      const dayStr = String(d)
      const count = placementCounts[dayStr] ?? 0
      if (count > 0 && count < totalRequired) {
        const date = parseISO(`${yearMonth}-${String(d).padStart(2, '0')}`)
        const label = format(date, 'M/d（E）', { locale: ja })
        list.push({
          type: 'day-short',
          message: `${label}: 配置人数 ${count}名（必要${totalRequired}名）`,
          severity: 'error',
        })
      }
    }

    return list
  }, [staff, staffConstraints, staffStats, placementCounts, totalRequired, yearMonth])

  const monthLabel = format(currentDate, 'yyyy年M月', { locale: ja })

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full min-h-0" style={{ height: 'calc(100vh - 88px)' }}>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 px-1 pb-3 shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentDate((d) => subMonths(d, 1))}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-gray-200 hover:bg-gray-50 active:bg-gray-100 transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          </button>
          <h1 className="text-lg font-bold text-gray-800 min-w-[100px] text-center">{monthLabel}</h1>
          <button
            onClick={() => setCurrentDate((d) => addMonths(d, 1))}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-gray-200 hover:bg-gray-50 active:bg-gray-100 transition-colors"
          >
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentDate(new Date())}
            className="px-3 py-1.5 rounded-xl text-xs font-medium bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            今月
          </button>
          <button
            onClick={() => setShowViolations((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors
              ${violations.length > 0
                ? 'bg-red-50 border-red-200 text-red-600'
                : 'bg-green-50 border-green-200 text-green-600'
              }`}
          >
            {violations.length > 0
              ? <AlertTriangle className="w-3.5 h-3.5" />
              : <CheckCircle className="w-3.5 h-3.5" />
            }
            {violations.length > 0 ? `${violations.length}件の違反` : '条件クリア'}
          </button>
        </div>
      </div>

      {/* ── Violations panel ───────────────────────────────────────── */}
      {showViolations && violations.length > 0 && (
        <div className="mb-3 bg-white border border-red-100 rounded-2xl p-3 shrink-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-red-600 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              制約違反・警告
            </span>
            <button onClick={() => setShowViolations(false)} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-1 max-h-28 overflow-y-auto">
            {violations.map((v, i) => (
              <div
                key={i}
                className={`text-xs px-2 py-1 rounded-lg flex items-start gap-1.5 ${
                  v.severity === 'error' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
                }`}
              >
                <span className="mt-0.5 shrink-0">{v.severity === 'error' ? '🔴' : '🟡'}</span>
                {v.message}
              </div>
            ))}
          </div>
        </div>
      )}
      {showViolations && violations.length === 0 && (
        <div className="mb-3 bg-green-50 border border-green-100 rounded-2xl px-4 py-2.5 shrink-0 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
          <span className="text-xs text-green-700 font-medium">全ての条件をクリアしています</span>
        </div>
      )}

      {/* ── 2-panel layout ─────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 gap-4">

        {/* ── Staff Panel ──────────────────────────────────────────── */}
        <div
          ref={panelRef}
          className="w-[220px] shrink-0 flex flex-col bg-white border border-orange-100 rounded-2xl overflow-hidden"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handlePanelDrop}
        >
          {/* Panel header */}
          <div className="px-3 pt-3 pb-2 border-b border-orange-50 shrink-0">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-gray-700">先生を配置</span>
              {unscheduledCount > 0 && (
                <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  未配置 {unscheduledCount}名
                </span>
              )}
            </div>
            {/* Filter toggle */}
            <div className="flex bg-gray-100 rounded-xl p-0.5 text-[10px] font-medium">
              <button
                onClick={() => setFilterMode('all')}
                className={`flex-1 py-1.5 rounded-[10px] transition-colors ${filterMode === 'all' ? 'bg-white text-gray-700 shadow-sm' : 'text-gray-500'}`}
              >
                すべて
              </button>
              <button
                onClick={() => setFilterMode('constrained')}
                className={`flex-1 py-1.5 rounded-[10px] transition-colors flex items-center justify-center gap-0.5 ${filterMode === 'constrained' ? 'bg-white text-gray-700 shadow-sm' : 'text-gray-500'}`}
              >
                <Filter className="w-2.5 h-2.5" />
                制約あり
              </button>
            </div>
          </div>

          {/* Staff cards (scrollable) */}
          <div className="flex-1 overflow-y-auto px-2 py-2 space-y-2">
            {displayStaff.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-4">職員がいません</p>
            )}
            {displayStaff.map((s) => {
              const stats = staffStats[s.id] ?? { workDays: 0, totalHours: 0 }
              const status = getConstraintStatus(s.id)
              const defaultPat = getDefaultPattern(s.id)
              const constraint = staffConstraints[s.id]

              return (
                <div
                  key={s.id}
                  draggable
                  onDragStart={(e) => handlePanelDragStart(e, s.id)}
                  onDragEnd={handleDragEnd}
                  className="bg-gray-50 border border-gray-100 rounded-xl p-2.5 cursor-grab active:cursor-grabbing select-none hover:shadow-sm hover:border-orange-200 transition-all"
                >
                  {/* Top row: avatar + name + status dot */}
                  <div className="flex items-center gap-2 mb-1.5">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                      style={{ backgroundColor: s.color }}
                    >
                      {s.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-semibold text-gray-700 truncate">{s.name}</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold shrink-0 ${
                          s.employment === 'fulltime' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'
                        }`}>
                          {s.employment === 'fulltime' ? '正' : 'P'}
                        </span>
                      </div>
                      <div className="text-[10px] text-gray-400">{stats.workDays}日 / {stats.totalHours.toFixed(0)}h</div>
                    </div>
                    {/* Constraint status dot */}
                    {constraint && (
                      <div
                        className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                          status === 'ok' ? 'bg-green-400' : status === 'warning' ? 'bg-amber-400' : 'bg-red-500'
                        }`}
                        title={
                          status === 'ok' ? '制約OK' :
                          status === 'warning' ? '制約に近づいています' : '制約違反'
                        }
                      />
                    )}
                  </div>

                  {/* Pattern selector */}
                  <select
                    value={defaultPat}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      e.stopPropagation()
                      setSelectedPatterns((prev) => ({ ...prev, [s.id]: e.target.value }))
                    }}
                    className="w-full text-[10px] border border-gray-200 rounded-lg px-1.5 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-primary-300 cursor-pointer"
                    style={{ color: patternMap[defaultPat]?.color ?? '#374151' }}
                  >
                    {shiftPatterns.filter((p) => !p.isOff).map((p) => (
                      <option key={p.id} value={p.id} style={{ color: p.color }}>
                        {p.name} ({p.startTime})
                      </option>
                    ))}
                  </select>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Calendar Grid ─────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 flex flex-col bg-white border border-orange-100 rounded-2xl overflow-hidden">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-gray-100 shrink-0">
            {DAY_NAMES.map((name, i) => (
              <div
                key={name}
                className={`py-2.5 text-center text-xs font-bold border-r last:border-r-0 border-gray-100 ${
                  i === 5 ? 'text-blue-500 bg-blue-50/50' :
                  i === 6 ? 'text-red-500 bg-red-50/50' :
                  'text-gray-500'
                }`}
              >
                {name}
              </div>
            ))}
          </div>

          {/* Weeks (scrollable) */}
          <div className="flex-1 overflow-y-auto">
            {calendarGrid.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7 border-b last:border-b-0 border-gray-100 min-h-[100px]">
                {week.map((date, di) => {
                  if (!date) {
                    return (
                      <div
                        key={di}
                        className="bg-gray-50 border-r last:border-r-0 border-gray-100"
                      />
                    )
                  }
                  const dayStr = String(date.getDate())
                  const dateISO = format(date, 'yyyy-MM-dd')
                  const isToday = dateISO === todayStr
                  const isWeekend = di === 5 || di === 6
                  const isSunday = di === 6
                  const count = placementCounts[dayStr] ?? 0
                  const isUnderstaffed = count > 0 && count < totalRequired
                  const isFullyStaffed = count >= totalRequired
                  const isDragTarget = dragOverDay === dayStr

                  // Staff placed on this day
                  const placedStaff = staff
                    .map((s) => {
                      const entry = shifts[yearMonth]?.[s.id]?.[dayStr]
                      if (!entry) return null
                      const pattern = patternMap[entry.patternId]
                      if (!pattern) return null
                      return { staff: s, pattern, entry }
                    })
                    .filter(Boolean) as { staff: typeof staff[0]; pattern: ShiftPattern; entry: { patternId: string; note: string } }[]

                  return (
                    <div
                      key={di}
                      className={`border-r last:border-r-0 border-gray-100 p-1 flex flex-col gap-0.5 transition-colors
                        ${isDragTarget ? 'ring-2 ring-inset ring-primary-400 bg-primary-50/30' : ''}
                        ${!isDragTarget && isUnderstaffed ? 'bg-red-50/60' : ''}
                        ${!isDragTarget && isFullyStaffed && count > 0 ? 'bg-green-50/30' : ''}
                        ${!isDragTarget && !isUnderstaffed && !isFullyStaffed && isWeekend ? (isSunday ? 'bg-red-50/20' : 'bg-blue-50/20') : ''}
                      `}
                      onDragOver={(e) => handleCellDragOver(e, dayStr)}
                      onDragLeave={() => setDragOverDay(null)}
                      onDrop={(e) => handleCellDrop(e, dayStr)}
                    >
                      {/* Date number */}
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-xs font-bold leading-none px-1 py-0.5 rounded-full w-6 h-6 flex items-center justify-center ${
                            isToday
                              ? 'bg-primary-500 text-white'
                              : isSunday ? 'text-red-500'
                              : di === 5 ? 'text-blue-500'
                              : 'text-gray-700'
                          }`}
                        >
                          {date.getDate()}
                        </span>
                        {/* Placement count badge */}
                        {count > 0 && (
                          <span
                            className={`text-[9px] font-bold px-1 rounded-full ${
                              isUnderstaffed ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'
                            }`}
                          >
                            {count}/{totalRequired}名
                          </span>
                        )}
                      </div>

                      {/* Placed staff chips */}
                      <div className="flex flex-col gap-0.5 flex-1">
                        {placedStaff.map(({ staff: s, pattern }) => {
                          const chipStatus = getChipConstraintStatus(s.id, date)
                          const hasWarning = chipStatus !== 'ok'
                          return (
                            <div
                              key={s.id}
                              draggable
                              onDragStart={(e) => handleChipDragStart(e, s.id, dayStr, pattern.id)}
                              onDragEnd={handleDragEnd}
                              onClick={(e) => openPopover(e, s.id, dayStr)}
                              onContextMenu={(e) => {
                                e.preventDefault()
                                clearShiftEntry(yearMonth, s.id, dayStr)
                              }}
                              className={`flex items-center gap-0.5 px-1 py-0.5 rounded-md text-[9px] font-medium cursor-grab active:cursor-grabbing select-none transition-all hover:opacity-80
                                ${hasWarning ? (chipStatus === 'unavailable-date' ? 'ring-1 ring-red-400' : 'ring-1 ring-amber-400') : ''}
                              `}
                              style={{
                                backgroundColor: pattern.bgColor,
                                color: pattern.color,
                              }}
                              title={`${s.name} — ${pattern.name}${hasWarning ? '\n⚠️ 制約違反' : ''}`}
                            >
                              {/* Avatar */}
                              <span
                                className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-white font-bold shrink-0"
                                style={{ backgroundColor: s.color, fontSize: 7 }}
                              >
                                {s.name[0]}
                              </span>
                              <span className="truncate max-w-[40px]">{s.name.split(' ')[0]}</span>
                              {/* Pattern badge */}
                              <span
                                className="shrink-0 text-[8px] font-bold px-0.5 rounded"
                                style={{ backgroundColor: pattern.color + '33', color: pattern.color }}
                              >
                                {pattern.name}
                              </span>
                              {/* Warning indicator */}
                              {hasWarning && <span className="shrink-0 text-[8px]">⚠</span>}
                              {/* Remove button */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  clearShiftEntry(yearMonth, s.id, dayStr)
                                }}
                                className="ml-auto shrink-0 opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity text-current"
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Pattern-change Popover ──────────────────────────────────── */}
      {popover && (
        <div
          ref={popoverRef}
          className="fixed z-50 bg-white rounded-2xl shadow-2xl border border-gray-100 p-3 w-52"
          style={{ left: popover.x, top: popover.y }}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-700">
              {staff.find((s) => s.id === popover.staffId)?.name} — {popover.day}日
            </span>
            <button onClick={() => setPopover(null)} className="text-gray-400 hover:text-gray-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Pattern buttons */}
          <div className="grid grid-cols-2 gap-1.5 mb-2">
            {shiftPatterns.map((p) => {
              const isCurrent = shifts[yearMonth]?.[popover.staffId]?.[popover.day]?.patternId === p.id
              return (
                <button
                  key={p.id}
                  onClick={() => handlePopoverPattern(p.id)}
                  className={`px-2 py-2 rounded-xl text-xs font-semibold border-2 transition-all active:scale-95 ${
                    isCurrent ? 'ring-2 ring-offset-1 ring-gray-400' : ''
                  }`}
                  style={{ backgroundColor: p.bgColor, color: p.color, borderColor: p.color + '55' }}
                >
                  {p.name}
                  {!p.isOff && <div className="text-[9px] opacity-70">{p.startTime}</div>}
                </button>
              )
            })}
          </div>

          {/* Delete button */}
          <button
            onClick={handlePopoverDelete}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold text-red-500 bg-red-50 border border-red-100 hover:bg-red-100 active:scale-95 transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
            削除
          </button>
        </div>
      )}
    </div>
  )
}
