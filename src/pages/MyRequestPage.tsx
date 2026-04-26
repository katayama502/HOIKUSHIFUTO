import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { format } from 'date-fns'
import { useStore } from '../store/useStore'
import type { LeaveRequest } from '../types'

export default function MyRequestPage() {
  const { leaveRequests, addLeaveRequest, currentStaffId } = useStore()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ date: '', type: 'dayoff' as 'dayoff' | 'paid', reason: '' })

  const myRequests = leaveRequests
    .filter((r) => r.staffId === currentStaffId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  const pendingCount = myRequests.filter((r) => r.status === 'pending').length

  function handleSubmit() {
    if (!form.date || !currentStaffId) return
    const req: LeaveRequest = {
      id: `req_${Date.now()}`,
      staffId: currentStaffId,
      date: form.date,
      type: form.type,
      reason: form.reason,
      status: 'pending',
      createdAt: new Date().toISOString(),
    }
    addLeaveRequest(req)
    setForm({ date: '', type: 'dayoff', reason: '' })
    setShowForm(false)
  }

  return (
    <div className="space-y-5 max-w-lg mx-auto md:max-w-none">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">希望休・有給申請</h1>
          <p className="text-xs text-gray-400 mt-0.5">お休みの申請ができます</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary text-sm px-4 py-2.5">
          <Plus className="w-4 h-4" />
          申請する
        </button>
      </div>

      {/* サマリー */}
      {pendingCount > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-2xl">
          <span className="text-lg">⏳</span>
          <p className="text-sm text-amber-800 font-medium">審査中の申請が {pendingCount} 件あります</p>
        </div>
      )}

      {/* 申請履歴 */}
      {myRequests.length === 0 ? (
        <div className="card text-center py-16">
          <div className="text-5xl mb-4">🌼</div>
          <p className="text-gray-600 font-medium">申請はまだありません</p>
          <p className="text-sm text-gray-400 mt-1">「申請する」ボタンからお休みを申請しましょう</p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-5 btn-primary mx-auto"
          >
            <Plus className="w-4 h-4" />
            さっそく申請する
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {myRequests.map((r) => (
            <div key={r.id} className="card p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 ${r.type === 'paid' ? 'bg-violet-100' : 'bg-sky-100'}`}>
                {r.type === 'paid' ? '📝' : '🙏'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-800">{r.date}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {r.type === 'paid' ? '有給休暇' : '希望休'}
                  {r.reason && ` · ${r.reason}`}
                </p>
              </div>
              <StatusBadge status={r.status} />
            </div>
          ))}
        </div>
      )}

      {/* 申請フォーム（ボトムシート） */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center sm:items-center sm:p-4 bg-black/40"
          onClick={() => setShowForm(false)}
        >
          <div
            className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-sm animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* ハンドル */}
            <div className="flex justify-center pt-3 pb-0 sm:hidden">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>

            <div className="px-5 pt-4 pb-2">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-bold text-gray-800 text-lg">お休みを申請する</h3>
                <button
                  onClick={() => setShowForm(false)}
                  className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <div className="space-y-5">
                {/* 日付 */}
                <div>
                  <label className="label">申請する日 <span className="text-red-400">*</span></label>
                  <input
                    type="date"
                    className="input"
                    value={form.date}
                    min={format(new Date(), 'yyyy-MM-dd')}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                  />
                </div>

                {/* 種類 */}
                <div>
                  <label className="label">休みの種類</label>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      onClick={() => setForm({ ...form, type: 'dayoff' })}
                      className={`py-4 rounded-2xl border-2 text-sm font-medium transition-all active:scale-95 ${
                        form.type === 'dayoff'
                          ? 'bg-sky-50 border-sky-400 text-sky-700 shadow-sm'
                          : 'border-gray-200 text-gray-500 bg-white hover:border-gray-300'
                      }`}
                    >
                      <div className="text-2xl mb-1">🙏</div>
                      希望休
                    </button>
                    <button
                      onClick={() => setForm({ ...form, type: 'paid' })}
                      className={`py-4 rounded-2xl border-2 text-sm font-medium transition-all active:scale-95 ${
                        form.type === 'paid'
                          ? 'bg-violet-50 border-violet-400 text-violet-700 shadow-sm'
                          : 'border-gray-200 text-gray-500 bg-white hover:border-gray-300'
                      }`}
                    >
                      <div className="text-2xl mb-1">📝</div>
                      有給休暇
                    </button>
                  </div>
                </div>

                {/* 理由 */}
                <div>
                  <label className="label">理由（任意）</label>
                  <textarea
                    className="input resize-none"
                    rows={2}
                    placeholder="例: 通院のため"
                    value={form.reason}
                    onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  />
                </div>
              </div>

              <button
                onClick={handleSubmit}
                disabled={!form.date}
                className="mt-5 w-full btn-primary justify-center text-base py-3.5 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                申請を送る 🌸
              </button>
            </div>

            <div className="h-safe-bottom sm:hidden" />
            <div className="h-4 sm:hidden" />
          </div>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending:  { label: '審査中 ⏳', cls: 'bg-amber-100 text-amber-700' },
    approved: { label: '承認済 ✅', cls: 'bg-green-100 text-green-700' },
    rejected: { label: '却下 ❌',   cls: 'bg-red-100 text-red-700' },
  }
  const item = map[status] ?? map.pending
  return <span className={`badge text-xs ${item.cls}`}>{item.label}</span>
}
