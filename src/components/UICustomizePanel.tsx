import { useEffect, useRef } from 'react'
import { X, Palette, Monitor, Type, Calendar, Pin } from 'lucide-react'
import { useStore } from '../store/useStore'
import type { UISettings } from '../types'

interface Props {
  open: boolean
  onClose: () => void
}

const THEMES: { value: UISettings['theme']; label: string; primary: string; light: string }[] = [
  { value: 'warm',   label: '温かみオレンジ', primary: '#f97316', light: '#fed7aa' },
  { value: 'cool',   label: 'クールブルー',   primary: '#0891b2', light: '#cffafe' },
  { value: 'green',  label: 'ナチュラルグリーン', primary: '#16a34a', light: '#dcfce7' },
  { value: 'purple', label: 'やさしいパープル', primary: '#7c3aed', light: '#ede9fe' },
]

const DENSITIES: { value: UISettings['density']; label: string; desc: string }[] = [
  { value: 'compact',  label: 'コンパクト', desc: '情報量を多く' },
  { value: 'normal',   label: '標準',       desc: 'バランス重視' },
  { value: 'spacious', label: 'ゆったり',   desc: '見やすく広々' },
]

const FONT_SIZES: { value: UISettings['fontSize']; label: string; size: string }[] = [
  { value: 'small',  label: '小', size: 'text-xs' },
  { value: 'medium', label: '中', size: 'text-sm' },
  { value: 'large',  label: '大', size: 'text-base' },
]

function applyTheme(theme: UISettings['theme']) {
  document.documentElement.setAttribute('data-theme', theme)
}

export default function UICustomizePanel({ open, onClose }: Props) {
  const { uiSettings, updateUISettings } = useStore()
  const panelRef = useRef<HTMLDivElement>(null)

  // Apply theme on mount and when it changes
  useEffect(() => {
    applyTheme(uiSettings.theme)
  }, [uiSettings.theme])

  // Trap focus / close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  function setTheme(theme: UISettings['theme']) {
    updateUISettings({ theme })
    applyTheme(theme)
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/30 transition-opacity duration-300 ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="UIカスタマイズ"
        className={`fixed top-0 right-0 bottom-0 z-50 w-80 max-w-[calc(100vw-2rem)] bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-out ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-primary-500" />
            <h2 className="font-bold text-gray-800">UIカスタマイズ</h2>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 active:bg-gray-200 transition-colors"
            aria-label="閉じる"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto no-scrollbar">
          <div className="p-5 space-y-6">

            {/* テーマカラー */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Palette className="w-4 h-4 text-gray-400" />
                <h3 className="text-sm font-bold text-gray-700">テーマカラー</h3>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {THEMES.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setTheme(t.value)}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border-2 transition-all text-left ${
                      uiSettings.theme === t.value
                        ? 'border-gray-700 shadow-sm scale-[1.02]'
                        : 'border-gray-100 hover:border-gray-300'
                    }`}
                  >
                    <div className="shrink-0 flex flex-col gap-0.5">
                      <div className="w-5 h-3 rounded-sm" style={{ backgroundColor: t.primary }} />
                      <div className="w-5 h-2 rounded-sm" style={{ backgroundColor: t.light }} />
                    </div>
                    <span className="text-xs font-medium text-gray-700 leading-tight">{t.label}</span>
                    {uiSettings.theme === t.value && (
                      <span className="ml-auto text-gray-700 text-xs font-bold">✓</span>
                    )}
                  </button>
                ))}
              </div>
            </section>

            <div className="border-t border-gray-100" />

            {/* 表示密度 */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Monitor className="w-4 h-4 text-gray-400" />
                <h3 className="text-sm font-bold text-gray-700">表示密度</h3>
              </div>
              <div className="space-y-2">
                {DENSITIES.map((d) => (
                  <button
                    key={d.value}
                    onClick={() => updateUISettings({ density: d.value })}
                    className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl border-2 transition-all ${
                      uiSettings.density === d.value
                        ? 'border-primary-400 bg-primary-50'
                        : 'border-gray-100 hover:border-gray-200 bg-gray-50'
                    }`}
                  >
                    <div>
                      <span className="text-sm font-medium text-gray-700">{d.label}</span>
                      <span className="text-xs text-gray-400 ml-2">{d.desc}</span>
                    </div>
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      uiSettings.density === d.value ? 'border-primary-500 bg-primary-500' : 'border-gray-300'
                    }`}>
                      {uiSettings.density === d.value && (
                        <div className="w-1.5 h-1.5 bg-white rounded-full" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <div className="border-t border-gray-100" />

            {/* フォントサイズ */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Type className="w-4 h-4 text-gray-400" />
                <h3 className="text-sm font-bold text-gray-700">フォントサイズ</h3>
              </div>
              <div className="flex gap-2">
                {FONT_SIZES.map((f) => (
                  <button
                    key={f.value}
                    onClick={() => updateUISettings({ fontSize: f.value })}
                    className={`flex-1 py-3 rounded-xl border-2 transition-all flex flex-col items-center gap-1 ${
                      uiSettings.fontSize === f.value
                        ? 'border-primary-400 bg-primary-50'
                        : 'border-gray-100 hover:border-gray-200 bg-gray-50'
                    }`}
                  >
                    <span className={`font-bold text-gray-700 ${f.size}`}>あ</span>
                    <span className="text-xs text-gray-500">{f.label}</span>
                  </button>
                ))}
              </div>
            </section>

            <div className="border-t border-gray-100" />

            {/* 週末表示 */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="w-4 h-4 text-gray-400" />
                <h3 className="text-sm font-bold text-gray-700">週末表示</h3>
              </div>
              <button
                onClick={() => updateUISettings({ showWeekends: !uiSettings.showWeekends })}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all ${
                  uiSettings.showWeekends
                    ? 'border-primary-400 bg-primary-50'
                    : 'border-gray-100 bg-gray-50'
                }`}
              >
                <div>
                  <p className="text-sm font-medium text-gray-700">週末の列を表示</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {uiSettings.showWeekends ? '土曜・日曜を表示中' : '土曜・日曜を非表示'}
                  </p>
                </div>
                <div className={`relative w-11 h-6 rounded-full transition-colors ${uiSettings.showWeekends ? 'bg-primary-500' : 'bg-gray-300'}`}>
                  <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${uiSettings.showWeekends ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </div>
              </button>
            </section>

            <div className="border-t border-gray-100" />

            {/* 列固定 (informational) */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Pin className="w-4 h-4 text-gray-400" />
                <h3 className="text-sm font-bold text-gray-700">列固定</h3>
              </div>
              <div className="px-4 py-3 rounded-xl bg-gray-50 border border-gray-100">
                <p className="text-sm text-gray-600">職員名列は常に固定表示されます</p>
                <p className="text-xs text-gray-400 mt-1">横スクロール時も職員名が見えるよう固定されています</p>
              </div>
            </section>

          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 px-5 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-gray-700 font-medium text-sm transition-colors"
          >
            閉じる
          </button>
        </div>
      </div>
    </>
  )
}
