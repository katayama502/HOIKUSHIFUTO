import { getDaysInMonth, parseISO, getDay, format } from 'date-fns'
import type { Staff, ShiftPattern, ClassRoom, ShiftData, StaffConstraint } from '../types'
import { AGE_RATIO } from '../types'
import { getSlotDay } from './shift'

// ─── Public types ─────────────────────────────────────────────────────────────

export type AutoScheduleMode = 'overwrite' | 'fill'

export interface PatternTarget {
  patternId: string
  targetCount: number   // 1日あたりの目標人数
}

export interface AutoScheduleResult {
  /** yearMonth スライスだけ持つ。適用時に store へ書き込む */
  monthShifts: Record<string, Record<string, { patternId: string; note: string }>>
  stats: AutoScheduleStats
}

export interface AutoScheduleStats {
  totalRequired: number            // 1日の必要人数
  totalAssignments: number         // 今回の生成で割り当てた総数
  unfilledDays: number[]           // 必要人数未満の日 (日番号)
  staffWorkDays: Record<string, number>  // staffId → 今月勤務日数
  belowMinStaff: string[]          // minDaysPerMonth 未達の staffId
  aboveMaxStaff: string[]          // maxDaysPerMonth 超過の staffId (警告用)
}

// ─── Main function ────────────────────────────────────────────────────────────

// ─── Helper: derive previous yearMonth string ────────────────────────────────

export function getPrevYearMonth(yearMonth: string): string {
  const [y, m] = yearMonth.split('-').map(Number)
  const d = new Date(y, m - 1, 1)
  d.setMonth(d.getMonth() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// ─── Helper: build "dominant pattern" map from a month's shifts ─────────────
// Returns staffId → patternId (the pattern used most often that month, work only)

export function buildPrevMonthPatternMap(
  prevYearMonth: string,
  staff: Staff[],
  patterns: ShiftPattern[],
  shifts: ShiftData,
): Record<string, string> {
  const patternMap = Object.fromEntries(patterns.map((p) => [p.id, p]))
  const result: Record<string, string> = {}

  for (const s of staff) {
    const days = shifts[prevYearMonth]?.[s.id] ?? {}
    const freq: Record<string, number> = {}
    for (const entry of Object.values(days)) {
      const p = patternMap[entry.patternId]
      if (p && !p.isOff) freq[entry.patternId] = (freq[entry.patternId] ?? 0) + 1
    }
    const best = Object.entries(freq).sort((a, b) => b[1] - a[1])[0]
    if (best) result[s.id] = best[0]
  }
  return result
}

// ─── Helper: 階段ローテーション（時間帯順で1つ後ろの番手）─────────────────────
// 「前の日が早1なら次の日は早2」のように、渡された候補パターンを開始時刻順に
// 並べ、直近勤務パターンの次（末尾なら先頭へ循環）を返す。
// 直近勤務パターンが候補内に見つからない場合は undefined（呼び出し側でフォールバック）。
function getStaircaseNextPattern(
  candidates: ShiftPattern[],
  lastPatternId: string | undefined,
): string | undefined {
  if (!lastPatternId || candidates.length === 0) return undefined

  const ordered = [...candidates].sort((a, b) => a.startTime.localeCompare(b.startTime))
  const lastIdx = ordered.findIndex((p) => p.id === lastPatternId)
  if (lastIdx === -1) return undefined

  const nextIdx = (lastIdx + 1) % ordered.length
  return ordered[nextIdx].id
}

export function autoGenerateShifts(
  yearMonth: string,
  mode: AutoScheduleMode,
  patternTargets: PatternTarget[],
  staff: Staff[],
  patterns: ShiftPattern[],
  classRooms: ClassRoom[],
  constraints: Record<string, StaffConstraint>,
  existingShifts: ShiftData,
  /** 前月実績パターンマップ: staffId → dominant patternId (省略可) */
  prevMonthPatterns?: Record<string, string>,
): AutoScheduleResult {

  const daysInMonth = getDaysInMonth(parseISO(`${yearMonth}-01`))
  const [yearStr, monthStr] = yearMonth.split('-')
  const year  = parseInt(yearStr, 10)
  const month = parseInt(monthStr, 10) - 1  // JS month (0-based)

  const totalRequired = classRooms.reduce(
    (sum, cr) => sum + Math.ceil(cr.childrenCount / (AGE_RATIO[cr.ageGroup] ?? 6)),
    0,
  )

  const patternMap = Object.fromEntries(patterns.map((p) => [p.id, p]))

  // ── Build working data ──────────────────────────────────────────────────────

  // monthShifts: staffId → dayStr → entry  (mutated during generation)
  const monthShifts: Record<string, Record<string, { patternId: string; note: string }>> = {}

  // Seed with existing data in fill mode
  if (mode === 'fill') {
    const existing = existingShifts[yearMonth] ?? {}
    for (const [staffId, days] of Object.entries(existing)) {
      monthShifts[staffId] = { ...days }
    }
  }

  // Track SET of day-numbers each staff works (for consecutive / max checks)
  const workDayNums: Record<string, Set<number>> = {}
  for (const s of staff) {
    workDayNums[s.id] = new Set()
    if (mode === 'fill') {
      const existing = monthShifts[s.id] ?? {}
      for (const [slotKey, entry] of Object.entries(existing)) {
        const p = patternMap[entry.patternId]
        if (p && !p.isOff) workDayNums[s.id].add(getSlotDay(slotKey))
      }
    }
  }

  // Active pattern targets (skip zero-count entries)
  const activeTargets = patternTargets.filter((t) => t.targetCount > 0)

  // ── 階段ローテーション用: staffId → 直近の勤務日に割り当てたパターンID ──────
  // （前日が「早1」なら翌日は「早2」…のように、時間帯順で1つずつ後ろへずらす）
  // 前月実績の主要パターンを初期値として引き継ぎ、月をまたいでも階段が途切れないようにする
  const lastAssignedPattern: Record<string, string> = { ...(prevMonthPatterns ?? {}) }

  // ── Day-by-day assignment ───────────────────────────────────────────────────

  const unfilledDays: number[] = []

  for (let d = 1; d <= daysInMonth; d++) {
    const date    = new Date(year, month, d)
    const dow     = getDay(date)            // 0=Sun … 6=Sat
    const dateStr = format(date, 'yyyy-MM-dd')
    const dayStr  = String(d)

    // Staff already assigned a work shift today (fill mode: keep them)
    const assignedToday = new Set<string>()
    if (mode === 'fill') {
      for (const s of staff) {
        const staffSlots = monthShifts[s.id] ?? {}
        const todayWorkEntry = Object.entries(staffSlots).find(([k, e]) => {
          if (getSlotDay(k) !== d) return false
          const p = patternMap[e.patternId]
          return p && !p.isOff
        })
        if (todayWorkEntry) {
          assignedToday.add(s.id)
          // 既存の割り当てでも階段の基準日として引き継ぐ
          lastAssignedPattern[s.id] = todayWorkEntry[1].patternId
        }
      }
    }

    // Eligible staff for today
    const eligible = staff.filter((s) => {
      if (assignedToday.has(s.id)) return false   // already filled

      const c = constraints[s.id]

      // Unavailable date
      if (c?.unavailableDates?.includes(dateStr)) return false

      // Day-of-week availability
      // 制約がない場合は平日のみ（月〜金）をデフォルトとして使用
      const availDays = (c?.availableDays?.length ?? 0) > 0 ? c!.availableDays : [1, 2, 3, 4, 5]
      if (!availDays.includes(dow)) return false

      // Max days per month
      const maxD = c?.maxDaysPerMonth ?? 31
      if (workDayNums[s.id].size >= maxD) return false

      // Max consecutive days
      const maxCons = c?.maxConsecutiveDays ?? 5
      let streak = 0
      for (let prev = d - 1; prev >= Math.max(1, d - maxCons); prev--) {
        if (workDayNums[s.id].has(prev)) streak++
        else break
      }
      if (streak >= maxCons) return false

      return true
    })

    const workPatternsList = patterns.filter(p => !p.isOff)

    if (activeTargets.length === 0) {
      // ── 条件ベースモード（1日あたりの配置数が未設定の場合）─────────────────
      // 各職員の制約を直接読み取り、それぞれに最適なパターンを割り当てる
      const patternCountsToday: Record<string, number> = {}

      // minDaysPerMonth 未達の人を先に処理するため、ニーズ順にソート
      const prioritized = [...eligible].sort((a, b) => {
        const ca = constraints[a.id], cb = constraints[b.id]
        const needA = (ca?.minDaysPerMonth ?? 0) - workDayNums[a.id].size
        const needB = (cb?.minDaysPerMonth ?? 0) - workDayNums[b.id].size
        return needB - needA  // 不足が多い人を優先
      })

      for (const s of prioritized) {
        if (assignedToday.has(s.id)) continue
        const c = constraints[s.id]
        const restricted = new Set(c?.restrictedPatternIds ?? [])
        const prefs = c?.preferredPatternIds ?? []

        let chosenPattern: string | null = null

        if (prefs.length > 0) {
          // 優先パターンあり（固定時間・パート職員）→ 先頭の優先パターンをそのまま使用
          chosenPattern = prefs[0]
        } else {
          // 優先パターンなし（ローテーション職員）→ 階段式（前回勤務日の次の番手）を優先
          const available = workPatternsList
            .filter(p => !restricted.has(p.id))
            .sort((a, b) => (patternCountsToday[a.id] ?? 0) - (patternCountsToday[b.id] ?? 0))
          if (available.length > 0) {
            const staircaseNext = getStaircaseNextPattern(available, lastAssignedPattern[s.id])
            if (staircaseNext) {
              chosenPattern = staircaseNext
            } else {
              // 階段の基準がない（初回など）→ 前月実績パターンがあれば優先採用
              const prev = prevMonthPatterns?.[s.id]
              const prevAvail = prev ? available.find(p => p.id === prev) : undefined
              chosenPattern = prevAvail ? prevAvail.id : available[0].id
            }
          }
        }

        if (!chosenPattern) continue

        if (!monthShifts[s.id]) monthShifts[s.id] = {}
        monthShifts[s.id][`${dayStr}_${chosenPattern}`] = { patternId: chosenPattern, note: '' }
        workDayNums[s.id].add(d)
        assignedToday.add(s.id)
        patternCountsToday[chosenPattern] = (patternCountsToday[chosenPattern] ?? 0) + 1
        lastAssignedPattern[s.id] = chosenPattern
      }
    } else {
      // ── ターゲットベースモード（1日あたりの配置数が設定されている場合）────────
      for (const target of activeTargets) {
        const patternId = target.patternId
        let remaining = target.targetCount

        // Candidates: prefer staff who have this pattern as preferred, then balance by days
        const candidates = eligible
          .filter((s) => {
            if (assignedToday.has(s.id)) return false
            const c = constraints[s.id]
            // restrictedPatternIds に含まれるパターンは除外
            if (c?.restrictedPatternIds?.includes(patternId)) return false
            return true
          })
          .map((s) => {
            const c = constraints[s.id]
            const currentWorkDays = workDayNums[s.id].size
            const minDays = c?.minDaysPerMonth ?? 0
            const prefersThis = c?.preferredPatternIds?.includes(patternId) ?? false
            const needsMoreDays = currentWorkDays < minDays
            // 前月の実績パターンと一致するか（希望未設定の場合に有効）
            const prevPattern = prevMonthPatterns?.[s.id]
            const matchesPrev = !!prevPattern && prevPattern === patternId && !prefersThis
            // 階段式：前回勤務日の次の番手と一致するか（希望未設定の場合に有効）
            const restrictedForS = new Set(c?.restrictedPatternIds ?? [])
            const staircaseAvailable = workPatternsList.filter(p => !restrictedForS.has(p.id))
            const staircaseNext = !prefersThis
              ? getStaircaseNextPattern(staircaseAvailable, lastAssignedPattern[s.id])
              : undefined
            const matchesStaircase = staircaseNext === patternId

            // Score: higher → chosen first
            let score = 0
            if (prefersThis) score += 200             // 希望パターン最優先
            else if (matchesStaircase) score += 180    // 階段式ローテーション（希望未設定時）
            else if (matchesPrev) score += 150         // 前月実績（希望・階段未設定時）
            if (needsMoreDays) score += 100 + (minDays - currentWorkDays) * 10
            score -= currentWorkDays * 3  // fewer days so far → higher priority
            return { s, score }
          })
          .sort((a, b) => b.score - a.score)

        for (const { s } of candidates) {
          if (remaining <= 0) break
          if (assignedToday.has(s.id)) continue

          if (!monthShifts[s.id]) monthShifts[s.id] = {}
          monthShifts[s.id][`${dayStr}_${patternId}`] = { patternId, note: '' }
          workDayNums[s.id].add(d)
          assignedToday.add(s.id)
          lastAssignedPattern[s.id] = patternId
          remaining--
        }
      }
    }

    // Check coverage
    const covered = assignedToday.size
    if (covered < totalRequired) unfilledDays.push(d)
  }

  // ── Stats ───────────────────────────────────────────────────────────────────

  const staffWorkDays: Record<string, number> = {}
  for (const s of staff) staffWorkDays[s.id] = workDayNums[s.id].size

  const belowMinStaff: string[] = []
  const aboveMaxStaff: string[] = []
  for (const s of staff) {
    const c = constraints[s.id]
    const minD = c?.minDaysPerMonth ?? 0
    const maxD = c?.maxDaysPerMonth ?? 31
    if (minD > 0 && staffWorkDays[s.id] < minD) belowMinStaff.push(s.id)
    if (staffWorkDays[s.id] > maxD) aboveMaxStaff.push(s.id)
  }

  const totalAssignments = Object.values(monthShifts).reduce(
    (sum, days) => {
      return sum + Object.values(days).filter((e) => {
        const p = patternMap[e.patternId]
        return p && !p.isOff
      }).length
    },
    0,
  )

  return {
    monthShifts,
    stats: {
      totalRequired,
      totalAssignments,
      unfilledDays,
      staffWorkDays,
      belowMinStaff,
      aboveMaxStaff,
    },
  }
}
