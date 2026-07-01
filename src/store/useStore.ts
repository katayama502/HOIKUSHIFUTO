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
  // 保育番手
  { id: 'kaya1',  name: '早1',  startTime: '06:50', endTime: '15:50', color: '#0ea5e9', bgColor: '#e0f2fe', isOff: false },
  { id: 'kaya2',  name: '早2',  startTime: '07:00', endTime: '16:00', color: '#0284c7', bgColor: '#e0f2fe', isOff: false },
  { id: 'ban2',   name: '2番',  startTime: '07:30', endTime: '16:30', color: '#16a34a', bgColor: '#dcfce7', isOff: false },
  { id: 'ban3',   name: '3番',  startTime: '08:00', endTime: '17:00', color: '#65a30d', bgColor: '#ecfccb', isOff: false },
  { id: 'ban4',   name: '4番',  startTime: '08:45', endTime: '17:45', color: '#ca8a04', bgColor: '#fef9c3', isOff: false },
  { id: 'osoi1',  name: '遅1',  startTime: '09:00', endTime: '18:00', color: '#ea580c', bgColor: '#ffedd5', isOff: false },
  { id: 'osoi2',  name: '遅2',  startTime: '09:00', endTime: '18:00', color: '#dc2626', bgColor: '#fee2e2', isOff: false },
  // 固定枠（非保育）
  { id: 'kango',    name: '看護師',   startTime: '08:15', endTime: '17:15', color: '#0891b2', bgColor: '#cffafe', isOff: false },
  { id: 'kyushoku', name: '給食',     startTime: '08:00', endTime: '17:00', color: '#c2410c', bgColor: '#ffedd5', isOff: false },
  { id: 'kyushokuP', name: '給食(短時間)', startTime: '08:30', endTime: '13:30', color: '#ea580c', bgColor: '#fff7ed', isOff: false },
  { id: 'gakudo',   name: '学童',     startTime: '15:00', endTime: '18:00', color: '#7c3aed', bgColor: '#ede9fe', isOff: false },
  { id: 'jimugakudo', name: '事務+学童', startTime: '08:30', endTime: '17:30', color: '#6d28d9', bgColor: '#ede9fe', isOff: false },
  // 保育パート系（時間帯自由）
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
  { id: 's_kancho', name: '園長',   role: 'admin', employment: 'fulltime', weeklyHours: 40, color: '#fb923c', note: '管理者。原則クラス非介入、欠員時のみ介入' },

  { id: 's_oishi',  name: '大石',   role: 'staff', employment: 'fulltime', weeklyHours: 40, color: '#0891b2', note: '看護師。毎日 8:15-17:15（階段枠外）' },

  { id: 's_nagashima', name: '長嶋', role: 'staff', employment: 'fulltime', weeklyHours: 40, color: '#c2410c', note: '給食（正規）8:00-17:00' },
  { id: 's_yamagata',  name: '山形', role: 'staff', employment: 'fulltime', weeklyHours: 40, color: '#ea580c', note: '給食（正規）8:30-17:30。長嶋休み時の代替' },
  { id: 's_kanatani',  name: '金谷', role: 'staff', employment: 'parttime', weeklyHours: 25, color: '#f97316', note: '給食（パート）8:30-13:30。一人専任は避ける運用' },
  { id: 's_horino',    name: '堀野', role: 'staff', employment: 'parttime', weeklyHours: 15, color: '#fb923c', note: '給食ピンチヒッター 8:30-13:30 or 11:00-14:00' },

  { id: 's_matsui', name: '松井', role: 'staff', employment: 'parttime', weeklyHours: 15, color: '#7c3aed', note: '学童 15:00-18:00（主に平日）' },
  { id: 's_nakao',  name: '中尾', role: 'staff', employment: 'fulltime', weeklyHours: 40, color: '#6d28d9', note: '事務+学童 8:30-17:30（土曜は不出勤）' },

  { id: 's_murata', name: '村田', role: 'staff', employment: 'parttime', weeklyHours: 30, color: '#f472b6', note: '保育パート 8:30-17:30（曜日制限なし）' },
  { id: 's_saito',  name: '斉藤', role: 'staff', employment: 'parttime', weeklyHours: 35, color: '#a78bfa', note: '保育 8:00-16:00（平日中心、土曜は弱い）' },
  { id: 's_washino', name: '鷲野', role: 'staff', employment: 'parttime', weeklyHours: 40, color: '#34d399', note: '保育パート 8:00-17:00' },
  { id: 's_omoto',  name: '大本', role: 'staff', employment: 'parttime', weeklyHours: 40, color: '#60a5fa', note: '保育パート 8:30-17:30' },
  { id: 's_murakami', name: '村上', role: 'staff', employment: 'parttime', weeklyHours: 35, color: '#4ade80', note: '保育 8:30-16:30（月金中心、土曜は稀）' },
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
    { name: 'hoiku-shift-store-v2' }
  )
)
