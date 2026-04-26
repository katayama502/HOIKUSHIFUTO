import { getDaysInMonth, parseISO, format } from 'date-fns'
import { ja } from 'date-fns/locale'
import type { ShiftPattern } from '../types'

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
