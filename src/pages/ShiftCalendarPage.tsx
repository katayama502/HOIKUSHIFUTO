import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import {
  ChevronLeft, ChevronRight, AlertTriangle, CheckCircle,
  Printer, Download, ChevronDown, ChevronUp, Check, X,
  Copy, UserPlus, Pencil, Wand2, LayoutGrid, Trash2,
} from 'lucide-react'
import { format, addMonths, subMonths, getDay, getDaysInMonth, parseISO, addWeeks, subWeeks } from 'date-fns'
import { ja } from 'date-fns/locale'
import { useStore } from '../store/useStore'
import {
  calcWorkHours, getYearMonth, getDaysArray,
  generateShiftExcel, downloadFile,
  getDaySlots,
} from '../utils/shift'
import { validateMonth } from '../utils/validation'
import { AGE_RATIO } from '../types'
import type { ShiftPattern } from '../types'
import StaffPanel from '../components/StaffPanel'
import AutoScheduleModal from '../components/AutoScheduleModal'
import WorkflowPanel from '../components/WorkflowPanel'
import HintTooltip from '../components/HintTooltip'

// ─── Drag payload ─────────────────────────────────────────────────────────────
type DragPayload =
  | { type: 'from-rail'; staffId: string; patternId: string }
  | { type: 'from-cell'; staffId: string; patternId: string; sourceYM: string; sourceSlotKey: string }

// ─── Popover state ────────────────────────────────────────────────────────────
interface PopoverState {
  staffId: string
  slotKey: string       // e.g. "15_early"
  day: string           // just the day number string
  x: number
  y: number
}

// ─── Hover tooltip state ─────────────────────────────────────────────────────
interface TooltipState {
  staffId: string
  slotKey: string
  x: number
  y: number
}

// ─── Mobile chip sheet state ──────────────────────────────────────────────────
interface MobileChipSheetState {
  staffId: string
  slotKey: string       // specific slot to edit
  day: string
  ym: string
}

// ─── Day names (Mon–Sun) ─────────────────────────────────────────────────────
const DAY_NAMES = ['月', '火', '水', '木', '金', '土', '日']

// ─── Build calendar grid (Mon-start) ─────────────────────────────────────────
function buildCalendarGrid(yearMonth: string): (Date | null)[][] {
  const base = parseISO(`${yearMonth}-01`)
  const daysInMonth = getDaysInMonth(base)
  const firstDow = getDay(base) // 0=Sun … 6=Sat
  const offset = (firstDow + 6) % 7 // Mon=0 … Sun=6

  const cells: (Date | null)[] = [
    ...Array(offset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => {
      const d = new Date(base)
      d.setDate(i + 1)
      return d
    }),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const rows: (Date | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7))
  return rows
}

// ─── Week days for weekly view (Mon start) ───────────────────────────────────
function buildWeekDays(anchor: Date): Date[] {
  const dow = anchor.getDay()
  const monOffset = (dow + 6) % 7
  const mon = new Date(anchor)
  mon.setDate(anchor.getDate() - monOffset)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon)
    d.setDate(mon.getDate() + i)
    return d
  })
}

// ─── Count working days in month (Mon–Fri) ───────────────────────────────────
function countWorkingDays(yearMonth: string): number {
  const days = getDaysArray(yearMonth)
  return days.filter((d) => {
    const dow = d.getDay()
    return dow !== 0 && dow !== 6
  }).length
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ShiftCalendarPage() {
  const {
    staff, shiftPatterns, shifts, classRooms,
    setShiftEntry, clearShiftSlot, setBulkMonthShifts,
  } = useStore()
  const staffConstraints = useStore((s) => s.staffConstraints) ?? {}

  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month')
  const [weekAnchor, setWeekAnchor] = useState(new Date())

  const [dragPayload, setDragPayload] = useState<DragPayload | null>(null)
  const [dragOverKey, setDragOverKey] = useState<string | null>(null)

  const [activePatternId, setActivePatternId] = useState<string>(() => {
    return shiftPatterns.find((p) => !p.isOff)?.id ?? shiftPatterns[0]?.id ?? ''
  })

  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null)
  const [popover, setPopover] = useState<PopoverState | null>(null)
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)
  const tooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [showViolations, setShowViolations] = useState(false)
  const [showCopyModal, setShowCopyModal] = useState(false)
  const [mobileChipSheet, setMobileChipSheet] = useState<MobileChipSheetState | null>(null)
  // Pulse hint: when user taps cell without staff selected
  const [pulseStaffStrip, setPulseStaffStrip] = useState(false)
  // Bottom tray expanded/collapsed (mobile)
  const [trayExpanded, setTrayExpanded] = useState(false)

  // Staff panel (add / edit)
  const [staffPanelOpen, setStaffPanelOpen] = useState(false)
  const [staffPanelTargetId, setStaffPanelTargetId] = useState<string | null>(null)

  // Workflow panel (per-staff month batch entry)
  const [workflowOpen, setWorkflowOpen] = useState(false)
  const [workflowStaffId, setWorkflowStaffId] = useState<string | null>(null)

  function openWorkflow(staffId: string) {
    setWorkflowStaffId(staffId)
    setWorkflowOpen(true)
  }

  function openStaffPanel(id: string | null) {
    setStaffPanelTargetId(id)
    setStaffPanelOpen(true)
    setTrayExpanded(false)
  }

  // Auto-schedule modal
  const [autoScheduleOpen, setAutoScheduleOpen] = useState(false)

  // Clear month modal
  const [showClearModal, setShowClearModal] = useState(false)

  function handleClearMonth() {
    setBulkMonthShifts(yearMonth, {})
    setShowClearModal(false)
  }

  // Mobile detection
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const popoverRef = useRef<HTMLDivElement>(null)
  const staffStripRef = useRef<HTMLDivElement>(null)
  const today = new Date()
  const todayStr = format(today, 'yyyy-MM-dd')

  const yearMonth = getYearMonth(currentDate)
  const ymMonth = Number(yearMonth.split('-')[1])

  const prevYM = getYearMonth(subMonths(currentDate, 1))
  const prevMonth = Number(prevYM.split('-')[1])

  const monthLabel = format(currentDate, 'yyyy年M月', { locale: ja })
  const calendarGrid = useMemo(() => buildCalendarGrid(yearMonth), [yearMonth])
  const weekDays = useMemo(() => buildWeekDays(weekAnchor), [weekAnchor])

  const patternMap = useMemo(
    () => Object.fromEntries(shiftPatterns.map((p) => [p.id, p])),
    [shiftPatterns]
  )

  const totalRequired = useMemo(
    () => classRooms.reduce((sum, cr) => sum + Math.ceil(cr.childrenCount / (AGE_RATIO[cr.ageGroup] ?? 6)), 0),
    [classRooms]
  )

  // ─── Monthly stats per staff ─────────────────────────────────────────────
  const staffStats = useMemo(() => {
    const result: Record<string, { workDays: number; totalHours: number }> = {}
    for (const s of staff) {
      const monthData = shifts[yearMonth]?.[s.id] ?? {}
      // Count unique work DAYS (not slots — same day with 2 patterns = 1 work day)
      const workDaySet = new Set<number>()
      let totalHours = 0
      for (const [slotKey, entry] of Object.entries(monthData)) {
        const p = patternMap[entry.patternId]
        if (!p) continue
        totalHours += calcWorkHours(p)
        if (!p.isOff) workDaySet.add(parseInt(slotKey, 10))
      }
      result[s.id] = { workDays: workDaySet.size, totalHours }
    }
    return result
  }, [staff, shifts, yearMonth, patternMap])

  // ─── Placement counts per day (unique staff working) ────────────────────
  const placementCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    const days = getDaysArray(yearMonth)
    for (const d of days) {
      const dayNum = d.getDate()
      const dayStr = String(dayNum)
      counts[dayStr] = staff.filter((s) => {
        const staffData = shifts[yearMonth]?.[s.id] ?? {}
        const slots = getDaySlots(staffData, dayNum)
        return slots.some((sl) => { const p = patternMap[sl.patternId]; return p && !p.isOff })
      }).length
    }
    return counts
  }, [staff, shifts, yearMonth, patternMap])

  // ─── Progress: filled days ────────────────────────────────────────────────
  const { filledDays, totalWorkingDays } = useMemo(() => {
    const days = getDaysArray(yearMonth)
    let filled = 0
    for (const d of days) {
      const dayStr = String(d.getDate())
      if ((placementCounts[dayStr] ?? 0) >= totalRequired) filled++
    }
    return { filledDays: filled, totalWorkingDays: countWorkingDays(yearMonth) }
  }, [yearMonth, placementCounts, totalRequired])

  // ─── Violations ──────────────────────────────────────────────────────────
  const violations = useMemo(
    () => validateMonth(yearMonth, shifts, staff, shiftPatterns, classRooms, staffConstraints),
    [yearMonth, shifts, staff, shiftPatterns, classRooms, staffConstraints]
  )
  const errorCount = violations.filter((v) => v.severity === 'error').length
  const warningCount = violations.filter((v) => v.severity === 'warning').length

  // ─── Constraint status for rail ──────────────────────────────────────────
  function getConstraintStatus(staffId: string): 'ok' | 'warning' | 'error' {
    const stats = staffStats[staffId]
    if (!stats) return 'ok'
    const staffViolations = violations.filter((v) => v.staffId === staffId)
    if (staffViolations.some((v) => v.severity === 'error')) return 'error'
    if (staffViolations.some((v) => v.severity === 'warning')) return 'warning'
    return 'ok'
  }

  // ─── Chip constraint status ───────────────────────────────────────────────
  function getChipConstraintStatus(staffId: string, date: Date, dayStr: string): 'ok' | 'warn' | 'error' {
    const dateStr = format(date, 'yyyy-MM-dd')
    const constraint = staffConstraints[staffId]
    if (!constraint) return 'ok'
    if (constraint.unavailableDates.includes(dateStr)) return 'error'
    if (constraint.availableDays.length > 0 && !constraint.availableDays.includes(date.getDay())) return 'warn'
    const dayViolations = violations.filter((v) => v.staffId === staffId && v.day === dayStr)
    if (dayViolations.some((v) => v.severity === 'error')) return 'error'
    if (dayViolations.some((v) => v.severity === 'warning')) return 'warn'
    return 'ok'
  }

  // ─── Default pattern for staff ───────────────────────────────────────────
  function getDefaultPatternForStaff(staffId: string): string {
    const constraint = staffConstraints[staffId]
    if (constraint?.preferredPatternIds?.length > 0) return constraint.preferredPatternIds[0]
    return shiftPatterns.find((p) => !p.isOff)?.id ?? shiftPatterns[0]?.id ?? ''
  }

  // ─── Drag handlers ────────────────────────────────────────────────────────
  function handleRailDragStart(e: React.DragEvent, staffId: string) {
    const patId = activePatternId || getDefaultPatternForStaff(staffId)
    const payload: DragPayload = { type: 'from-rail', staffId, patternId: patId }
    e.dataTransfer.setData('text/plain', JSON.stringify(payload))
    e.dataTransfer.effectAllowed = 'copy'

    const s = staff.find((st) => st.id === staffId)
    const ghost = document.createElement('div')
    ghost.style.cssText = `
      width:36px;height:36px;border-radius:50%;
      background:${s?.color ?? '#fb923c'};
      display:flex;align-items:center;justify-content:center;
      color:white;font-weight:bold;font-size:14px;
      position:fixed;top:-100px;left:-100px;
      box-shadow:0 4px 12px rgba(0,0,0,0.2);
    `
    ghost.textContent = s?.name?.[0] ?? '?'
    document.body.appendChild(ghost)
    e.dataTransfer.setDragImage(ghost, 18, 18)
    setTimeout(() => { if (document.body.contains(ghost)) document.body.removeChild(ghost) }, 0)
    setDragPayload(payload)
  }

  function handleChipDragStart(e: React.DragEvent, staffId: string, patternId: string, sourceYM: string, sourceSlotKey: string) {
    e.stopPropagation()
    const payload: DragPayload = { type: 'from-cell', staffId, patternId, sourceYM, sourceSlotKey }
    e.dataTransfer.setData('text/plain', JSON.stringify(payload))
    e.dataTransfer.effectAllowed = 'move'

    const s = staff.find((st) => st.id === staffId)
    const ghost = document.createElement('div')
    ghost.style.cssText = `
      width:36px;height:36px;border-radius:50%;
      background:${s?.color ?? '#fb923c'};
      display:flex;align-items:center;justify-content:center;
      color:white;font-weight:bold;font-size:14px;
      position:fixed;top:-100px;left:-100px;
      box-shadow:0 4px 12px rgba(0,0,0,0.2);
    `
    ghost.textContent = s?.name?.[0] ?? '?'
    document.body.appendChild(ghost)
    e.dataTransfer.setDragImage(ghost, 18, 18)
    setTimeout(() => { if (document.body.contains(ghost)) document.body.removeChild(ghost) }, 0)
    setDragPayload(payload)
  }

  function handleCellDragOver(e: React.DragEvent, cellKey: string) {
    e.preventDefault()
    e.dataTransfer.dropEffect = dragPayload?.type === 'from-rail' ? 'copy' : 'move'
    setDragOverKey(cellKey)
  }

  function handleCellDrop(e: React.DragEvent, targetYM: string, targetDayStr: string) {
    e.preventDefault()
    setDragOverKey(null)

    let payload: DragPayload | null = null
    try {
      payload = JSON.parse(e.dataTransfer.getData('text/plain')) as DragPayload
    } catch {
      payload = dragPayload
    }
    if (!payload) return

    if (payload.type === 'from-cell') {
      // Remove source slot (even if same day — moving a slot to same day is a no-op but still cleans source)
      const sourceDay = parseInt(payload.sourceSlotKey, 10)
      if (payload.sourceYM !== targetYM || sourceDay !== parseInt(targetDayStr, 10)) {
        clearShiftSlot(payload.sourceYM, payload.staffId, payload.sourceSlotKey)
      }
    }
    setShiftEntry(targetYM, payload.staffId, targetDayStr, { patternId: payload.patternId, note: '' })
    setDragPayload(null)
  }

  function handleRailDrop(e: React.DragEvent) {
    e.preventDefault()
    let payload: DragPayload | null = null
    try {
      payload = JSON.parse(e.dataTransfer.getData('text/plain')) as DragPayload
    } catch {
      payload = dragPayload
    }
    if (payload?.type === 'from-cell') {
      clearShiftSlot(payload.sourceYM, payload.staffId, payload.sourceSlotKey)
    }
    setDragPayload(null)
    setDragOverKey(null)
  }

  function handleDragEnd() {
    setDragPayload(null)
    setDragOverKey(null)
  }

  // ─── Mobile cell tap handler ──────────────────────────────────────────────
  function handleCellTap(targetYM: string, targetDayStr: string) {
    if (!selectedStaffId) {
      // Pulse the staff strip as a hint
      setPulseStaffStrip(true)
      setTimeout(() => setPulseStaffStrip(false), 600)
      return
    }

    // Find if the specific pattern slot already exists for this day
    const staffData = shifts[targetYM]?.[selectedStaffId] ?? {}
    const daySlots = getDaySlots(staffData, parseInt(targetDayStr, 10))
    const existingSlot = daySlots.find((sl) => sl.patternId === activePatternId)

    if (existingSlot) {
      // Toggle OFF — remove that specific slot only
      clearShiftSlot(targetYM, selectedStaffId, existingSlot.slotKey)
    } else {
      setShiftEntry(targetYM, selectedStaffId, targetDayStr, { patternId: activePatternId, note: '' })
    }
  }

  // ─── Popover ──────────────────────────────────────────────────────────────
  const openPopover = useCallback((e: React.MouseEvent, staffId: string, slotKey: string, day: string) => {
    e.stopPropagation()
    if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current)
    setTooltip(null)
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    let x = rect.right + 8
    let y = rect.top
    if (x + 220 > window.innerWidth) x = rect.left - 228
    if (y + 340 > window.innerHeight) y = window.innerHeight - 350
    setPopover({ staffId, slotKey, day, x, y })
  }, [])

  function handlePopoverPattern(patternId: string) {
    if (!popover) return
    // Replace old slot with new pattern slot
    clearShiftSlot(yearMonth, popover.staffId, popover.slotKey)
    setShiftEntry(yearMonth, popover.staffId, popover.day, { patternId, note: '' })
    setPopover(null)
  }

  function handlePopoverDelete() {
    if (!popover) return
    clearShiftSlot(yearMonth, popover.staffId, popover.slotKey)
    setPopover(null)
  }

  // ─── Hover tooltip ────────────────────────────────────────────────────────
  function handleChipMouseEnter(e: React.MouseEvent, staffId: string, slotKey: string) {
    if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current)
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    tooltipTimerRef.current = setTimeout(() => {
      let x = rect.right + 8
      let y = rect.top
      if (x + 240 > window.innerWidth) x = rect.left - 248
      if (y + 180 > window.innerHeight) y = window.innerHeight - 190
      setTooltip({ staffId, slotKey, x, y })
    }, 250)
  }

  function handleChipMouseLeave() {
    if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current)
    setTooltip(null)
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') { setPopover(null); setMobileChipSheet(null) } }
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

  // ─── CSV export ───────────────────────────────────────────────────────────
  function handleExportCSV() {
    const days = getDaysArray(yearMonth)
    const content = generateShiftExcel(yearMonth, staff, days, shifts, shiftPatterns)
    downloadFile(content, `シフト表_${yearMonth}.csv`, 'text/csv;charset=utf-8')
  }

  // ─── Print ────────────────────────────────────────────────────────────────
  function handlePrint() {
    window.print()
  }

  // ─── Copy previous month ─────────────────────────────────────────────────
  function handleCopyPrevMonth() {
    const prevDays = getDaysArray(prevYM)
    const curDays = getDaysArray(yearMonth)
    const curDayNumbers = new Set(curDays.map((d) => d.getDate()))

    for (const s of staff) {
      const prevMonthData = shifts[prevYM]?.[s.id] ?? {}
      for (const d of prevDays) {
        const dayStr = String(d.getDate())
        if (!curDayNumbers.has(d.getDate())) continue
        const entry = prevMonthData[dayStr]
        if (entry) {
          setShiftEntry(yearMonth, s.id, dayStr, { patternId: entry.patternId, note: entry.note })
        }
      }
    }
    setShowCopyModal(false)
  }

  // ─── Current month shift entries ─────────────────────────────────────────
  const currentMonthShifts = shifts[yearMonth] ?? {}

  // ─── Progress bar ────────────────────────────────────────────────────────
  const progressPct = totalWorkingDays > 0
    ? Math.round((filledDays / totalWorkingDays) * 100)
    : 0
  const progressColor = progressPct >= 100 ? 'bg-green-500' : progressPct >= 60 ? 'bg-primary-400' : 'bg-amber-400'

  // ─── Week label ───────────────────────────────────────────────────────────
  const weekLabel = useMemo(() => {
    const mon = weekDays[0]
    const sun = weekDays[6]
    return `${format(mon, 'M/d', { locale: ja })} 〜 ${format(sun, 'M/d（E）', { locale: ja })}`
  }, [weekDays])

  const navLabel = viewMode === 'week' ? weekLabel : monthLabel

  // ─── Nav prev/next ────────────────────────────────────────────────────────
  function navPrev() {
    if (viewMode === 'week') {
      setWeekAnchor((d) => subWeeks(d, 1))
    } else {
      setCurrentDate((d) => subMonths(d, 1))
      setWeekAnchor((d) => subMonths(d, 1))
    }
  }
  function navNext() {
    if (viewMode === 'week') {
      setWeekAnchor((d) => addWeeks(d, 1))
    } else {
      setCurrentDate((d) => addMonths(d, 1))
      setWeekAnchor((d) => addMonths(d, 1))
    }
  }

  // ─── Render cell content ──────────────────────────────────────────────────
  function renderDayCell(date: Date | null, colIndex: number, isWeekView = false) {
    if (!date) {
      return (
        <div className="bg-gray-100/50 border-r last:border-r-0 border-gray-100 min-h-[80px] md:min-h-[110px]" />
      )
    }

    const dayStr = String(date.getDate())
    const dateISO = format(date, 'yyyy-MM-dd')
    const cellYM = getYearMonth(date)
    const isInMonth = cellYM === yearMonth
    const isToday = dateISO === todayStr
    const isSaturday = colIndex === 5
    const isSunday = colIndex === 6
    const isWeekend = isSaturday || isSunday
    const count = isInMonth ? (placementCounts[dayStr] ?? 0) : 0
    const isUnderstaffed = isInMonth && count > 0 && count < totalRequired
    const isOk = isInMonth && count >= totalRequired
    const cellKey = `${cellYM}-${dayStr}`
    const isDragTarget = dragOverKey === cellKey

    // Staff placed on this day — each slot is a separate chip (multi-shift allowed)
    const placedStaff = isInMonth
      ? staff.flatMap((s) => {
          const staffData = shifts[cellYM]?.[s.id] ?? {}
          const daySlots = getDaySlots(staffData, date.getDate())
          return daySlots
            .map((sl) => {
              const pattern = patternMap[sl.patternId]
              if (!pattern) return null
              return { staff: s, pattern, entry: sl, slotKey: sl.slotKey }
            })
            .filter((x): x is { staff: typeof staff[0]; pattern: ShiftPattern; entry: typeof daySlots[0]; slotKey: string } => x !== null)
        })
        // Sort by shift start time
        .sort((a, b) => (a.pattern.startTime || '').localeCompare(b.pattern.startTime || ''))
      : []

    // Selected staff tint
    const selectedStaff = selectedStaffId ? staff.find((s) => s.id === selectedStaffId) : null
    const isSelectedStaffHere = isInMonth && selectedStaffId !== null &&
      placedStaff.some((ps) => ps.staff.id === selectedStaffId)
    // Count unique staff working (for badge display)
    const uniqueStaffCount = new Set(placedStaff.map((ps) => ps.staff.id)).size

    // On mobile: tint cell if selected staff is placed here
    const selectedStaffTint = isSelectedStaffHere && selectedStaff
      ? selectedStaff.color + '18'
      : undefined

    let bgClass = ''
    if (!isInMonth) bgClass = 'bg-gray-100/60'
    else if (isDragTarget) bgClass = 'bg-primary-50 ring-2 ring-primary-300 ring-inset'
    else if (isUnderstaffed) bgClass = 'bg-red-50'
    else if (isWeekend) bgClass = isSunday ? 'bg-red-50/30' : 'bg-sky-50/30'
    else if (count === 0) bgClass = 'bg-gray-50/60'

    // Height: week view taller, mobile slightly shorter than desktop
    let minH: string
    if (isWeekView) {
      minH = 'min-h-[110px] md:min-h-[200px]'
    } else {
      minH = 'min-h-[88px] md:min-h-[128px]'
    }

    return (
      <div
        className={`border-r last:border-r-0 border-gray-100 flex flex-col p-1 md:p-1.5 transition-colors relative ${minH} ${bgClass}`}
        style={
          selectedStaffTint
            ? { backgroundColor: selectedStaffTint }
            : undefined
        }
        // Desktop DnD handlers
        onDragOver={isInMonth ? (e) => handleCellDragOver(e, cellKey) : undefined}
        onDragLeave={isInMonth ? () => setDragOverKey(null) : undefined}
        onDrop={isInMonth ? (e) => handleCellDrop(e, cellYM, dayStr) : undefined}
        // Mobile tap handler (only fires on mobile when not DnD)
        onClick={isInMonth && isMobile ? () => handleCellTap(cellYM, dayStr) : undefined}
      >
        {/* Date header row */}
        <div className="flex items-center justify-between mb-0.5 md:mb-1">
          <span
            className={`text-xs font-bold w-5 h-5 md:w-6 md:h-6 flex items-center justify-center rounded-full leading-none ${
              isToday
                ? 'bg-primary-500 text-white'
                : isSunday ? 'text-red-500'
                : isSaturday ? 'text-sky-600'
                : 'text-gray-700'
            }`}
          >
            {date.getDate()}
          </span>

          {/* Placement badge */}
          {isInMonth && uniqueStaffCount > 0 && (
            <span
              className={`text-[8px] md:text-[9px] font-bold px-1 md:px-1.5 py-0.5 rounded-full flex items-center gap-0.5 ${
                isOk
                  ? 'bg-green-100 text-green-700'
                  : 'bg-red-100 text-red-600'
              }`}
            >
              {uniqueStaffCount}/{totalRequired}
              {isOk ? (
                <Check className="w-2 h-2 md:w-2.5 md:h-2.5" />
              ) : (
                <ChevronUp className="w-2 h-2 md:w-2.5 md:h-2.5" />
              )}
            </span>
          )}
        </div>

        {/* Staff cards — each placed slot as a contained card (multi-shift per day supported) */}
        <div className="flex flex-col gap-1 flex-1">
          {placedStaff.map(({ staff: s, pattern, slotKey }) => {
            const chipStatus = getChipConstraintStatus(s.id, date, dayStr)
            const isSelectedChip = selectedStaffId === s.id

            return (
              <div
                key={slotKey}
                draggable={!isMobile}
                onDragStart={!isMobile ? (e) => handleChipDragStart(e, s.id, pattern.id, cellYM, slotKey) : undefined}
                onDragEnd={!isMobile ? handleDragEnd : undefined}
                onMouseEnter={!isMobile ? (e) => handleChipMouseEnter(e, s.id, slotKey) : undefined}
                onMouseLeave={!isMobile ? handleChipMouseLeave : undefined}
                onClick={(e) => {
                  e.stopPropagation()
                  if (isMobile) {
                    setMobileChipSheet({ staffId: s.id, slotKey, day: dayStr, ym: cellYM })
                  } else {
                    openPopover(e, s.id, slotKey, dayStr)
                  }
                }}
                className={`group rounded-lg overflow-hidden select-none transition-all ${
                  isMobile ? 'cursor-pointer active:scale-95' : 'cursor-grab active:cursor-grabbing hover:shadow-md hover:brightness-95'
                }`}
                style={{
                  backgroundColor: pattern.bgColor,
                  borderLeft: `3px solid ${s.color}`,
                  boxShadow: isSelectedChip
                    ? `0 0 0 2px ${s.color}, 0 2px 6px ${s.color}30`
                    : chipStatus === 'error'
                      ? '0 0 0 1.5px #ef4444'
                      : chipStatus === 'warn'
                        ? '0 0 0 1.5px #f59e0b'
                        : `0 1px 3px ${s.color}20`,
                }}
              >
                <div className="flex items-center gap-1 px-1 py-1 md:px-1.5">
                  {/* Avatar */}
                  <span
                    className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-white font-bold shrink-0"
                    style={{ backgroundColor: s.color, fontSize: 7 }}
                  >
                    {s.name[0]}
                  </span>
                  {/* Name — shown on desktop */}
                  <span
                    className="hidden md:block truncate flex-1 text-[9px] font-semibold leading-tight"
                    style={{ color: pattern.color }}
                  >
                    {s.name.split(/[\s　]/)[0]}
                  </span>
                  {/* Pattern name — always visible */}
                  <span
                    className="shrink-0 text-[8px] md:text-[9px] font-bold leading-tight"
                    style={{ color: pattern.color }}
                  >
                    {pattern.name}
                  </span>
                  {/* Warning */}
                  {chipStatus !== 'ok' && (
                    <AlertTriangle
                      className={`w-2 h-2 shrink-0 ${chipStatus === 'error' ? 'text-red-500' : 'text-amber-500'}`}
                    />
                  )}
                  {/* Remove — desktop hover */}
                  {!isMobile && (
                    <button
                      onClick={(e) => { e.stopPropagation(); clearShiftSlot(cellYM, s.id, slotKey) }}
                      className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity ml-auto hover:text-red-500"
                      title="削除"
                    >
                      <X className="w-2.5 h-2.5 text-current" />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full min-h-0" style={{ height: 'calc(100vh - 88px)' }}>

      {/* ══════════════════ MOBILE TOPBAR (< md) ══════════════════ */}
      <div className="md:hidden shrink-0 bg-white border-b border-gray-100 px-3 py-2 space-y-2">
        {/* Row 1: month nav + view toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <button
              onClick={navPrev}
              className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-50 border border-gray-200 active:scale-95 transition-all"
            >
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            </button>
            <span className="font-bold text-sm text-gray-800 min-w-[80px] text-center">{navLabel}</span>
            <button
              onClick={navNext}
              className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-50 border border-gray-200 active:scale-95 transition-all"
            >
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </button>
          </div>
          {/* View toggle */}
          <div className="flex rounded-xl overflow-hidden border border-gray-200">
            <button
              onClick={() => setViewMode('month')}
              className={`px-3 py-1.5 text-xs font-medium transition-all ${viewMode === 'month' ? 'bg-primary-500 text-white' : 'text-gray-500 bg-white'}`}
            >
              月
            </button>
            <button
              onClick={() => { setViewMode('week'); setWeekAnchor(currentDate) }}
              className={`px-3 py-1.5 text-xs font-medium transition-all ${viewMode === 'week' ? 'bg-primary-500 text-white' : 'text-gray-500 bg-white'}`}
            >
              週
            </button>
          </div>
        </div>
        {/* Row 2: progress + violation + export */}
        <div className="flex items-center gap-2">
          {/* Progress pill (compact) */}
          <div className="flex-1 flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5">
            <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${progressColor}`}
                style={{ width: `${Math.min(progressPct, 100)}%` }}
              />
            </div>
            <span className="text-[10px] font-bold text-gray-600 shrink-0">{filledDays}/{totalWorkingDays}日</span>
          </div>
          {/* Violation badge */}
          <button
            onClick={() => setShowViolations((v) => !v)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
              errorCount > 0
                ? 'bg-red-50 border-red-200 text-red-700'
                : warningCount > 0
                ? 'bg-amber-50 border-amber-200 text-amber-700'
                : 'bg-green-50 border-green-200 text-green-700'
            }`}
          >
            {errorCount > 0 || warningCount > 0
              ? <><AlertTriangle className="w-3 h-3" />{errorCount + warningCount}件</>
              : <><CheckCircle className="w-3 h-3" />OK</>
            }
          </button>
          {/* Auto-schedule */}
          <button
            onClick={() => setAutoScheduleOpen(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-primary-500 text-white active:scale-95 transition-all shadow-sm"
          >
            <Wand2 className="w-3.5 h-3.5" />
            一括
          </button>
          {/* Clear month */}
          <button
            onClick={() => setShowClearModal(true)}
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-red-50 border border-red-200 active:scale-95 transition-all"
            title="今月のシフトを全クリア"
          >
            <Trash2 className="w-3.5 h-3.5 text-red-500" />
          </button>
          <HintTooltip
            title="一括作成"
            content={
              <ul className="space-y-1.5">
                <li>• 出勤条件（曜日・パターン制限）を考慮して自動配置します。管理職は早番・遅番に配置されません。</li>
                <li>• 各パターンに何名配置するか設定するだけ</li>
                <li>• 生成前にプレビューで確認できます</li>
              </ul>
            }
            size="sm"
          />
          {/* CSV download */}
          <button
            onClick={handleExportCSV}
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-50 border border-gray-200 active:scale-95 transition-all"
          >
            <Download className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>

      {/* ══════════════════ DESKTOP TOPBAR (≥ md) ══════════════════ */}
      <div className="hidden md:flex shrink-0 bg-white border-b border-gray-100 px-4 py-2.5 flex-wrap items-center gap-3">
        {/* Month navigation */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => { setCurrentDate((d) => subMonths(d, 1)); setWeekAnchor((d) => subMonths(d, 1)) }}
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-50 border border-gray-200 hover:bg-gray-100 active:scale-95 transition-all"
          >
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          </button>
          <h1 className="text-base font-bold text-gray-800 min-w-[96px] text-center">
            {viewMode === 'week' ? weekLabel : monthLabel}
          </h1>
          <button
            onClick={() => { setCurrentDate((d) => addMonths(d, 1)); setWeekAnchor((d) => addMonths(d, 1)) }}
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-50 border border-gray-200 hover:bg-gray-100 active:scale-95 transition-all"
          >
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </button>
          {viewMode === 'week' && (
            <>
              <button
                onClick={() => setWeekAnchor((d) => subWeeks(d, 1))}
                className="ml-1 px-2 py-1 text-[11px] rounded-lg bg-gray-50 border border-gray-200 hover:bg-gray-100 text-gray-600 transition-all"
              >
                先週
              </button>
              <button
                onClick={() => setWeekAnchor((d) => addWeeks(d, 1))}
                className="px-2 py-1 text-[11px] rounded-lg bg-gray-50 border border-gray-200 hover:bg-gray-100 text-gray-600 transition-all"
              >
                翌週
              </button>
            </>
          )}
        </div>

        {/* Progress pill */}
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5">
          <div className="w-28 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${progressColor}`}
              style={{ width: `${Math.min(progressPct, 100)}%` }}
            />
          </div>
          <span className="text-xs font-medium text-gray-600 whitespace-nowrap">
            {filledDays}/{totalWorkingDays}日 入力済
          </span>
        </div>

        {/* Violation badge */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowViolations((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
              errorCount > 0
                ? 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100'
                : warningCount > 0
                ? 'bg-amber-50 border-amber-200 text-amber-600 hover:bg-amber-100'
                : 'bg-green-50 border-green-200 text-green-600 hover:bg-green-100'
            }`}
          >
            {errorCount > 0 || warningCount > 0 ? (
              <AlertTriangle className="w-3.5 h-3.5" />
            ) : (
              <CheckCircle className="w-3.5 h-3.5" />
            )}
            {errorCount > 0
              ? `⚠ ${errorCount + warningCount}件の問題`
              : warningCount > 0
              ? `⚠ ${warningCount}件の警告`
              : '✓ 問題なし'
            }
            {showViolations
              ? <ChevronUp className="w-3 h-3" />
              : <ChevronDown className="w-3 h-3" />
            }
          </button>
          <HintTooltip
            title="制約チェックとは？"
            content={
              <ul className="space-y-1.5">
                <li>• 各職員に設定した「最低勤務日数」「連続勤務上限」などのルールに違反がないかを自動チェックします</li>
                <li>• 赤：エラー（必ず修正が必要）</li>
                <li>• 黄：警告（確認を推奨）</li>
                <li>• クリックすると詳細の一覧が表示されます</li>
              </ul>
            }
          />
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* View toggle */}
        <div className="flex bg-gray-100 rounded-xl p-0.5 text-[11px] font-medium">
          <button
            onClick={() => setViewMode('month')}
            className={`px-3 py-1.5 rounded-[10px] transition-all ${viewMode === 'month' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            月
          </button>
          <button
            onClick={() => { setViewMode('week'); setWeekAnchor(currentDate) }}
            className={`px-3 py-1.5 rounded-[10px] transition-all ${viewMode === 'week' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            週
          </button>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setAutoScheduleOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-primary-500 text-white hover:bg-primary-600 active:scale-95 transition-all shadow-sm"
          >
            <Wand2 className="w-3.5 h-3.5" />
            一括作成
          </button>
          <HintTooltip
            title="一括作成とは？"
            content={
              <ul className="space-y-1.5">
                <li>• 出勤条件（曜日・パターン制限）を考慮して自動配置します。管理職は早番・遅番に配置されません。</li>
                <li>• 手動で入力済みの部分を残す「補完モード」と全て作り直す「上書きモード」から選べます</li>
                <li>• 生成後はプレビューで確認してから適用できます</li>
              </ul>
            }
          />
        </div>
        <button
          onClick={() => setShowCopyModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 active:scale-95 transition-all"
        >
          <Copy className="w-3.5 h-3.5" />
          前月コピー
        </button>
        <button
          onClick={handleExportCSV}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 active:scale-95 transition-all"
        >
          <Download className="w-3.5 h-3.5" />
          CSV出力
        </button>
        <button
          onClick={handlePrint}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 active:scale-95 transition-all"
        >
          <Printer className="w-3.5 h-3.5" />
          印刷
        </button>
        <button
          onClick={() => setShowClearModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-white border border-red-200 text-red-500 hover:bg-red-50 active:scale-95 transition-all"
        >
          <Trash2 className="w-3.5 h-3.5" />
          全クリア
        </button>
      </div>


      {/* ══════════════════ VIOLATION PANEL ══════════════════ */}
      {showViolations && (
        <div className="shrink-0 bg-white border-b border-gray-100 px-3 md:px-4 py-3">
          {violations.length === 0 ? (
            <div className="flex items-center gap-2 text-green-700 text-xs">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="font-medium">全ての条件をクリアしています</span>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
              {violations.map((v) => (
                <div
                  key={v.id}
                  className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg ${
                    v.severity === 'error' ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-amber-50 text-amber-700 border border-amber-100'
                  }`}
                >
                  <span>{v.severity === 'error' ? '🔴' : '🟡'}</span>
                  {v.message}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════ MAIN BODY ══════════════════ */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ══ DESKTOP STAFF RAIL (left, 200px, ≥ md) ══ */}
        <div
          className="hidden md:flex w-[200px] shrink-0 flex-col bg-white border-r border-gray-100 overflow-hidden"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleRailDrop}
        >
          {/* Rail header */}
          <div className="px-3 pt-3 pb-2 border-b border-gray-100 shrink-0 flex items-center justify-between gap-1">
            <div className="flex items-center gap-1">
              <div>
                <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-0.5">スタッフ</p>
                <p className="text-[10px] text-gray-400">ドラッグして配置</p>
              </div>
              <HintTooltip
                title="シフトの配置方法"
                content={
                  <ul className="space-y-1.5">
                    <li>• カードをカレンダーの日付マスに<strong className="text-gray-900">ドラッグ</strong>してシフトを配置します</li>
                    <li>• 下のパターン選択で「早番」「遅番」などを選んでからドラッグすると、そのパターンで配置されます</li>
                    <li>• 同じ職員を同じ日に<strong className="text-gray-900">別のパターンで複数回</strong>配置することもできます</li>
                    <li>• 配置済みのカードをクリック → パターン変更、×ボタン → 削除</li>
                    <li>• カードにカーソルを乗せると<strong className="text-gray-900">月間入力</strong>ボタンが表示され、1ヶ月分を一括で設定できます</li>
                  </ul>
                }
                className="ml-0.5"
              />
            </div>
            <button
              onClick={() => openStaffPanel(null)}
              className="w-7 h-7 flex items-center justify-center rounded-lg bg-primary-50 hover:bg-primary-100 active:scale-90 transition-all shrink-0"
              title="職員を追加"
            >
              <UserPlus className="w-3.5 h-3.5 text-primary-500" />
            </button>
          </div>

          {/* Staff cards */}
          <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1.5">
            {staff.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-6">職員がいません</p>
            )}
            {staff.map((s) => {
              const stats = staffStats[s.id] ?? { workDays: 0, totalHours: 0 }
              const status = getConstraintStatus(s.id)
              const isSelected = selectedStaffId === s.id

              // Today's pattern
              const todayEntry = shifts[yearMonth]?.[s.id]?.[String(today.getDate())]
              const todayPattern = todayEntry ? patternMap[todayEntry.patternId] : null

              return (
                <div
                  key={s.id}
                  draggable
                  onDragStart={(e) => handleRailDragStart(e, s.id)}
                  onDragEnd={handleDragEnd}
                  onClick={() => setSelectedStaffId((prev) => prev === s.id ? null : s.id)}
                  className={`group relative border rounded-xl p-2 cursor-grab active:cursor-grabbing select-none transition-all hover:shadow-sm ${
                    isSelected
                      ? 'border-primary-300 bg-primary-50/50 shadow-sm'
                      : 'border-gray-100 bg-gray-50 hover:border-orange-200'
                  }`}
                  style={
                    status !== 'ok'
                      ? {
                          borderLeftWidth: 3,
                          borderLeftColor:
                            status === 'error' ? '#ef4444' : '#f59e0b',
                        }
                      : { borderLeftWidth: 3, borderLeftColor: '#22c55e' }
                  }
                >
                  <div className="flex items-center gap-2">
                    {/* Avatar */}
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm"
                      style={{ backgroundColor: s.color }}
                    >
                      {s.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="text-[11px] font-semibold text-gray-700 truncate">{s.name}</span>
                        <span className={`text-[9px] px-1 py-0.5 rounded-full font-bold shrink-0 ${
                          s.employment === 'fulltime' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'
                        }`}>
                          {s.employment === 'fulltime' ? '正' : 'P'}
                        </span>
                      </div>
                      <div className="text-[10px] text-gray-400">{stats.workDays}日 / {stats.totalHours.toFixed(0)}h</div>
                    </div>
                  </div>
                  {/* Preferred patterns */}
                  {(staffConstraints[s.id]?.preferredPatternIds?.length ?? 0) > 0 && (
                    <div className="flex flex-wrap gap-0.5 mt-1.5">
                      {staffConstraints[s.id].preferredPatternIds.slice(0, 4).map((pid) => {
                        const p = patternMap[pid]
                        if (!p) return null
                        return (
                          <span
                            key={pid}
                            className="text-[8px] font-bold px-1.5 py-0.5 rounded-md"
                            style={{ backgroundColor: p.bgColor, color: p.color }}
                          >
                            {p.name}
                          </span>
                        )
                      })}
                    </div>
                  )}
                  {/* Today pattern badge */}
                  {todayPattern && (
                    <div
                      className="mt-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full inline-block"
                      style={{ backgroundColor: todayPattern.bgColor, color: todayPattern.color }}
                    >
                      今日: {todayPattern.name}
                    </div>
                  )}
                  {/* Workflow + Edit buttons — shown on hover */}
                  <div className="absolute top-1.5 right-1.5 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
                    <button
                      onClick={(e) => { e.stopPropagation(); openWorkflow(s.id) }}
                      className="w-5 h-5 flex items-center justify-center rounded-md bg-white/90 border border-gray-200 hover:bg-amber-50 hover:border-amber-300 active:scale-90 transition-all shadow-sm"
                      title={`${s.name}の月間入力`}
                    >
                      <LayoutGrid className="w-2.5 h-2.5 text-amber-500" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); openStaffPanel(s.id) }}
                      className="w-5 h-5 flex items-center justify-center rounded-md bg-white/90 border border-gray-200 hover:bg-gray-50 active:scale-90 transition-all shadow-sm"
                      title={`${s.name}を編集`}
                    >
                      <Pencil className="w-2.5 h-2.5 text-gray-400" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Active pattern selector */}
          <div className="px-2 pb-3 pt-2 border-t border-gray-100 shrink-0">
            <div className="flex items-center gap-1 mb-1.5">
              <p className="text-[10px] font-semibold text-gray-500">ドラッグ時のパターン：</p>
              <HintTooltip
                title="シフトパターンとは？"
                content={
                  <ul className="space-y-1.5">
                    <li>• ドラッグして配置する際のシフト種別をここで選択します</li>
                    <li>• <strong className="text-gray-900">早番</strong>（07:00〜）・<strong className="text-gray-900">中番</strong>（09:00〜）・<strong className="text-gray-900">遅番</strong>（11:00〜）など時間帯別に選べます</li>
                    <li>• 同じ人に別パターンを配置すると、1日に複数のシフトを重ねられます</li>
                    <li>• 「休み」「有給」なども配置可能です</li>
                  </ul>
                }
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {shiftPatterns.filter((p) => !p.isOff).map((p) => (
                <button
                  key={p.id}
                  onClick={() => setActivePatternId(p.id)}
                  className={`relative text-[10px] font-bold px-2 py-1 rounded-lg transition-all border ${
                    activePatternId === p.id
                      ? 'ring-2 ring-offset-1 shadow-sm'
                      : 'opacity-70 hover:opacity-100'
                  }`}
                  style={{
                    backgroundColor: p.bgColor,
                    color: p.color,
                    borderColor: p.color + '55',
                    ...(activePatternId === p.id ? { ringColor: p.color } : {}),
                  }}
                  title={`${p.name} ${p.startTime}–${p.endTime}`}
                >
                  {activePatternId === p.id && (
                    <Check className="w-2.5 h-2.5 absolute -top-1 -right-1 bg-white rounded-full" style={{ color: p.color }} />
                  )}
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ══ CALENDAR GRID (both mobile and desktop) ══ */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden bg-white">

          {/* 初回ガイダンス: 職員未登録 */}
          {staff.length === 0 && (
            <div className="mx-3 mt-3 bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center shrink-0">
              <p className="text-sm font-bold text-amber-800 mb-1">まず職員を登録してください</p>
              <p className="text-xs text-amber-600">右下の「職員を追加」ボタンから職員情報を入力できます</p>
            </div>
          )}

          {/* 初回ガイダンス: シフトが空の場合 */}
          {Object.keys(currentMonthShifts).length === 0 && staff.length > 0 && (
            <div className="mx-3 mt-3 bg-gradient-to-r from-primary-50 to-sky-50 border border-primary-100 rounded-2xl p-4 shrink-0">
              <p className="text-sm font-bold text-primary-800 mb-2">📋 シフトを作成しましょう</p>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <span className="w-5 h-5 rounded-full bg-green-500 text-white flex items-center justify-center text-[10px] font-bold shrink-0">✓</span>
                  <span>職員の登録が完了しています（{staff.length}名）</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <span className="w-5 h-5 rounded-full bg-primary-500 text-white flex items-center justify-center text-[10px] font-bold shrink-0">2</span>
                  <span>出勤条件を確認してください（ナビ→「出勤条件」）</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <span className="w-5 h-5 rounded-full bg-gray-300 text-white flex items-center justify-center text-[10px] font-bold shrink-0">3</span>
                  <span>「一括シフト作成」ボタンでシフトを自動生成できます</span>
                </div>
              </div>
              <button
                onClick={() => setAutoScheduleOpen(true)}
                className="mt-3 w-full py-2.5 rounded-xl bg-primary-500 text-white text-sm font-bold active:scale-95 transition-all"
              >
                ✨ 一括シフト作成を開く
              </button>
            </div>
          )}

          {/* Day-of-week header */}
          <div className="grid grid-cols-7 border-b border-gray-100 shrink-0">
            {DAY_NAMES.map((name, i) => (
              <div
                key={name}
                className={`py-1.5 md:py-2 text-center text-xs font-bold border-r last:border-r-0 border-gray-100 ${
                  i === 5 ? 'text-sky-600 bg-sky-50/60' :
                  i === 6 ? 'text-red-500 bg-red-50/60' :
                  'text-gray-500'
                }`}
              >
                {name}
              </div>
            ))}
          </div>

          {/* Grid body (scrollable) — pb on mobile accounts for bottom tray (≈90px) + bottom nav (≈64px) */}
          <div className="flex-1 overflow-y-auto pb-40 md:pb-0">
            {viewMode === 'month' ? (
              /* Monthly view */
              calendarGrid.map((week, wi) => (
                <div key={wi} className="grid grid-cols-7 border-b last:border-b-0 border-gray-100">
                  {week.map((date, di) => (
                    <div key={di}>
                      {renderDayCell(date, di, false)}
                    </div>
                  ))}
                </div>
              ))
            ) : (
              /* Weekly view */
              <div className="grid grid-cols-7 h-full">
                {weekDays.map((date, di) => (
                  <div key={di}>
                    {renderDayCell(date, di, true)}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ══════════════════ MOBILE BOTTOM SHEET — chip action ══════════════════ */}
      {mobileChipSheet && (() => {
        const sheetStaff = staff.find((s) => s.id === mobileChipSheet.staffId)
        const currentPatternId = shifts[mobileChipSheet.ym]?.[mobileChipSheet.staffId]?.[mobileChipSheet.slotKey]?.patternId
        return (
          <div
            className="md:hidden fixed inset-0 z-50 flex flex-col justify-end bg-black/40 backdrop-blur-[2px]"
            onClick={() => setMobileChipSheet(null)}
          >
            <div
              className="bg-white rounded-t-3xl px-5 pt-3 pb-4 space-y-3"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Handle */}
              <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto" />

              {/* Staff header */}
              <div className="flex items-center gap-3">
                {sheetStaff && (
                  <div
                    className="w-10 h-10 rounded-2xl flex items-center justify-center text-white text-base font-bold shrink-0"
                    style={{ backgroundColor: sheetStaff.color }}
                  >
                    {sheetStaff.name[0]}
                  </div>
                )}
                <div>
                  <p className="font-bold text-gray-800">{sheetStaff?.name}</p>
                  <p className="text-xs text-gray-400">{mobileChipSheet.day}日 — シフトパターンを変更</p>
                </div>
              </div>

              {/* Pattern grid */}
              <div className="grid grid-cols-2 gap-2">
                {shiftPatterns.map((p) => {
                  const isCurrent = p.id === currentPatternId
                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        // Replace this specific slot with the new pattern
                        clearShiftSlot(mobileChipSheet.ym, mobileChipSheet.staffId, mobileChipSheet.slotKey)
                        setShiftEntry(mobileChipSheet.ym, mobileChipSheet.staffId, mobileChipSheet.day, { patternId: p.id, note: '' })
                        setMobileChipSheet(null)
                      }}
                      className="py-3 px-3 rounded-2xl font-semibold text-sm border-2 active:scale-95 transition-all text-left relative"
                      style={{
                        backgroundColor: p.bgColor,
                        color: p.color,
                        borderColor: isCurrent ? p.color : p.color + '40',
                        boxShadow: isCurrent ? `0 0 0 2px ${p.color}` : undefined,
                      }}
                    >
                      {isCurrent && (
                        <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-white flex items-center justify-center shadow-sm" style={{ color: p.color }}>
                          <Check className="w-2.5 h-2.5" />
                        </span>
                      )}
                      <span className="block font-bold">{p.name}</span>
                      {!p.isOff
                        ? <span className="text-[10px] opacity-70">{p.startTime} – {p.endTime}</span>
                        : <span className="text-[10px] opacity-60">終日休み</span>
                      }
                    </button>
                  )
                })}
              </div>

              {/* Delete this slot only */}
              <button
                onClick={() => {
                  clearShiftSlot(mobileChipSheet.ym, mobileChipSheet.staffId, mobileChipSheet.slotKey)
                  setMobileChipSheet(null)
                }}
                className="w-full py-3 rounded-2xl bg-red-50 text-red-500 font-semibold flex items-center justify-center gap-2 active:scale-95 transition-all border border-red-100"
              >
                <X className="w-4 h-4" /> このシフトを削除
              </button>
              <div style={{ height: 'env(safe-area-inset-bottom, 0px)' }} />
            </div>
          </div>
        )
      })()}

      {/* ══════════════════ DESKTOP PATTERN CHANGE POPOVER ══════════════════ */}
      {/* ══════════════════ MOBILE BOTTOM TRAY (< md) ══════════════════ */}
      {/* Fixed above bottom nav. Collapsed = 90px compact strip. Expanded = 50vh drawer. */}
      <div
        ref={staffStripRef}
        className={`md:hidden fixed left-0 right-0 z-[25] bg-white border-t-2 border-orange-100 shadow-[0_-4px_24px_rgba(0,0,0,0.10)] transition-all duration-300 ease-in-out ${pulseStaffStrip ? 'animate-pulse' : ''}`}
        style={{
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 56px)',
          height: trayExpanded ? '50vh' : '92px',
        }}
      >
        {/* ── Drag handle / toggle ── */}
        <button
          onClick={() => setTrayExpanded((v) => !v)}
          className="absolute -top-3.5 left-1/2 -translate-x-1/2 w-20 h-7 bg-white border border-orange-100 rounded-full flex items-center justify-center gap-1 shadow-sm active:scale-95 transition-all"
          aria-label={trayExpanded ? 'トレイを閉じる' : 'トレイを開く'}
        >
          {trayExpanded
            ? <ChevronDown className="w-4 h-4 text-gray-400" />
            : <ChevronUp className="w-4 h-4 text-gray-400" />}
        </button>

        {/* ══ COLLAPSED VIEW ══ */}
        {!trayExpanded && (
          <div className="flex flex-col h-full justify-center">
            {/* Row 1: Staff avatar chips (horizontal scroll) */}
            <div
              className="flex items-center gap-2 px-3 pt-2 pb-1 overflow-x-auto"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              {/* Selected indicator on the left */}
              {selectedStaffId ? (
                <div
                  className="shrink-0 flex items-center gap-1.5 px-2 py-1 rounded-xl text-xs font-medium border"
                  style={{
                    color: staff.find((s) => s.id === selectedStaffId)?.color,
                    borderColor: staff.find((s) => s.id === selectedStaffId)?.color + '60',
                    backgroundColor: staff.find((s) => s.id === selectedStaffId)?.color + '12',
                  }}
                >
                  <Check className="w-3 h-3 shrink-0" />
                  <span className="truncate max-w-[56px]">
                    {staff.find((s) => s.id === selectedStaffId)?.name.split(/[\s　]/)[0]}
                  </span>
                </div>
              ) : (
                <span className="shrink-0 text-[10px] text-gray-400 whitespace-nowrap">先生を選択↓</span>
              )}

              {/* Staff circles */}
              {staff.map((s) => {
                const isSelected = selectedStaffId === s.id
                return (
                  <button
                    key={s.id}
                    onClick={() => setSelectedStaffId(isSelected ? null : s.id)}
                    className="shrink-0 relative flex flex-col items-center gap-0.5 active:scale-90 transition-transform"
                  >
                    <div
                      className="w-10 h-10 rounded-2xl flex items-center justify-center text-white text-sm font-bold transition-all"
                      style={{
                        backgroundColor: s.color,
                        boxShadow: isSelected ? `0 0 0 3px ${s.color}55, 0 0 0 5px ${s.color}22` : undefined,
                        transform: isSelected ? 'scale(1.1)' : undefined,
                      }}
                    >
                      {s.name[0]}
                    </div>
                    {isSelected && (
                      <div
                        className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-white flex items-center justify-center shadow"
                        style={{ color: s.color }}
                      >
                        <Check className="w-2.5 h-2.5" />
                      </div>
                    )}
                    <span className="text-[9px] text-gray-500 leading-tight max-w-[40px] truncate">
                      {s.name.split(/[\s　]/)[0]}
                    </span>
                  </button>
                )
              })}

              {/* Add staff button */}
              <button
                onClick={() => openStaffPanel(null)}
                className="shrink-0 flex flex-col items-center gap-0.5 active:scale-90 transition-transform"
                aria-label="職員を追加"
              >
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-gray-100 border-2 border-dashed border-gray-300">
                  <UserPlus className="w-4 h-4 text-gray-400" />
                </div>
                <span className="text-[9px] text-gray-400 leading-tight">追加</span>
              </button>
            </div>

            {/* Row 2: Pattern chips (horizontal scroll) */}
            <div
              className="flex items-center gap-1.5 px-3 pb-1.5 overflow-x-auto"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              {shiftPatterns.map((p) => {
                const isActive = activePatternId === p.id
                return (
                  <button
                    key={p.id}
                    onClick={() => setActivePatternId(p.id)}
                    className="shrink-0 flex items-center gap-0.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold border-2 active:scale-95 transition-all"
                    style={{
                      backgroundColor: p.bgColor,
                      color: p.color,
                      borderColor: isActive ? p.color : 'transparent',
                      transform: isActive ? 'scale(1.05)' : undefined,
                    }}
                  >
                    {isActive && <Check className="w-2.5 h-2.5 shrink-0" />}
                    {p.name}
                    {!p.isOff && <span className="opacity-60 ml-0.5">{p.startTime?.slice(0, 5)}</span>}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* ══ EXPANDED VIEW ══ */}
        {trayExpanded && (
          <div className="flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 shrink-0">
              <span className="text-sm font-bold text-gray-800">先生を選択してカレンダーに配置</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => openStaffPanel(null)}
                  className="w-8 h-8 flex items-center justify-center rounded-xl bg-primary-50 hover:bg-primary-100 active:scale-90 transition-all"
                  aria-label="職員を追加"
                >
                  <UserPlus className="w-4 h-4 text-primary-500" />
                </button>
                <button
                  onClick={() => setTrayExpanded(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 active:scale-90 transition-all"
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>
            </div>

            {/* Staff grid (3 columns, scrollable) */}
            <div className="flex-1 overflow-y-auto p-3">
              <div className="grid grid-cols-3 gap-2">
                {staff.map((s) => {
                  const isSelected = selectedStaffId === s.id
                  const status = getConstraintStatus(s.id)
                  const borderDot =
                    status === 'error' ? 'bg-red-400' :
                    status === 'warning' ? 'bg-amber-400' : 'bg-green-400'
                  // Monthly hours for this staff
                  const monthEntries = shifts[yearMonth]?.[s.id] ?? {}
                  const totalH = Object.values(monthEntries).reduce((sum, e) => {
                    const p = shiftPatterns.find((p) => p.id === e.patternId)
                    return sum + (p ? calcWorkHours(p) : 0)
                  }, 0)
                  const workDays = Object.values(monthEntries).filter((e) => {
                    const p = shiftPatterns.find((p) => p.id === e.patternId)
                    return p && !p.isOff
                  }).length

                  return (
                    <div
                      key={s.id}
                      className="relative flex flex-col items-center gap-1.5 p-2.5 rounded-2xl border-2 transition-all"
                      style={{
                        borderColor: isSelected ? s.color : '#f3f4f6',
                        backgroundColor: isSelected ? s.color + '18' : '#f9fafb',
                        boxShadow: isSelected ? `0 0 0 3px ${s.color}22` : undefined,
                      }}
                    >
                      {/* Edit button (top-right) */}
                      <button
                        onClick={(e) => { e.stopPropagation(); openStaffPanel(s.id) }}
                        className="absolute top-1.5 right-1.5 w-6 h-6 flex items-center justify-center rounded-lg bg-white/80 hover:bg-white shadow-sm active:scale-90 transition-all z-10"
                        aria-label={`${s.name}を編集`}
                      >
                        <Pencil className="w-3 h-3 text-gray-400" />
                      </button>

                      {/* Select area */}
                      <button
                        onClick={() => { setSelectedStaffId(isSelected ? null : s.id); setTrayExpanded(false) }}
                        className="flex flex-col items-center gap-1.5 w-full active:scale-95 transition-transform"
                      >
                        {/* Avatar + status dot */}
                        <div className="relative mt-2">
                          <div
                            className="w-12 h-12 rounded-2xl flex items-center justify-center text-white text-base font-bold"
                            style={{ backgroundColor: s.color }}
                          >
                            {s.name[0]}
                          </div>
                          <span className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${borderDot}`} />
                          {isSelected && (
                            <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-white flex items-center justify-center shadow" style={{ color: s.color }}>
                              <Check className="w-3 h-3" />
                            </div>
                          )}
                        </div>
                        {/* Name */}
                        <span className="text-xs font-semibold text-gray-700 leading-tight text-center line-clamp-1">
                          {s.name.split(/[\s　]/)[0]}
                        </span>
                        {/* Stats */}
                        <span className="text-[9px] text-gray-400 leading-tight">
                          {workDays}日 / {Math.round(totalH)}h
                        </span>
                        {/* Employment badge */}
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${s.employment === 'fulltime' ? 'bg-sky-100 text-sky-600' : 'bg-violet-100 text-violet-600'}`}>
                          {s.employment === 'fulltime' ? '正' : 'P'}
                        </span>
                        {/* Preferred patterns */}
                        {(staffConstraints[s.id]?.preferredPatternIds?.length ?? 0) > 0 && (
                          <div className="flex flex-wrap justify-center gap-0.5 mt-0.5 w-full px-0.5">
                            {staffConstraints[s.id].preferredPatternIds.slice(0, 2).map((pid) => {
                              const p = patternMap[pid]
                              if (!p) return null
                              return (
                                <span
                                  key={pid}
                                  className="text-[7px] font-bold px-1 py-0.5 rounded-md leading-tight"
                                  style={{ backgroundColor: p.bgColor, color: p.color }}
                                >
                                  {p.name}
                                </span>
                              )
                            })}
                          </div>
                        )}
                      </button>
                    </div>
                  )
                })}

                {/* Add staff card */}
                <button
                  onClick={() => openStaffPanel(null)}
                  className="flex flex-col items-center justify-center gap-1.5 p-2.5 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 hover:bg-gray-100 active:scale-95 transition-all min-h-[110px]"
                  aria-label="職員を追加"
                >
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-white border-2 border-dashed border-gray-300">
                    <UserPlus className="w-5 h-5 text-gray-400" />
                  </div>
                  <span className="text-[10px] text-gray-400 font-medium">追加</span>
                </button>
              </div>
            </div>

            {/* Pattern selector pinned at bottom */}
            <div className="shrink-0 border-t border-gray-100 px-3 py-2 bg-white">
              <p className="text-[10px] text-gray-400 mb-1.5">ドラッグ / タップ時のシフトパターン:</p>
              <div
                className="flex gap-1.5 overflow-x-auto"
                style={{ WebkitOverflowScrolling: 'touch' }}
              >
                {shiftPatterns.map((p) => {
                  const isActive = activePatternId === p.id
                  return (
                    <button
                      key={p.id}
                      onClick={() => setActivePatternId(p.id)}
                      className="shrink-0 flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold border-2 active:scale-95 transition-all"
                      style={{
                        backgroundColor: p.bgColor,
                        color: p.color,
                        borderColor: isActive ? p.color : 'transparent',
                      }}
                    >
                      {isActive && <Check className="w-3 h-3 shrink-0" />}
                      <span>{p.name}</span>
                      {!p.isOff && <span className="opacity-60">{p.startTime}</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ══════════════════ HOVER TOOLTIP (desktop) ══════════════════ */}
      {tooltip && (() => {
        const tooltipStaff = staff.find((s) => s.id === tooltip.staffId)
        const slotEntry = shifts[yearMonth]?.[tooltip.staffId]?.[tooltip.slotKey]
        const tooltipPattern = slotEntry ? patternMap[slotEntry.patternId] : null
        const tooltipStats = staffStats[tooltip.staffId]
        const tooltipConstraintStatus = getConstraintStatus(tooltip.staffId)
        if (!tooltipStaff || !tooltipPattern) return null
        return (
          <div
            className="hidden md:block fixed z-[60] pointer-events-none"
            style={{ left: tooltip.x, top: tooltip.y }}
          >
            <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-3 w-56 animate-in fade-in-0 zoom-in-95 duration-150">
              {/* Staff row */}
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                  style={{ backgroundColor: tooltipStaff.color }}
                >
                  {tooltipStaff.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-gray-800 truncate">{tooltipStaff.name}</p>
                  <span className={`text-[9px] px-1 py-0.5 rounded-full font-semibold ${tooltipStaff.employment === 'fulltime' ? 'bg-sky-100 text-sky-600' : 'bg-violet-100 text-violet-600'}`}>
                    {tooltipStaff.employment === 'fulltime' ? '正規' : 'パート'}
                  </span>
                </div>
                {tooltipConstraintStatus !== 'ok' && (
                  <AlertTriangle className={`w-3.5 h-3.5 shrink-0 ${tooltipConstraintStatus === 'error' ? 'text-red-500' : 'text-amber-500'}`} />
                )}
              </div>
              {/* Pattern */}
              <div
                className="flex items-center gap-2 px-2.5 py-2 rounded-xl mb-2"
                style={{ backgroundColor: tooltipPattern.bgColor }}
              >
                <span className="text-sm font-bold" style={{ color: tooltipPattern.color }}>{tooltipPattern.name}</span>
                {!tooltipPattern.isOff && (
                  <span className="text-[10px] font-medium ml-auto" style={{ color: tooltipPattern.color }}>
                    {tooltipPattern.startTime} – {tooltipPattern.endTime}
                  </span>
                )}
              </div>
              {/* Stats */}
              <div className="flex items-center gap-3 text-[10px] text-gray-400">
                <span>今月 <strong className="text-gray-700">{tooltipStats?.workDays ?? 0}日</strong></span>
                <span><strong className="text-gray-700">{tooltipStats?.totalHours.toFixed(0) ?? 0}h</strong></span>
              </div>
              <p className="text-[9px] text-gray-300 mt-1.5">クリックしてパターンを変更</p>
            </div>
          </div>
        )
      })()}

      {/* ══════════════════ PATTERN CHANGE POPOVER (desktop click) ══════════════════ */}
      {popover && (
        <div
          ref={popoverRef}
          className="hidden md:block fixed z-50 bg-white rounded-2xl shadow-2xl border border-gray-100 p-3 w-56"
          style={{ left: popover.x, top: popover.y }}
        >
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-xs font-bold text-gray-700">
              {staff.find((s) => s.id === popover.staffId)?.name} — {popover.day}日
            </span>
            <button onClick={() => setPopover(null)} className="text-gray-400 hover:text-gray-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-1.5 mb-2.5">
            {shiftPatterns.map((p) => {
              const isCurrent = p.id === (shifts[yearMonth]?.[popover.staffId]?.[popover.slotKey]?.patternId)
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
                  {!p.isOff && <div className="text-[9px] opacity-70 mt-0.5">{p.startTime}</div>}
                </button>
              )
            })}
          </div>

          <button
            onClick={handlePopoverDelete}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold text-red-500 bg-red-50 border border-red-100 hover:bg-red-100 active:scale-95 transition-all"
          >
            <X className="w-3.5 h-3.5" />
            削除
          </button>
        </div>
      )}

      {/* ══════════════════ CLEAR MONTH MODAL ══════════════════ */}
      {showClearModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 w-80 mx-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-red-500" />
              </div>
              <h2 className="text-base font-bold text-gray-800">シフトを全て削除</h2>
            </div>
            <p className="text-sm text-gray-700 mb-1">
              <span className="font-semibold">{ymMonth}月のシフトを全て削除</span>します。
            </p>
            <p className="text-sm text-red-500 mb-6">
              この操作は取り消せません。
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowClearModal(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-600 bg-gray-50 border border-gray-200 hover:bg-gray-100 active:scale-95 transition-all"
              >
                キャンセル
              </button>
              <button
                onClick={handleClearMonth}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-red-500 hover:bg-red-600 active:scale-95 transition-all shadow-sm"
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════ COPY PREVIOUS MONTH MODAL ══════════════════ */}
      {showCopyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 w-80 mx-4">
            <div className="flex items-center gap-2 mb-4">
              <Copy className="w-5 h-5 text-primary-500" />
              <h2 className="text-base font-bold text-gray-800">前月シフトをコピー</h2>
            </div>
            <p className="text-sm text-gray-600 mb-1">
              {prevMonth}月のシフトを{ymMonth}月にコピーします。
            </p>
            <p className="text-sm text-gray-500 mb-6">
              現在の{ymMonth}月のシフトは上書きされます。
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowCopyModal(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-600 bg-gray-50 border border-gray-200 hover:bg-gray-100 active:scale-95 transition-all"
              >
                キャンセル
              </button>
              <button
                onClick={handleCopyPrevMonth}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-primary-500 hover:bg-primary-600 active:scale-95 transition-all shadow-sm"
              >
                コピーする
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════ STAFF PANEL ══════════════════ */}
      <StaffPanel
        open={staffPanelOpen}
        staffId={staffPanelTargetId}
        onClose={() => setStaffPanelOpen(false)}
      />

      {/* ══════════════════ AUTO SCHEDULE MODAL ══════════════════ */}
      <AutoScheduleModal
        open={autoScheduleOpen}
        yearMonth={yearMonth}
        onClose={() => setAutoScheduleOpen(false)}
      />

      {/* ══════════════════ WORKFLOW PANEL ══════════════════ */}
      <WorkflowPanel
        open={workflowOpen}
        staffId={workflowStaffId}
        yearMonth={yearMonth}
        onClose={() => setWorkflowOpen(false)}
      />
    </div>
  )
}
