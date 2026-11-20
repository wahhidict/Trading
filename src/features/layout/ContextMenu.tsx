import { useEffect, useRef } from 'react'
import { useStore } from '../../state/store'
import { useT } from '../../i18n'
import { activeDrawingsCtl, getDrawingsCtl } from '../drawings/controller'

export default function ContextMenu(): React.ReactNode {
  const { t } = useT()
  const ctx = useStore((s) => s.contextMenu)
  const selected = useStore((s) => s.selectedOverlay)
  const closeContextMenu = useStore((s) => s.closeContextMenu)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!ctx) return
    const onDown = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) closeContextMenu()
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [ctx, closeContextMenu])

  if (!ctx) return null
  const ctl = selected ? activeDrawingsCtl() : (ctx as unknown as { pane?: number }).pane !== undefined ? getDrawingsCtl((ctx as unknown as { pane: number }).pane) : null
  const act = (fn: (id: string) => void): void => {
    if (selected) fn(selected)
    closeContextMenu()
  }

  return (
    <div
      ref={ref}
      className="fixed z-50 min-w-36 overflow-hidden rounded-lg border border-border bg-panel text-xs shadow-2xl"
      style={{ top: Math.min(ctx.y, window.innerHeight - 190), left: Math.min(ctx.x, window.innerWidth - 150) }}
      data-testid="context-menu"
    >
      <CtxBtn testid="ctx-copy" disabled={!selected} onClick={() => selected ? act((id) => ctl?.copy(id)) : undefined}>{t('copy')}</CtxBtn>
      <CtxBtn testid="ctx-lock" disabled={!selected} onClick={() => selected ? act((id) => void ctl?.toggleLock(id)) : undefined}>{t('lock')}</CtxBtn>
      <CtxBtn testid="ctx-hide" disabled={!selected} onClick={() => selected ? act((id) => void ctl?.toggleVisible(id)) : undefined}>{t('hide')}</CtxBtn>
      <CtxBtn testid="ctx-delete" disabled={!selected} danger onClick={() => selected ? act((id) => ctl?.remove(id)) : undefined}>{t('delete')}</CtxBtn>
      <CtxBtn testid="ctx-clear-all" danger onClick={() => { ctl?.clearAll(); closeContextMenu() }}>{t('drawClear')}</CtxBtn>
    </div>
  )
}

function CtxBtn({ children, onClick, disabled, danger, testid }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; danger?: boolean; testid?: string }): React.ReactNode {
  return (
    <button
      data-testid={testid}
      disabled={disabled}
      onClick={onClick}
      className={`block w-full px-3 py-1.5 text-start ${disabled ? 'text-muted/40' : danger ? 'text-down hover:bg-down/10' : 'text-txt hover:bg-panel2'}`}
    >{children}</button>
  )
}
