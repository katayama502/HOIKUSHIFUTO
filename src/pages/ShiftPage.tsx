import { useState, useMemo } from 'react'
import {
  ChevronLeft, ChevronRight, AlertTriangle, CheckCircle, X, Info,
  Printer, FileDown, FileSpreadsheet, Zap,
} from 'lucide-react'
import { format, addMonths, subMonths, addWeeks, subWeeks } from 'date-fns'
import { ja } from 'date-fns/locale'
import { useStore } from '../store/useStore'
import {
  getYearMonth, getDaysArray, getWeekDays, formatDayHeader,
  calcWorkHours, generateShiftCSV, generateShiftExcel, downloadFile,
} from '../utils/shift'
import { AGE_RATIO } from '../types'

type ViewMode = 'month' | 'week'

export default function ShiftPage() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<ViewMode>('month')
  const [weekAnchor, setWeekAnchor] = useState(new Date())
  const [quickFill, setQuickFill] = useState(false)

  const {
    staff, shiftPatterns, shifts, classRooms,
    setShiftEntry, clearShiftEntry, currentRole, currentStaffId,
    orgSettings,
  } = useStore()

  const yearMonth = getYearMonth(currentDate)
  const monthDays = getDaysArray(yearMonth)
  const weekDays = getWeekDays(weekAnchor)

  // Which days to display in the table
  const days = viewMode === 'month' ? monthDays : weekDays

  const patternMap = useMemo(() => Object.fromEntries(shiftPatterns.map((p) => [p.id, p])), [shiftPatterns])

  const [selected, setSelected] = useState<{ staffId: string; day: string } | null>(null)
  const [legendOpen, setLegendOpen] = useState(false)

  const isAdmin = currentRole === 'admin'

  // For weekly view we may span two months - derive yearMonth per day
  function getEntryYearMonth(d: Date) {
    return format(d, 'yyyy-MM')
  }

  const placementAlerts = useMemo(() => {
    const alerts: Record<string, boolean> = {}
    days.forEach((d) => {
      const ym = getEntryYearMonth(d)
      const dayStr = String(d.getDate())
      const workingCount = staff.filter((s) => {
        const entry = shifts[ym]?.[s.id]?.[dayStr]
        if (!entry) return false
        const p = patternMap[entry.patternId]
        return p && !p.isOff
      }).length
      const totalRequired = classRooms.reduce((sum, cr) => {
        const ratio = AGE_RATIO[cr.ageGroup] ?? 6
        return sum + Math.ceil(cr.childrenCount / ratio)
      }, 0)
      alerts[`${ym}-${dayStr}`] = workingCount < totalRequired
    })
    return alerts
  }, [days, staff, shifts, classRooms, patternMap])

  const totalRequired = classRooms.reduce((sum, cr) => {
    const ratio = AGE_RATIO[cr.ageGroup] ?? 6
    return sum + Math.ceil(cr.childrenCount / ratio)
  }, 0)

  const hasAlert = Object.values(placementAlerts).some(Boolean)
  const displayStaff = isAdmin ? staff : staff.filter((s) => s.id === currentStaffId)

  function handleCellClick(staffId: string, day: string, ym: string) {
    if (!isAdmin) return
    if (quickFill) {
      // Quick-fill: apply last selected pattern to all staff for this day
      setSelected({ staffId: '__quickfill__', day: `${ym}|${day}` })
    } else {
      setSelected({ staffId, day: `${ym}|${day}` })
    }
  }

  function handleSelectPattern(patternId: string) {
    if (!selected) return
    const [ym, day] = selected.day.split('|')
    if (quickFill && selected.staffId === '__quickfill__') {
      // Apply to all displayed staff
      displayStaff.forEach((s) => {
        setShiftEntry(ym, s.id, day, { patternId, note: '' })
      })
    } else {
      setShiftEntry(ym, selected.staffId, day, { patternId, note: '' })
    }
    setSelected(null)
  }

  function handleClearEntry() {
    if (!selected) return
    const [ym, day] = selected.day.split('|')
    if (quickFill && selected.staffId === '__quickfill__') {
      displayStaff.forEach((s) => clearShiftEntry(ym, s.id, day))
    } else {
      clearShiftEntry(ym, selected.staffId, day)
    }
    setSelected(null)
  }

  function getSelectedDay(): string {
    if (!selected) return ''
    return selected.day.split('|')[1]
  }
  function getSelectedYM(): string {
    if (!selected) return yearMonth
    return selected.day.split('|')[0]
  }

  const selectedStaff =
    selected && selected.staffId !== '__quickfill__'
      ? staff.find((s) => s.id === selected.staffId)
      : null

  const monthLabel = format(currentDate, 'yyyy年M月', { locale: ja })
  const weekLabel = (() => {
    const s = weekDays[0]
    const e = weekDays[6]
    if (s.getMonth() === e.getMonth()) {
      return `${format(s, 'yyyy年M月d日')} 〜 ${format(e, 'd日', { locale: ja })}`
    }
    return `${format(s, 'M月d日', { locale: ja })} 〜 ${format(e, 'M月d日', { locale: ja })}`
  })()

  // ---- CSV / Excel download ----
  function handleCSVDownload() {
    const csv = generateShiftCSV(yearMonth, displayStaff, monthDays, shifts, shiftPatterns)
    downloadFile(csv, `シフト表_${yearMonth}.csv`, 'text/csv;charset=utf-8')
  }

  function handleExcelDownload() {
    const csv = generateShiftExcel(yearMonth, displayStaff, monthDays, shifts, shiftPatterns)
    downloadFile(csv, `シフト表_${yearMonth}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  }

  // Placement count per day
  const placementCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    days.forEach((d) => {
      const ym = getEntryYearMonth(d)
      const dayStr = String(d.getDate())
      counts[`${ym}-${dayStr}`] = staff.filter((s) => {
        const entry = shifts[ym]?.[s.id]?.[dayStr]
        if (!entry) return false
        const p = patternMap[entry.patternId]
        return p && !p.isOff
      }).length
    })
    return counts
  }, [days, staff, shifts, patternMap])

  return (
    <div className="space-y-4">

      {/* ヘッダー */}
      <div className="flex items-center justify-between gap-3 print:hidden">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-gray-800 truncate">シフト表</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {isAdmin ? '✏️ セルをタップしてシフト入力' : '👀 自分のシフトを確認'}
          </p>
        </div>
        {/* 月切り替え */}
        <div className="flex items-center gap-1 shrink-0">
          {viewMode === 'month' ? (
            <>
              <button
                onClick={() => setCurrentDate((d) => subMonths(d, 1))}
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-gray-200 active:bg-gray-100 transition-colors"
              >
                <ChevronLeft className="w-4 h-4 text-gray-600" />
              </button>
              <span className="font-bold text-gray-800 text-sm min-w-[80px] text-center">{monthLabel}</span>
              <button
                onClick={() => setCurrentDate((d) => addMonths(d, 1))}
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-gray-200 active:bg-gray-100 transition-colors"
              >
                <ChevronRight className="w-4 h-4 text-gray-600" />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setWeekAnchor((d) => subWeeks(d, 1))}
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-gray-200 active:bg-gray-100 transition-colors"
              >
                <ChevronLeft className="w-4 h-4 text-gray-600" />
              </button>
              <span className="font-bold text-gray-800 text-xs min-w-[140px] text-center">{weekLabel}</span>
              <button
                onClick={() => setWeekAnchor((d) => addWeeks(d, 1))}
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-gray-200 active:bg-gray-100 transition-colors"
              >
                <ChevronRight className="w-4 h-4 text-gray-600" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* 月次/週次ビュー切り替え */}
      <div className="flex items-center gap-2 print:hidden">
        <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
          <button
            onClick={() => setViewMode('month')}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${viewMode === 'month' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            月次ビュー
          </button>
          <button
            onClick={() => setViewMode('week')}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${viewMode === 'week' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            週次ビュー
          </button>
        </div>

        {/* 一括入力モードトグル (admin only) */}
        {isAdmin && (
          <button
            onClick={() => setQuickFill((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors
              ${quickFill
                ? 'bg-amber-400 text-white border-amber-400 shadow-sm'
                : 'bg-white text-gray-500 border-gray-200 hover:border-amber-300'}`}
          >
            <Zap className="w-3.5 h-3.5" />
            一括入力{quickFill ? '中' : 'モード'}
          </button>
        )}
      </div>

      {/* エクスポートツールバー */}
      {isAdmin && (
        <div className="flex items-center gap-2 flex-wrap print:hidden export-toolbar">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            印刷
          </button>
          <button
            onClick={handleCSVDownload}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors"
          >
            <FileDown className="w-3.5 h-3.5" />
            CSV出力
          </button>
          <button
            onClick={handleExcelDownload}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-white border border-green-200 text-green-700 hover:bg-green-50 active:bg-green-100 transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Excelダウンロード
          </button>
        </div>
      )}

      {/* 配置基準バナー */}
      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm border ${hasAlert ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
        {hasAlert
          ? <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
          : <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
        }
        <span className="text-gray-700 text-xs leading-snug flex-1">
          必要人数 <strong>{totalRequired}名/日</strong>
          {hasAlert ? ' — ⚠️ 不足している日があります' : ' — すべての日で基準をクリア'}
        </span>
      </div>

      {/* 凡例 (折りたたみ) */}
      <div className="print:hidden">
        <button
          onClick={() => setLegendOpen(!legendOpen)}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
        >
          <Info className="w-3.5 h-3.5" />
          シフトの色一覧
          <ChevronRight className={`w-3 h-3 transition-transform ${legendOpen ? 'rotate-90' : ''}`} />
        </button>
        {legendOpen && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {shiftPatterns.map((p) => (
              <span
                key={p.id}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border"
                style={{ backgroundColor: p.bgColor, color: p.color, borderColor: p.color + '44' }}
              >
                {p.name}
                {!p.isOff && <span className="opacity-70 text-[10px]">{p.startTime}</span>}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 印刷用ヘッダー（印刷時のみ表示） */}
      <div className="hidden print:block print-header">
        <h1 className="text-2xl font-bold">{orgSettings.name}</h1>
        <p className="text-base text-gray-600 mt-1">
          {viewMode === 'month' ? monthLabel : weekLabel} シフト表
        </p>
      </div>

      {/* シフトテーブル */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto shift-scroll" style={{ WebkitOverflowScrolling: 'touch' }}>
          <table className="border-collapse shift-print-table" style={{ minWidth: `${120 + days.length * 44 + 56}px` }}>
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {/* 職員名列 */}
                <th className="sticky left-0 z-10 bg-gray-50 text-left px-3 py-3 font-medium text-gray-500 text-xs w-[110px] min-w-[110px]">
                  職員名
                </th>
                {/* 日付列 */}
                {days.map((d) => {
                  const { day, dayOfWeek, isWeekend, isSunday } = formatDayHeader(d)
                  const ym = getEntryYearMonth(d)
                  const alertKey = `${ym}-${day}`
                  const alert = placementAlerts[alertKey]
                  return (
                    <th
                      key={`${ym}-${day}`}
                      className={`text-center py-2 font-medium w-[44px] min-w-[44px]
                        ${isSunday ? 'text-red-400' : isWeekend ? 'text-blue-400' : 'text-gray-500'}
                        ${alert ? 'bg-amber-50' : ''}
                      `}
                      style={{ fontSize: 11 }}
                    >
                      {viewMode === 'week' && (
                        <div className="text-gray-400 font-normal text-[10px]">{format(d, 'M/d')}</div>
                      )}
                      <div>{day}</div>
                      <div className="text-gray-400 font-normal">{dayOfWeek}</div>
                      {alert && <div className="text-amber-400 leading-none">▲</div>}
                    </th>
                  )
                })}
                {/* 合計列 */}
                <th className="text-center px-2 py-3 text-gray-500 font-medium w-[52px] min-w-[52px]" style={{ fontSize: 11 }}>
                  合計
                </th>
              </tr>
            </thead>
            <tbody>
              {displayStaff.map((s, si) => {
                const totalHours = days.reduce((sum, d) => {
                  const ym = getEntryYearMonth(d)
                  const entry = shifts[ym]?.[s.id]?.[String(d.getDate())]
                  if (!entry) return sum
                  const p = patternMap[entry.patternId]
                  return sum + (p ? calcWorkHours(p) : 0)
                }, 0)

                return (
                  <tr key={s.id} className={si % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}>
                    {/* 職員名（sticky） */}
                    <td className={`sticky left-0 z-10 px-3 py-2 border-b border-gray-100 ${si % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                      <div className="flex items-center gap-1.5">
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                          style={{ backgroundColor: s.color }}
                        >
                          {s.name[0]}
                        </div>
                        <span className="text-xs font-medium text-gray-700 leading-tight">
                          {s.name.replace(' ', '\n').split('\n')[0]}
                        </span>
                      </div>
                    </td>

                    {/* 各日のシフトセル */}
                    {days.map((d) => {
                      const dayStr = String(d.getDate())
                      const ym = getEntryYearMonth(d)
                      const entry = shifts[ym]?.[s.id]?.[dayStr]
                      const pattern = entry ? patternMap[entry.patternId] : null
                      const isSelected =
                        selected?.staffId === s.id &&
                        selected?.day === `${ym}|${dayStr}`
                      const isQuickSelected =
                        quickFill &&
                        selected?.staffId === '__quickfill__' &&
                        selected?.day === `${ym}|${dayStr}`
                      const { isWeekend } = formatDayHeader(d)

                      return (
                        <td
                          key={`${ym}-${dayStr}`}
                          onClick={() => handleCellClick(s.id, dayStr, ym)}
                          className={`text-center border-b border-gray-100 transition-colors select-none
                            ${isAdmin ? 'cursor-pointer active:opacity-60' : ''}
                            ${isSelected || isQuickSelected ? 'ring-2 ring-primary-400 ring-inset' : ''}
                            ${isWeekend && !pattern ? 'bg-orange-50/40' : ''}
                          `}
                          style={{ padding: '4px 2px', height: 40 }}
                        >
                          {pattern ? (
                            <span
                              className="inline-flex items-center justify-center w-full text-center font-bold rounded-md"
                              style={{
                                backgroundColor: pattern.bgColor,
                                color: pattern.color,
                                fontSize: 10,
                                padding: '3px 2px',
                                minWidth: 36,
                              }}
                            >
                              {pattern.name}
                            </span>
                          ) : (
                            <span className="text-gray-200 text-xs">―</span>
                          )}
                        </td>
                      )
                    })}

                    {/* 合計時間 */}
                    <td className="text-center border-b border-gray-100 px-2">
                      <span className="text-xs font-bold text-gray-700">{totalHours.toFixed(0)}h</span>
                    </td>
                  </tr>
                )
              })}

              {/* 配置数行 */}
              <tr className="bg-gray-50 border-t-2 border-gray-200">
                <td className="sticky left-0 z-10 bg-gray-100 px-3 py-2 border-b border-gray-200">
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
                      </span>
                    </td>
                  )
                })}
                <td className="border-b border-gray-200 bg-gray-50" />
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ===== シフト選択モーダル（ボトムシート） ===== */}
      {selected && isAdmin && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center sm:items-center sm:p-4 bg-black/40 print:hidden"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-sm animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* ハンドル（スマホ用） */}
            <div className="flex justify-center pt-3 pb-1 sm:hidden">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>

            <div className="px-5 pb-2 pt-3 sm:pt-5">
              {/* 対象の職員・日付 */}
              <div className="flex items-center gap-3 mb-4">
                {quickFill && selected.staffId === '__quickfill__' ? (
                  <div className="w-10 h-10 rounded-full flex items-center justify-center bg-amber-400 text-white font-bold shrink-0">
                    <Zap className="w-5 h-5" />
                  </div>
                ) : selectedStaff ? (
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shrink-0"
                    style={{ backgroundColor: selectedStaff.color }}
                  >
                    {selectedStaff.name[0]}
                  </div>
                ) : null}
                <div>
                  <p className="font-bold text-gray-800">
                    {quickFill && selected.staffId === '__quickfill__'
                      ? '一括入力モード'
                      : selectedStaff?.name}
                  </p>
                  <p className="text-xs text-gray-400">
                    {getSelectedYM().replace('-', '年').replace('-', '月')}
                    {getSelectedDay()}日 のシフトを選択
                    {quickFill && selected.staffId === '__quickfill__' && ' (全職員)'}
                  </p>
                </div>
                <button onClick={() => setSelected(null)} className="ml-auto p-2 rounded-xl hover:bg-gray-100">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              {/* パターンボタン */}
              <div className="grid grid-cols-2 gap-2.5">
                {shiftPatterns.map((p) => {
                  const [ym, day] = selected.day.split('|')
                  const currentEntry = selected.staffId !== '__quickfill__'
                    ? shifts[ym]?.[selected.staffId]?.[day]
                    : undefined
                  const isCurrent = currentEntry?.patternId === p.id
                  return (
                    <button
                      key={p.id}
                      onClick={() => handleSelectPattern(p.id)}
                      className={`flex items-center justify-between gap-2 px-4 py-3.5 rounded-xl border-2 text-sm font-medium transition-all active:scale-95
                        ${isCurrent ? 'ring-2 ring-offset-1 ring-gray-400' : ''}`}
                      style={{
                        backgroundColor: p.bgColor,
                        color: p.color,
                        borderColor: p.color + '60',
                      }}
                    >
                      <span className="font-bold">{p.name}</span>
                      <span className="text-xs opacity-70">
                        {p.isOff ? '休み' : `${p.startTime}`}
                      </span>
                    </button>
                  )
                })}
              </div>

              {/* クリアボタン */}
              <button
                onClick={handleClearEntry}
                className="mt-3 w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium text-red-400 bg-red-50 border border-red-100 active:bg-red-100 transition-colors"
              >
                <X className="w-4 h-4" />
                シフトをクリア（空白にする）
                {quickFill && selected.staffId === '__quickfill__' && ' (全職員)'}
              </button>
            </div>

            {/* iOS safe area */}
            <div className="h-safe-bottom sm:hidden" />
            <div className="h-4 sm:hidden" />
          </div>
        </div>
      )}
    </div>
  )
}
