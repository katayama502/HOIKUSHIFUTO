import { useState, useMemo } from 'react'
import { X, Check, Zap, CalendarDays } from 'lucide-react'
import { getDaysInMonth, parseISO, getDay, format } from 'date-fns'
import { ja } from 'date-fns/locale'
import { useStore } from '../store/useStore'
import { getDaySlots, calcWorkHours } from '../utils/shift'

interface Props {
  open: boolean
  staffId: string | null
  yearMonth: string
  onClose: () => void
}

// Mon-Sun order: DOW_LABELS[i] corresponds to JS day-of-week DOW_JS[i]
const DOW_LABELS = ['月', '火', '水', '木', '金', '土', '日']
const DOW_JS     = [1, 2, 3, 4, 5, 6, 0]

export default function WorkflowPanel({ open, staffId, yearMonth, onClose }: Props) {
  const { staff, shiftPatterns, shifts, setShiftEntry, clearShiftSlot } = useStore()

  const s = staff.find((st) => st.id === staffId)
  const patternMap = useMemo(
    () => Object.fromEntries(shiftPatterns.map((p) => [p.id, p])),
    [shiftPatterns],
  )
  const workPatterns = shiftPatterns.filter((p) => !p.isOff)

  const [selectedPatternId, setSelectedPatternId] = useState<string>(
    () => workPatterns[0]?.id ?? '',
  )
  const [selectedDOWs, setSelectedDOWs] = useState<number[]>([1, 2, 3, 4, 5])

  const staffData = useMemo(
    () => shifts[yearMonth]?.[staffId ?? ''] ?? {},
    [shifts, yearMonth, staffId],
  )

  const daysInMonth = getDaysInMonth(parseISO(`${yearMonth}-01`))
  const [y, m] = yearMonth.split('-').map(Number)

  const days = useMemo(
    () =>
      Array.from({ length: daysInMonth }, (_, i) => {
        const d = i + 1
        const date = new Date(y, m - 1, d)
        const dow = getDay(date)
        const slots = getDaySlots(staffData, d)
        return { d, date, dow, slots }
      }),
    [daysInMonth, y, m, staffData],
  )

  // Calendar offset (Mon = 0)
  const firstDow = getDay(new Date(y, m - 1, 1))
  const offset = (firstDow + 6) % 7

  // Stats
  const { totalWorkDays, totalHours } = useMemo(() => {
    const uniqueWorkDays = new Set(
      Object.entries(staffData)
        .filter(([, e]) => !patternMap[e.patternId]?.isOff)
        .map(([k]) => parseInt(k, 10)),
    ).size
    const hours = Object.values(staffData).reduce((sum, e) => {
      const p = patternMap[e.patternId]
      return sum + (p ? calcWorkHours(p) : 0)
    }, 0)
    return { totalWorkDays: uniqueWorkDays, totalHours: hours }
  }, [staffData, patternMap])

  function toggleDay(d: number) {
    if (!staffId || !selectedPatternId) return
    const day = days.find((day) => day.d === d)!
    const existingSlot = day.slots.find((sl) => sl.patternId === selectedPatternId)
    if (existingSlot) {
      clearShiftSlot(yearMonth, staffId, existingSlot.slotKey)
    } else {
      setShiftEntry(yearMonth, staffId, String(d), { patternId: selectedPatternId, note: '' })
    }
  }

  function handleQuickFill() {
    if (!staffId || !selectedPatternId) return
    const matchingDays = days.filter((day) => selectedDOWs.includes(day.dow))
    const allHavePattern = matchingDays.length > 0 &&
      matchingDays.every((day) => day.slots.some((sl) => sl.patternId === selectedPatternId))

    for (const day of matchingDays) {
      const existingSlot = day.slots.find((sl) => sl.patternId === selectedPatternId)
      if (allHavePattern) {
        if (existingSlot) clearShiftSlot(yearMonth, staffId, existingSlot.slotKey)
      } else {
        if (!existingSlot) {
          setShiftEntry(yearMonth, staffId, String(day.d), { patternId: selectedPatternId, note: '' })
        }
      }
    }
  }

  const monthLabel = format(parseISO(`${yearMonth}-01`), 'yyyy年M月', { locale: ja })

  if (!open || !s) return null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[1px]" onClick={onClose} />

      {/* Panel */}
      <div
        className="
          fixed z-50 bg-white flex flex-col shadow-2xl
          inset-x-0 bottom-0 rounded-t-3xl max-h-[92dvh]
          md:inset-auto md:right-0 md:top-0 md:bottom-0 md:w-[400px] md:rounded-l-3xl md:max-h-full
        "
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile handle */}
        <div className="flex justify-center pt-3 md:hidden shrink-0">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center text-white text-base font-bold shrink-0"
              style={{ backgroundColor: s.color }}
            >
              {s.name[0]}
            </div>
            <div>
              <p className="font-bold text-gray-800 leading-tight">{s.name}</p>
              <p className="text-xs text-gray-400 leading-tight">{monthLabel} — 月間シフト入力</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 active:scale-90 transition-all cursor-pointer shrink-0"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">

          {/* Pattern selector */}
          <div className="px-5 pt-4 pb-3 border-b border-gray-50">
            <div className="flex items-center gap-2 mb-2">
              <CalendarDays className="w-3.5 h-3.5 text-primary-500" />
              <p className="text-xs font-bold text-gray-600">入力するシフトパターン</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {shiftPatterns.map((p) => {
                const isActive = selectedPatternId === p.id
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPatternId(p.id)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold border-2 transition-all active:scale-95 cursor-pointer"
                    style={{
                      backgroundColor: p.bgColor,
                      color: p.color,
                      borderColor: isActive ? p.color : 'transparent',
                      transform: isActive ? 'scale(1.05)' : undefined,
                    }}
                  >
                    {isActive && <Check className="w-3 h-3 shrink-0" />}
                    {p.name}
                    {!p.isOff && <span className="opacity-60 text-[9px] ml-0.5">{p.startTime}</span>}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Quick fill by DOW */}
          <div className="px-5 py-3.5 border-b border-gray-50">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <p className="text-xs font-bold text-gray-600">一括入力（曜日指定）</p>
            </div>
            <div className="flex gap-1 mb-2.5">
              {DOW_LABELS.map((label, i) => {
                const jsDay = DOW_JS[i]
                const isSelected = selectedDOWs.includes(jsDay)
                const isSat = i === 5, isSun = i === 6
                return (
                  <button
                    key={i}
                    onClick={() =>
                      setSelectedDOWs((prev) =>
                        isSelected ? prev.filter((d) => d !== jsDay) : [...prev, jsDay],
                      )
                    }
                    className={`flex-1 py-2 rounded-xl text-[10px] font-bold transition-all border-2 active:scale-90 cursor-pointer ${
                      isSelected
                        ? 'bg-primary-500 text-white border-primary-500'
                        : isSat
                        ? 'bg-sky-50 text-sky-500 border-sky-200 hover:bg-sky-100'
                        : isSun
                        ? 'bg-red-50 text-red-500 border-red-200 hover:bg-red-100'
                        : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
            <button
              onClick={handleQuickFill}
              disabled={selectedDOWs.length === 0 || !selectedPatternId}
              className="w-full py-2.5 rounded-2xl bg-amber-500 text-white text-xs font-bold hover:bg-amber-600 disabled:opacity-40 active:scale-95 transition-all cursor-pointer shadow-sm"
            >
              選択した曜日に一括適用
            </button>
          </div>

          {/* Month calendar grid */}
          <div className="px-4 py-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-gray-700">個別入力</p>
              <div className="flex items-center gap-2 text-[10px] text-gray-400">
                <span>{totalWorkDays}日勤務</span>
                <span>/{totalHours.toFixed(0)}h</span>
              </div>
            </div>

            {/* DOW header */}
            <div className="grid grid-cols-7 mb-1">
              {DOW_LABELS.map((d, i) => (
                <div
                  key={d}
                  className={`text-center text-[10px] font-bold pb-1 ${
                    i === 5 ? 'text-sky-500' : i === 6 ? 'text-red-500' : 'text-gray-400'
                  }`}
                >
                  {d}
                </div>
              ))}
            </div>

            {/* Calendar cells */}
            <div className="grid grid-cols-7 gap-0.5">
              {/* Offset cells */}
              {Array.from({ length: offset }, (_, i) => (
                <div key={`e${i}`} className="aspect-square" />
              ))}

              {days.map(({ d, dow, slots }) => {
                const selPattern = patternMap[selectedPatternId]
                const hasSelectedPattern = slots.some((sl) => sl.patternId === selectedPatternId)
                const isSat = dow === 6
                const isSun = dow === 0
                const workSlots = slots.filter((sl) => !patternMap[sl.patternId]?.isOff)

                return (
                  <button
                    key={d}
                    onClick={() => toggleDay(d)}
                    className={`aspect-square rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all active:scale-90 cursor-pointer border-2 ${
                      hasSelectedPattern && selPattern
                        ? 'shadow-md'
                        : 'border-transparent hover:border-gray-200 hover:bg-gray-50'
                    }`}
                    style={
                      hasSelectedPattern && selPattern
                        ? {
                            backgroundColor: selPattern.bgColor,
                            borderColor: selPattern.color,
                          }
                        : undefined
                    }
                    title={`${d}日 — クリックで${selectedPatternId ? patternMap[selectedPatternId]?.name : ''}を追加/削除`}
                  >
                    <span
                      className={`text-[11px] font-bold leading-none ${
                        isSun ? 'text-red-500' : isSat ? 'text-sky-500' :
                        hasSelectedPattern && selPattern ? 'text-inherit' : 'text-gray-700'
                      }`}
                      style={hasSelectedPattern && selPattern ? { color: selPattern.color } : undefined}
                    >
                      {d}
                    </span>
                    {/* Pattern dots for all slots */}
                    {workSlots.length > 0 && (
                      <div className="flex flex-wrap justify-center gap-0.5 px-0.5">
                        {workSlots.slice(0, 3).map((sl) => {
                          const p = patternMap[sl.patternId]
                          if (!p) return null
                          return (
                            <span
                              key={sl.slotKey}
                              className="w-1 h-1 rounded-full"
                              style={{ backgroundColor: p.color }}
                            />
                          )
                        })}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-3 mt-3 text-[10px] text-gray-400">
              {workPatterns.slice(0, 4).map((p) => (
                <span key={p.id} className="flex items-center gap-1">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: p.color }}
                  />
                  {p.name}
                </span>
              ))}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="shrink-0 px-5 pt-3 pb-4 border-t border-gray-100 bg-white">
          <button
            onClick={onClose}
            className="w-full py-3.5 rounded-2xl bg-primary-500 text-white font-bold text-sm hover:bg-primary-600 active:scale-95 transition-all cursor-pointer shadow-sm"
          >
            完了
          </button>
          <div className="md:hidden" style={{ height: 'env(safe-area-inset-bottom, 0px)' }} />
        </div>
      </div>
    </>
  )
}
