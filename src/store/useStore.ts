import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  Staff, ShiftPattern, ClassRoom, ShiftData,
  LeaveRequest, OrgSettings, UISettings, StaffConstraint,
} from '../types'

interface AppState {
  currentRole: 'admin' | 'staff'
  currentStaffId: string | null
  orgSettings: OrgSettings
  uiSettings: UISettings
  staff: Staff[]
  shiftPatterns: ShiftPattern[]
  classRooms: ClassRoom[]
  shifts: ShiftData
  leaveRequests: LeaveRequest[]

  setRole: (role: 'admin' | 'staff', staffId?: string) => void
  updateOrgSettings: (s: Partial<OrgSettings>) => void
  updateUISettings: (s: Partial<UISettings>) => void

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
  clearShiftSlot: (yearMonth: string, staffId: string, slotKey: string) => void
  setBulkMonthShifts: (yearMonth: string, monthShifts: Record<string, Record<string, { patternId: string; note: string }>>) => void

  addLeaveRequest: (r: LeaveRequest) => void
  updateLeaveRequest: (id: string, r: Partial<LeaveRequest>) => void

  staffConstraints: Record<string, StaffConstraint>
  setStaffConstraint: (staffId: string, constraint: Partial<StaffConstraint>) => void
  removeStaffConstraint: (staffId: string) => void

  resetToDefaults: () => void
}

const defaultUISettings: UISettings = {
  theme: 'warm',
  density: 'normal',
  fontSize: 'medium',
  showWeekends: true,
  sidebarCollapsed: false,
  dashboardCards: [
    { id: 'stats',        visible: true },
    { id: 'today',        visible: true },
    { id: 'progress',     visible: true },
    { id: 'hours',        visible: true },
    { id: 'quickActions', visible: true },
    { id: 'calendar',     visible: true },
  ],
}

const defaultPatterns: ShiftPattern[] = [
  // ── 番号制シフト（写真の勤務体系表より）─────────────────────────────────
  { id: 'hayai1', name: '早1',   startTime: '06:50', endTime: '15:50', color: '#0369a1', bgColor: '#dbeafe', isOff: false },
  { id: 'hayai2', name: '早2',   startTime: '07:00', endTime: '16:00', color: '#2563eb', bgColor: '#eff6ff', isOff: false },
  { id: 'ban2',   name: '2番',   startTime: '07:30', endTime: '16:30', color: '#0284c7', bgColor: '#e0f2fe', isOff: false },
  { id: 'ban3',   name: '3番',   startTime: '08:00', endTime: '17:00', color: '#16a34a', bgColor: '#dcfce7', isOff: false },
  { id: 'ban4',   name: '4番',   startTime: '08:30', endTime: '17:30', color: '#15803d', bgColor: '#f0fdf4', isOff: false },
  { id: 'ban5',   name: '5番',   startTime: '08:45', endTime: '17:45', color: '#d97706', bgColor: '#fffbeb', isOff: false },
  { id: 'ban6',   name: '6番',   startTime: '08:45', endTime: '17:45', color: '#b45309', bgColor: '#fef3c7', isOff: false },
  { id: 'osoi1',  name: '遅1',   startTime: '09:00', endTime: '18:00', color: '#dc2626', bgColor: '#fee2e2', isOff: false },
  { id: 'shu2',   name: '週2',   startTime: '09:00', endTime: '18:00', color: '#7c3aed', bgColor: '#f5f3ff', isOff: false },
  // ── 短時間・パートシフト ─────────────────────────────────────────────
  { id: 'gozanP', name: '午前P', startTime: '08:30', endTime: '13:30', color: '#8b5cf6', bgColor: '#ede9fe', isOff: false },
  { id: 'hanichi',name: '半日',  startTime: '08:00', endTime: '14:00', color: '#2dd4bf', bgColor: '#ccfbf1', isOff: false },
  { id: 'yugata', name: '夕勤',  startTime: '15:00', endTime: '18:00', color: '#db2777', bgColor: '#fce7f3', isOff: false },
  // ── 休暇 ─────────────────────────────────────────────────────────────
  { id: 'off',    name: '休み',  startTime: '', endTime: '', color: '#ef4444', bgColor: '#fee2e2', isOff: true },
  { id: 'paid',   name: '有給',  startTime: '', endTime: '', color: '#6d28d9', bgColor: '#ede9fe', isOff: true },
]

const defaultClassRooms: ClassRoom[] = [
  { id: 'c0', name: '0歳児クラス', ageGroup: 0, childrenCount: 6 },
  { id: 'c1', name: '1歳児クラス', ageGroup: 1, childrenCount: 12 },
  { id: 'c2', name: '2歳児クラス', ageGroup: 2, childrenCount: 12 },
  { id: 'c3', name: '3歳児クラス', ageGroup: 3, childrenCount: 15 },
  { id: 'c4', name: '4歳児クラス', ageGroup: 4, childrenCount: 20 },
  { id: 'c5', name: '5歳児クラス', ageGroup: 5, childrenCount: 20 },
]

// ── ローテーション職員（番号シフトで回す保育士） ──────────────────────────
const defaultStaff: Staff[] = [
  { id: 'watanabe',  name: '渡辺',  role: 'staff',   employment: 'fulltime', weeklyHours: 40, color: '#fb923c', note: '' },
  { id: 'iwasaki',   name: '岩崎',  role: 'staff',   employment: 'fulltime', weeklyHours: 40, color: '#f472b6', note: '' },
  { id: 'matsuzaki', name: '松崎',  role: 'staff',   employment: 'fulltime', weeklyHours: 40, color: '#a78bfa', note: '' },
  { id: 'hama',      name: '濱',    role: 'staff',   employment: 'fulltime', weeklyHours: 40, color: '#34d399', note: '' },
  { id: 'takuno',    name: '宅野',  role: 'staff',   employment: 'fulltime', weeklyHours: 40, color: '#60a5fa', note: '' },
  { id: 'oka',       name: '岡',    role: 'staff',   employment: 'fulltime', weeklyHours: 40, color: '#fbbf24', note: '' },
  { id: 'kushizaki', name: '串崎',  role: 'staff',   employment: 'fulltime', weeklyHours: 40, color: '#f87171', note: '' },
  { id: 'sasao',     name: '笹尾',  role: 'staff',   employment: 'fulltime', weeklyHours: 40, color: '#2dd4bf', note: '' },
  { id: 'nagahara',  name: '長原',  role: 'staff',   employment: 'fulltime', weeklyHours: 40, color: '#818cf8', note: '' },
  // ── 固定時間職員 ────────────────────────────────────────────────────
  { id: 'oishi',     name: '大石',  role: 'staff',   employment: 'fulltime', weeklyHours: 40, color: '#4ade80', note: '8:15〜17:15' },
  { id: 'murata',    name: '村田',  role: 'staff',   employment: 'fulltime', weeklyHours: 40, color: '#fb923c', note: '8:30〜17:30' },
  { id: 'miyatsuru', name: '宮鶴',  role: 'staff',   employment: 'fulltime', weeklyHours: 40, color: '#f472b6', note: '8:00〜17:00' },
  { id: 'masuno',    name: '増野',  role: 'staff',   employment: 'fulltime', weeklyHours: 40, color: '#a78bfa', note: '8:00〜17:00' },
  { id: 'omoto',     name: '大本',  role: 'staff',   employment: 'fulltime', weeklyHours: 40, color: '#34d399', note: '8:30〜17:30' },
  { id: 'murakami',  name: '村上',  role: 'staff',   employment: 'parttime', weeklyHours: 35, color: '#60a5fa', note: '8:30〜16:30' },
  { id: 'yamagata',  name: '山縣',  role: 'staff',   employment: 'fulltime', weeklyHours: 40, color: '#fbbf24', note: '8:00〜17:00' },
  { id: 'nagashima', name: '長島',  role: 'staff',   employment: 'fulltime', weeklyHours: 40, color: '#f87171', note: '8:00〜17:00' },
  { id: 'kanetani',  name: '金谷',  role: 'staff',   employment: 'parttime', weeklyHours: 25, color: '#2dd4bf', note: '8:30〜13:30' },
  { id: 'horino',    name: '堀野',  role: 'staff',   employment: 'parttime', weeklyHours: 30, color: '#818cf8', note: '8:00〜14:00' },
  { id: 'matsui',    name: '松井',  role: 'staff',   employment: 'parttime', weeklyHours: 15, color: '#4ade80', note: '15:00〜18:00' },
  { id: 'tsuji',     name: '辻',    role: 'staff',   employment: 'fulltime', weeklyHours: 40, color: '#fb923c', note: '8:00〜17:00' },
  // ── 管理職（保育士ではない括り） ─────────────────────────────────────
  { id: 'nakao',     name: '中尾',  role: 'admin',   employment: 'fulltime', weeklyHours: 40, color: '#6d28d9', note: '理事長 8:30〜17:30' },
]

// ローテーション職員が使えないシフト（パート専用）
const ROTATION_RESTRICTED = ['gozanP', 'hanichi', 'yugata'] as const
// 固定時間職員が使えないシフト（ローテーション＋パート）
const FIXED_BASE = ['hayai1', 'hayai2', 'ban2', 'ban3', 'ban4', 'ban5', 'ban6', 'osoi1', 'shu2'] as const
const mkFixedRestricted = (...keep: string[]) =>
  [...FIXED_BASE, 'gozanP', 'hanichi', 'yugata'].filter(p => !keep.includes(p))

const defaultConstraints: Record<string, StaffConstraint> = {
  // ── ローテーション職員（早1〜遅1・週2 で平日ローテーション） ─────────────
  watanabe: {
    staffId: 'watanabe', availableDays: [1,2,3,4,5], unavailableDates: [],
    minDaysPerMonth: 18, maxDaysPerMonth: 23, maxConsecutiveDays: 5,
    preferredPatternIds: [], restrictedPatternIds: [...ROTATION_RESTRICTED],
  },
  iwasaki: {
    staffId: 'iwasaki', availableDays: [1,2,3,4,5], unavailableDates: [],
    minDaysPerMonth: 18, maxDaysPerMonth: 23, maxConsecutiveDays: 5,
    preferredPatternIds: [], restrictedPatternIds: [...ROTATION_RESTRICTED],
  },
  matsuzaki: {
    staffId: 'matsuzaki', availableDays: [1,2,3,4,5], unavailableDates: [],
    minDaysPerMonth: 18, maxDaysPerMonth: 23, maxConsecutiveDays: 5,
    preferredPatternIds: [], restrictedPatternIds: [...ROTATION_RESTRICTED],
  },
  hama: {
    staffId: 'hama', availableDays: [1,2,3,4,5], unavailableDates: [],
    minDaysPerMonth: 18, maxDaysPerMonth: 23, maxConsecutiveDays: 5,
    preferredPatternIds: [], restrictedPatternIds: [...ROTATION_RESTRICTED],
  },
  takuno: {
    staffId: 'takuno', availableDays: [1,2,3,4,5], unavailableDates: [],
    minDaysPerMonth: 18, maxDaysPerMonth: 23, maxConsecutiveDays: 5,
    preferredPatternIds: [], restrictedPatternIds: [...ROTATION_RESTRICTED],
  },
  oka: {
    staffId: 'oka', availableDays: [1,2,3,4,5], unavailableDates: [],
    minDaysPerMonth: 18, maxDaysPerMonth: 23, maxConsecutiveDays: 5,
    preferredPatternIds: [], restrictedPatternIds: [...ROTATION_RESTRICTED],
  },
  kushizaki: {
    staffId: 'kushizaki', availableDays: [1,2,3,4,5], unavailableDates: [],
    minDaysPerMonth: 18, maxDaysPerMonth: 23, maxConsecutiveDays: 5,
    preferredPatternIds: [], restrictedPatternIds: [...ROTATION_RESTRICTED],
  },
  sasao: {
    staffId: 'sasao', availableDays: [1,2,3,4,5], unavailableDates: [],
    minDaysPerMonth: 18, maxDaysPerMonth: 23, maxConsecutiveDays: 5,
    preferredPatternIds: [], restrictedPatternIds: [...ROTATION_RESTRICTED],
  },
  nagahara: {
    staffId: 'nagahara', availableDays: [1,2,3,4,5], unavailableDates: [],
    minDaysPerMonth: 18, maxDaysPerMonth: 23, maxConsecutiveDays: 5,
    preferredPatternIds: [], restrictedPatternIds: [...ROTATION_RESTRICTED],
  },
  // ── 固定時間職員（写真の固定欄：毎日同じ時間帯） ────────────────────────
  // 大石 8:15〜17:15 → 最近似の4番（8:30〜17:30）を使用
  oishi: {
    staffId: 'oishi', availableDays: [1,2,3,4,5], unavailableDates: [],
    minDaysPerMonth: 18, maxDaysPerMonth: 23, maxConsecutiveDays: 5,
    preferredPatternIds: ['ban4'], restrictedPatternIds: mkFixedRestricted('ban4'),
  },
  // 村田 8:30〜17:30 → 4番と同じ時間
  murata: {
    staffId: 'murata', availableDays: [1,2,3,4,5], unavailableDates: [],
    minDaysPerMonth: 18, maxDaysPerMonth: 23, maxConsecutiveDays: 5,
    preferredPatternIds: ['ban4'], restrictedPatternIds: mkFixedRestricted('ban4'),
  },
  // 宮鶴 8:00〜17:00 → 3番と同じ時間
  miyatsuru: {
    staffId: 'miyatsuru', availableDays: [1,2,3,4,5], unavailableDates: [],
    minDaysPerMonth: 18, maxDaysPerMonth: 23, maxConsecutiveDays: 5,
    preferredPatternIds: ['ban3'], restrictedPatternIds: mkFixedRestricted('ban3'),
  },
  // 増野 8:00〜17:00 → 3番と同じ時間
  masuno: {
    staffId: 'masuno', availableDays: [1,2,3,4,5], unavailableDates: [],
    minDaysPerMonth: 18, maxDaysPerMonth: 23, maxConsecutiveDays: 5,
    preferredPatternIds: ['ban3'], restrictedPatternIds: mkFixedRestricted('ban3'),
  },
  // 大本 8:30〜17:30 → 4番と同じ時間
  omoto: {
    staffId: 'omoto', availableDays: [1,2,3,4,5], unavailableDates: [],
    minDaysPerMonth: 18, maxDaysPerMonth: 23, maxConsecutiveDays: 5,
    preferredPatternIds: ['ban4'], restrictedPatternIds: mkFixedRestricted('ban4'),
  },
  // 村上 8:30〜16:30 → 最近似の2番（7:30〜16:30）を使用
  murakami: {
    staffId: 'murakami', availableDays: [1,2,3,4,5], unavailableDates: [],
    minDaysPerMonth: 18, maxDaysPerMonth: 23, maxConsecutiveDays: 5,
    preferredPatternIds: ['ban2'], restrictedPatternIds: mkFixedRestricted('ban2'),
  },
  // 山縣 8:00〜17:00 → 3番と同じ時間
  yamagata: {
    staffId: 'yamagata', availableDays: [1,2,3,4,5], unavailableDates: [],
    minDaysPerMonth: 18, maxDaysPerMonth: 23, maxConsecutiveDays: 5,
    preferredPatternIds: ['ban3'], restrictedPatternIds: mkFixedRestricted('ban3'),
  },
  // 長島 8:00〜17:00 → 3番と同じ時間
  nagashima: {
    staffId: 'nagashima', availableDays: [1,2,3,4,5], unavailableDates: [],
    minDaysPerMonth: 18, maxDaysPerMonth: 23, maxConsecutiveDays: 5,
    preferredPatternIds: ['ban3'], restrictedPatternIds: mkFixedRestricted('ban3'),
  },
  // 辻 8:00〜17:00 → 3番と同じ時間（固定）
  tsuji: {
    staffId: 'tsuji', availableDays: [1,2,3,4,5], unavailableDates: [],
    minDaysPerMonth: 18, maxDaysPerMonth: 23, maxConsecutiveDays: 5,
    preferredPatternIds: ['ban3'], restrictedPatternIds: mkFixedRestricted('ban3'),
  },
  // ── 短時間パート職員（担当シフトのみ） ────────────────────────────────
  // 金谷 8:30〜13:30（午前P）
  kanetani: {
    staffId: 'kanetani', availableDays: [1,2,3,4,5], unavailableDates: [],
    minDaysPerMonth: 15, maxDaysPerMonth: 23, maxConsecutiveDays: 5,
    preferredPatternIds: ['gozanP'],
    restrictedPatternIds: [...FIXED_BASE, 'hanichi', 'yugata'],
  },
  // 堀野 8:00〜14:00（半日）
  horino: {
    staffId: 'horino', availableDays: [1,2,3,4,5], unavailableDates: [],
    minDaysPerMonth: 15, maxDaysPerMonth: 23, maxConsecutiveDays: 5,
    preferredPatternIds: ['hanichi'],
    restrictedPatternIds: [...FIXED_BASE, 'gozanP', 'yugata'],
  },
  // 松井 15:00〜18:00（夕勤）
  matsui: {
    staffId: 'matsui', availableDays: [1,2,3,4,5], unavailableDates: [],
    minDaysPerMonth: 15, maxDaysPerMonth: 23, maxConsecutiveDays: 5,
    preferredPatternIds: ['yugata'],
    restrictedPatternIds: [...FIXED_BASE, 'gozanP', 'hanichi'],
  },
  // ── 管理職（保育士ではない括り）─────────────────────────────────────
  // 中尾 理事長 8:30〜17:30：早1・早2は除外、4番優先
  nakao: {
    staffId: 'nakao', availableDays: [1,2,3,4,5], unavailableDates: [],
    minDaysPerMonth: 18, maxDaysPerMonth: 23, maxConsecutiveDays: 5,
    preferredPatternIds: ['ban4'],
    restrictedPatternIds: ['hayai1', 'hayai2', 'gozanP', 'hanichi', 'yugata'],
  },
}

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
      uiSettings: defaultUISettings,
      staff: defaultStaff,
      shiftPatterns: defaultPatterns,
      classRooms: defaultClassRooms,
      shifts: {},
      leaveRequests: [],
      staffConstraints: defaultConstraints,

      setRole: (role, staffId) => set({ currentRole: role, currentStaffId: staffId ?? null }),
      updateOrgSettings: (s) => set((state) => ({ orgSettings: { ...state.orgSettings, ...s } })),
      updateUISettings: (s) => set((state) => ({ uiSettings: { ...state.uiSettings, ...s } })),

      addStaff: (s) => set((state) => {
        // ロールに基づくデフォルトの制約パターン除外
        const restrictedPatternIds = (s.role === 'admin' || s.role === 'manager')
          ? ['early', 'late']  // 管理職は早番・遅番の自動配置から除外
          : []

        const defaultConstraint: StaffConstraint = {
          staffId: s.id,
          availableDays: [1, 2, 3, 4, 5],  // 平日のみ（月〜金）
          unavailableDates: [],
          minDaysPerMonth: s.employment === 'fulltime' ? 20 : 0,
          maxDaysPerMonth: s.employment === 'fulltime' ? 23 : 15,
          preferredPatternIds: [],
          maxConsecutiveDays: 5,
          restrictedPatternIds,
        }

        return {
          staff: [...state.staff, s],
          staffConstraints: {
            ...state.staffConstraints,
            [s.id]: defaultConstraint,
          },
        }
      }),
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
              // Composite key: "${day}_${patternId}" allows multi-slot per day
              [`${day}_${entry.patternId}`]: entry,
            },
          },
        },
      })),

      clearShiftEntry: (yearMonth, staffId, day) => set((state) => {
        const monthData = { ...(state.shifts[yearMonth] ?? {}) }
        const staffData = { ...(monthData[staffId] ?? {}) }
        const dayNum = parseInt(day, 10)
        for (const key of Object.keys(staffData)) {
          if (parseInt(key, 10) === dayNum) delete staffData[key]
        }
        monthData[staffId] = staffData
        return { shifts: { ...state.shifts, [yearMonth]: monthData } }
      }),

      clearShiftSlot: (yearMonth, staffId, slotKey) => set((state) => {
        const monthData = { ...(state.shifts[yearMonth] ?? {}) }
        const staffData = { ...(monthData[staffId] ?? {}) }
        delete staffData[slotKey]
        monthData[staffId] = staffData
        return { shifts: { ...state.shifts, [yearMonth]: monthData } }
      }),

      setBulkMonthShifts: (yearMonth, monthShifts) => set((state) => ({
        shifts: {
          ...state.shifts,
          [yearMonth]: monthShifts,
        },
      })),

      addLeaveRequest: (r) => set((state) => ({ leaveRequests: [...state.leaveRequests, r] })),
      updateLeaveRequest: (id, r) => set((state) => ({
        leaveRequests: state.leaveRequests.map((req) => req.id === id ? { ...req, ...r } : req),
      })),

      setStaffConstraint: (staffId, constraint) => set((state) => ({
        staffConstraints: {
          ...state.staffConstraints,
          [staffId]: {
            // 既存設定 or デフォルト値を先に展開し、新しい constraint で上書き
            ...(state.staffConstraints[staffId] ?? {
              availableDays: [1, 2, 3, 4, 5],
              unavailableDates: [],
              minDaysPerMonth: 0,
              maxDaysPerMonth: 31,
              preferredPatternIds: [],
              maxConsecutiveDays: 5,
              restrictedPatternIds: [],
            }),
            ...constraint,
            staffId,
          },
        },
      })),

      removeStaffConstraint: (staffId) => set((state) => {
        const next = { ...state.staffConstraints }
        delete next[staffId]
        return { staffConstraints: next }
      }),

      resetToDefaults: () => set({
        shiftPatterns: defaultPatterns,
        staff: defaultStaff,
        staffConstraints: defaultConstraints,
        shifts: {},
        leaveRequests: [],
      }),
    }),
    { name: 'hoiku-shift-store' }
  )
)
