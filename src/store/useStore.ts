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
  // ── 保育番手（早1〜遅2 の7枠。4番のみ3名体制、遅1/遅2は各1名だが実態2名体制）──
  { id: 'hayai1', name: '早1',   startTime: '06:50', endTime: '15:50', color: '#0369a1', bgColor: '#dbeafe', isOff: false },
  { id: 'hayai2', name: '早2',   startTime: '07:00', endTime: '16:00', color: '#2563eb', bgColor: '#eff6ff', isOff: false },
  { id: 'ban2',   name: '2番',   startTime: '07:30', endTime: '16:30', color: '#0284c7', bgColor: '#e0f2fe', isOff: false },
  { id: 'ban3',   name: '3番',   startTime: '08:00', endTime: '17:00', color: '#16a34a', bgColor: '#dcfce7', isOff: false },
  { id: 'ban4',   name: '4番',   startTime: '08:45', endTime: '17:45', color: '#15803d', bgColor: '#f0fdf4', isOff: false },
  { id: 'osoi1',  name: '遅1',   startTime: '09:00', endTime: '18:00', color: '#dc2626', bgColor: '#fee2e2', isOff: false },
  { id: 'osoi2',  name: '遅2',   startTime: '09:00', endTime: '18:00', color: '#b91c1c', bgColor: '#fecaca', isOff: false },
  // ── 固定枠（非保育）───────────────────────────────────────────────────
  { id: 'kango',       name: '看護師',       startTime: '08:15', endTime: '17:15', color: '#0891b2', bgColor: '#cffafe', isOff: false },
  { id: 'kyushoku',    name: '給食',         startTime: '08:00', endTime: '17:00', color: '#c2410c', bgColor: '#ffedd5', isOff: false },
  { id: 'kyushokuSub', name: '給食(代替)',   startTime: '08:30', endTime: '17:30', color: '#ea580c', bgColor: '#fff7ed', isOff: false },
  { id: 'kyushokuP',   name: '給食(短時間)', startTime: '08:30', endTime: '13:30', color: '#f97316', bgColor: '#fff7ed', isOff: false },
  { id: 'gakudo',      name: '学童',         startTime: '15:00', endTime: '18:00', color: '#7c3aed', bgColor: '#ede9fe', isOff: false },
  { id: 'jimugakudo',  name: '事務+学童',    startTime: '08:30', endTime: '17:30', color: '#6d28d9', bgColor: '#ede9fe', isOff: false },
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

// ── ローテーション職員（早1〜遅2 の7枠を平日ローテーションで回す保育士） ─────
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

  // ── 管理者（先生/園長格）：原則クラス非介入、欠員時のみ手動で介入 ────────
  { id: 'encho', name: '園長', role: 'manager', employment: 'fulltime', weeklyHours: 40, color: '#94a3b8', note: '管理者。原則クラス非介入、欠員時のみ介入' },

  // ── 固定枠（非保育） ──────────────────────────────────────────────────
  { id: 'oishi',     name: '大石', role: 'staff', employment: 'fulltime', weeklyHours: 40, color: '#0891b2', note: '看護師。毎日 8:15〜17:15（階段枠外）' },
  { id: 'nagashima', name: '長嶋', role: 'staff', employment: 'fulltime', weeklyHours: 40, color: '#c2410c', note: '給食（正規）8:00〜17:00' },
  { id: 'yamagata',  name: '山形', role: 'staff', employment: 'fulltime', weeklyHours: 40, color: '#ea580c', note: '給食（正規）8:30〜17:30。長嶋休み時の代替' },
  { id: 'kanetani',  name: '金谷', role: 'staff', employment: 'parttime', weeklyHours: 25, color: '#f97316', note: '給食（パート）8:30〜13:30。一人専任は避ける運用' },
  { id: 'horino',    name: '堀野', role: 'staff', employment: 'parttime', weeklyHours: 15, color: '#fb923c', note: '給食ピンチヒッター 8:30〜13:30 or 11:00〜14:00' },
  { id: 'matsui',    name: '松井', role: 'staff', employment: 'parttime', weeklyHours: 15, color: '#7c3aed', note: '学童 15:00〜18:00（主に平日）' },
  { id: 'nakao',     name: '中尾', role: 'staff', employment: 'fulltime', weeklyHours: 40, color: '#6d28d9', note: '事務+学童 8:30〜17:30（土曜は不出勤）' },

  // ── 保育パート/正規（代表） ───────────────────────────────────────────
  { id: 'murata',    name: '村田', role: 'staff', employment: 'parttime', weeklyHours: 30, color: '#4ade80', note: '保育パート 8:30〜17:30（曜日制限なし）' },
  { id: 'saito',     name: '斉藤', role: 'staff', employment: 'parttime', weeklyHours: 35, color: '#f472b6', note: '保育 8:00〜16:00（平日中心、土曜は弱い）' },
  { id: 'washino',   name: '鷲野', role: 'staff', employment: 'parttime', weeklyHours: 40, color: '#a78bfa', note: '保育パート 8:00〜17:00' },
  { id: 'omoto',     name: '大本', role: 'staff', employment: 'parttime', weeklyHours: 40, color: '#34d399', note: '保育パート 8:30〜17:30' },
  { id: 'murakami',  name: '村上', role: 'staff', employment: 'parttime', weeklyHours: 35, color: '#60a5fa', note: '保育 8:30〜16:30（月金中心、土曜は稀）' },

  // ── その他の固定時間職員（棚卸し対象外・既存データを保持） ──────────────
  { id: 'miyatsuru', name: '宮鶴', role: 'staff', employment: 'fulltime', weeklyHours: 40, color: '#fbbf24', note: '8:00〜17:00' },
  { id: 'masuno',    name: '増野', role: 'staff', employment: 'fulltime', weeklyHours: 40, color: '#f87171', note: '8:00〜17:00' },
  { id: 'tsuji',     name: '辻',   role: 'staff', employment: 'fulltime', weeklyHours: 40, color: '#2dd4bf', note: '8:00〜17:00' },
]

// 保育番手（7枠）と固定枠（非保育）を合わせた、通常勤務で使いうる全パターン
const ALL_WORK_PATTERN_IDS = [
  'hayai1', 'hayai2', 'ban2', 'ban3', 'ban4', 'osoi1', 'osoi2',
  'kango', 'kyushoku', 'kyushokuSub', 'kyushokuP', 'gakudo', 'jimugakudo',
] as const
// 固定枠（非保育：看護師・給食・学童）
const FIXED_ROLE_IDS = ['kango', 'kyushoku', 'kyushokuSub', 'kyushokuP', 'gakudo', 'jimugakudo'] as const

// ローテーション職員は固定枠（非保育）業務には入らない
const ROTATION_RESTRICTED = [...FIXED_ROLE_IDS]
// 固定枠・代表パート/正規職員は自分の担当パターン以外に自動配置されない
const mkFixedRestricted = (...keep: string[]) =>
  ALL_WORK_PATTERN_IDS.filter((p) => !keep.includes(p))
// 管理者は原則すべての保育番手・固定枠から除外（欠員時のみ手動で個別に割り当てる）
const MANAGER_RESTRICTED = [...ALL_WORK_PATTERN_IDS]

const defaultConstraints: Record<string, StaffConstraint> = {
  // ── ローテーション職員（早1〜遅2 で平日ローテーション） ─────────────────
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

  // ── 管理者（先生/園長格）：原則クラス非介入、欠員時のみ手動で介入 ────────
  encho: {
    staffId: 'encho', availableDays: [1,2,3,4,5], unavailableDates: [],
    minDaysPerMonth: 0, maxDaysPerMonth: 0, maxConsecutiveDays: 5,
    preferredPatternIds: [], restrictedPatternIds: [...MANAGER_RESTRICTED],
  },

  // ── 固定枠（非保育）：看護師・給食・学童 ─────────────────────────────
  // 大石 看護師 8:15〜17:15（毎日、階段枠外）
  oishi: {
    staffId: 'oishi', availableDays: [1,2,3,4,5,6], unavailableDates: [],
    minDaysPerMonth: 20, maxDaysPerMonth: 26, maxConsecutiveDays: 6,
    preferredPatternIds: ['kango'], restrictedPatternIds: mkFixedRestricted('kango'),
  },
  // 長嶋 給食（正規）8:00〜17:00
  nagashima: {
    staffId: 'nagashima', availableDays: [1,2,3,4,5], unavailableDates: [],
    minDaysPerMonth: 18, maxDaysPerMonth: 23, maxConsecutiveDays: 5,
    preferredPatternIds: ['kyushoku'], restrictedPatternIds: mkFixedRestricted('kyushoku'),
  },
  // 山形 給食（正規）8:30〜17:30、長嶋休み時の代替
  yamagata: {
    staffId: 'yamagata', availableDays: [1,2,3,4,5], unavailableDates: [],
    minDaysPerMonth: 18, maxDaysPerMonth: 23, maxConsecutiveDays: 5,
    preferredPatternIds: ['kyushokuSub'], restrictedPatternIds: mkFixedRestricted('kyushokuSub'),
  },
  // 金谷 給食（パート）8:30〜13:30。一人専任は避ける運用
  kanetani: {
    staffId: 'kanetani', availableDays: [1,2,3,4,5], unavailableDates: [],
    minDaysPerMonth: 15, maxDaysPerMonth: 23, maxConsecutiveDays: 5,
    preferredPatternIds: ['kyushokuP'], restrictedPatternIds: mkFixedRestricted('kyushokuP'),
  },
  // 堀野 給食ピンチヒッター 8:30〜13:30 or 11:00〜14:00
  horino: {
    staffId: 'horino', availableDays: [1,2,3,4,5], unavailableDates: [],
    minDaysPerMonth: 8, maxDaysPerMonth: 20, maxConsecutiveDays: 5,
    preferredPatternIds: ['kyushokuP'], restrictedPatternIds: mkFixedRestricted('kyushokuP'),
  },
  // 松井 学童 15:00〜18:00（主に平日）
  matsui: {
    staffId: 'matsui', availableDays: [1,2,3,4,5], unavailableDates: [],
    minDaysPerMonth: 15, maxDaysPerMonth: 23, maxConsecutiveDays: 5,
    preferredPatternIds: ['gakudo'], restrictedPatternIds: mkFixedRestricted('gakudo'),
  },
  // 中尾 事務+学童 8:30〜17:30（土曜は不出勤）
  nakao: {
    staffId: 'nakao', availableDays: [1,2,3,4,5], unavailableDates: [],
    minDaysPerMonth: 18, maxDaysPerMonth: 23, maxConsecutiveDays: 5,
    preferredPatternIds: ['jimugakudo'], restrictedPatternIds: mkFixedRestricted('jimugakudo'),
  },

  // ── 保育パート/正規（代表）：最も近い保育番手を担当 ──────────────────
  // 村田 8:30〜17:30（パート、曜日制限なし）→ 4番と近い時間
  murata: {
    staffId: 'murata', availableDays: [0,1,2,3,4,5,6], unavailableDates: [],
    minDaysPerMonth: 12, maxDaysPerMonth: 23, maxConsecutiveDays: 5,
    preferredPatternIds: ['ban4'], restrictedPatternIds: mkFixedRestricted('ban4'),
  },
  // 斉藤 8:00〜16:00（平日中心、土曜は弱い）→ 3番と近い時間
  saito: {
    staffId: 'saito', availableDays: [1,2,3,4,5], unavailableDates: [],
    minDaysPerMonth: 15, maxDaysPerMonth: 23, maxConsecutiveDays: 5,
    preferredPatternIds: ['ban3'], restrictedPatternIds: mkFixedRestricted('ban3'),
  },
  // 鷲野 8:00〜17:00（パート）→ 3番と同じ時間
  washino: {
    staffId: 'washino', availableDays: [1,2,3,4,5], unavailableDates: [],
    minDaysPerMonth: 18, maxDaysPerMonth: 23, maxConsecutiveDays: 5,
    preferredPatternIds: ['ban3'], restrictedPatternIds: mkFixedRestricted('ban3'),
  },
  // 大本 8:30〜17:30（パート）→ 4番と近い時間
  omoto: {
    staffId: 'omoto', availableDays: [1,2,3,4,5], unavailableDates: [],
    minDaysPerMonth: 18, maxDaysPerMonth: 23, maxConsecutiveDays: 5,
    preferredPatternIds: ['ban4'], restrictedPatternIds: mkFixedRestricted('ban4'),
  },
  // 村上 8:30〜16:30（月金中心、土曜は稀）→ 2番と近い時間
  murakami: {
    staffId: 'murakami', availableDays: [1,2,3,4,5], unavailableDates: [],
    minDaysPerMonth: 15, maxDaysPerMonth: 23, maxConsecutiveDays: 5,
    preferredPatternIds: ['ban2'], restrictedPatternIds: mkFixedRestricted('ban2'),
  },

  // ── その他の固定時間職員（棚卸し対象外・既存データを保持） ──────────────
  miyatsuru: {
    staffId: 'miyatsuru', availableDays: [1,2,3,4,5], unavailableDates: [],
    minDaysPerMonth: 18, maxDaysPerMonth: 23, maxConsecutiveDays: 5,
    preferredPatternIds: ['ban3'], restrictedPatternIds: mkFixedRestricted('ban3'),
  },
  masuno: {
    staffId: 'masuno', availableDays: [1,2,3,4,5], unavailableDates: [],
    minDaysPerMonth: 18, maxDaysPerMonth: 23, maxConsecutiveDays: 5,
    preferredPatternIds: ['ban3'], restrictedPatternIds: mkFixedRestricted('ban3'),
  },
  tsuji: {
    staffId: 'tsuji', availableDays: [1,2,3,4,5], unavailableDates: [],
    minDaysPerMonth: 18, maxDaysPerMonth: 23, maxConsecutiveDays: 5,
    preferredPatternIds: ['ban3'], restrictedPatternIds: mkFixedRestricted('ban3'),
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
        // 管理者（先生/園長格）は原則クラス非介入 → 全パターンを自動配置から除外
        const restrictedPatternIds = (s.role === 'admin' || s.role === 'manager')
          ? state.shiftPatterns.filter((p) => !p.isOff).map((p) => p.id)
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
    { name: 'hoiku-shift-store-v2' }
  )
)
