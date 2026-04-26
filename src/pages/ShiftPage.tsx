import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight, AlertTriangle, CheckCircle, X, Info } from 'lucide-react'
import { format, addMonths, subMonths } from 'date-fns'
import { ja } from 'date-fns/locale'
import { useStore } from '../store/useStore'
import { getYearMonth, getDaysArray, formatDayHeader, calcWorkHours } from '../utils/shift'
import { AGE_RATIO } from '../types'

export default function ShiftPage() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const { staff, shiftPatterns, shifts, classRooms, setShiftEntry, clearShiftEntry, currentRole, currentStaffId } = useStore()
  const yearMonth = getYearMonth(currentDate)
  const days = getDaysArray(yearMonth)
  const patternMap = useMemo(() => Object.fromEntries(shiftPatterns.map((p) => [p.id, p])), [shiftPatterns])

  const [selected, setSelected] = useState<{ staffId: string; day: string } | null>(null)
  const [legendOpen, setLegendOpen] = useState(false)

  const isAdmin = currentRole === 'admin'

  const placementAlerts = useMemo(() => {
    const alerts: Record<string, boolean> = {}
    days.forEach((d) => {
      const dayStr = String(d.getDate())
      const workingCount = staff.filter((s) => {
        const entry = shifts[yearMonth]?.[s.id]?.[dayStr]
        if (!entry) return false
        const p = patternMap[entry.patternId]
        return p && !p.isOff
      }).length
      const totalRequired = classRooms.reduce((sum, cr) => {
        const ratio = AGE_RATIO[cr.ageGroup] ?? 6
        return sum + Math.ceil(cr.childrenCount / ratio)
      }, 0)
      alerts[dayStr] = workingCount < totalRequired
    })
    return alerts
  }, [days, staff, shifts, yearMonth, classRooms, patternMap])

  const totalRequired = classRooms.reduce((sum, cr) => {
    const ratio = AGE_RATIO[cr.ageGroup] ?? 6
    return sum + Math.ceil(cr.childrenCount / ratio)
  }, 0)

  const hasAlert = Object.values(placementAlerts).some(Boolean)
  const displayStaff = isAdmin ? staff : staff.filter((s) => s.id === currentStaffId)

  function handleCellClick(staffId: string, day: string) {
    if (!isAdmin) return
    setSelected({ staffId, day })
  }

  function handleSelectPattern(patternId: string) {
    if (!selected) return
    setShiftEntry(yearMonth, selected.staffId, selected.day, { patternId, note: '' })
    setSelected(null)
  }

  function handleClearEntry() {
    if (!selected) return
    clearShiftEntry(yearMonth, selected.staffId, selected.day)
    setSelected(null)
  }

  const selectedStaff = selected ? staff.find((s) => s.id === selected.staffId) : null
  const monthLabel = format(currentDate, 'yyyy年M月', { locale: ja })

  return (
    <div className="space-y-4">

      {/* ヘッダー */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-gray-800 truncate">シフト表</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {isAdmin ? '✏️ セルをタップしてシフト入力' : '👀 自分のシフトを確認'}
          </p>
        </div>
        {/* 月切り替え */}
        <div className="flex items-center gap-1 shrink-0">
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
        </div>
      </div>

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
      <div>
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

      {/* シフトテーブル */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto shift-scroll" style={{ WebkitOverflowScrolling: 'touch' }}>
          <table className="border-collapse" style={{ minWidth: `${120 + days.length * 44 + 56}px` }}>
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {/* 職員名列 */}
                <th className="sticky left-0 z-10 bg-gray-50 text-left px-3 py-3 font-medium text-gray-500 text-xs w-[110px] min-w-[110px]">
                  職員名
                </th>
                {/* 日付列 */}
                {days.map((d) => {
                  const { day, dayOfWeek, isWeekend, isSunday } = formatDayHeader(d)
                  const dayStr = String(d.getDate())
                  const alert = placementAlerts[dayStr]
                  return (
                    <th
                      key={dayStr}
                      className={`text-center py-2 font-medium w-[44px] min-w-[44px]
                        ${isSunday ? 'text-red-400' : isWeekend ? 'text-blue-400' : 'text-gray-500'}
                        ${alert ? 'bg-amber-50' : ''}
                      `}
                      style={{ fontSize: 11 }}
                    >
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
                  const entry = shifts[yearMonth]?.[s.id]?.[String(d.getDate())]
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
                      const entry = shifts[yearMonth]?.[s.id]?.[dayStr]
                      const pattern = entry ? patternMap[entry.patternId] : null
                      const isSelected = selected?.staffId === s.id && selected?.day === dayStr
                      const { isWeekend } = formatDayHeader(d)

                      return (
                        <td
                          key={dayStr}
                          onClick={() => handleCellClick(s.id, dayStr)}
                          className={`text-center border-b border-gray-100 transition-colors select-none
                            ${isAdmin ? 'cursor-pointer active:opacity-60' : ''}
                            ${isSelected ? 'ring-2 ring-primary-400 ring-inset' : ''}
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
            </tbody>
          </table>
        </div>
      </div>

      {/* ===== シフト選択モーダル（ボトムシート） ===== */}
      {selected && isAdmin && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center sm:items-center sm:p-4 bg-black/40"
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
                {selectedStaff && (
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shrink-0"
                    style={{ backgroundColor: selectedStaff.color }}
                  >
                    {selectedStaff.name[0]}
                  </div>
                )}
                <div>
                  <p className="font-bold text-gray-800">{selectedStaff?.name}</p>
                  <p className="text-xs text-gray-400">
                    {format(currentDate, 'M月', { locale: ja })}{selected.day}日 のシフトを選択
                  </p>
                </div>
                <button onClick={() => setSelected(null)} className="ml-auto p-2 rounded-xl hover:bg-gray-100">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              {/* パターンボタン */}
              <div className="grid grid-cols-2 gap-2.5">
                {shiftPatterns.map((p) => {
                  const currentEntry = shifts[yearMonth]?.[selected.staffId]?.[selected.day]
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
