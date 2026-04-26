import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  Staff, ShiftPattern, ClassRoom, ShiftData,
  LeaveRequest, OrgSettings,
} from '../types'

interface AppState {
  currentRole: 'admin' | 'staff'
  currentStaffId: string | null
  orgSettings: OrgSettings
  staff: Staff[]
  shiftPatterns: ShiftPattern[]
  classRooms: ClassRoom[]
  shifts: ShiftData
  leaveRequests: LeaveRequest[]

  setRole: (role: 'admin' | 'staff', staffId?: string) => void
  updateOrgSettings: (s: Partial<OrgSettings>) => void

  addStaff: (s: Staff) => void
  updateStaff: (id: string, s: Partial<Staff>) => void
  deleteStaff: (id: string) => void

  addShiftPattern: (p: ShiftPattern) => void
  updateShiftPattern: (id: string, p: Partial<ShiftPattern>) => void
  deleteShiftPattern: (id: string) => void

  addClassRoom: (c: ClassRoom) => void
  updateClassRoom: (id: string, c: Partial<ClassRoom>) => void
  deleteClassRoom: (id: string) => void

  setShiftEntry: (yearMonth: string, staffId: string, day: string, entry: { patternId: string; note: string }) => void
  clearShiftEntry: (yearMonth: string, staffId: string, day: string) => void

  addLeaveRequest: (r: LeaveRequest) => void
  updateLeaveRequest: (id: string, r: Partial<LeaveRequest>) => void
}

const defaultPatterns: ShiftPattern[] = [
  { id: 'early',  name: '早番', startTime: '07:00', endTime: '16:00', color: '#0ea5e9', bgColor: '#e0f2fe', isOff: false },
  { id: 'middle', name: '中番', startTime: '09:00', endTime: '18:00', color: '#16a34a', bgColor: '#dcfce7', isOff: false },
  { id: 'late',   name: '遅番', startTime: '11:00', endTime: '20:00', color: '#ea580c', bgColor: '#ffedd5', isOff: false },
  { id: 'normal', name: '通常', startTime: '08:30', endTime: '17:30', color: '#6b7280', bgColor: '#f3f4f6', isOff: false },
  { id: 'ampart', name: '午前P', startTime: '08:30', endTime: '12:30', color: '#8b5cf6', bgColor: '#ede9fe', isOff: false },
  { id: 'pmpart', name: '午後P', startTime: '13:30', endTime: '17:30', color: '#d946ef', bgColor: '#fae8ff', isOff: false },
  { id: 'off',    name: '休み', startTime: '', endTime: '', color: '#ef4444', bgColor: '#fee2e2', isOff: true },
  { id: 'paid',   name: '有給', startTime: '', endTime: '', color: '#7c3aed', bgColor: '#ede9fe', isOff: true },
]

const defaultClassRooms: ClassRoom[] = [
  { id: 'c0', name: '0歳児クラス', ageGroup: 0, childrenCount: 6 },
  { id: 'c1', name: '1歳児クラス', ageGroup: 1, childrenCount: 12 },
  { id: 'c2', name: '2歳児クラス', ageGroup: 2, childrenCount: 12 },
  { id: 'c3', name: '3歳児クラス', ageGroup: 3, childrenCount: 15 },
  { id: 'c4', name: '4歳児クラス', ageGroup: 4, childrenCount: 20 },
  { id: 'c5', name: '5歳児クラス', ageGroup: 5, childrenCount: 20 },
]

const defaultStaff: Staff[] = [
  { id: 's1', name: '田中 花子', role: 'admin',  employment: 'fulltime', weeklyHours: 40, color: '#fb923c', note: '主任' },
  { id: 's2', name: '鈴木 一郎', role: 'staff',  employment: 'fulltime', weeklyHours: 40, color: '#f472b6', note: '' },
  { id: 's3', name: '山田 美咲', role: 'staff',  employment: 'fulltime', weeklyHours: 40, color: '#a78bfa', note: '' },
  { id: 's4', name: '佐藤 ゆり', role: 'staff',  employment: 'parttime', weeklyHours: 20, color: '#34d399', note: '火・木のみ' },
  { id: 's5', name: '高橋 さくら', role: 'staff', employment: 'parttime', weeklyHours: 25, color: '#60a5fa', note: '' },
]

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      currentRole: 'admin',
      currentStaffId: null,
      orgSettings: {
        name: 'ひまわり保育園',
        openTime: '07:00',
        closeTime: '20:00',
        requestDeadline: 15,
      },
      staff: defaultStaff,
      shiftPatterns: defaultPatterns,
      classRooms: defaultClassRooms,
      shifts: {},
      leaveRequests: [],

      setRole: (role, staffId) => set({ currentRole: role, currentStaffId: staffId ?? null }),
      updateOrgSettings: (s) => set((state) => ({ orgSettings: { ...state.orgSettings, ...s } })),

      addStaff: (s) => set((state) => ({ staff: [...state.staff, s] })),
      updateStaff: (id, s) => set((state) => ({
        staff: state.staff.map((st) => st.id === id ? { ...st, ...s } : st),
      })),
      deleteStaff: (id) => set((state) => ({ staff: state.staff.filter((st) => st.id !== id) })),

      addShiftPattern: (p) => set((state) => ({ shiftPatterns: [...state.shiftPatterns, p] })),
      updateShiftPattern: (id, p) => set((state) => ({
        shiftPatterns: state.shiftPatterns.map((sp) => sp.id === id ? { ...sp, ...p } : sp),
      })),
      deleteShiftPattern: (id) => set((state) => ({
        shiftPatterns: state.shiftPatterns.filter((sp) => sp.id !== id),
      })),

      addClassRoom: (c) => set((state) => ({ classRooms: [...state.classRooms, c] })),
      updateClassRoom: (id, c) => set((state) => ({
        classRooms: state.classRooms.map((cr) => cr.id === id ? { ...cr, ...c } : cr),
      })),
      deleteClassRoom: (id) => set((state) => ({
        classRooms: state.classRooms.filter((cr) => cr.id !== id),
      })),

      setShiftEntry: (yearMonth, staffId, day, entry) => set((state) => ({
        shifts: {
          ...state.shifts,
          [yearMonth]: {
            ...state.shifts[yearMonth],
            [staffId]: {
              ...(state.shifts[yearMonth]?.[staffId] ?? {}),
              [day]: entry,
            },
          },
        },
      })),

      clearShiftEntry: (yearMonth, staffId, day) => set((state) => {
        const monthData = { ...(state.shifts[yearMonth] ?? {}) }
        const staffData = { ...(monthData[staffId] ?? {}) }
        delete staffData[day]
        monthData[staffId] = staffData
        return { shifts: { ...state.shifts, [yearMonth]: monthData } }
      }),

      addLeaveRequest: (r) => set((state) => ({ leaveRequests: [...state.leaveRequests, r] })),
      updateLeaveRequest: (id, r) => set((state) => ({
        leaveRequests: state.leaveRequests.map((req) => req.id === id ? { ...req, ...r } : req),
      })),
    }),
    { name: 'hoiku-shift-store' }
  )
)
