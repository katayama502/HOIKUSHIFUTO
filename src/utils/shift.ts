import { getDaysInMonth, parseISO, format, startOfWeek, addDays } from 'date-fns'
import { ja } from 'date-fns/locale'
import type { ShiftPattern, Staff, ShiftData } from '../types'

export function calcWorkHours(pattern: ShiftPattern): number {
  if (pattern.isOff || !pattern.startTime || !pattern.endTime) return 0
  const [sh, sm] = pattern.startTime.split(':').map(Number)
  const [eh, em] = pattern.endTime.split(':').map(Number)
  const total = (eh * 60 + em) - (sh * 60 + sm)
  return Math.max(0, total - 60) / 60 // 休憩1時間引き
}

export function getYearMonth(date: Date): string {
  return format(date, 'yyyy-MM')
}

export function getDaysArray(yearMonth: string): Date[] {
  const base = parseISO(`${yearMonth}-01`)
  const count = getDaysInMonth(base)
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(base)
    d.setDate(i + 1)
    return d
  })
}

export function getWeekDays(anchorDate: Date): Date[] {
  const start = startOfWeek(anchorDate, { weekStartsOn: 1 }) // Monday start
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

export function formatDayHeader(date: Date): { day: string; dayOfWeek: string; isWeekend: boolean; isSunday: boolean } {
  const dow = date.getDay()
  return {
    day: String(date.getDate()),
    dayOfWeek: format(date, 'E', { locale: ja }),
    isWeekend: dow === 0 || dow === 6,
    isSunday: dow === 0,
  }
}

export function calcMonthlyHours(
  yearMonth: string,
  staffId: string,
  shifts: Record<string, Record<string, Record<string, { patternId: string }>>>,
  patterns: ShiftPattern[]
): number {
  const monthData = shifts[yearMonth]?.[staffId] ?? {}
  const patternMap = Object.fromEntries(patterns.map((p) => [p.id, p]))
  return Object.values(monthData).reduce((sum, entry) => {
    const p = patternMap[entry.patternId]
    return sum + (p ? calcWorkHours(p) : 0)
  }, 0)
}

// -----------------------------------------------------------------------
// CSV / Export utilities
// -----------------------------------------------------------------------

/**
 * Generate CSV content for the shift table.
 * Columns: 職員名, 1日, 2日, ..., N日, 合計時間
 * Each cell shows the pattern name or blank.
 */
export function generateShiftCSV(
  yearMonth: string,
  staffList: Staff[],
  days: Date[],
  shifts: ShiftData,
  patterns: ShiftPattern[]
): string {
  const patternMap = Object.fromEntries(patterns.map((p) => [p.id, p]))
  const [year, month] = yearMonth.split('-')
  const title = `${year}年${Number(month)}月 シフト表`

  // Header row
  const headerCols = ['職員名', ...days.map((d) => `${d.getDate()}日`), '合計時間']
  const rows: string[][] = [
    [title],
    headerCols,
  ]

  // Data rows
  for (const s of staffList) {
    let totalHours = 0
    const cells: string[] = [s.name]
    for (const d of days) {
      const dayStr = String(d.getDate())
      const entry = shifts[yearMonth]?.[s.id]?.[dayStr]
      const pattern = entry ? patternMap[entry.patternId] : null
      if (pattern) {
        cells.push(pattern.name)
        totalHours += calcWorkHours(pattern)
      } else {
        cells.push('')
      }
    }
    cells.push(`${totalHours.toFixed(0)}h`)
    rows.push(cells)
  }

  // Placement count row
  const placementRow: string[] = ['配置数']
  for (const d of days) {
    const dayStr = String(d.getDate())
    const count = staffList.filter((s) => {
      const entry = shifts[yearMonth]?.[s.id]?.[dayStr]
      if (!entry) return false
      const p = patternMap[entry.patternId]
      return p && !p.isOff
    }).length
    placementRow.push(String(count))
  }
  placementRow.push('')
  rows.push(placementRow)

  return rows
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\r\n')
}

/**
 * Generate CSV with UTF-8 BOM for Excel compatibility.
 * Same structure as generateShiftCSV but prepends \uFEFF.
 */
export function generateShiftExcel(
  yearMonth: string,
  staffList: Staff[],
  days: Date[],
  shifts: ShiftData,
  patterns: ShiftPattern[]
): string {
  return '\uFEFF' + generateShiftCSV(yearMonth, staffList, days, shifts, patterns)
}

/**
 * Trigger a file download from a string content.
 */
export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Get a plain-text summary of staff monthly hours (used for debugging/print caption).
 */
export function getShiftSummaryText(
  yearMonth: string,
  staffList: Staff[],
  shifts: ShiftData,
  patterns: ShiftPattern[]
): string {
  const patternMap = Object.fromEntries(patterns.map((p) => [p.id, p]))
  const [year, month] = yearMonth.split('-')
  const lines: string[] = [`${year}年${Number(month)}月 勤務時間サマリー`, '']
  for (const s of staffList) {
    const monthData = shifts[yearMonth]?.[s.id] ?? {}
    const totalHours = Object.values(monthData).reduce((sum, entry) => {
      const p = patternMap[entry.patternId]
      return sum + (p ? calcWorkHours(p) : 0)
    }, 0)
    const workDays = Object.values(monthData).filter((entry) => {
      const p = patternMap[entry.patternId]
      return p && !p.isOff
    }).length
    lines.push(`${s.name}: ${workDays}日 / ${totalHours.toFixed(1)}h`)
  }
  return lines.join('\n')
}
