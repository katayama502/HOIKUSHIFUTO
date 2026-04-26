import { useState } from 'react'
import { Save, Plus, Trash2, Pencil } from 'lucide-react'
import { useStore } from '../store/useStore'
import type { ClassRoom, ShiftPattern } from '../types'
import { AGE_RATIO } from '../types'

const AGE_LABELS: Record<number, string> = {
  0: '0歳児', 1: '1歳児', 2: '2歳児', 3: '3歳児', 4: '4歳児', 5: '5歳児',
}

const BG_COLORS = [
  '#e0f2fe', '#dcfce7', '#ffedd5', '#f3f4f6', '#ede9fe', '#fae8ff', '#fee2e2', '#fef9c3',
]
const TEXT_COLORS = [
  '#0ea5e9', '#16a34a', '#ea580c', '#6b7280', '#8b5cf6', '#d946ef', '#ef4444', '#ca8a04',
]

export default function SettingsPage() {
  const {
    orgSettings, updateOrgSettings,
    classRooms, addClassRoom, updateClassRoom, deleteClassRoom,
    shiftPatterns, addShiftPattern, updateShiftPattern, deleteShiftPattern,
  } = useStore()

  const [orgForm, setOrgForm] = useState(orgSettings)
  const [orgSaved, setOrgSaved] = useState(false)

  const [editingClass, setEditingClass] = useState<ClassRoom | null>(null)
  const [newClass, setNewClass] = useState(false)
  const [classForm, setClassForm] = useState<Omit<ClassRoom, 'id'>>({ name: '', ageGroup: 0, childrenCount: 0 })

  const [editingPattern, setEditingPattern] = useState<ShiftPattern | null>(null)
  const [newPattern, setNewPattern] = useState(false)
  const [patternForm, setPatternForm] = useState<Omit<ShiftPattern, 'id'>>({
    name: '', startTime: '08:00', endTime: '17:00', color: TEXT_COLORS[0], bgColor: BG_COLORS[0], isOff: false,
  })

  function saveOrg() {
    updateOrgSettings(orgForm)
    setOrgSaved(true)
    setTimeout(() => setOrgSaved(false), 2000)
  }

  function saveClass() {
    if (!classForm.name) return
    if (newClass) {
      addClassRoom({ ...classForm, id: `c_${Date.now()}` })
      setNewClass(false)
    } else if (editingClass) {
      updateClassRoom(editingClass.id, classForm)
      setEditingClass(null)
    }
  }

  function savePattern() {
    if (!patternForm.name) return
    if (newPattern) {
      addShiftPattern({ ...patternForm, id: `p_${Date.now()}` })
      setNewPattern(false)
    } else if (editingPattern) {
      updateShiftPattern(editingPattern.id, patternForm)
      setEditingPattern(null)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold text-gray-800">設定</h1>
        <p className="text-sm text-gray-500 mt-0.5">保育園の基本情報・クラス・シフトパターンを設定できます</p>
      </div>

      {/* Org settings */}
      <section className="card space-y-4">
        <h2 className="font-bold text-gray-700 text-base">🏫 保育園情報</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label">園名</label>
            <input className="input" value={orgForm.name} onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })} />
          </div>
          <div>
            <label className="label">希望休申請の締め切り（毎月 〇日）</label>
            <input type="number" className="input" min={1} max={28} value={orgForm.requestDeadline}
              onChange={(e) => setOrgForm({ ...orgForm, requestDeadline: Number(e.target.value) })} />
          </div>
          <div>
            <label className="label">開園時間</label>
            <input type="time" className="input" value={orgForm.openTime}
              onChange={(e) => setOrgForm({ ...orgForm, openTime: e.target.value })} />
          </div>
          <div>
            <label className="label">閉園時間</label>
            <input type="time" className="input" value={orgForm.closeTime}
              onChange={(e) => setOrgForm({ ...orgForm, closeTime: e.target.value })} />
          </div>
        </div>
        <button onClick={saveOrg} className="btn-primary">
          <Save className="w-4 h-4" />
          {orgSaved ? '保存しました ✓' : '保存する'}
        </button>
      </section>

      {/* Class rooms */}
      <section className="card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-gray-700 text-base">👶 クラス設定</h2>
          <button onClick={() => { setClassForm({ name: '', ageGroup: 0, childrenCount: 0 }); setNewClass(true); setEditingClass(null) }} className="btn-secondary text-sm px-3 py-2">
            <Plus className="w-4 h-4" />
            追加
          </button>
        </div>
        <p className="text-xs text-gray-400">各クラスの在籍児童数から必要最低保育士数を自動計算します</p>

        {(newClass || editingClass) && (
          <div className="bg-orange-50 rounded-xl p-4 space-y-3 border border-orange-200">
            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <label className="label">クラス名</label>
                <input className="input" value={classForm.name} onChange={(e) => setClassForm({ ...classForm, name: e.target.value })} />
              </div>
              <div>
                <label className="label">年齢</label>
                <select className="input" value={classForm.ageGroup} onChange={(e) => setClassForm({ ...classForm, ageGroup: Number(e.target.value) as ClassRoom['ageGroup'] })}>
                  {[0,1,2,3,4,5].map((a) => <option key={a} value={a}>{AGE_LABELS[a]}</option>)}
                </select>
              </div>
              <div>
                <label className="label">児童数</label>
                <input type="number" className="input" min={0} value={classForm.childrenCount}
                  onChange={(e) => setClassForm({ ...classForm, childrenCount: Number(e.target.value) })} />
              </div>
            </div>
            <div className="text-xs text-gray-500">
              必要保育士数: {Math.ceil(classForm.childrenCount / (AGE_RATIO[classForm.ageGroup] ?? 6))} 名（配置基準: {AGE_RATIO[classForm.ageGroup]}:1）
            </div>
            <div className="flex gap-2">
              <button onClick={saveClass} className="btn-primary text-sm px-4 py-2">保存</button>
              <button onClick={() => { setNewClass(false); setEditingClass(null) }} className="btn-secondary text-sm px-4 py-2">キャンセル</button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {classRooms.map((cr) => {
            const ratio = AGE_RATIO[cr.ageGroup] ?? 6
            const required = Math.ceil(cr.childrenCount / ratio)
            return (
              <div key={cr.id} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-50">
                <span className="text-xl">{['🍼','🧒','🧒','👧','👦','🧑'][cr.ageGroup]}</span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-700">{cr.name}</p>
                  <p className="text-xs text-gray-400">児童 {cr.childrenCount}名 → 保育士 {required}名以上必要（{ratio}:1）</p>
                </div>
                <button onClick={() => { setClassForm({ name: cr.name, ageGroup: cr.ageGroup, childrenCount: cr.childrenCount }); setEditingClass(cr); setNewClass(false) }}
                  className="p-1.5 hover:bg-gray-200 rounded-lg">
                  <Pencil className="w-4 h-4 text-gray-400" />
                </button>
                <button onClick={() => deleteClassRoom(cr.id)} className="p-1.5 hover:bg-red-50 rounded-lg">
                  <Trash2 className="w-4 h-4 text-red-400" />
                </button>
              </div>
            )
          })}
        </div>
      </section>

      {/* Shift patterns */}
      <section className="card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-gray-700 text-base">🕐 シフトパターン</h2>
          <button onClick={() => { setPatternForm({ name: '', startTime: '08:00', endTime: '17:00', color: TEXT_COLORS[0], bgColor: BG_COLORS[0], isOff: false }); setNewPattern(true); setEditingPattern(null) }} className="btn-secondary text-sm px-3 py-2">
            <Plus className="w-4 h-4" />
            追加
          </button>
        </div>

        {(newPattern || editingPattern) && (
          <div className="bg-orange-50 rounded-xl p-4 space-y-3 border border-orange-200">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="label">パターン名</label>
                <input className="input" value={patternForm.name} onChange={(e) => setPatternForm({ ...patternForm, name: e.target.value })} />
              </div>
              <div className="flex items-center gap-2 pt-5">
                <input type="checkbox" id="isOff" checked={patternForm.isOff}
                  onChange={(e) => setPatternForm({ ...patternForm, isOff: e.target.checked })} />
                <label htmlFor="isOff" className="text-sm text-gray-600">休み扱い（労働時間0）</label>
              </div>
              {!patternForm.isOff && (
                <>
                  <div>
                    <label className="label">開始時間</label>
                    <input type="time" className="input" value={patternForm.startTime}
                      onChange={(e) => setPatternForm({ ...patternForm, startTime: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">終了時間</label>
                    <input type="time" className="input" value={patternForm.endTime}
                      onChange={(e) => setPatternForm({ ...patternForm, endTime: e.target.value })} />
                  </div>
                </>
              )}
              <div>
                <label className="label">背景色</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {BG_COLORS.map((c, i) => (
                    <button key={c} onClick={() => setPatternForm({ ...patternForm, bgColor: c, color: TEXT_COLORS[i] })}
                      className={`w-7 h-7 rounded-lg border-2 transition-transform hover:scale-110 ${patternForm.bgColor === c ? 'border-gray-500 scale-110' : 'border-transparent'}`}
                      style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <label className="label">プレビュー:</label>
                <span className="badge text-sm px-3 py-1" style={{ backgroundColor: patternForm.bgColor, color: patternForm.color }}>
                  {patternForm.name || 'パターン名'}
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={savePattern} className="btn-primary text-sm px-4 py-2">保存</button>
              <button onClick={() => { setNewPattern(false); setEditingPattern(null) }} className="btn-secondary text-sm px-4 py-2">キャンセル</button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {shiftPatterns.map((p) => (
            <div key={p.id} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-50">
              <span className="badge text-sm px-3 py-1 min-w-[60px] text-center"
                style={{ backgroundColor: p.bgColor, color: p.color }}>
                {p.name}
              </span>
              <div className="flex-1 text-xs text-gray-400">
                {p.isOff ? '休み（労働時間なし）' : `${p.startTime} 〜 ${p.endTime}`}
              </div>
              <button onClick={() => { setPatternForm({ name: p.name, startTime: p.startTime, endTime: p.endTime, color: p.color, bgColor: p.bgColor, isOff: p.isOff }); setEditingPattern(p); setNewPattern(false) }}
                className="p-1.5 hover:bg-gray-200 rounded-lg">
                <Pencil className="w-4 h-4 text-gray-400" />
              </button>
              <button onClick={() => deleteShiftPattern(p.id)} className="p-1.5 hover:bg-red-50 rounded-lg">
                <Trash2 className="w-4 h-4 text-red-400" />
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
