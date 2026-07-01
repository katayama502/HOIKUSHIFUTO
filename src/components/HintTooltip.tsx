import { useState, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { HelpCircle } from 'lucide-react'

interface Props {
  /** ポップアップのタイトル（省略可） */
  title?: string
  /** ポップアップの本文（文字列 or JSX） */
  content: React.ReactNode
  /** アイコンの大きさ: 'sm' = 14px, 'md' = 16px */
  size?: 'sm' | 'md'
  /** 追加 className（外側 span に適用） */
  className?: string
}

export default function HintTooltip({ title, content, size = 'sm', className = '' }: Props) {
  const [visible, setVisible] = useState(false)
  const [coords, setCoords] = useState({ x: 0, y: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const calcPos = useCallback(() => {
    const rect = btnRef.current?.getBoundingClientRect()
    if (!rect) return
    const TW = 288   // tooltip width
    const TH = 220   // estimated tooltip height
    let x = rect.right + 10
    let y = rect.top - 8
    if (x + TW > window.innerWidth - 8) x = rect.left - TW - 10
    if (x < 8) x = 8
    if (y + TH > window.innerHeight - 8) y = window.innerHeight - TH - 8
    if (y < 8) y = 8
    setCoords({ x, y })
  }, [])

  function scheduleClose() {
    closeTimer.current = setTimeout(() => setVisible(false), 120)
  }

  function cancelClose() {
    if (closeTimer.current) clearTimeout(closeTimer.current)
  }

  function handleEnter() {
    cancelClose()
    calcPos()
    setVisible(true)
  }

  function handleLeave() {
    scheduleClose()
  }

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation()
    cancelClose()
    if (visible) {
      setVisible(false)
    } else {
      calcPos()
      setVisible(true)
    }
  }

  const iconSize = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'

  return (
    <span className={`inline-flex items-center ${className}`}>
      <button
        ref={btnRef}
        type="button"
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        onClick={handleClick}
        aria-label="ヒントを表示"
        className={`rounded-full flex items-center justify-center text-gray-300 hover:text-primary-400 hover:bg-primary-50 active:scale-90 transition-all cursor-pointer ${size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'}`}
      >
        <HelpCircle className={iconSize} />
      </button>

      {visible && createPortal(
        <div
          className="fixed z-[110] max-w-[288px]"
          style={{ left: coords.x, top: coords.y }}
          onMouseEnter={cancelClose}
          onMouseLeave={handleLeave}
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 p-3.5 animate-in fade-in-0 zoom-in-95 duration-150">
            {title && (
              <div className="flex items-center gap-1.5 mb-2 pb-2 border-b border-gray-200">
                <HelpCircle className="w-3.5 h-3.5 text-primary-500 shrink-0" />
                <span className="text-[11px] font-bold text-primary-600 leading-tight">{title}</span>
              </div>
            )}
            <div className="text-[11px] leading-relaxed text-gray-700 space-y-1">
              {content}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </span>
  )
}
