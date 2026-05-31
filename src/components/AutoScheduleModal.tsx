import { useState, useMemo } from 'react'
import {
  X, Wand2, ChevronRight, ChevronLeft,
  AlertTriangle, CheckCircle, Info,
  RefreshCw,
} from 'lucide-react'
import { getDaysInMonth, parseISO, getDay, format } from 'date-fns'
import { ja } from 'date-fns/locale'
import { useStore } from '../store/useStore'
import { autoGenerateShifts } from '../utils/autoSchedule'
import type { PatternTarget, AutoScheduleMode, AutoScheduleResult } from '../utils/autoSchedule'

interface Props {
  open: boolean
  yearMonth: string   // "2025-05"
  onClose: () => void
}

const DOW = ['日', '月', '火', '水', '木', '金', '土']

export default function AutoScheduleModal({ open, yearMonth, onClose }: Props) {
  const {
    staff, shiftPatterns, classRooms, shifts,
    setBulkMonthShifts,
  } = useStore()
  const constraints = useStore((s) => s.staffConstraints) ?? {}

  const workPatterns = shiftPatterns.filter((p) => !p.isOff)
  const patternMap   = useMemo(() => Object.fromEntries(shiftPatterns.map((p) => [p.id, p])), [shiftPatterns])

  // ── Step state ──────────────────────────────────────────────────────────────
  const [step, setStep] = useState<1 | 2>(1)

  // ── Step 1: Settings ────────────────────────────────────────────────────────
  const [mode, setMode] = useState<AutoScheduleMode>('fill')
  const [targets, setTargets] = useState<PatternTarget[]>(() =>
    workPatterns.map((p) => ({ patternId: p.id, targetCount: 0 }))
  )

  function setTarget(patternId: string, count: number) {
    setTargets((prev) =>
      prev.map((t) => t.patternId === patternId ? { ...t, targetCount: Math.max(0, count) } : t)
    )
  }

  const totalTargetPerDay = targets.reduce((s, t) => s + t.targetCount, 0)

  // ── Step 2: Preview (generated result) ─────────────────────────────────────
  const [result, setResult] = useState<AutoScheduleResult | null>(null)

  function runGeneration() {
    const res = autoGenerateShifts(
      yearMonth, mode, targets,
      staff, shiftPatterns, classRooms, constraints, shifts,
    )
    setResult(res)
    setStep(2)
  }

  function handleApply() {
    if (!result) return
    setBulkMonthShifts(yearMonth, result.monthShifts)
    onClose()
    setStep(1)
    setResult(null)
  }

  function handleClose() {
    onClose()
    setStep(1)
    setResult(null)
  }

  // ── Calendar preview data ────────────────────────────────────────────────────
  const previewDays = useMemo(() => {
    if (!result) return []
    const daysInMonth = getDaysInMonth(parseISO(`${yearMonth}-01`))
    const [y, m] = yearMonth.split('-').map(Number)
    return Array.from({ length: daysInMonth }, (_, i) => {
      const d = i + 1
      const date  = new Date(y, m - 1, d)
      const dow   = getDay(date)
      const dayStr = String(d)
      let count = 0
      for (const s of staff) {
        const entry = result.monthShifts[s.id]?.[dayStr]
        if (!entry) continue
        const p = patternMap[entry.patternId]
        if (p && !p.isOff) count++
      }
      const req = result.stats.totalRequired
      const unfilled = result.stats.unfilledDays.includes(d)
      return { d, dow, dayStr, count, req, unfilled }
    })
  }, [result, yearMonth, staff, patternMap])

  if (!open) return null

  const monthLabel = format(parseISO(`${yearMonth}-01`), 'yyyy年M月', { locale: ja })

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]" onClick={handleClose} />

      {/* Modal */}
      <div
        className="
          fixed z-50 bg-white flex flex-col
          inset-x-0 bottom-0 rounded-t-3xl max-h-[95dvh]
          md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2
          md:w-[680px] md:max-h-[88vh] md:rounded-3xl
          shadow-2xl
        "
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle (mobile) */}
        <div className="flex justify-center pt-3 pb-0 md:hidden shrink-0">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary-50 flex items-center justify-center">
              <Wand2 className="w-5 h-5 text-primary-500" />
            </div>
            <div>
              <h2 className="font-bold text-gray-800 text-base leading-tight">シフト一括作成</h2>
              <p className="text-xs text-gray-400 leading-tight">{monthLabel}</p>
            </div>
          </div>
          <button onClick={handleClose} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 active:scale-90 transition-all cursor-pointer">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-3 px-5 py-2.5 bg-gray-50 border-b border-gray-100 shrink-0">
          {[
            { n: 1, label: '設定' },
            { n: 2, label: 'プレビュー' },
          ].map(({ n, label }, i, arr) => (
            <div key={n} className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${step === n ? 'bg-primary-500 text-white' : step > n ? 'bg-green-400 text-white' : 'bg-gray-200 text-gray-500'}`}>
                {step > n ? '✓' : n}
              </div>
              <span className={`text-xs font-medium ${step === n ? 'text-gray-800' : 'text-gray-400'}`}>{label}</span>
              {i < arr.length - 1 && <ChevronRight className="w-3 h-3 text-gray-300" />}
            </div>
          ))}
        </div>

        {/* ── STEP 1: Settings ── */}
        {step === 1 && (
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

            {/* Mode */}
            <div>
              <p className="text-sm font-bold text-gray-700 mb-2">作成モード</p>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { value: 'fill',      label: '補完モード',   desc: '空き日のみ埋める（手動入力を保持）' },
                  { value: 'overwrite', label: '上書きモード', desc: '今月のシフトを全て置き換え' },
                ] as const).map(({ value, label, desc }) => (
                  <button
                    key={value}
                    onClick={() => setMode(value)}
                    className={`p-3.5 rounded-2xl border-2 text-left transition-all active:scale-95 cursor-pointer ${
                      mode === value
                        ? 'border-primary-400 bg-primary-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <p className={`text-sm font-bold leading-tight ${mode === value ? 'text-primary-700' : 'text-gray-700'}`}>{label}</p>
                    <p className="text-[10px] text-gray-400 mt-1 leading-snug">{desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Pattern balance */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-bold text-gray-700">1日あたりのパターン配置数</p>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  totalTargetPerDay === 0 ? 'bg-gray-100 text-gray-500' :
                  totalTargetPerDay >= result?.stats.totalRequired! || !result ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  合計 {totalTargetPerDay}名/日
                </span>
              </div>

              <div className="space-y-2">
                {workPatterns.map((p) => {
                  const target = targets.find((t) => t.patternId === p.id)
                  const count = target?.targetCount ?? 0
                  return (
                    <div key={p.id} className="flex items-center gap-3 p-3 rounded-2xl border border-gray-100 bg-gray-50">
                      {/* Pattern badge */}
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold"
                        style={{ backgroundColor: p.bgColor, color: p.color }}
                      >
                        {p.name}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-700 leading-tight">{p.name}</p>
                        {p.startTime && (
                          <p className="text-[10px] text-gray-400">{p.startTime} – {p.endTime}</p>
                        )}
                      </div>
                      {/* Counter */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => setTarget(p.id, count - 1)}
                          disabled={count <= 0}
                          className="w-8 h-8 rounded-xl border border-gray-200 bg-white flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:opacity-30 active:scale-90 transition-all cursor-pointer"
                        >
                          <span className="text-lg font-bold leading-none">−</span>
                        </button>
                        <span className={`w-10 text-center text-lg font-bold ${count > 0 ? 'text-primary-600' : 'text-gray-300'}`}>
                          {count}
                        </span>
                        <button
                          onClick={() => setTarget(p.id, count + 1)}
                          className="w-8 h-8 rounded-xl border border-gray-200 bg-white flex items-center justify-center text-gray-600 hover:bg-gray-100 active:scale-90 transition-all cursor-pointer"
                        >
                          <span className="text-lg font-bold leading-none">＋</span>
                        </button>
                        <span className="text-xs text-gray-400 w-6">名</span>
                      </div>
                    </div>
                  )
                })}
              </div>

              {totalTargetPerDay === 0 && (
                <div className="flex items-start gap-2 mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200">
                  <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700">1日あたりの配置数を1以上設定してください</p>
                </div>
              )}
            </div>

            {/* Staff summary */}
            <div>
              <p className="text-sm font-bold text-gray-700 mb-2">対象職員（{staff.length}名）</p>
              <div className="flex flex-wrap gap-1.5">
                {staff.map((s) => {
                  const c = constraints[s.id]
                  const minD = c?.minDaysPerMonth ?? 0
                  const maxD = c?.maxDaysPerMonth ?? 31
                  const prefs = c?.preferredPatternIds ?? []
                  return (
                    <div
                      key={s.id}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-gray-50 border border-gray-100"
                    >
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[8px] font-bold shrink-0" style={{ backgroundColor: s.color }}>
                        {s.name[0]}
                      </div>
                      <span className="text-xs font-medium text-gray-700">{s.name.split(/[\s　]/)[0]}</span>
                      {minD > 0 && (
                        <span className="text-[9px] text-gray-400">{minD}–{maxD === 31 ? '∞' : maxD}日</span>
                      )}
                      {prefs.slice(0, 2).map((pid) => {
                        const p = patternMap[pid]
                        if (!p) return null
                        return (
                          <span key={pid} className="text-[8px] font-bold px-1 py-0.5 rounded" style={{ backgroundColor: p.bgColor, color: p.color }}>
                            {p.name}
                          </span>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Bottom padding for footer overlap */}
            <div className="h-2" />
          </div>
        )}

        {/* ── STEP 2: Preview ── */}
        {step === 2 && result && (
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-2">
              <div className="p-3 rounded-2xl bg-primary-50 border border-primary-100 text-center">
                <p className="text-2xl font-bold text-primary-600">{result.stats.totalAssignments}</p>
                <p className="text-[10px] text-primary-500 mt-0.5">総割当数</p>
              </div>
              <div className={`p-3 rounded-2xl text-center border ${
                result.stats.unfilledDays.length > 0 ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100'
              }`}>
                <p className={`text-2xl font-bold ${result.stats.unfilledDays.length > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {result.stats.unfilledDays.length}
                </p>
                <p className={`text-[10px] mt-0.5 ${result.stats.unfilledDays.length > 0 ? 'text-red-500' : 'text-green-500'}`}>
                  配置不足日
                </p>
              </div>
              <div className={`p-3 rounded-2xl text-center border ${
                result.stats.belowMinStaff.length > 0 ? 'bg-amber-50 border-amber-100' : 'bg-gray-50 border-gray-100'
              }`}>
                <p className={`text-2xl font-bold ${result.stats.belowMinStaff.length > 0 ? 'text-amber-600' : 'text-gray-500'}`}>
                  {result.stats.belowMinStaff.length}
                </p>
                <p className={`text-[10px] mt-0.5 ${result.stats.belowMinStaff.length > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                  目標日数未達
                </p>
              </div>
            </div>

            {/* Warnings */}
            {(result.stats.unfilledDays.length > 0 || result.stats.belowMinStaff.length > 0) && (
              <div className="space-y-2">
                {result.stats.unfilledDays.length > 0 && (
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200">
                    <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-red-700">配置不足の日があります</p>
                      <p className="text-[10px] text-red-600 mt-0.5">
                        {result.stats.unfilledDays.map((d) => `${d}日`).join('・')} — 1日の目標合計({totalTargetPerDay}名)に対して職員が不足しています
                      </p>
                    </div>
                  </div>
                )}
                {result.stats.belowMinStaff.length > 0 && (
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200">
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-amber-700">最低勤務日数に未達の職員がいます</p>
                      <p className="text-[10px] text-amber-600 mt-0.5">
                        {result.stats.belowMinStaff.map((id) => staff.find((s) => s.id === id)?.name).filter(Boolean).join('・')}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
            {result.stats.unfilledDays.length === 0 && result.stats.belowMinStaff.length === 0 && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-green-50 border border-green-200">
                <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                <p className="text-xs font-bold text-green-700">すべての制約を満たすシフトを生成できました</p>
              </div>
            )}

            {/* Calendar preview */}
            <div>
              <p className="text-sm font-bold text-gray-700 mb-2">日別カバレッジ</p>
              <div className="grid grid-cols-7 mb-1">
                {DOW.map((d, i) => (
                  <div key={d} className={`text-center text-[10px] font-semibold pb-1 ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'}`}>{d}</div>
                ))}
              </div>
              {/* Build week rows */}
              {(() => {
                const [y, m] = yearMonth.split('-').map(Number)
                const firstDow = getDay(new Date(y, m - 1, 1))
                const cells: (typeof previewDays[0] | null)[] = [
                  ...Array(firstDow).fill(null),
                  ...previewDays,
                ]
                while (cells.length % 7 !== 0) cells.push(null)
                const weeks: (typeof cells)[] = []
                for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
                return weeks.map((week, wi) => (
                  <div key={wi} className="grid grid-cols-7 gap-0.5 mb-0.5">
                    {week.map((cell, di) => {
                      if (!cell) return <div key={di} className="aspect-square" />
                      const ratio = cell.req > 0 ? cell.count / cell.req : 0
                      const bg =
                        cell.count === 0 ? 'bg-gray-100 text-gray-400' :
                        ratio >= 1 ? 'bg-green-100 text-green-700' :
                        ratio >= 0.5 ? 'bg-amber-100 text-amber-700' :
                        'bg-red-100 text-red-600'
                      const isSun = di === 0, isSat = di === 6
                      return (
                        <div
                          key={di}
                          className={`rounded-lg p-0.5 flex flex-col items-center justify-center aspect-square ${bg}`}
                          title={`${cell.d}日: ${cell.count}/${cell.req}名`}
                        >
                          <span className={`text-[9px] font-bold ${isSun ? 'text-red-500' : isSat ? 'text-blue-500' : ''}`}>
                            {cell.d}
                          </span>
                          <span className="text-[8px] font-semibold leading-none">{cell.count}/{cell.req}</span>
                        </div>
                      )
                    })}
                  </div>
                ))
              })()}
              <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-400">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-green-100 inline-block" />達成</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-100 inline-block" />一部</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-100 inline-block" />不足</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-gray-100 inline-block" />未配置</span>
              </div>
            </div>

            {/* Staff breakdown */}
            <div>
              <p className="text-sm font-bold text-gray-700 mb-2">職員別割当日数</p>
              <div className="space-y-1.5">
                {staff.map((s) => {
                  const c = constraints[s.id]
                  const workDays = result.stats.staffWorkDays[s.id] ?? 0
                  const minD = c?.minDaysPerMonth ?? 0
                  const isBelow = result.stats.belowMinStaff.includes(s.id)
                  const isAbove = result.stats.aboveMaxStaff?.includes(s.id)
                  const target = minD > 0 ? minD : Math.round(s.weeklyHours / 5 * 4.33)
                  const pct = target > 0 ? Math.min(100, (workDays / target) * 100) : 100

                  return (
                    <div key={s.id} className={`flex items-center gap-3 p-2.5 rounded-xl border ${isBelow ? 'border-amber-200 bg-amber-50' : isAbove ? 'border-red-200 bg-red-50' : 'border-gray-100 bg-gray-50'}`}>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ backgroundColor: s.color }}>
                        {s.name[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-gray-700 truncate">{s.name}</span>
                          <span className={`text-xs font-bold shrink-0 ml-2 ${isBelow ? 'text-amber-600' : isAbove ? 'text-red-600' : 'text-gray-700'}`}>
                            {workDays}日
                            {minD > 0 && <span className="font-normal text-gray-400 ml-0.5">/ {minD}日〜</span>}
                          </span>
                        </div>
                        <div className="w-full bg-white rounded-full h-1.5 border border-gray-100">
                          <div
                            className={`h-1.5 rounded-full transition-all ${isBelow ? 'bg-amber-400' : isAbove ? 'bg-red-400' : 'bg-primary-400'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                      {isBelow && <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                      {!isBelow && !isAbove && <CheckCircle className="w-3.5 h-3.5 text-green-400 shrink-0" />}
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="h-2" />
          </div>
        )}

        {/* Footer */}
        <div className="shrink-0 px-5 pt-3 pb-4 border-t border-gray-100 bg-white">
          {step === 1 ? (
            <button
              onClick={runGeneration}
              disabled={totalTargetPerDay === 0}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-base bg-primary-500 text-white hover:bg-primary-600 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all cursor-pointer shadow-sm"
            >
              <Wand2 className="w-5 h-5" />
              プレビューを生成する
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => { setStep(1); setResult(null) }}
                className="flex items-center gap-1.5 px-4 py-3.5 rounded-2xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 active:scale-95 transition-all cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                設定に戻る
              </button>
              <button
                onClick={runGeneration}
                className="flex items-center gap-1.5 px-4 py-3.5 rounded-2xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 active:scale-95 transition-all cursor-pointer"
                title="同じ設定で再生成"
              >
                <RefreshCw className="w-4 h-4" />
                再生成
              </button>
              <button
                onClick={handleApply}
                className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-base bg-primary-500 text-white hover:bg-primary-600 active:scale-95 transition-all cursor-pointer shadow-sm"
              >
                <Wand2 className="w-5 h-5" />
                このシフトを適用する
              </button>
            </div>
          )}
          <div className="h-safe-bottom md:hidden" />
        </div>
      </div>
    </>
  )
}
