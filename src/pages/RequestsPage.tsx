import { useState } from 'react'
import { CheckCircle, XCircle, Clock } from 'lucide-react'
import { useStore } from '../store/useStore'

type FilterType = 'all' | 'pending' | 'approved' | 'rejected'

export default function RequestsPage() {
  const { leaveRequests, updateLeaveRequest, staff, currentRole } = useStore()
  const [filter, setFilter] = useState<FilterType>('all')

  const filtered = leaveRequests
    .filter((r) => filter === 'all' || r.status === filter)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  const staffMap = Object.fromEntries(staff.map((s) => [s.id, s]))
  const pendingCount = leaveRequests.filter((r) => r.status === 'pending').length

  const tabs: { key: FilterType; label: string; count: number }[] = [
    { key: 'all',      label: 'すべて', count: leaveRequests.length },
    { key: 'pending',  label: '審査中', count: pendingCount },
    { key: 'approved', label: '承認済', count: leaveRequests.filter((r) => r.status === 'approved').length },
    { key: 'rejected', label: '却下',   count: leaveRequests.filter((r) => r.status === 'rejected').length },
  ]

  return (
    <div className="space-y-5 max-w-2xl mx-auto md:max-w-none">
      <div>
        <h1 className="text-xl font-bold text-gray-800">申請一覧</h1>
        <p className="text-xs text-gray-400 mt-0.5">希望休・有給の承認・却下ができます</p>
      </div>

      {/* フィルタータブ */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 md:mx-0 md:px-0 no-scrollbar">
        {tabs.map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-colors shrink-0
              ${filter === key
                ? 'bg-primary-500 text-white shadow-sm'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
          >
            {label}
            {count > 0 && (
              <span className={`text-xs rounded-full px-1.5 py-0.5 min-w-[18px] text-center ${filter === key ? 'bg-white/30' : 'bg-gray-100 text-gray-500'}`}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* リスト */}
      {filtered.length === 0 ? (
        <div className="card text-center py-16">
          <div className="text-5xl mb-3">📭</div>
          <p className="text-gray-400 font-medium">申請はありません</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => {
            const s = staffMap[r.staffId]
            return (
              <div key={r.id} className="card p-4">
                <div className="flex items-start gap-3">
                  {s && (
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold shrink-0 text-base"
                      style={{ backgroundColor: s.color }}
                    >
                      {s.name[0]}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-bold text-gray-800 truncate">{s?.name ?? '不明'}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <span className={`badge text-xs ${r.type === 'paid' ? 'bg-violet-100 text-violet-700' : 'bg-sky-100 text-sky-700'}`}>
                            {r.type === 'paid' ? '有給休暇' : '希望休'}
                          </span>
                          <span className="text-sm font-medium text-gray-700">{r.date}</span>
                        </div>
                        {r.reason && (
                          <p className="text-xs text-gray-500 mt-1">理由: {r.reason}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-0.5">申請日: {r.createdAt.slice(0, 10)}</p>
                      </div>
                      <StatusBadge status={r.status} />
                    </div>

                    {/* 承認・却下ボタン */}
                    {currentRole === 'admin' && r.status === 'pending' && (
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => updateLeaveRequest(r.id, { status: 'approved' })}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-green-500 hover:bg-green-600 active:bg-green-700 text-white text-sm font-medium rounded-xl transition-colors"
                        >
                          <CheckCircle className="w-4 h-4" />
                          承認する
                        </button>
                        <button
                          onClick={() => updateLeaveRequest(r.id, { status: 'rejected' })}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-red-500 hover:bg-red-600 active:bg-red-700 text-white text-sm font-medium rounded-xl transition-colors"
                        >
                          <XCircle className="w-4 h-4" />
                          却下する
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; icon: React.ReactNode; cls: string }> = {
    pending:  { label: '審査中', icon: <Clock className="w-3 h-3" />,       cls: 'bg-amber-100 text-amber-700' },
    approved: { label: '承認済', icon: <CheckCircle className="w-3 h-3" />, cls: 'bg-green-100 text-green-700' },
    rejected: { label: '却下',   icon: <XCircle className="w-3 h-3" />,     cls: 'bg-red-100 text-red-700' },
  }
  const item = map[status] ?? map.pending
  return (
    <span className={`badge flex items-center gap-1 shrink-0 ${item.cls}`}>
      {item.icon}
      {item.label}
    </span>
  )
}
