import { useState } from 'react'
import { Plus, Pencil, Trash2, X, Save } from 'lucide-react'
import { useStore } from '../store/useStore'
import type { Staff, Employment, Role } from '../types'
import { STAFF_COLORS } from '../types'

const emptyForm: Omit<Staff, 'id'> = {
  name: '',
  role: 'staff',
  employment: 'fulltime',
  weeklyHours: 40,
  color: STAFF_COLORS[0],
  note: '',
}

export default function StaffPage() {
  const { staff, addStaff, updateStaff, deleteStaff } = useStore()
  const [editing, setEditing] = useState<Staff | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [form, setForm] = useState<Omit<Staff, 'id'>>(emptyForm)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const showForm = isNew || editing !== null

  function openNew() {
    setForm({ ...emptyForm, color: STAFF_COLORS[staff.length % STAFF_COLORS.length] })
    setIsNew(true)
    setEditing(null)
  }

  function openEdit(s: Staff) {
    setForm({ name: s.name, role: s.role, employment: s.employment, weeklyHours: s.weeklyHours, color: s.color, note: s.note })
    setEditing(s)
    setIsNew(false)
  }

  function handleSave() {
    if (!form.name.trim()) return
    if (isNew) {
      addStaff({ ...form, id: `s_${Date.now()}` })
      setIsNew(false)
    } else if (editing) {
      updateStaff(editing.id, form)
      setEditing(null)
    }
  }

  function handleDelete(id: string) {
    deleteStaff(id)
    setDeleteTarget(null)
  }

  return (
    <div className="space-y-5 max-w-2xl mx-auto md:max-w-none">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">職員管理</h1>
          <p className="text-xs text-gray-400 mt-0.5">職員の追加・編集・削除</p>
        </div>
        <button onClick={openNew} className="btn-primary text-sm px-4 py-2.5">
          <Plus className="w-4 h-4" />
          追加
        </button>
      </div>

      {/* 職員一覧 */}
      <div className="space-y-3">
        {staff.map((s) => (
          <div key={s.id} className="card p-4 flex items-center gap-3 hover:shadow-md transition-shadow">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-lg font-bold shrink-0"
              style={{ backgroundColor: s.color }}
            >
              {s.name[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-gray-800 text-base truncate">{s.name}</p>
              <div className="flex flex-wrap gap-1.5 mt-1">
                <span className={`badge text-xs ${s.role === 'admin' ? 'bg-orange-100 text-orange-700' : 'bg-sky-100 text-sky-700'}`}>
                  {s.role === 'admin' ? '管理者' : '職員'}
                </span>
                <span className={`badge text-xs ${s.employment === 'fulltime' ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'}`}>
                  {s.employment === 'fulltime' ? '正社員' : 'パート'}
                </span>
                <span className="badge text-xs bg-gray-100 text-gray-500">週{s.weeklyHours}h</span>
              </div>
              {s.note && <p className="text-xs text-gray-400 mt-0.5 truncate">{s.note}</p>}
            </div>
            <div className="flex gap-1 shrink-0">
              <button
                onClick={() => openEdit(s)}
                className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 active:bg-gray-200 transition-colors"
              >
                <Pencil className="w-4 h-4 text-gray-400" />
              </button>
              <button
                onClick={() => setDeleteTarget(s.id)}
                className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-red-50 active:bg-red-100 transition-colors"
              >
                <Trash2 className="w-4 h-4 text-red-400" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* 追加・編集フォーム（ボトムシート） */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center sm:items-center sm:p-4 bg-black/40">
          <div
            className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* ハンドル */}
            <div className="flex justify-center pt-3 pb-0 sm:hidden">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>

            <div className="px-5 pt-4 pb-2">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-bold text-gray-800 text-lg">
                  {isNew ? '職員を追加する' : '職員情報を編集'}
                </h2>
                <button
                  onClick={() => { setEditing(null); setIsNew(false) }}
                  className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <div className="space-y-4">
                {/* 氏名 */}
                <div>
                  <label className="label">氏名 <span className="text-red-400">*</span></label>
                  <input
                    className="input"
                    placeholder="例: 田中 花子"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>

                {/* ロール・雇用 */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">ロール</label>
                    <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
                      <option value="staff">職員</option>
                      <option value="admin">管理者</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">雇用形態</label>
                    <select className="input" value={form.employment} onChange={(e) => setForm({ ...form, employment: e.target.value as Employment })}>
                      <option value="fulltime">正社員</option>
                      <option value="parttime">パート</option>
                    </select>
                  </div>
                </div>

                {/* 週所定時間・メモ */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">週所定時間</label>
                    <input
                      type="number" className="input" min={1} max={40}
                      value={form.weeklyHours}
                      onChange={(e) => setForm({ ...form, weeklyHours: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="label">メモ</label>
                    <input
                      className="input" placeholder="例: 火・木のみ"
                      value={form.note}
                      onChange={(e) => setForm({ ...form, note: e.target.value })}
                    />
                  </div>
                </div>

                {/* カラー */}
                <div>
                  <label className="label">カラー</label>
                  <div className="flex flex-wrap gap-2.5 mt-1">
                    {STAFF_COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => setForm({ ...form, color: c })}
                        className={`w-9 h-9 rounded-full transition-all active:scale-90 ${form.color === c ? 'ring-3 ring-offset-2 ring-gray-400 scale-110' : 'hover:scale-105'}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <button
                onClick={handleSave}
                disabled={!form.name.trim()}
                className="mt-5 w-full btn-primary justify-center disabled:opacity-40 disabled:cursor-not-allowed text-base py-3.5"
              >
                <Save className="w-5 h-5" />
                {isNew ? '追加する' : '変更を保存する'}
              </button>
            </div>

            <div className="h-safe-bottom sm:hidden" />
            <div className="h-4 sm:hidden" />
          </div>
        </div>
      )}

      {/* 削除確認ダイアログ */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-5 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xs p-6 text-center animate-slide-up">
            <div className="text-4xl mb-3">🗑️</div>
            <h3 className="font-bold text-gray-800 mb-2">本当に削除しますか？</h3>
            <p className="text-sm text-gray-500 mb-5 leading-relaxed">
              <strong>{staff.find((s) => s.id === deleteTarget)?.name}</strong> さんのデータを削除します。<br />
              この操作は取り消せません。
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="btn-secondary flex-1 justify-center py-3">
                キャンセル
              </button>
              <button onClick={() => handleDelete(deleteTarget)} className="btn-danger flex-1 justify-center py-3">
                削除する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
