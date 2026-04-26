import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, Users, ClipboardList, AlertTriangle, Clock, ChevronRight } from 'lucide-react'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import { useStore } from '../store/useStore'
import { getYearMonth, calcMonthlyHours } from '../utils/shift'

export default function Dashboard() {
  const { staff, shifts, shiftPatterns, leaveRequests, currentRole, currentStaffId, orgSettings } = useStore()
  const today = new Date()
  const yearMonth = getYearMonth(today)
  const monthLabel = format(today, 'M月', { locale: ja })
  const fullMonthLabel = format(today, 'yyyy年M月', { locale: ja })

  const pendingRequests = leaveRequests.filter((r) => r.status === 'pending')

  const staffHours = useMemo(() =>
    staff.map((s) => ({
      ...s,
      hours: calcMonthlyHours(yearMonth, s.id, shifts, shiftPatterns),
    })),
    [staff, shifts, shiftPatterns, yearMonth]
  )

  const overStaff = staffHours.filter((s) => (s.hours / 4) > 40)
  const myData = staffHours.find((s) => s.id === currentStaffId)
  const myHours = myData?.hours ?? 0
  const myShiftsThisMonth = Object.keys(shifts[yearMonth]?.[currentStaffId ?? ''] ?? {}).length
  const myRequests = leaveRequests.filter((r) => r.staffId === currentStaffId)

  // 今日のシフト確認
  const todayDay = String(today.getDate())
  const myTodayEntry = shifts[yearMonth]?.[currentStaffId ?? '']?.[todayDay]
  const myTodayPattern = myTodayEntry ? shiftPatterns.find((p) => p.id === myTodayEntry.patternId) : null

  return (
    <div className="space-y-5 max-w-2xl mx-auto md:max-w-none">

      {/* あいさつヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">
            {currentRole === 'admin' ? 'こんにちは！' : `こんにちは、${myData?.name?.split(' ')[0] ?? ''}さん`}
            <span className="ml-1">{currentRole === 'admin' ? '👩‍💼' : '🌸'}</span>
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">{fullMonthLabel} — {orgSettings.name}</p>
        </div>
      </div>

      {currentRole === 'admin' ? (
        <>
          {/* アラート（優先表示） */}
          {(pendingRequests.length > 0 || overStaff.length > 0) && (
            <div className="space-y-2">
              {pendingRequests.length > 0 && (
                <Link to="/requests">
                  <div className="flex items-center gap-3 px-4 py-3.5 bg-amber-50 border border-amber-200 rounded-2xl">
                    <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-amber-800">未処理の申請が {pendingRequests.length} 件あります</p>
                      <p className="text-xs text-amber-600">タップして確認する</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-amber-400 shrink-0" />
                  </div>
                </Link>
              )}
              {overStaff.slice(0, 2).map((s) => (
                <div key={s.id} className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-2xl">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                  <p className="text-xs text-red-700 flex-1">{s.name}さん: 今月 {s.hours.toFixed(0)}h（週平均 {(s.hours / 4).toFixed(0)}h）</p>
                </div>
              ))}
            </div>
          )}

          {/* 統計カード */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              icon={<Users className="w-5 h-5 text-primary-500" />}
              label="職員数"
              value={`${staff.length}名`}
              bg="bg-orange-50"
            />
            <StatCard
              icon={<CalendarDays className="w-5 h-5 text-sky-500" />}
              label={`${monthLabel}シフト`}
              value={`${Object.keys(shifts[yearMonth] ?? {}).length}名分`}
              bg="bg-sky-50"
            />
            <StatCard
              icon={<ClipboardList className="w-5 h-5 text-violet-500" />}
              label="未処理申請"
              value={`${pendingRequests.length}件`}
              bg="bg-violet-50"
              alert={pendingRequests.length > 0}
            />
            <StatCard
              icon={<AlertTriangle className="w-5 h-5 text-amber-500" />}
              label="残業アラート"
              value={`${overStaff.length}名`}
              bg="bg-amber-50"
              alert={overStaff.length > 0}
            />
          </div>

          {/* クイックリンク */}
          <div className="space-y-2.5">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">クイックアクション</p>
            <QuickLink to="/shift"    icon="📅" label="シフト表を編集する"  desc={fullMonthLabel} color="bg-orange-100" />
            <QuickLink to="/requests" icon="📋" label="申請を確認する"      desc={`${pendingRequests.length}件 待ち`} color="bg-violet-100" badge={pendingRequests.length} />
            <QuickLink to="/staff"    icon="👥" label="職員を管理する"      desc={`${staff.length}名登録中`} color="bg-sky-100" />
          </div>

          {/* 今月の勤務時間 */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-700">{fullMonthLabel}の勤務時間</h2>
            </div>
            <div className="space-y-3">
              {staffHours.map((s) => {
                const isOver = (s.hours / 4) > 40
                const pct = Math.min(100, (s.hours / (s.weeklyHours * 4)) * 100)
                return (
                  <div key={s.id} className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                      style={{ backgroundColor: s.color }}
                    >
                      {s.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-700 truncate">{s.name}</span>
                        <span className={`text-sm font-bold shrink-0 ml-2 ${isOver ? 'text-red-500' : 'text-gray-700'}`}>
                          {s.hours.toFixed(0)}h
                        </span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all duration-500 ${isOver ? 'bg-red-400' : 'bg-primary-400'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      ) : (
        // 職員ダッシュボード
        <div className="space-y-4">

          {/* 今日のシフト */}
          <div className={`card border-2 ${myTodayPattern ? '' : 'border-gray-100'}`}
            style={myTodayPattern ? { borderColor: myTodayPattern.color + '60' } : {}}>
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-medium text-gray-500">今日のシフト</p>
              <span className="text-xs text-gray-400">{format(today, 'M月d日 (E)', { locale: ja })}</span>
            </div>
            {myTodayPattern ? (
              <div className="flex items-center gap-3 mt-2">
                <span
                  className="text-lg font-bold px-4 py-1.5 rounded-xl"
                  style={{ backgroundColor: myTodayPattern.bgColor, color: myTodayPattern.color }}
                >
                  {myTodayPattern.name}
                </span>
                {!myTodayPattern.isOff && (
                  <span className="text-sm text-gray-500">
                    {myTodayPattern.startTime} 〜 {myTodayPattern.endTime}
                  </span>
                )}
              </div>
            ) : (
              <p className="text-gray-400 text-sm mt-1">シフトが未登録です</p>
            )}
          </div>

          {/* 統計 */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              icon={<Clock className="w-5 h-5 text-primary-500" />}
              label={`${monthLabel}の勤務時間`}
              value={`${myHours.toFixed(0)}h`}
              bg="bg-orange-50"
            />
            <StatCard
              icon={<CalendarDays className="w-5 h-5 text-sky-500" />}
              label="シフト登録日数"
              value={`${myShiftsThisMonth}日`}
              bg="bg-sky-50"
            />
          </div>

          {/* クイックリンク */}
          <div className="space-y-2.5">
            <QuickLink to="/shift"      icon="📅" label="シフト表を確認する" desc={fullMonthLabel} color="bg-orange-100" />
            <QuickLink to="/my-request" icon="🙋" label="希望休を申請する"   desc="申請・確認" color="bg-green-100" badge={myRequests.filter((r) => r.status === 'pending').length} />
          </div>

          {/* 申請履歴 */}
          <div className="card">
            <h2 className="font-bold text-gray-700 mb-3">申請の状況</h2>
            {myRequests.length === 0 ? (
              <p className="text-sm text-gray-400 py-2">申請はまだありません</p>
            ) : (
              <div className="space-y-2">
                {myRequests.slice(0, 5).map((r) => (
                  <div key={r.id} className="flex items-center justify-between py-1.5">
                    <div>
                      <span className="text-sm text-gray-700 font-medium">{r.date}</span>
                      <span className="ml-2 text-xs text-gray-400">{r.type === 'paid' ? '有給' : '希望休'}</span>
                    </div>
                    <StatusBadge status={r.status} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// --- Sub components ---

function StatCard({ icon, label, value, bg, alert }: {
  icon: React.ReactNode; label: string; value: string; bg: string; alert?: boolean
}) {
  return (
    <div className={`card flex items-center gap-3 p-4 ${alert ? 'border-amber-200' : ''}`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${bg}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-400 truncate">{label}</p>
        <p className="text-xl font-bold text-gray-800 leading-tight">{value}</p>
      </div>
    </div>
  )
}

function QuickLink({ to, icon, label, desc, color, badge }: {
  to: string; icon: string; label: string; desc: string; color: string; badge?: number
}) {
  return (
    <Link
      to={to}
      className="card flex items-center gap-4 p-4 hover:shadow-md active:scale-[0.98] transition-all duration-150"
    >
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0 ${color}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-800 text-sm">{label}</p>
        <p className="text-xs text-gray-400 truncate">{desc}</p>
      </div>
      {badge != null && badge > 0 && (
        <span className="w-5 h-5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center shrink-0">
          {badge}
        </span>
      )}
      <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
    </Link>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending:  { label: '審査中', cls: 'bg-amber-100 text-amber-700' },
    approved: { label: '承認済', cls: 'bg-green-100 text-green-700' },
    rejected: { label: '却下',   cls: 'bg-red-100 text-red-700' },
  }
  const item = map[status] ?? map.pending
  return <span className={`badge ${item.cls}`}>{item.label}</span>
}
