import type { Staff, ShiftPattern, ClassRoom, StaffConstraint, ShiftData } from '../types'
import { AGE_RATIO } from '../types'
import { getDaysArray, getDaySlots } from './shift'

export type ViolationSeverity = 'error' | 'warning'

export interface ShiftViolation {
  id: string                   // React key として使う一意キー
  severity: ViolationSeverity
  type:
    | 'understaffed'           // 必要配置人数を下回る日
    | 'overscheduled'          // 月の上限出勤日数を超過
    | 'underscheduled'         // 月の最低出勤日数を下回る
    | 'unavailable-day'        // 出勤不可曜日に配置されている
    | 'unavailable-date'       // 休み希望日に配置されている
    | 'consecutive-days'       // 連続勤務上限を超過
    | 'hours-limit'            // 時間外（将来拡張用）
  staffId?: string
  day?: string                 // 日付（"15" のような日番号文字列）
  yearMonth: string            // "2026-05"
  message: string              // 日本語のエラーメッセージ
}

/**
 * 指定月のシフト全体をバリデーションして違反一覧を返す。
 * ※ スロットキーは複合形式 "15_ban3" のみサポート（getDaySlots 経由で参照）
 */
export function validateMonth(
  yearMonth: string,
  shifts: ShiftData,
  staff: Staff[],
  patterns: ShiftPattern[],
  classRooms: ClassRoom[],
  constraints: Record<string, StaffConstraint>
): ShiftViolation[] {
  const violations: ShiftViolation[] = []
  const patternMap = Object.fromEntries(patterns.map((p) => [p.id, p]))
  const days = getDaysArray(yearMonth)

  // クラスごとの必要配置人数を合算
  const totalRequired = classRooms.reduce((sum, cr) => {
    const ratio = AGE_RATIO[cr.ageGroup] ?? 6
    return sum + Math.ceil(cr.childrenCount / ratio)
  }, 0)

  // ────────────────────────────────────────────
  // 1. 日ごとの配置人数チェック（人員不足）
  //    ※ 誰も出勤していない日（土日・全員休暇等）はスキップ
  // ────────────────────────────────────────────
  for (const d of days) {
    const dayNum = d.getDate()
    const dayStr = String(dayNum)

    const workingCount = staff.filter((s) => {
      const staffData = shifts[yearMonth]?.[s.id] ?? {}
      const slots = getDaySlots(staffData, dayNum)
      return slots.some((sl) => {
        const p = patternMap[sl.patternId]
        return p != null && !p.isOff
      })
    }).length

    // 誰も出勤していない日（土日・全員休暇）は配置不足扱いしない
    if (workingCount > 0 && workingCount < totalRequired) {
      violations.push({
        id: `understaffed-${yearMonth}-${dayStr}`,
        severity: 'error',
        type: 'understaffed',
        day: dayStr,
        yearMonth,
        message: `${d.getMonth() + 1}月${dayStr}日: 配置${workingCount}名（必要${totalRequired}名）`,
      })
    }
  }

  // ────────────────────────────────────────────
  // 2. 職員ごとの制約チェック
  // ────────────────────────────────────────────
  for (const s of staff) {
    const constraint = constraints[s.id]
    const monthEntries = shifts[yearMonth]?.[s.id] ?? {}

    // ユニークな出勤日数を集計（同日に複数スロットがあっても1日としてカウント）
    // slotKey 形式: "15_ban3" → parseInt("15_ban3", 10) = 15
    const workDaySet = new Set<number>()
    for (const [slotKey, entry] of Object.entries(monthEntries)) {
      const p = patternMap[entry.patternId]
      if (p && !p.isOff) {
        const dayNum = parseInt(slotKey, 10)
        if (!isNaN(dayNum)) workDaySet.add(dayNum)
      }
    }
    const workingDayCount = workDaySet.size

    if (constraint) {
      // ── 月の最低出勤日数 ──
      if (constraint.minDaysPerMonth > 0 && workingDayCount < constraint.minDaysPerMonth) {
        violations.push({
          id: `underscheduled-${s.id}-${yearMonth}`,
          severity: 'warning',
          type: 'underscheduled',
          staffId: s.id,
          yearMonth,
          message: `${s.name}: 今月${workingDayCount}日（最低${constraint.minDaysPerMonth}日必要）`,
        })
      }

      // ── 月の最大出勤日数 ──
      if (constraint.maxDaysPerMonth < 31 && workingDayCount > constraint.maxDaysPerMonth) {
        violations.push({
          id: `overscheduled-${s.id}-${yearMonth}`,
          severity: 'error',
          type: 'overscheduled',
          staffId: s.id,
          yearMonth,
          message: `${s.name}: 今月${workingDayCount}日（上限${constraint.maxDaysPerMonth}日超過）`,
        })
      }

      // ── 日ごとの詳細チェック（休み希望・曜日制限） ──
      for (const d of days) {
        const dayNum = d.getDate()
        const dayStr = String(dayNum)
        const staffData = shifts[yearMonth]?.[s.id] ?? {}
        const slots = getDaySlots(staffData, dayNum)
        const workSlots = slots.filter((sl) => {
          const p = patternMap[sl.patternId]
          return p != null && !p.isOff
        })
        if (workSlots.length === 0) continue

        // 休み希望日チェック
        const dateStr = `${yearMonth}-${dayStr.padStart(2, '0')}`
        if (constraint.unavailableDates.includes(dateStr)) {
          violations.push({
            id: `unavailable-date-${s.id}-${dayStr}-${yearMonth}`,
            severity: 'error',
            type: 'unavailable-date',
            staffId: s.id,
            day: dayStr,
            yearMonth,
            message: `${s.name}: ${d.getMonth() + 1}月${dayStr}日は休み希望日です`,
          })
        }

        // 出勤可能曜日チェック
        if (
          constraint.availableDays.length > 0 &&
          !constraint.availableDays.includes(d.getDay())
        ) {
          violations.push({
            id: `unavailable-day-${s.id}-${dayStr}-${yearMonth}`,
            severity: 'warning',
            type: 'unavailable-day',
            staffId: s.id,
            day: dayStr,
            yearMonth,
            message: `${s.name}: ${d.getMonth() + 1}月${dayStr}日は通常出勤しない曜日です`,
          })
        }
      }

      // ── 連続勤務日数チェック ──
      if (constraint.maxConsecutiveDays < 7) {
        let consecutive = 0
        let maxSeen = 0
        const staffData = shifts[yearMonth]?.[s.id] ?? {}
        for (const d of days) {
          const slots = getDaySlots(staffData, d.getDate())
          const isWorking = slots.some((sl) => {
            const p = patternMap[sl.patternId]
            return p != null && !p.isOff
          })
          if (isWorking) {
            consecutive++
            maxSeen = Math.max(maxSeen, consecutive)
          } else {
            consecutive = 0
          }
        }
        if (maxSeen > constraint.maxConsecutiveDays) {
          violations.push({
            id: `consecutive-${s.id}-${yearMonth}`,
            severity: 'error',
            type: 'consecutive-days',
            staffId: s.id,
            yearMonth,
            message: `${s.name}: ${maxSeen}日連続勤務（上限${constraint.maxConsecutiveDays}日）`,
          })
        }
      }
    }
  }

  return violations
}

/**
 * 特定の日付の違反を絞り込む（シフト表セル表示用）。
 */
export function getDayViolations(
  violations: ShiftViolation[],
  yearMonth: string,
  day: string
): ShiftViolation[] {
  return violations.filter((v) => v.yearMonth === yearMonth && v.day === day)
}

/**
 * 特定の職員の違反を絞り込む。
 */
export function getStaffViolations(
  violations: ShiftViolation[],
  staffId: string
): ShiftViolation[] {
  return violations.filter((v) => v.staffId === staffId)
}
