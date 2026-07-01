import { useState, useMemo } from 'react'
import {
  X, Wand2, ChevronRight, ChevronLeft,
  AlertTriangle, CheckCircle, Info,
  RefreshCw,
} from 'lucide-react'
import HintTooltip from './HintTooltip'
import { getDaysInMonth, parseISO, getDay, format } from 'date-fns'
import { ja } from 'date-fns/locale'
import { useStore } from '../store/useStore'
import { autoGenerateShifts, buildPrevMonthPatternMap, getPrevYearMonth } from '../utils/autoSchedule'
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

  // 制約未設定の職員リスト
  const unconfiguredStaff = useMemo(
    () => staff.filter((s) => !constraints[s.id]),
    [staff, constraints],
  )

  const workPatterns = shiftPatterns.filter((p) => !p.isOff)
  const patternMap   = useMemo(() => Object.fromEntries(shiftPatterns.map((p) => [p.id, p])), [shiftPatterns])

  // ── Step state ──────────────────────────────────────────────────────────────
  const [step, setStep] = useState<1 | 2>(1)

  // ── Step 1: Settings ────────────────────────────────────────────────────────
  const [mode, setMode] = useState<AutoScheduleMode>('fill')
  const [targets, setTargets] = useState<PatternTarget[]>(() =>
    workPatterns.map((p) => ({ patternId: p.id, targetCount: 0 }))
  )
  const [usePrevMonth, setUsePrevMonth] = useState(true)

  // 前月ラベルと前月データの有無
  const prevYearMonth = useMemo(() => getPrevYearMonth(yearMonth), [yearMonth])
  const prevMonthLabel = useMemo(
    () => format(parseISO(`${prevYearMonth}-01`), 'yyyy年M月', { locale: ja }),
    [prevYearMonth],
  )
  const hasPrevMonthData = useMemo(
    () => Object.keys(shifts[prevYearMonth] ?? {}).length > 0,
    [shifts, prevYearMonth],
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
    const prevPatterns = usePrevMonth && hasPrevMonthData
      ? buildPrevMonthPatternMap(prevYearMonth, staff, shiftPatterns, shifts)
      : undefined
    const res = autoGenerateShifts(
      yearMonth, mode, targets,
      staff, shiftPatterns, classRooms, constraints, shifts,
      prevPatterns,
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

            {/* 動作説明バナー */}
            <div className="bg-sky-50 border border-sky-200 rounded-2xl p-4 space-y-2">
              <p className="text-sm font-semibold text-sky-800">自動シフト作成について</p>
              <ul className="text-xs text-sky-700 space-y-1 list-none">
                <li>✅ 各職員の<strong className="text-sky-900">出勤条件（優先パターン・除外パターン）</strong>を自動で考慮します</li>
                <li>✅ 固定時間職員（3番・4番など）は毎日その時間帯に配置されます</li>
                <li>✅ ローテーション職員は番号シフトを均等にバランス配置します</li>
                <li>✅ パート職員は午前P・半日・夕勤のみに配置されます</li>
                <li>✅ 管理職は早1・早2には配置されません</li>
                <li>✅ 休み希望日は除外されます</li>
                <li className="text-amber-700">⚠️ 出勤条件が未設定の職員は平日（月〜金）にのみ配置されます</li>
              </ul>
            </div>

            {/* 制約未設定職員の警告 */}
            {unconfiguredStaff.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <p className="text-xs text-amber-700">
                  <span className="font-semibold">出勤条件未設定の職員がいます:</span>{' '}
                  {unconfiguredStaff.map(s => s.name).join('、')}
                  <br />平日（月〜金）のみに自動配置されます。詳細設定は「出勤条件」ページから行えます。
                </p>
              </div>
            )}

            {/* Mode */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <p className="text-sm font-bold text-gray-700">作成モード</p>
                <HintTooltip
                  title="どちらのモードを選ぶ？"
                  content={
                    <ul className="space-y-1.5">
                      <li>• <strong className="text-gray-900">補完モード</strong>：手動で入力済みのシフトはそのまま残し、空いている日だけを自動で埋めます。部分的に調整した後に残りを埋めたいときに最適です</li>
                      <li>• <strong className="text-gray-900">上書きモード</strong>：今月のシフトを全て消して、最初から自動生成します。月初めにまとめて作成したいときに使います</li>
                    </ul>
                  }
                />
              </div>
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

            {/* 前月参照 */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <p className="text-sm font-bold text-gray-700">前月シフト参照</p>
                <HintTooltip
                  title="前月参照の効果"
                  content={
                    <ul className="space-y-1.5">
                      <li>• 希望パターンが未設定の職員に対し、前月最も多く勤務したパターンを優先的に割り当てます</li>
                      <li>• 先月と同じリズムで働ける日が多くなり、職員の負担軽減につながります</li>
                      <li>• 希望パターンが設定されている職員には影響しません（希望が最優先）</li>
                    </ul>
                  }
                />
              </div>
              <button
                onClick={() => setUsePrevMonth((v) => !v)}
                className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border-2 text-left transition-all active:scale-95 cursor-pointer ${
                  usePrevMonth && hasPrevMonthData
                    ? 'border-primary-400 bg-primary-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                {/* Toggle switch */}
                <div className={`relative w-10 h-6 rounded-full transition-colors shrink-0 ${usePrevMonth && hasPrevMonthData ? 'bg-primary-500' : 'bg-gray-200'}`}>
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${usePrevMonth && hasPrevMonthData ? 'translate-x-5' : 'translate-x-1'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold leading-tight ${usePrevMonth && hasPrevMonthData ? 'text-primary-700' : 'text-gray-600'}`}>
                    {prevMonthLabel}の実績を参照
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5 leading-snug">
                    {hasPrevMonthData
                      ? '希望未設定の職員に、前月最多パターンを優先ヒントとして使用します'
                      : '前月のシフトデータがありません'}
                  </p>
                </div>
                {hasPrevMonthData ? (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700 shrink-0">データあり</span>
                ) : (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-400 shrink-0">データなし</span>
                )}
              </button>
            </div>

            {/* Pattern balance */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-bold text-gray-700">1日あたりのパターン配置数</p>
                  <HintTooltip
                    title="配置数の設定"
                    content={
                      <ul className="space-y-1.5">
                        <li>• 各シフトパターンに<strong className="text-gray-900">1日に何名配置するか</strong>を設定します</li>
                        <li>• 例：早番3名・中番2名・遅番2名 → 合計7名/日</li>
                        <li>• 0にするとそのパターンは自動生成の対象外になります</li>
                        <li>• 職員の総数・制約・希望を考慮して自動で割り当てます</li>
                      </ul>
                    }
                  />
                </div>
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
                <div className="flex items-start gap-2 mt-3 p-3 rounded-xl bg-sky-50 border border-sky-200">
                  <Info className="w-4 h-4 text-sky-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-sky-700">
                    <span className="font-semibold">配置数が0のまま生成すると「条件ベース自動モード」になります。</span>
                    各職員の出勤条件（優先パターン・除外パターン）を自動で読み取り、それぞれに最適なシフトを割り当てます。配置数を設定すれば人数の上限も調整できます。
                  </p>
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

            {/* 配置数の補足説明 */}
            <p className="text-[10px] text-gray-400 -mt-3">
              ※ 配置人数は土日・休み希望日を除いた平日ベースで計算されています
            </p>

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
            <div className="flex gap-2">
              <button
                onClick={handleClose}
                className="flex items-center gap-1.5 px-4 py-3.5 rounded-2xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 active:scale-95 transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
                閉じる
              </button>
              <button
                onClick={runGeneration}
                className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-base bg-primary-500 text-white hover:bg-primary-600 active:scale-95 transition-all cursor-pointer shadow-sm"
              >
                <Wand2 className="w-5 h-5" />
                {totalTargetPerDay === 0 ? '条件ベースで自動生成' : 'プレビューを生成する'}
              </button>
            </div>
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
