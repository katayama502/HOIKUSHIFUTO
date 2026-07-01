/**
 * 先生の出勤条件設定ページ
 *
 * ── ルート追加（App.tsx） ──
 * 1. import StaffConstraintPage from './pages/StaffConstraintPage'
 * 2. <Route path="staff-constraints" element={<ProtectedAdmin><StaffConstraintPage /></ProtectedAdmin>} />
 *    ※ 既存の staff ルートの下に追加すること
 *
 * ── StaffPage.tsx：各カードへのリンク追加 ──
 * import { Link } from 'react-router-dom'
 * import { SlidersHorizontal } from 'lucide-react'
 * 各スタッフカードの action ボタン群に追記:
 *   <Link
 *     to={`/staff-constraints?staffId=${s.id}`}
 *     className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-green-50 active:bg-green-100 transition-colors"
 *     title="出勤条件を設定"
 *   >
 *     <SlidersHorizontal className="w-4 h-4 text-green-400" />
 *   </Link>
 *
 * ── Layout.tsx adminNav への追加（任意） ──
 * adminNav 配列に以下を追加:
 *   { to: '/staff-constraints', icon: SlidersHorizontal, label: '出勤条件' }
 * ※ lucide-react から SlidersHorizontal をインポートすること
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Save, X, ChevronLeft, ChevronRight, AlertTriangle, Info } from 'lucide-react'
import { format, addMonths, startOfMonth, getDaysInMonth, parseISO } from 'date-fns'
import { ja } from 'date-fns/locale'
import { useStore } from '../store/useStore'
import type { StaffConstraint } from '../types'

// ────────────────────────────────────────────
// 定数
// ────────────────────────────────────────────
const DAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'] as const
const DAY_INDICES = [0, 1, 2, 3, 4, 5, 6] as const

// デフォルト制約値
const DEFAULT_CONSTRAINT: Omit<StaffConstraint, 'staffId'> = {
  availableDays: [1, 2, 3, 4, 5],
  unavailableDates: [],
  minDaysPerMonth: 0,
  maxDaysPerMonth: 31,
  preferredPatternIds: [],
  maxConsecutiveDays: 5,
  restrictedPatternIds: [],
}

// ────────────────────────────────────────────
// ユーティリティ
// ────────────────────────────────────────────
function getYearMonth(date: Date): string {
  return format(date, 'yyyy-MM')
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

// ────────────────────────────────────────────
// コンポーネント本体
// ────────────────────────────────────────────
export default function StaffConstraintPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { staff, shiftPatterns, staffConstraints, setStaffConstraint, removeStaffConstraint } = useStore()

  // 選択中のスタッフ
  const initialStaffId = searchParams.get('staffId') ?? staff[0]?.id ?? ''
  const [selectedStaffId, setSelectedStaffId] = useState(initialStaffId)

  // URL クエリと選択を同期
  useEffect(() => {
    const id = searchParams.get('staffId')
    if (id && id !== selectedStaffId) setSelectedStaffId(id)
  }, [searchParams]) // eslint-disable-line react-hooks/exhaustive-deps

  const selectedStaff = staff.find((s) => s.id === selectedStaffId)

  // 既存の制約 or デフォルト
  const existingConstraint = staffConstraints[selectedStaffId]
  const [form, setForm] = useState<Omit<StaffConstraint, 'staffId'>>({
    ...DEFAULT_CONSTRAINT,
    ...(existingConstraint ?? {}),
  })

  // スタッフが変わったらフォームをリセット
  useEffect(() => {
    const c = staffConstraints[selectedStaffId]
    setForm({ ...DEFAULT_CONSTRAINT, ...(c ?? {}) })
    setSaved(false)
  }, [selectedStaffId, staffConstraints])

  // 休み希望日の表示月
  const today = new Date()
  const [calendarMonth, setCalendarMonth] = useState<Date>(startOfMonth(today))

  const [saved, setSaved] = useState(false)

  // 自動保存（800ms デバウンス）
  const debouncedForm = useDebounce(form, 800)
  useEffect(() => {
    if (!selectedStaffId) return
    setStaffConstraint(selectedStaffId, debouncedForm)
    setSaved(true)
    const t = setTimeout(() => setSaved(false), 2000)
    return () => clearTimeout(t)
  }, [debouncedForm]) // eslint-disable-line react-hooks/exhaustive-deps

  // パートタイム職員向け推奨最低日数
  const suggestedMin = useMemo(() => {
    if (!selectedStaff || selectedStaff.employment !== 'parttime') return null
    return Math.round((selectedStaff.weeklyHours / 8) * 4)
  }, [selectedStaff])

  // ────────── 曜日トグル ──────────
  const toggleDay = useCallback((day: number) => {
    setForm((prev) => {
      const has = prev.availableDays.includes(day)
      return {
        ...prev,
        availableDays: has
          ? prev.availableDays.filter((d) => d !== day)
          : [...prev.availableDays, day].sort((a, b) => a - b),
      }
    })
  }, [])

  // ────────── カレンダー ──────────
  const calendarYM = getYearMonth(calendarMonth)
  const daysInMonth = getDaysInMonth(calendarMonth)
  const firstDayOfWeek = new Date(`${calendarYM}-01`).getDay() // 0=日

  const calendarDays = useMemo(() => {
    const arr: (number | null)[] = Array(firstDayOfWeek).fill(null)
    for (let d = 1; d <= daysInMonth; d++) arr.push(d)
    // 6行になるよう末尾埋め
    while (arr.length % 7 !== 0) arr.push(null)
    return arr
  }, [calendarYM, daysInMonth, firstDayOfWeek])

  const toggleUnavailableDate = useCallback((day: number) => {
    const dateStr = `${calendarYM}-${String(day).padStart(2, '0')}`
    setForm((prev) => {
      const has = prev.unavailableDates.includes(dateStr)
      return {
        ...prev,
        unavailableDates: has
          ? prev.unavailableDates.filter((d) => d !== dateStr)
          : [...prev.unavailableDates, dateStr].sort(),
      }
    })
  }, [calendarYM])

  const clearMonthUnavailableDates = useCallback(() => {
    setForm((prev) => ({
      ...prev,
      unavailableDates: prev.unavailableDates.filter((d) => !d.startsWith(calendarYM)),
    }))
  }, [calendarYM])

  // 今月の休み希望日
  const thisMonthUnavailable = form.unavailableDates.filter((d) => d.startsWith(calendarYM))

  // ────────── シフトパターン選択 ──────────
  const togglePattern = useCallback((id: string) => {
    setForm((prev) => {
      const has = prev.preferredPatternIds.includes(id)
      return {
        ...prev,
        preferredPatternIds: has
          ? prev.preferredPatternIds.filter((p) => p !== id)
          : [...prev.preferredPatternIds, id],
      }
    })
  }, [])

  // ────────── クイックプリセット ──────────
  function applyPreset(type: 'fulltime' | 'manager' | 'parttime') {
    if (!selectedStaff) return
    if (type === 'fulltime') {
      setForm((prev) => ({ ...prev, availableDays: [1, 2, 3, 4, 5], minDaysPerMonth: 20, maxDaysPerMonth: 23, maxConsecutiveDays: 5, restrictedPatternIds: [] }))
    } else if (type === 'manager') {
      // 管理者は原則クラス非介入（欠員時のみ手動で介入）→ 全パターンを自動配置から除外
      setForm((prev) => ({
        ...prev,
        availableDays: [1, 2, 3, 4, 5],
        minDaysPerMonth: 0,
        maxDaysPerMonth: 0,
        maxConsecutiveDays: 5,
        restrictedPatternIds: shiftPatterns.filter((p) => !p.isOff).map((p) => p.id),
      }))
    } else if (type === 'parttime') {
      const suggested = Math.round((selectedStaff.weeklyHours / 8) * 4)
      setForm((prev) => ({ ...prev, availableDays: [1, 2, 3, 4, 5], minDaysPerMonth: 0, maxDaysPerMonth: suggested + 2, maxConsecutiveDays: 3, restrictedPatternIds: [] }))
    }
  }

  // ────────── スタッフ切り替え ──────────
  function selectStaff(id: string) {
    setSelectedStaffId(id)
    setSearchParams({ staffId: id })
  }

  // ────────── 手動保存 ──────────
  function handleSave() {
    if (!selectedStaffId) return
    setStaffConstraint(selectedStaffId, form)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  // ────────── 制約削除（リセット） ──────────
  function handleReset() {
    removeStaffConstraint(selectedStaffId)
    setForm({ ...DEFAULT_CONSTRAINT })
  }

  if (staff.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-gray-400">
        <p className="text-sm">職員が登録されていません</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 md:space-y-5 max-w-2xl mx-auto md:max-w-3xl">

      {/* ページヘッダー */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">先生の出勤条件設定</h1>
          <p className="text-xs text-gray-400 mt-0.5">各職員の出勤可能日・制限を設定します</p>
        </div>
        {saved && (
          <span className="flex items-center gap-1.5 text-xs text-green-600 bg-green-50 border border-green-200 px-3 py-1.5 rounded-xl animate-fade-in">
            <Save className="w-3.5 h-3.5" />
            保存しました
          </span>
        )}
      </div>

      {/* 説明テキスト */}
      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 mb-4">
        <p className="text-sm text-blue-800 leading-relaxed">
          ここで設定した条件は「一括シフト作成」時に自動的に反映されます。<br />
          <span className="font-semibold">特に「出勤可能曜日」が未設定だと土日にも配置される場合があります。</span>
        </p>
      </div>

      {/* ────────── スタッフタブ ────────── */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none" style={{ WebkitOverflowScrolling: 'touch' }}>
        {staff.map((s) => (
          <button
            key={s.id}
            onClick={() => selectStaff(s.id)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium shrink-0 transition-all duration-150 border ${
              selectedStaffId === s.id
                ? 'text-white border-transparent shadow-sm'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
            style={selectedStaffId === s.id ? { backgroundColor: s.color, borderColor: s.color } : {}}
          >
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: selectedStaffId === s.id ? 'rgba(255,255,255,0.6)' : s.color }}
            />
            {s.name.split(' ')[0]}
          </button>
        ))}
      </div>

      {selectedStaff && (
        <>
          {/* 選択中の職員バナー */}
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-2xl border text-sm"
            style={{ backgroundColor: `${selectedStaff.color}15`, borderColor: `${selectedStaff.color}40` }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-base shrink-0"
              style={{ backgroundColor: selectedStaff.color }}
            >
              {selectedStaff.name[0]}
            </div>
            <div className="flex-1">
              <p className="font-bold text-gray-800">{selectedStaff.name}</p>
              <p className="text-xs text-gray-500">
                {selectedStaff.employment === 'fulltime' ? '正社員' : 'パート'} / 週{selectedStaff.weeklyHours}h
                {selectedStaff.note ? ` / ${selectedStaff.note}` : ''}
              </p>
            </div>
            {!existingConstraint && (
              <span className="text-xs text-gray-400 bg-white/60 px-2 py-1 rounded-lg">デフォルト設定</span>
            )}
          </div>

          {/* クイックプリセット */}
          <div className="mb-4">
            <p className="text-xs text-gray-500 mb-2 font-medium">クイック設定</p>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => applyPreset('fulltime')} className="px-3 py-1.5 rounded-xl text-xs font-medium bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100 transition-all">
                📅 正社員（平日フル）
              </button>
              <button onClick={() => applyPreset('manager')} className="px-3 py-1.5 rounded-xl text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 transition-all">
                👔 管理職（通常・中番のみ）
              </button>
              <button onClick={() => applyPreset('parttime')} className="px-3 py-1.5 rounded-xl text-xs font-medium bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition-all">
                🕐 パートタイム
              </button>
            </div>
          </div>

          {/* ────────── セクション1: 出勤可能曜日 ────────── */}
          <section className="card p-4 md:p-5 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-1 h-5 bg-primary-400 rounded-full" />
              <h2 className="font-bold text-gray-700 text-base">出勤可能曜日</h2>
            </div>
            <p className="text-xs text-gray-400">出勤できる曜日を選択してください（複数選択可）</p>
            <div className="flex gap-2 flex-wrap">
              {DAY_INDICES.map((day) => {
                const isSelected = form.availableDays.includes(day)
                const isWeekend = day === 0 || day === 6
                return (
                  <button
                    key={day}
                    onClick={() => toggleDay(day)}
                    className={`w-11 h-11 rounded-xl text-sm font-bold transition-all duration-150 active:scale-90 border-2 ${
                      isSelected
                        ? isWeekend
                          ? 'bg-red-500 border-red-500 text-white shadow-sm'
                          : 'bg-primary-500 border-primary-500 text-white shadow-sm'
                        : 'bg-white border-gray-200 text-gray-400 hover:border-gray-300'
                    }`}
                  >
                    {DAY_LABELS[day]}
                  </button>
                )
              })}
            </div>
            {form.availableDays.length === 0 && (
              <p className="text-xs text-red-500 mt-1">⚠️ 曜日が選択されていません。一括設定で全日配置される可能性があります。</p>
            )}
          </section>

          {/* ────────── セクション2: 月の出勤日数 ────────── */}
          <section className="card p-4 md:p-5 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-1 h-5 bg-primary-400 rounded-full" />
              <h2 className="font-bold text-gray-700 text-base">月の出勤日数</h2>
            </div>

            {suggestedMin !== null && (
              <div className="flex items-start gap-2 px-3 py-2.5 bg-blue-50 rounded-xl text-xs text-blue-700">
                <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>
                  週{selectedStaff.weeklyHours}h のパート勤務：月間目安は約 <strong>{suggestedMin}日</strong> です
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">最低出勤日数</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    className="input flex-1"
                    min={0}
                    max={form.maxDaysPerMonth}
                    value={form.minDaysPerMonth}
                    onChange={(e) => setForm({ ...form, minDaysPerMonth: Math.min(Number(e.target.value), form.maxDaysPerMonth) })}
                  />
                  <span className="text-sm text-gray-400 shrink-0">日</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">0 = 制限なし</p>
              </div>
              <div>
                <label className="label">最大出勤日数</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    className="input flex-1"
                    min={form.minDaysPerMonth}
                    max={31}
                    value={form.maxDaysPerMonth}
                    onChange={(e) => setForm({ ...form, maxDaysPerMonth: Math.max(Number(e.target.value), form.minDaysPerMonth) })}
                  />
                  <span className="text-sm text-gray-400 shrink-0">日</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">31 = 制限なし</p>
              </div>
            </div>

            {suggestedMin !== null && form.minDaysPerMonth === 0 && (
              <button
                onClick={() => setForm({ ...form, minDaysPerMonth: suggestedMin })}
                className="text-xs text-primary-500 hover:underline"
              >
                推奨値（{suggestedMin}日）を設定する
              </button>
            )}
          </section>

          {/* ────────── セクション3: 連続勤務上限 ────────── */}
          <section className="card p-4 md:p-5 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-1 h-5 bg-primary-400 rounded-full" />
              <h2 className="font-bold text-gray-700 text-base">連続勤務上限</h2>
            </div>
            <p className="text-xs text-gray-400">連続して出勤できる最大日数を設定します</p>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 flex-1 max-w-xs">
                <input
                  type="number"
                  className="input flex-1"
                  min={1}
                  max={14}
                  value={form.maxConsecutiveDays}
                  onChange={(e) =>
                    setForm({ ...form, maxConsecutiveDays: Math.max(1, Math.min(14, Number(e.target.value))) })
                  }
                />
                <span className="text-sm text-gray-400 shrink-0">日まで</span>
              </div>
              {/* ビジュアルスライダー */}
              <div className="flex gap-1 items-end">
                {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                  <button
                    key={n}
                    onClick={() => setForm({ ...form, maxConsecutiveDays: n })}
                    className={`w-6 rounded-sm transition-all duration-100 ${
                      n <= form.maxConsecutiveDays ? 'bg-primary-400' : 'bg-gray-200'
                    }`}
                    style={{ height: `${8 + n * 4}px` }}
                    title={`${n}日`}
                  />
                ))}
              </div>
            </div>
            {form.maxConsecutiveDays >= 7 && (
              <p className="text-xs text-amber-600 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                7日以上の連続勤務は法定休日の観点からご注意ください
              </p>
            )}
          </section>

          {/* ────────── セクション4: 休み希望日 ────────── */}
          <section className="card p-4 md:p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-1 h-5 bg-primary-400 rounded-full" />
                <h2 className="font-bold text-gray-700 text-base">休み希望日</h2>
              </div>
              {thisMonthUnavailable.length > 0 && (
                <button
                  onClick={clearMonthUnavailableDates}
                  className="text-xs text-gray-400 hover:text-red-500 transition-colors flex items-center gap-1"
                >
                  <X className="w-3.5 h-3.5" />
                  今月をクリア
                </button>
              )}
            </div>
            <p className="text-xs text-gray-400">日付をタップすると休み希望日に登録されます</p>

            {/* 月ナビゲーション */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => setCalendarMonth((m) => addMonths(m, -1))}
                className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-gray-400" />
              </button>
              <span className="font-bold text-gray-700 text-sm">
                {format(calendarMonth, 'yyyy年M月', { locale: ja })}
              </span>
              <button
                onClick={() => setCalendarMonth((m) => addMonths(m, 1))}
                className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors"
              >
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* カレンダーグリッド */}
            <div>
              {/* 曜日ヘッダー */}
              <div className="grid grid-cols-7 mb-1">
                {DAY_LABELS.map((lbl, i) => (
                  <div
                    key={lbl}
                    className={`text-center text-xs font-medium py-1 ${
                      i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'
                    }`}
                  >
                    {lbl}
                  </div>
                ))}
              </div>
              {/* 日付グリッド */}
              <div className="grid grid-cols-7 gap-0.5">
                {calendarDays.map((day, idx) => {
                  if (day === null) return <div key={`empty-${idx}`} />
                  const dateStr = `${calendarYM}-${String(day).padStart(2, '0')}`
                  const isUnavailable = form.unavailableDates.includes(dateStr)
                  const colIdx = idx % 7
                  const isSunday = colIdx === 0
                  const isSaturday = colIdx === 6
                  const isPast = parseISO(dateStr) < startOfMonth(today) && calendarYM < getYearMonth(today)
                  return (
                    <button
                      key={dateStr}
                      onClick={() => toggleUnavailableDate(day)}
                      disabled={isPast}
                      style={{ touchAction: 'manipulation', minHeight: 40, minWidth: 36 }}
                      className={`aspect-square rounded-xl text-sm font-medium transition-all duration-100 active:scale-90 flex flex-col items-center justify-center ${
                        isUnavailable
                          ? 'bg-red-500 text-white shadow-sm'
                          : isPast
                          ? 'text-gray-300 cursor-default'
                          : isSunday
                          ? 'hover:bg-red-50 text-red-400'
                          : isSaturday
                          ? 'hover:bg-blue-50 text-blue-400'
                          : 'hover:bg-gray-100 text-gray-700'
                      }`}
                    >
                      {day}
                      {isUnavailable && <span className="text-[8px] leading-none">✕</span>}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 今月の休み希望チップ */}
            {thisMonthUnavailable.length > 0 && (
              <div>
                <p className="text-xs text-gray-400 mb-2">
                  {format(calendarMonth, 'M月', { locale: ja })} の休み希望日（{thisMonthUnavailable.length}日）
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {thisMonthUnavailable.map((dateStr) => {
                    const d = parseISO(dateStr)
                    return (
                      <span
                        key={dateStr}
                        className="flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-600 rounded-full text-xs border border-red-200"
                      >
                        {format(d, 'M/d（E）', { locale: ja })}
                        <button
                          onClick={() =>
                            setForm((prev) => ({
                              ...prev,
                              unavailableDates: prev.unavailableDates.filter((x) => x !== dateStr),
                            }))
                          }
                          className="hover:text-red-800 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    )
                  })}
                </div>
              </div>
            )}

            {/* 全月合計 */}
            {form.unavailableDates.length > 0 && (
              <p className="text-xs text-gray-400 text-right">
                累計 {form.unavailableDates.length}日の休み希望が登録されています
              </p>
            )}
          </section>

          {/* ────────── セクション5: 希望シフトパターン ────────── */}
          <section className="card p-4 md:p-5 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-1 h-5 bg-primary-400 rounded-full" />
              <h2 className="font-bold text-gray-700 text-base">希望するシフトパターン</h2>
            </div>
            <p className="text-xs text-gray-400">自動割り当て時に優先して使用するシフトパターンを選んでください</p>
            <div className="space-y-2">
              {shiftPatterns.filter((p) => !p.isOff).map((p) => {
                const isSelected = form.preferredPatternIds.includes(p.id)
                return (
                  <button
                    key={p.id}
                    onClick={() => togglePattern(p.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all duration-150 ${
                      isSelected
                        ? 'border-primary-400 bg-primary-50'
                        : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {/* チェックボックス風インジケーター */}
                    <div
                      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all duration-100 ${
                        isSelected ? 'border-primary-500 bg-primary-500' : 'border-gray-300'
                      }`}
                    >
                      {isSelected && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12">
                          <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                    {/* パターンカラードット */}
                    <div
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: p.color }}
                    />
                    {/* パターン名・時間帯 */}
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-gray-800 text-sm">{p.name}</span>
                      <span className="text-xs text-gray-400 ml-2">
                        {p.startTime}〜{p.endTime}
                      </span>
                    </div>
                    {/* バッジ */}
                    {isSelected && (
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0"
                        style={{ backgroundColor: p.bgColor, color: p.color }}
                      >
                        希望
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
            {form.preferredPatternIds.length === 0 && (
              <p className="text-xs text-gray-400 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 shrink-0" />
                未選択の場合、すべてのパターンが均等に使用されます
              </p>
            )}
          </section>

          {/* ────────── セクション6: 自動配置除外パターン ────────── */}
          <section className="card p-4 md:p-5 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-1 h-5 bg-primary-400 rounded-full" />
              <h2 className="font-bold text-gray-700 text-base">自動配置から除外するシフト</h2>
            </div>
            <p className="text-xs text-gray-500 mb-3">チェックしたシフトは「一括設定」で自動的に配置されません</p>
            <div className="grid grid-cols-2 gap-2">
              {shiftPatterns.filter((p) => !p.isOff).map((p) => (
                <label key={p.id} className="flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={form.restrictedPatternIds?.includes(p.id) ?? false}
                    onChange={(e) => {
                      const current = form.restrictedPatternIds ?? []
                      setForm((prev) => ({
                        ...prev,
                        restrictedPatternIds: e.target.checked
                          ? [...current, p.id]
                          : current.filter((id) => id !== p.id),
                      }))
                    }}
                    className="rounded"
                  />
                  <span className="text-xs font-medium" style={{ color: p.color }}>{p.name}</span>
                  <span className="text-xs text-gray-400">{p.startTime}〜{p.endTime}</span>
                </label>
              ))}
            </div>
          </section>

          {/* ────────── アクションボタン ────────── */}
          <div className="flex gap-3 pb-4">
            <button
              onClick={handleReset}
              className="btn-secondary flex-none justify-center px-5 py-3 text-sm"
            >
              リセット
            </button>
            <button
              onClick={handleSave}
              className="btn-primary flex-1 justify-center py-3 text-base"
            >
              <Save className="w-5 h-5" />
              保存する
            </button>
          </div>
        </>
      )}
    </div>
  )
}
