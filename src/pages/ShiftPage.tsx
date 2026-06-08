import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  ChevronLeft, ChevronRight, X, Zap, Copy,
  Printer, FileDown, FileSpreadsheet, CheckCircle2,
} from 'lucide-react'
import { format, addMonths, subMonths, addWeeks, subWeeks, parseISO } from 'date-fns'
import { ja } from 'date-fns/locale'
import { useStore } from '../store/useStore'
import {
  getYearMonth, getDaysArray, getWeekDays, formatDayHeader,
  calcWorkHours, generateShiftCSV, generateShiftExcel, downloadFile,
  getDaySlots,
} from '../utils/shift'
import { AGE_RATIO } from '../types'

type ViewMode = 'month' | 'week'
type ToastType = 'success' | 'info' | 'error'

interface Toast {
  msg: string
  type: ToastType
}

export default function ShiftPage() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<ViewMode>('month')
  const [weekAnchor, setWeekAnchor] = useState(new Date())
  const [quickFill, setQuickFill] = useState(false)
  const [quickFillPatternId, setQuickFillPatternId] = useState<string | null>(null)
  const [selected, setSelected] = useState<{ staffId: string; day: string } | null>(null)
  const [showCopyConfirm, setShowCopyConfirm] = useState(false)
  const [toast, setToast] = useState<Toast | null>(null)

  const {
    staff, shiftPatterns, shifts, classRooms,
    setShiftEntry, clearShiftEntry, orgSettings, leaveRequests,
  } = useStore()

  const yearMonth = getYearMonth(currentDate)
  const monthDays = getDaysArray(yearMonth)
  const weekDays = getWeekDays(weekAnchor)
  const days = viewMode === 'month' ? monthDays : weekDays

  const patternMap = useMemo(
    () => Object.fromEntries(shiftPatterns.map((p) => [p.id, p])),
    [shiftPatterns],
  )

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(timer)
  }, [toast])

  function showToast(msg: string, type: ToastType = 'info') {
    setToast({ msg, type })
  }

  function getEntryYearMonth(d: Date) {
    return format(d, 'yyyy-MM')
  }

  // ---- Placement alerts ----
  const totalRequired = classRooms.reduce((sum, cr) => {
    const ratio = AGE_RATIO[cr.ageGroup] ?? 6
    return sum + Math.ceil(cr.childrenCount / ratio)
  }, 0)

  const placementCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    days.forEach((d) => {
      const ym = getEntryYearMonth(d)
      const dayNum = d.getDate()
      const dayStr = String(dayNum)
      counts[`${ym}-${dayStr}`] = staff.filter((s) => {
        const slots = getDaySlots(shifts[ym]?.[s.id] ?? {}, dayNum)
        return slots.some((slot) => {
          const p = patternMap[slot.patternId]
          return p && !p.isOff
        })
      }).length
    })
    return counts
  }, [days, staff, shifts, patternMap])

  const placementAlerts = useMemo(() => {
    const alerts: Record<string, boolean> = {}
    days.forEach((d) => {
      const ym = getEntryYearMonth(d)
      const dayStr = String(d.getDate())
      alerts[`${ym}-${dayStr}`] = (placementCounts[`${ym}-${dayStr}`] ?? 0) < totalRequired
    })
    return alerts
  }, [days, placementCounts, totalRequired])

  const shortDaysCount = Object.values(placementAlerts).filter(Boolean).length

  // ---- Fill-rate stats ----
  const fillStats = useMemo(() => {
    const totalCells = staff.length * monthDays.length
    if (totalCells === 0) return 0
    const filled = staff.reduce((acc, s) => {
      return acc + monthDays.filter((d) => {
        const slots = getDaySlots(shifts[yearMonth]?.[s.id] ?? {}, d.getDate())
        return slots.length > 0
      }).length
    }, 0)
    return Math.round((filled / totalCells) * 100)
  }, [staff, monthDays, shifts, yearMonth])

  // ---- Leave requests lookup ----
  const leaveMap = useMemo(() => {
    const map: Record<string, { status: 'pending' | 'approved' | 'rejected'; type: string }> = {}
    leaveRequests.forEach((lr) => {
      map[`${lr.staffId}-${lr.date}`] = { status: lr.status, type: lr.type }
    })
    return map
  }, [leaveRequests])

  // ---- Cell click ----
  function handleCellClick(staffId: string, dayStr: string, ym: string) {
    if (quickFill) {
      if (!quickFillPatternId) {
        showToast('先にパターンを選択してください', 'info')
        return
      }
      const current = shifts[ym]?.[staffId]?.[dayStr]
      if (current?.patternId === quickFillPatternId) {
        clearShiftEntry(ym, staffId, dayStr)
      } else {
        setShiftEntry(ym, staffId, dayStr, { patternId: quickFillPatternId, note: '' })
      }
      return
    }
    setSelected({ staffId, day: `${ym}|${dayStr}` })
  }

  function handleSelectPattern(patternId: string) {
    if (!selected) return
    const [ym, day] = selected.day.split('|')
    setShiftEntry(ym, selected.staffId, day, { patternId, note: '' })
    setSelected(null)
  }

  function handleClearEntry() {
    if (!selected) return
    const [ym, day] = selected.day.split('|')
    clearShiftEntry(ym, selected.staffId, day)
    setSelected(null)
  }

  const selectedStaff = selected
    ? staff.find((s) => s.id === selected.staffId) ?? null
    : null

  // ---- Prev-month copy ----
  function handlePrevMonthCopy() {
    const prevYM = format(subMonths(parseISO(`${yearMonth}-01`), 1), 'yyyy-MM')
    if (!shifts[prevYM]) {
      showToast('前月のシフトデータがありません', 'error')
      return
    }
    setShowCopyConfirm(true)
  }

  const executeCopy = useCallback(() => {
    const prevYM = format(subMonths(parseISO(`${yearMonth}-01`), 1), 'yyyy-MM')
    monthDays.forEach((d) => {
      const dayStr = String(d.getDate())
      const dayNum = d.getDate()
      staff.forEach((s) => {
        const prevSlots = getDaySlots(shifts[prevYM]?.[s.id] ?? {}, dayNum)
        prevSlots.forEach((slot) => {
          setShiftEntry(yearMonth, s.id, dayStr, { patternId: slot.patternId, note: slot.note })
        })
      })
    })
    setShowCopyConfirm(false)
    showToast('前月のシフトをコピーしました', 'success')
  }, [yearMonth, monthDays, staff, shifts, setShiftEntry])

  // ---- Export ----
  function handleCSVDownload() {
    const csv = generateShiftCSV(yearMonth, staff, monthDays, shifts, shiftPatterns)
    downloadFile(csv, `シフト表_${yearMonth}.csv`, 'text/csv;charset=utf-8')
    showToast('CSVをダウンロードしました', 'success')
  }

  function handleExcelDownload() {
    const csv = generateShiftExcel(yearMonth, staff, monthDays, shifts, shiftPatterns)
    downloadFile(
      csv,
      `シフト表_${yearMonth}.xlsx`,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    )
    showToast('Excelファイルをダウンロードしました', 'success')
  }

  // ---- Labels ----
  const monthLabel = format(currentDate, 'yyyy年M月', { locale: ja })
  const weekLabel = (() => {
    const s = weekDays[0]
    const e = weekDays[6]
    if (s.getMonth() === e.getMonth()) {
      return `${format(s, 'M月d日', { locale: ja })} 〜 ${format(e, 'd日', { locale: ja })}`
    }
    return `${format(s, 'M月d日', { locale: ja })} 〜 ${format(e, 'M月d日', { locale: ja })}`
  })()

  const [year, month] = yearMonth.split('-')
  const prevMonthLabel = format(subMonths(parseISO(`${yearMonth}-01`), 1), 'M月', { locale: ja })

  return (
    <div className="space-y-3">

      {/* ========== 印刷用ヘッダー ========== */}
      <div className="hidden print:block mb-4">
        <h1 className="text-2xl font-bold text-gray-900">
          {orgSettings.name}　シフト表　{year}年{Number(month)}月
        </h1>
      </div>

      {/* ========== ページヘッダー ========== */}
      <div className="print:hidden">
        {/* タイトル行 + 月ナビ */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <h1 className="text-lg sm:text-xl font-bold text-gray-800 truncate">シフト表（一覧）</h1>

          {/* 月 / 週 ナビ */}
          <div className="flex items-center gap-1 shrink-0">
            {viewMode === 'month' ? (
              <>
                <button
                  onClick={() => setCurrentDate((d) => subMonths(d, 1))}
                  className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-gray-200 hover:bg-gray-50 active:bg-gray-100 transition-colors"
                  aria-label="前月"
                >
                  <ChevronLeft className="w-4 h-4 text-gray-600" />
                </button>
                <span className="font-bold text-gray-800 text-sm min-w-[84px] text-center">
                  {monthLabel}
                </span>
                <button
                  onClick={() => setCurrentDate((d) => addMonths(d, 1))}
                  className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-gray-200 hover:bg-gray-50 active:bg-gray-100 transition-colors"
                  aria-label="翌月"
                >
                  <ChevronRight className="w-4 h-4 text-gray-600" />
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setWeekAnchor((d) => subWeeks(d, 1))}
                  className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-gray-200 hover:bg-gray-50 active:bg-gray-100 transition-colors"
                  aria-label="前週"
                >
                  <ChevronLeft className="w-4 h-4 text-gray-600" />
                </button>
                <span className="font-bold text-gray-800 text-xs min-w-[140px] text-center">
                  {weekLabel}
                </span>
                <button
                  onClick={() => setWeekAnchor((d) => addWeeks(d, 1))}
                  className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-gray-200 hover:bg-gray-50 active:bg-gray-100 transition-colors"
                  aria-label="翌週"
                >
                  <ChevronRight className="w-4 h-4 text-gray-600" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* ---- 進捗統計バー ---- */}
        <div className="bg-white border border-gray-100 rounded-2xl px-4 py-3 shadow-sm mb-3">
          {/* モバイル: 2列グリッド / デスクトップ: 横並び */}
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-x-5 sm:gap-y-2">
            {/* 入力率 */}
            <div className="col-span-2 flex items-center gap-2">
              <span className="text-xs text-gray-500 whitespace-nowrap">入力率</span>
              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${fillStats}%`,
                    background: fillStats >= 80 ? '#22c55e' : fillStats >= 50 ? '#f59e0b' : '#ef4444',
                  }}
                />
              </div>
              <span className="text-xs font-bold text-gray-700 tabular-nums">{fillStats}%</span>
            </div>

            {/* 配置不足日数 */}
            <div className="flex items-center gap-1.5">
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  shortDaysCount > 0
                    ? 'bg-red-100 text-red-600'
                    : 'bg-green-100 text-green-600'
                }`}
              >
                {shortDaysCount > 0 ? `配置不足: ${shortDaysCount}日` : '配置OK'}
              </span>
            </div>

            {/* 必要人数 */}
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <span className="bg-sky-50 text-sky-600 px-2 py-0.5 rounded-full font-medium whitespace-nowrap">
                必要: {totalRequired}名/日
              </span>
            </div>
          </div>
        </div>

        {/* ---- ツールバー（モバイル: アイコンのみ / デスクトップ: フルラベル） ---- */}
        {/* モバイル用コンパクトツールバー */}
        <div className="flex items-center gap-1.5 md:hidden">
          {/* ビュー切り替え */}
          <div className="flex bg-gray-100 rounded-xl p-1 gap-0.5">
            <button
              onClick={() => setViewMode('month')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                viewMode === 'month'
                  ? 'bg-white text-gray-800 shadow-sm'
                  : 'text-gray-500'
              }`}
            >
              月
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                viewMode === 'week'
                  ? 'bg-white text-gray-800 shadow-sm'
                  : 'text-gray-500'
              }`}
            >
              週
            </button>
          </div>

          {/* 一括入力 */}
          <button
            onClick={() => {
              setQuickFill((v) => !v)
              setQuickFillPatternId(null)
            }}
            className={`w-9 h-9 flex items-center justify-center rounded-xl border transition-colors ${
              quickFill
                ? 'bg-amber-400 text-white border-amber-400 shadow-sm'
                : 'bg-white text-gray-600 border-gray-200'
            }`}
            aria-label="一括入力"
          >
            <Zap className="w-4 h-4" />
          </button>

          {/* 前月コピー */}
          <button
            onClick={handlePrevMonthCopy}
            className="w-9 h-9 flex items-center justify-center rounded-xl border bg-white text-gray-600 border-gray-200 transition-colors"
            aria-label="前月コピー"
          >
            <Copy className="w-4 h-4" />
          </button>

          {/* CSV */}
          <button
            onClick={handleCSVDownload}
            className="w-9 h-9 flex items-center justify-center rounded-xl border bg-white text-gray-600 border-gray-200 transition-colors"
            aria-label="CSV出力"
          >
            <FileDown className="w-4 h-4" />
          </button>

          {/* 印刷 */}
          <button
            onClick={() => window.print()}
            className="w-9 h-9 flex items-center justify-center rounded-xl border bg-white text-gray-600 border-gray-200 transition-colors"
            aria-label="印刷"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>

        {/* デスクトップ用フルツールバー */}
        <div className="hidden md:flex flex-wrap items-center gap-2">
          {/* ビュー切り替え */}
          <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
            <button
              onClick={() => setViewMode('month')}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                viewMode === 'month'
                  ? 'bg-white text-gray-800 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              月次
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                viewMode === 'week'
                  ? 'bg-white text-gray-800 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              週次
            </button>
          </div>

          {/* 一括入力 */}
          <button
            onClick={() => {
              setQuickFill((v) => !v)
              setQuickFillPatternId(null)
            }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${
              quickFill
                ? 'bg-amber-400 text-white border-amber-400 shadow-sm'
                : 'bg-white text-gray-600 border-gray-200 hover:border-amber-300 hover:text-amber-600'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            一括入力
          </button>

          {/* 前月コピー */}
          <button
            onClick={handlePrevMonthCopy}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border bg-white text-gray-600 border-gray-200 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
          >
            <Copy className="w-3.5 h-3.5" />
            前月コピー
          </button>

          {/* エクスポート / 印刷 */}
          <div className="flex items-center gap-1.5 ml-auto">
            <button
              onClick={handleCSVDownload}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors"
            >
              <FileDown className="w-3.5 h-3.5" />
              CSV
            </button>
            <button
              onClick={handleExcelDownload}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-white border border-green-200 text-green-700 hover:bg-green-50 transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Excel
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              印刷
            </button>
          </div>
        </div>
      </div>

      {/* ========== 一括入力バナー + パターンチップ ========== */}
      {quickFill && (
        <div className="print:hidden space-y-2">
          <div className="flex items-center gap-3 bg-amber-50 border-2 border-amber-300 rounded-2xl px-3 sm:px-4 py-3">
            <Zap className="w-4 h-4 text-amber-500 shrink-0" />
            <p className="text-xs font-semibold text-amber-700 flex-1">
              <span className="sm:hidden">パターンを選んでセルをタップ</span>
              <span className="hidden sm:inline">⚡ 一括入力モード中 — 先にパターンを選択してからセルをタップ</span>
            </p>
            <button
              onClick={() => { setQuickFill(false); setQuickFillPatternId(null) }}
              className="text-xs font-bold text-amber-700 bg-amber-200 hover:bg-amber-300 px-3 py-1 rounded-lg transition-colors"
            >
              終了
            </button>
          </div>

          {/* パターンチップ選択 */}
          <div className="flex flex-wrap gap-2 px-1">
            {shiftPatterns.map((p) => (
              <button
                key={p.id}
                onClick={() => setQuickFillPatternId(p.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border-2 transition-all active:scale-95 ${
                  quickFillPatternId === p.id ? 'ring-2 ring-offset-1 ring-amber-400 scale-105' : ''
                }`}
                style={{
                  backgroundColor: p.bgColor,
                  color: p.color,
                  borderColor: quickFillPatternId === p.id ? p.color : p.color + '44',
                }}
              >
                {quickFillPatternId === p.id && (
                  <CheckCircle2 className="w-3 h-3" />
                )}
                {p.name}
                {!p.isOff && (
                  <span className="opacity-60 font-normal">{p.startTime}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ========== シフトテーブル ========== */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto shift-scroll" style={{ WebkitOverflowScrolling: 'touch' }}>
          <table
            className="border-collapse shift-print-table"
            style={{ minWidth: `${90 + days.length * 38 + 52}px` }}
          >
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {/* 職員名列ヘッダー */}
                <th className="sticky left-0 z-10 bg-gray-50 text-left px-2 py-3 font-semibold text-gray-500 text-xs w-[90px] min-w-[90px] sm:w-[130px] sm:min-w-[130px] sm:px-3 border-r border-gray-100">
                  職員名
                </th>

                {/* 日付列ヘッダー */}
                {days.map((d) => {
                  const { day, dayOfWeek, isSunday } = formatDayHeader(d)
                  const isSaturday = d.getDay() === 6
                  const ym = getEntryYearMonth(d)
                  const alertKey = `${ym}-${day}`
                  const hasShortage = placementAlerts[alertKey]
                  return (
                    <th
                      key={`${ym}-${day}`}
                      className={`text-center py-2 font-medium w-[38px] min-w-[38px] sm:w-[46px] sm:min-w-[46px] ${
                        isSunday
                          ? 'text-red-400'
                          : isSaturday
                          ? 'text-sky-500'
                          : 'text-gray-500'
                      } ${hasShortage ? 'bg-amber-100' : isSunday ? 'bg-red-50/30' : isSaturday ? 'bg-sky-50/30' : ''}`}
                      style={{ fontSize: 11 }}
                    >
                      {viewMode === 'week' && (
                        <div className="text-gray-400 font-normal text-[10px]">{format(d, 'M/d')}</div>
                      )}
                      <div className="font-bold">{day}</div>
                      <div className="font-normal text-[10px]">{dayOfWeek}</div>
                      {hasShortage && <div className="text-amber-500 leading-none text-[10px]">▲</div>}
                    </th>
                  )
                })}

                {/* 合計列ヘッダー */}
                <th
                  className="sticky right-0 z-10 bg-gray-50 text-center px-2 py-3 text-gray-500 font-semibold w-[60px] min-w-[60px] border-l border-gray-100"
                  style={{ fontSize: 11 }}
                >
                  月計
                </th>
              </tr>
            </thead>
            <tbody>
              {staff.map((s, si) => {
                const monthlyHours = monthDays.reduce((sum, d) => {
                  const ym = getEntryYearMonth(d)
                  const slots = getDaySlots(shifts[ym]?.[s.id] ?? {}, d.getDate())
                  return sum + slots.reduce((s2, slot) => {
                    const p = patternMap[slot.patternId]
                    return s2 + (p ? calcWorkHours(p) : 0)
                  }, 0)
                }, 0)

                const expectedHours = s.weeklyHours * 4
                const isOverHours = monthlyHours > expectedHours + 1
                const isUnderHours = monthlyHours < expectedHours - 8

                const rowBg = si % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'
                const rowBgSticky = si % 2 === 0 ? 'bg-white' : 'bg-gray-50'

                return (
                  <tr key={s.id} className={rowBg}>
                    {/* 職員名（sticky left） */}
                    <td
                      className={`sticky left-0 z-10 ${rowBgSticky} px-2 sm:px-3 py-1.5 sm:py-2 border-b border-gray-100 border-r border-r-gray-100`}
                      style={{ minHeight: 48 }}
                    >
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        {/* アバター */}
                        <div
                          className="w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-white text-[10px] sm:text-xs font-bold shrink-0 shadow-sm"
                          style={{ backgroundColor: s.color }}
                        >
                          {s.name[0]}
                        </div>
                        <div className="min-w-0">
                          <div className="text-[10px] sm:text-xs font-semibold text-gray-800 leading-tight truncate max-w-[48px] sm:max-w-[72px]">
                            {/* モバイルでは名前の最初の部分のみ表示 */}
                            <span className="sm:hidden">{s.name.split(/[\s　]/)[0]}</span>
                            <span className="hidden sm:inline">{s.name}</span>
                          </div>
                          <div className="flex items-center gap-1 mt-0.5">
                            <span
                              className={`text-[9px] sm:text-[10px] font-medium px-1 sm:px-1.5 py-0.5 rounded-full ${
                                s.employment === 'fulltime'
                                  ? 'bg-indigo-50 text-indigo-600'
                                  : 'bg-orange-50 text-orange-500'
                              }`}
                            >
                              {s.employment === 'fulltime' ? '正' : 'P'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* 各日セル */}
                    {days.map((d) => {
                      const dayStr = String(d.getDate())
                      const ym = getEntryYearMonth(d)
                      const dayNum = d.getDate()
                      const slots = getDaySlots(shifts[ym]?.[s.id] ?? {}, dayNum)
                      const workSlots = slots.filter((slot) => {
                        const p = patternMap[slot.patternId]
                        return p && !p.isOff
                      })
                      const primarySlot = slots[0] ?? null
                      const primaryPattern = primarySlot ? patternMap[primarySlot.patternId] : null
                      const isSaturday = d.getDay() === 6
                      const isSunday = d.getDay() === 0

                      const isSelected =
                        !quickFill &&
                        selected?.staffId === s.id &&
                        selected?.day === `${ym}|${dayStr}`

                      // Leave request indicator
                      const leaveDate = `${ym}-${dayStr.padStart(2, '0')}`
                      const leaveLookupKey = `${s.id}-${leaveDate}`
                      const leave = leaveMap[leaveLookupKey]

                      // Column tint
                      let colBg = ''
                      if (slots.length === 0) {
                        if (isSunday) colBg = 'bg-red-50/20'
                        else if (isSaturday) colBg = 'bg-sky-50/30'
                      }

                      // Active quickfill pattern highlight
                      const isQuickFillActive = quickFill && quickFillPatternId !== null

                      return (
                        <td
                          key={`${ym}-${dayStr}-${s.id}`}
                          onClick={() => handleCellClick(s.id, dayStr, ym)}
                          className={`text-center border-b border-gray-100 transition-colors select-none cursor-pointer active:opacity-60 ${colBg} ${
                            isSelected ? 'ring-2 ring-primary-400 ring-inset' : ''
                          } ${isQuickFillActive ? 'hover:bg-amber-50' : ''}`}
                          style={{ padding: '3px 2px', height: 48 }}
                        >
                          {workSlots.length > 0 ? (
                            <div className="flex flex-col gap-0.5 items-center">
                              {workSlots.map((slot) => {
                                const p = patternMap[slot.patternId]
                                if (!p) return null
                                return (
                                  <span
                                    key={slot.slotKey}
                                    className="inline-flex items-center justify-center w-full font-bold rounded-md"
                                    style={{
                                      backgroundColor: p.bgColor,
                                      color: p.color,
                                      fontSize: 10,
                                      padding: '3px 2px',
                                      minWidth: 34,
                                    }}
                                  >
                                    {p.name}
                                  </span>
                                )
                              })}
                            </div>
                          ) : primaryPattern ? (
                            /* 休み・有給など isOff パターン */
                            <span
                              className="inline-flex items-center justify-center w-full font-bold rounded-md"
                              style={{
                                backgroundColor: primaryPattern.bgColor,
                                color: primaryPattern.color,
                                fontSize: 10,
                                padding: '4px 2px',
                                minWidth: 34,
                              }}
                            >
                              {primaryPattern.name}
                            </span>
                          ) : leave?.status === 'pending' ? (
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-purple-300 mx-auto mt-1" title="休暇申請中" />
                          ) : (
                            <span className="text-gray-200 text-xs">—</span>
                          )}
                        </td>
                      )
                    })}

                    {/* 月計（sticky right） */}
                    <td
                      className={`sticky right-0 z-10 ${rowBgSticky} text-center border-b border-gray-100 border-l border-l-gray-100 px-1`}
                    >
                      <span
                        className={`text-xs font-bold tabular-nums ${
                          isOverHours
                            ? 'text-red-500'
                            : isUnderHours
                            ? 'text-gray-400'
                            : 'text-green-600'
                        }`}
                      >
                        {monthlyHours.toFixed(0)}h
                      </span>
                    </td>
                  </tr>
                )
              })}

              {/* 配置数行（テーブル下部） */}
              <tr className="bg-gray-100 border-t-2 border-gray-200">
                <td className="sticky left-0 z-10 bg-gray-100 px-3 py-2 border-b border-gray-200 border-r border-r-gray-200">
                  <span className="text-xs font-bold text-gray-600">配置数</span>
                </td>
                {days.map((d) => {
                  const ym = getEntryYearMonth(d)
                  const dayStr = String(d.getDate())
                  const count = placementCounts[`${ym}-${dayStr}`] ?? 0
                  const isShort = count < totalRequired
                  return (
                    <td
                      key={`placement-${ym}-${dayStr}`}
                      className={`text-center border-b border-gray-200 ${isShort ? 'bg-red-50' : 'bg-green-50'}`}
                      style={{ padding: '4px 2px', height: 36 }}
                    >
                      <span
                        className={`text-xs font-bold ${isShort ? 'text-red-500' : 'text-green-600'}`}
                      >
                        {count}
                        {!isShort && <span className="ml-0.5 text-[9px]">✓</span>}
                      </span>
                    </td>
                  )
                })}
                <td className="sticky right-0 z-10 bg-gray-100 border-b border-gray-200 border-l border-l-gray-200" />
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ========== シフト選択モーダル（ボトムシート） ========== */}
      {selected && !quickFill && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center sm:items-center sm:p-4 bg-black/40 print:hidden"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-sm animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* スマホ用ハンドル */}
            <div className="flex justify-center pt-3 pb-1 sm:hidden">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>

            <div className="px-5 pb-4 pt-3 sm:pt-5">
              {/* ヘッダー */}
              <div className="flex items-center gap-3 mb-4">
                {selectedStaff ? (
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shrink-0"
                    style={{ backgroundColor: selectedStaff.color }}
                  >
                    {selectedStaff.name[0]}
                  </div>
                ) : null}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-800 truncate">{selectedStaff?.name}</p>
                  <p className="text-xs text-gray-400">
                    {selected.day.split('|')[0].replace('-', '年').replace('-', '月')}
                    {selected.day.split('|')[1]}日 のシフトを選択
                  </p>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              {/* パターンボタン */}
              <div className="grid grid-cols-2 gap-2">
                {shiftPatterns.map((p) => {
                  const [ym, day] = selected.day.split('|')
                  const currentEntry = shifts[ym]?.[selected.staffId]?.[day]
                  const isCurrent = currentEntry?.patternId === p.id
                  return (
                    <button
                      key={p.id}
                      onClick={() => handleSelectPattern(p.id)}
                      className={`flex items-center justify-between gap-2 px-4 py-3.5 rounded-xl border-2 text-sm font-medium transition-all active:scale-95 ${
                        isCurrent ? 'ring-2 ring-offset-1 ring-gray-500' : ''
                      }`}
                      style={{
                        backgroundColor: p.bgColor,
                        color: p.color,
                        borderColor: p.color + '60',
                      }}
                    >
                      <div className="flex items-center gap-1.5">
                        {isCurrent && <CheckCircle2 className="w-4 h-4 shrink-0" />}
                        <span className="font-bold">{p.name}</span>
                      </div>
                      <span className="text-xs opacity-70">
                        {p.isOff ? '休み' : `${p.startTime}〜${p.endTime}`}
                      </span>
                    </button>
                  )
                })}
              </div>

              {/* クリアボタン */}
              <button
                onClick={handleClearEntry}
                className="mt-3 w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium text-red-400 bg-red-50 border border-red-100 hover:bg-red-100 active:bg-red-100 transition-colors"
              >
                <X className="w-4 h-4" />
                シフトをクリア（空白にする）
              </button>
            </div>

            {/* iOS safe area */}
            <div className="h-4 sm:hidden" />
          </div>
        </div>
      )}

      {/* ========== 前月コピー確認モーダル ========== */}
      {showCopyConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 print:hidden"
          onClick={() => setShowCopyConfirm(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-gray-800 mb-2">
              前月のシフトをコピーしますか？
            </h3>
            <p className="text-sm text-gray-500 mb-1">
              {prevMonthLabel}のシフトを{Number(month)}月にコピーします。
            </p>
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-5">
              ⚠️ 現在入力済みのシフトは上書きされます。
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCopyConfirm(false)}
                className="flex-1 py-3 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={executeCopy}
                className="flex-1 py-3 rounded-xl text-sm font-semibold text-white bg-indigo-500 hover:bg-indigo-600 transition-colors"
              >
                コピーする
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== トースト通知 ========== */}
      {toast && (
        <div className="fixed bottom-6 left-4 right-4 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-[60] print:hidden animate-slide-up sm:w-auto max-w-xs mx-auto sm:mx-0">
          <div
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl shadow-lg text-sm font-semibold text-white ${
              toast.type === 'success'
                ? 'bg-green-500'
                : toast.type === 'error'
                ? 'bg-red-500'
                : 'bg-gray-700'
            }`}
          >
            {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 shrink-0" />}
            {toast.msg}
          </div>
        </div>
      )}
    </div>
  )
}
