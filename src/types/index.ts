export type Role = 'admin' | 'staff'
export type Employment = 'fulltime' | 'parttime'

export interface Staff {
  id: string
  name: string
  role: Role
  employment: Employment
  weeklyHours: number
  color: string
  note: string
}

export interface ShiftPattern {
  id: string
  name: string
  startTime: string
  endTime: string
  color: string
  bgColor: string
  isOff: boolean
}

export interface ClassRoom {
  id: string
  name: string
  ageGroup: 0 | 1 | 2 | 3 | 4 | 5
  childrenCount: number
}

export interface ShiftEntry {
  patternId: string
  note: string
}

// shifts[yearMonth][staffId][day] = ShiftEntry
export type ShiftData = Record<string, Record<string, Record<string, ShiftEntry>>>

export interface LeaveRequest {
  id: string
  staffId: string
  date: string // YYYY-MM-DD
  type: 'dayoff' | 'paid'
  reason: string
  status: 'pending' | 'approved' | 'rejected'
  createdAt: string
}

export interface OrgSettings {
  name: string
  openTime: string
  closeTime: string
  requestDeadline: number // 何日締め
}

export const AGE_RATIO: Record<number, number> = {
  0: 3,
  1: 6,
  2: 6,
  3: 15,
  4: 25,
  5: 25,
}

export const STAFF_COLORS = [
  '#fb923c', '#f472b6', '#a78bfa', '#34d399', '#60a5fa',
  '#fbbf24', '#f87171', '#2dd4bf', '#818cf8', '#4ade80',
]
