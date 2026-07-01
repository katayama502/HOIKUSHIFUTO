import { useState, useEffect } from 'react'
import { X, Save, Trash2, UserPlus, AlertTriangle, SlidersHorizontal } from 'lucide-react'
import { useStore } from '../store/useStore'
import { STAFF_COLORS } from '../types'
import type { Staff, Employment, Role } from '../types'

const DAY_LABELS = ['日', '月', '火', '水', '木', '金', '土']

interface Props {
  open: boolean
  staffId: string | null   // null = 新規追加モード
  onClose: () => void
  onOpenConstraints?: (staffId: string) => void
}

const emptyForm: Omit<Staff, 'id'> = {
  name: '',
  role: 'staff',
  employment: 'fulltime',
  weeklyHours: 40,
  color: STAFF_COLORS[0],
  note: '',
}

export default function StaffPanel({ open, staffId, onClose, onOpenConstraints }: Props) {
  const { staff, addStaff, updateStaff, deleteStaff, staffConstraints, setStaffConstraint } = useStore()
  const isNew = staffId === null
  const target = staff.find((s) => s.id === staffId) ?? null

  const [form, setForm] = useState<Omit<Staff, 'id'>>(emptyForm)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [saved, setSaved] = useState(false)
  const [availDays, setAvailDays] = useState<number[]>([1, 2, 3, 4, 5])

  // フォームをリセット（パネルが開くたびに）
  useEffect(() => {
    if (!open) {
      setDeleteConfirm(false)
      setSaved(false)
      return
    }
    if (isNew) {
      setForm({
        ...emptyForm,
        color: STAFF_COLORS[staff.length % STAFF_COLORS.length],
      })
      setAvailDays([1, 2, 3, 4, 5])
    } else if (target) {
      setForm({
        name: target.name,
        role: target.role,
        employment: target.employment,
        weeklyHours: target.weeklyHours,
        color: target.color,
        note: target.note,
      })
      const existing = staffConstraints[target.id]
      setAvailDays(existing?.availableDays ?? [1, 2, 3, 4, 5])
    }
  }, [open, staffId]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleSave() {
    if (!form.name.trim()) return
    const id = isNew ? `s_${Date.now()}` : target!.id
    if (isNew) {
      addStaff({ ...form, id })
      setStaffConstraint(id, { availableDays: availDays })
    } else if (target) {
      updateStaff(target.id, form)
      setStaffConstraint(target.id, { availableDays: availDays })
    }
    setSaved(true)
    setTimeout(() => {
      setSaved(false)
      onClose()
    }, 600)
  }

  function handleDelete() {
    if (!target) return
    deleteStaff(target.id)
    onClose()
  }

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Panel: right drawer on desktop, bottom sheet on mobile */}
      <div
        className={`
          fixed z-50 bg-white shadow-2xl flex flex-col
          /* mobile: bottom sheet */
          inset-x-0 bottom-0 rounded-t-3xl max-h-[92dvh]
          /* desktop: right panel */
          md:inset-x-auto md:right-0 md:top-0 md:bottom-0 md:h-full md:w-96 md:rounded-none md:rounded-l-3xl
          animate-slide-up md:animate-none
        `}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle (mobile only) */}
        <div className="flex justify-center pt-3 pb-1 md:hidden shrink-0">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-3 pb-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2.5">
            {isNew ? (
              <div className="w-9 h-9 rounded-xl bg-primary-50 flex items-center justify-center">
                <UserPlus className="w-5 h-5 text-primary-500" />
              </div>
            ) : (
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm"
                style={{ backgroundColor: form.color }}
              >
                {form.name?.[0] ?? '?'}
              </div>
            )}
            <div>
              <h2 className="font-bold text-gray-800 text-base leading-tight">
                {isNew ? '職員を追加' : '職員情報を編集'}
              </h2>
              {!isNew && target && (
                <p className="text-xs text-gray-400 leading-tight">{target.name}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 active:scale-90 transition-all"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

          {/* Preview card */}
          <div
            className="flex items-center gap-3 p-3.5 rounded-2xl border-2 transition-all"
            style={{ borderColor: form.color + '44', backgroundColor: form.color + '0d' }}
          >
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center text-white text-lg font-bold shrink-0"
              style={{ backgroundColor: form.color }}
            >
              {form.name ? form.name[0] : '?'}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-gray-800 truncate">{form.name || '（氏名未入力）'}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${form.employment === 'fulltime' ? 'bg-sky-100 text-sky-600' : 'bg-violet-100 text-violet-600'}`}>
                  {form.employment === 'fulltime' ? '正社員' : 'パート'}
                </span>
                <span className="text-[10px] text-gray-400">週{form.weeklyHours}h / 月{Math.round(form.weeklyHours * 4.3)}h目安</span>
              </div>
            </div>
          </div>

          {/* 氏名 */}
          <div>
            <label className="label">氏名 <span className="text-red-400">*</span></label>
            <input
              className="input"
              placeholder="例: 田中 花子"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              autoFocus={isNew}
            />
          </div>

          {/* ロール・雇用形態 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">ロール</label>
              <select
                className="input"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
              >
                <option value="staff">職員</option>
                <option value="manager">主任・副主任</option>
                <option value="admin">管理者（理事長・園長）</option>
              </select>
            </div>
            <div>
              <label className="label">雇用形態</label>
              <select
                className="input"
                value={form.employment}
                onChange={(e) => {
                  const emp = e.target.value as Employment
                  setForm({ ...form, employment: emp, weeklyHours: emp === 'fulltime' ? 40 : 20 })
                }}
              >
                <option value="fulltime">正社員</option>
                <option value="parttime">パート</option>
              </select>
            </div>
          </div>

          {/* 管理職ヒント */}
          {(form.role === 'admin' || form.role === 'manager') && (
            <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 mt-1">
              管理職は自動シフト作成時、早番・遅番には配置されません
            </p>
          )}

          {/* 出勤可能曜日 */}
          <div>
            <label className="label">出勤可能曜日</label>
            <div className="flex gap-1.5 mt-1.5">
              {DAY_LABELS.map((label, dow) => (
                <button
                  key={dow}
                  type="button"
                  onClick={() => {
                    const next = availDays.includes(dow)
                      ? availDays.filter(d => d !== dow)
                      : [...availDays, dow].sort((a, b) => a - b)
                    setAvailDays(next)
                  }}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                    availDays.includes(dow)
                      ? dow === 0 || dow === 6
                        ? 'bg-red-100 text-red-600 ring-1 ring-red-300'
                        : 'bg-primary-100 text-primary-700 ring-1 ring-primary-300'
                      : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-1">土日は通常、自動配置から除外することを推奨します</p>
          </div>

          {/* 週所定時間・メモ */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">週所定時間</label>
              <input
                type="number"
                className="input"
                min={1}
                max={40}
                value={form.weeklyHours}
                onChange={(e) => setForm({ ...form, weeklyHours: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="label">メモ</label>
              <input
                className="input"
                placeholder="例: 火・木のみ"
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
              />
            </div>
          </div>

          {/* カラー */}
          <div>
            <label className="label">カラー</label>
            <div className="flex flex-wrap gap-2.5 mt-1.5">
              {STAFF_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setForm({ ...form, color: c })}
                  className={`w-9 h-9 rounded-full transition-all active:scale-90 cursor-pointer ${
                    form.color === c
                      ? 'ring-3 ring-offset-2 ring-gray-400 scale-110'
                      : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: c }}
                  aria-label={`カラー: ${c}`}
                />
              ))}
            </div>
          </div>

          {/* 出勤条件リンク (既存職員のみ) */}
          {!isNew && target && onOpenConstraints && (
            <button
              onClick={() => { onClose(); onOpenConstraints(target.id) }}
              className="w-full flex items-center gap-2 px-4 py-3 rounded-2xl border border-gray-200 hover:bg-gray-50 active:bg-gray-100 transition-all cursor-pointer"
            >
              <SlidersHorizontal className="w-4 h-4 text-green-500 shrink-0" />
              <span className="text-sm text-gray-700 font-medium">出勤条件設定を開く</span>
              <span className="ml-auto text-gray-300">›</span>
            </button>
          )}

          {/* 削除 (既存職員のみ) */}
          {!isNew && target && (
            <div>
              {!deleteConfirm ? (
                <button
                  onClick={() => setDeleteConfirm(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-red-500 border border-red-100 hover:bg-red-50 active:bg-red-100 transition-all text-sm font-medium cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  この職員を削除する
                </button>
              ) : (
                <div className="p-4 rounded-2xl bg-red-50 border border-red-100 space-y-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                    <p className="text-sm text-red-700 leading-relaxed">
                      <strong>{target.name}</strong> を削除します。<br />
                      シフトデータは残りますが、この操作は取り消せません。
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setDeleteConfirm(false)}
                      className="flex-1 py-2.5 rounded-xl bg-white border border-gray-200 text-sm text-gray-600 font-medium active:scale-95 transition-all cursor-pointer"
                    >
                      キャンセル
                    </button>
                    <button
                      onClick={handleDelete}
                      className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-bold active:scale-95 transition-all cursor-pointer"
                    >
                      削除する
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* safe area */}
          <div className="h-4" />
        </div>

        {/* Footer: Save button */}
        <div className="shrink-0 px-5 pt-3 pb-4 border-t border-gray-100 bg-white">
          <div className="h-safe-bottom md:hidden" />
          <button
            onClick={handleSave}
            disabled={!form.name.trim()}
            className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-base transition-all active:scale-95 cursor-pointer ${
              saved
                ? 'bg-green-500 text-white'
                : 'btn-primary disabled:opacity-40 disabled:cursor-not-allowed'
            }`}
          >
            <Save className="w-5 h-5" />
            {saved ? '保存しました！' : isNew ? '追加する' : '変更を保存する'}
          </button>
        </div>
      </div>
    </>
  )
}
