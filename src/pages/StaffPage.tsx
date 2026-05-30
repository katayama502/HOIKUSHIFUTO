import { useState, useMemo } from 'react'
import { Plus, Pencil, Trash2, X, Save, Search, Copy, Users, Briefcase, Clock } from 'lucide-react'
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

type FilterEmployment = 'all' | Employment

export default function StaffPage() {
  const { staff, addStaff, updateStaff, deleteStaff } = useStore()
  const [editing, setEditing] = useState<Staff | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [form, setForm] = useState<Omit<Staff, 'id'>>(emptyForm)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  // Search & filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [filterEmployment, setFilterEmployment] = useState<FilterEmployment>('all')

  const showForm = isNew || editing !== null

  // Stats
  const fulltimeCount = staff.filter((s) => s.employment === 'fulltime').length
  const parttimeCount = staff.filter((s) => s.employment === 'parttime').length
  const adminCount = staff.filter((s) => s.role === 'admin').length

  // Filtered staff list
  const filteredStaff = useMemo(() => {
    return staff.filter((s) => {
      const matchesSearch = searchQuery === '' ||
        s.name.includes(searchQuery) ||
        (s.note && s.note.includes(searchQuery))
      const matchesEmployment = filterEmployment === 'all' || s.employment === filterEmployment
      return matchesSearch && matchesEmployment
    })
  }, [staff, searchQuery, filterEmployment])

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

  function openCopy(s: Staff) {
    setForm({
      name: `${s.name}（コピー）`,
      role: s.role,
      employment: s.employment,
      weeklyHours: s.weeklyHours,
      color: STAFF_COLORS[(staff.length) % STAFF_COLORS.length],
      note: s.note,
    })
    setIsNew(true)
    setEditing(null)
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

      {/* Header */}
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

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
            <Users className="w-4 h-4 text-blue-500" />
          </div>
          <div>
            <p className="text-xs text-gray-400">総職員数</p>
            <p className="text-lg font-bold text-gray-800">{staff.length}<span className="text-xs font-normal text-gray-400 ml-0.5">名</span></p>
          </div>
        </div>
        <div className="card p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center shrink-0">
            <Briefcase className="w-4 h-4 text-green-500" />
          </div>
          <div>
            <p className="text-xs text-gray-400">正社員</p>
            <p className="text-lg font-bold text-gray-800">{fulltimeCount}<span className="text-xs font-normal text-gray-400 ml-0.5">名</span></p>
          </div>
        </div>
        <div className="card p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4 text-purple-500" />
          </div>
          <div>
            <p className="text-xs text-gray-400">パート</p>
            <p className="text-lg font-bold text-gray-800">{parttimeCount}<span className="text-xs font-normal text-gray-400 ml-0.5">名</span></p>
          </div>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex gap-2 items-center">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            className="input pl-9"
            placeholder="名前・メモで検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full bg-gray-200 hover:bg-gray-300 transition-colors"
            >
              <X className="w-3 h-3 text-gray-500" />
            </button>
          )}
        </div>
        <div className="flex gap-1 shrink-0">
          {(['all', 'fulltime', 'parttime'] as FilterEmployment[]).map((v) => (
            <button
              key={v}
              onClick={() => setFilterEmployment(v)}
              className={`px-3 py-2.5 rounded-xl text-xs font-medium transition-colors border ${
                filterEmployment === v
                  ? 'bg-primary-500 text-white border-primary-500'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {v === 'all' ? 'すべて' : v === 'fulltime' ? '正社員' : 'パート'}
            </button>
          ))}
        </div>
      </div>

      {/* 管理者表示 */}
      {adminCount > 0 && filterEmployment === 'all' && !searchQuery && (
        <p className="text-xs text-orange-500">
          👩‍💼 管理者が {adminCount} 名含まれています
        </p>
      )}

      {/* 検索結果なし */}
      {filteredStaff.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">
            {searchQuery ? `「${searchQuery}」に一致する職員が見つかりません` : '該当する職員がいません'}
          </p>
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="mt-2 text-xs text-primary-500 hover:underline">
              検索をクリア
            </button>
          )}
        </div>
      )}

      {/* 職員一覧 */}
      <div className="space-y-3">
        {filteredStaff.map((s) => (
          <div key={s.id} className="card p-4 flex items-center gap-3 hover:shadow-md transition-shadow">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-lg font-bold shrink-0"
              style={{ backgroundColor: s.color }}
            >
              {s.name[0]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-bold text-gray-800 text-base truncate">{s.name}</p>
                {s.role === 'admin' && (
                  <span className="shrink-0 text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-medium">管理者</span>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 mt-1">
                <span className={`badge text-xs ${s.employment === 'fulltime' ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'}`}>
                  {s.employment === 'fulltime' ? '正社員' : 'パート'}
                </span>
                <span className="badge text-xs bg-gray-100 text-gray-500">週{s.weeklyHours}h</span>
                {s.weeklyHours >= 40 && (
                  <span className="badge text-xs bg-blue-50 text-blue-500">フルタイム</span>
                )}
              </div>
              {s.note && <p className="text-xs text-gray-400 mt-1 truncate">📝 {s.note}</p>}
            </div>
            <div className="flex gap-1 shrink-0">
              <button
                onClick={() => openCopy(s)}
                className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-blue-50 active:bg-blue-100 transition-colors"
                title="この職員をコピー"
              >
                <Copy className="w-4 h-4 text-blue-400" />
              </button>
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
                    <select className="input" value={form.employment}
                      onChange={(e) => {
                        const emp = e.target.value as Employment
                        setForm({ ...form, employment: emp, weeklyHours: emp === 'fulltime' ? 40 : 20 })
                      }}>
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
                    <p className="text-xs text-gray-400 mt-1">
                      月間目安: 約{Math.round(form.weeklyHours * 4.3)}h
                    </p>
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
                  {/* Preview */}
                  <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-xl">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold shrink-0"
                      style={{ backgroundColor: form.color }}
                    >
                      {form.name ? form.name[0] : '?'}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700">{form.name || '（氏名未入力）'}</p>
                      <p className="text-xs text-gray-400">{form.employment === 'fulltime' ? '正社員' : 'パート'} / 週{form.weeklyHours}h</p>
                    </div>
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
