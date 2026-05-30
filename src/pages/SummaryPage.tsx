/**
 * 勤怠サマリーページ (SummaryPage)
 *
 * NOTE for Layout.tsx maintainer:
 * Add this nav item to adminNav array in src/components/Layout.tsx:
 *   { to: '/summary', icon: BarChart3, label: '勤怠サマリー' }
 * Import BarChart3 from 'lucide-react'.
 */

import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight, AlertTriangle, FileDown, Filter } from 'lucide-react'
import { format, addMonths, subMonths } from 'date-fns'
import { ja } from 'date-fns/locale'
import { useStore } from '../store/useStore'
import {
  getYearMonth, getDaysArray, calcWorkHours, downloadFile,
} from '../utils/shift'
import type { Employment, Staff } from '../types'

// --- Thresholds ---
const OVERTIME_MONTHLY_LIMIT = 45   // hours: red alert
const OVERTIME_MONTHLY_WARN  = 36   // hours: orange warning
const STANDARD_MONTHLY_HOURS = 160  // assumed standard for fulltime

interface SummaryRow {
  staff: Staff
  workDays: number
  totalHours: number
  weeklyAvgHours: number
  overtimeHours: number
  paidLeave: number
  alerts: string[]
}

function buildSummary(
  yearMonth: string,
  staffList: Staff[],
  shifts: Record<string, Record<string, Record<string, { patternId: string }>>>,
  patterns: { id: string; name: string; isOff: boolean; startTime: string; endTime: string }[]
): SummaryRow[] {
  const patternMap = Object.fromEntries(patterns.map((p) => [p.id, p]))
  const days = getDaysArray(yearMonth)
  const weeksInMonth = days.length / 7

  return staffList.map((s) => {
    const monthData = shifts[yearMonth]?.[s.id] ?? {}
    let workDays = 0
    let totalHours = 0
    let paidLeave = 0

    for (const entry of Object.values(monthData)) {
      const p = patternMap[entry.patternId]
      if (!p) continue
      if (p.isOff) {
        if (p.name === '有給') paidLeave++
      } else {
        workDays++
        totalHours += calcWorkHours(p as Parameters<typeof calcWorkHours>[0])
      }
    }

    const weeklyAvgHours = weeksInMonth > 0 ? totalHours / weeksInMonth : 0
    const standardHours = s.employment === 'parttime'
      ? (s.weeklyHours / 7) * days.length
      : STANDARD_MONTHLY_HOURS
    const overtimeHours = Math.max(0, totalHours - standardHours)

    const alerts: string[] = []
    if (overtimeHours >= OVERTIME_MONTHLY_LIMIT) {
      alerts.push(`残業${overtimeHours.toFixed(0)}h超過`)
    } else if (overtimeHours >= OVERTIME_MONTHLY_WARN) {
      alerts.push(`残業注意 ${overtimeHours.toFixed(0)}h`)
    }
    if (workDays === 0) {
      alerts.push('勤務記録なし')
    }

    return { staff: s, workDays, totalHours, weeklyAvgHours, overtimeHours, paidLeave, alerts }
  })
}

function rowAlertLevel(row: SummaryRow): 'red' | 'orange' | 'none' {
  if (row.overtimeHours >= OVERTIME_MONTHLY_LIMIT) return 'red'
  if (row.overtimeHours >= OVERTIME_MONTHLY_WARN) return 'orange'
  return 'none'
}

export default function SummaryPage() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [employmentFilter, setEmploymentFilter] = useState<Employment | 'all'>('all')

  const { staff, shiftPatterns, shifts } = useStore()
  const yearMonth = getYearMonth(currentDate)
  const monthLabel = format(currentDate, 'yyyy年M月', { locale: ja })

  const filteredStaff = useMemo(() =>
    employmentFilter === 'all'
      ? staff
      : staff.filter((s) => s.employment === employmentFilter),
    [staff, employmentFilter]
  )

  const summaryRows = useMemo(
    () => buildSummary(yearMonth, filteredStaff, shifts, shiftPatterns),
    [yearMonth, filteredStaff, shifts, shiftPatterns]
  )

  function handleCSVDownload() {
    const header = ['職員名', '雇用区分', '勤務日数', '総勤務時間', '週平均時間', '残業時間', '有給取得日数', 'アラート']
    const rows = summaryRows.map((r) => [
      r.staff.name,
      r.staff.employment === 'fulltime' ? '正職員' : 'パート',
      String(r.workDays),
      `${r.totalHours.toFixed(1)}h`,
      `${r.weeklyAvgHours.toFixed(1)}h`,
      `${r.overtimeHours.toFixed(1)}h`,
      String(r.paidLeave),
      r.alerts.join(' / '),
    ])
    const csv =
      '\uFEFF' +
      [header, ...rows]
        .map((row) => row.map((c) => `"${c.replace(/"/g, '""')}"`).join(','))
        .join('\r\n')
    downloadFile(csv, `勤怠サマリー_${yearMonth}.csv`, 'text/csv;charset=utf-8')
  }

  const alertCount = summaryRows.filter((r) => r.alerts.length > 0).length

  return (
    <div className="space-y-4">

      {/* ヘッダー */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-gray-800 truncate">勤怠サマリー</h1>
          <p className="text-xs text-gray-400 mt-0.5">月次の勤務実績まとめ</p>
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

      {/* アラートサマリーバナー */}
      {alertCount > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm border bg-amber-50 border-amber-200">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
          <span className="text-gray-700 text-xs leading-snug flex-1">
            <strong>{alertCount}名</strong> の職員に勤務アラートがあります
          </span>
        </div>
      )}

      {/* フィルター & エクスポート */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 bg-gray-100 rounded-xl p-1">
          <Filter className="w-3.5 h-3.5 text-gray-400 ml-1" />
          {(['all', 'fulltime', 'parttime'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setEmploymentFilter(v)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                employmentFilter === v
                  ? 'bg-white text-gray-800 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {v === 'all' ? 'すべて' : v === 'fulltime' ? '正職員' : 'パート'}
            </button>
          ))}
        </div>
        <button
          onClick={handleCSVDownload}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors"
        >
          <FileDown className="w-3.5 h-3.5" />
          CSV出力
        </button>
      </div>

      {/* サマリーテーブル */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
          <table className="w-full border-collapse" style={{ minWidth: 600 }}>
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-xs text-gray-500 font-medium">
                <th className="sticky left-0 bg-gray-50 text-left px-4 py-3 w-[120px] z-10">職員名</th>
                <th className="text-center px-3 py-3 w-[72px]">雇用</th>
                <th className="text-center px-3 py-3 w-[72px]">勤務日数</th>
                <th className="text-center px-3 py-3 w-[88px]">総勤務時間</th>
                <th className="text-center px-3 py-3 w-[88px]">週平均時間</th>
                <th className="text-center px-3 py-3 w-[80px]">残業時間</th>
                <th className="text-center px-3 py-3 w-[80px]">有給取得</th>
                <th className="text-left px-3 py-3">アラート</th>
              </tr>
            </thead>
            <tbody>
              {summaryRows.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-gray-400 text-sm">
                    該当する職員データがありません
                  </td>
                </tr>
              )}
              {summaryRows.map((row, i) => {
                const level = rowAlertLevel(row)
                const rowBg =
                  level === 'red'
                    ? 'bg-red-50'
                    : level === 'orange'
                    ? 'bg-orange-50'
                    : i % 2 === 0
                    ? 'bg-white'
                    : 'bg-gray-50/40'

                return (
                  <tr key={row.staff.id} className={`${rowBg} border-b border-gray-100 text-sm`}>
                    {/* 職員名 */}
                    <td className={`sticky left-0 z-10 px-4 py-3 ${rowBg}`}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                          style={{ backgroundColor: row.staff.color }}
                        >
                          {row.staff.name[0]}
                        </div>
                        <div>
                          <p className="font-medium text-gray-800 text-xs leading-tight">{row.staff.name}</p>
                          {row.staff.note && (
                            <p className="text-[10px] text-gray-400 leading-tight">{row.staff.note}</p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* 雇用区分 */}
                    <td className="text-center px-3 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        row.staff.employment === 'fulltime'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-purple-100 text-purple-700'
                      }`}>
                        {row.staff.employment === 'fulltime' ? '正職員' : 'パート'}
                      </span>
                    </td>

                    {/* 勤務日数 */}
                    <td className="text-center px-3 py-3">
                      <span className="font-bold text-gray-800">{row.workDays}</span>
                      <span className="text-xs text-gray-400 ml-0.5">日</span>
                    </td>

                    {/* 総勤務時間 */}
                    <td className="text-center px-3 py-3">
                      <span className={`font-bold ${level === 'red' ? 'text-red-600' : level === 'orange' ? 'text-orange-500' : 'text-gray-800'}`}>
                        {row.totalHours.toFixed(1)}
                      </span>
                      <span className="text-xs text-gray-400 ml-0.5">h</span>
                    </td>

                    {/* 週平均時間 */}
                    <td className="text-center px-3 py-3">
                      <span className="font-semibold text-gray-700">{row.weeklyAvgHours.toFixed(1)}</span>
                      <span className="text-xs text-gray-400 ml-0.5">h/週</span>
                    </td>

                    {/* 残業時間 */}
                    <td className="text-center px-3 py-3">
                      {row.overtimeHours > 0 ? (
                        <>
                          <span className={`font-bold ${level === 'red' ? 'text-red-600' : level === 'orange' ? 'text-orange-500' : 'text-gray-700'}`}>
                            {row.overtimeHours.toFixed(1)}
                          </span>
                          <span className="text-xs text-gray-400 ml-0.5">h</span>
                        </>
                      ) : (
                        <span className="text-gray-300 text-xs">―</span>
                      )}
                    </td>

                    {/* 有給取得日数 */}
                    <td className="text-center px-3 py-3">
                      {row.paidLeave > 0 ? (
                        <>
                          <span className="font-semibold text-purple-600">{row.paidLeave}</span>
                          <span className="text-xs text-gray-400 ml-0.5">日</span>
                        </>
                      ) : (
                        <span className="text-gray-300 text-xs">―</span>
                      )}
                    </td>

                    {/* アラート */}
                    <td className="px-3 py-3">
                      {row.alerts.length > 0 ? (
                        <div className="flex flex-col gap-0.5">
                          {row.alerts.map((a, ai) => (
                            <span
                              key={ai}
                              className={`inline-flex items-center gap-1 text-[10px] font-semibold ${
                                level === 'red' ? 'text-red-600' : 'text-orange-500'
                              }`}
                            >
                              <AlertTriangle className="w-3 h-3 shrink-0" />
                              {a}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[10px] text-green-500 font-medium">問題なし</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>

            {/* フッター集計 */}
            {summaryRows.length > 0 && (
              <tfoot>
                <tr className="bg-gray-100 border-t-2 border-gray-200 text-xs font-semibold text-gray-600">
                  <td className="sticky left-0 z-10 bg-gray-100 px-4 py-2" colSpan={2}>
                    合計 / 平均 ({summaryRows.length}名)
                  </td>
                  <td className="text-center px-3 py-2">
                    {(summaryRows.reduce((s, r) => s + r.workDays, 0) / summaryRows.length).toFixed(1)}日
                  </td>
                  <td className="text-center px-3 py-2">
                    {(summaryRows.reduce((s, r) => s + r.totalHours, 0) / summaryRows.length).toFixed(1)}h
                  </td>
                  <td className="text-center px-3 py-2">
                    {(summaryRows.reduce((s, r) => s + r.weeklyAvgHours, 0) / summaryRows.length).toFixed(1)}h
                  </td>
                  <td className="text-center px-3 py-2">
                    {(summaryRows.reduce((s, r) => s + r.overtimeHours, 0) / summaryRows.length).toFixed(1)}h
                  </td>
                  <td className="text-center px-3 py-2">
                    {(summaryRows.reduce((s, r) => s + r.paidLeave, 0) / summaryRows.length).toFixed(1)}日
                  </td>
                  <td className="px-3 py-2">
                    <span className={`${summaryRows.filter((r) => r.alerts.length > 0).length > 0 ? 'text-red-500' : 'text-green-500'}`}>
                      アラート {summaryRows.filter((r) => r.alerts.length > 0).length}名
                    </span>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* 凡例 */}
      <div className="flex flex-wrap gap-3 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-red-100 border border-red-300 inline-block" />
          残業{OVERTIME_MONTHLY_LIMIT}h以上（要注意）
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-orange-100 border border-orange-300 inline-block" />
          残業{OVERTIME_MONTHLY_WARN}h以上（警告）
        </span>
        <span className="flex items-center gap-1.5">
          残業時間 = 総勤務時間 − 標準時間（正職員:{STANDARD_MONTHLY_HOURS}h/月）
        </span>
      </div>
    </div>
  )
}
