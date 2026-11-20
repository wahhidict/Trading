import { useStore } from '../../state/store'
import { useT } from '../../i18n'
import { activeDrawingsCtl } from './controller'
import { TOOL_BY_ID, type ToolDef } from '../tools/toolDefs'

const ICON_BY_OVERLAY = new Map<string, ToolDef>(Array.from(TOOL_BY_ID.values()).map((tool) => [tool.overlay ?? '', tool]))

export default function DrawingsPanel(): React.ReactNode {
  const { t } = useT()
  const drawingsVersion = useStore((s) => s.drawingsVersion)
  const selected = useStore((s) => s.selectedOverlay)
  const setSelected = useStore((s) => s.setSelectedOverlay)
  const crossTf = useStore((s) => s.settings.crossTfDrawings)
  const updateSettings = useStore((s) => s.updateSettings)
  const risk = useStore((s) => s.risk)
  const setRisk = useStore((s) => s.setRisk)
  const ctl = activeDrawingsCtl()
  const items = (drawingsVersion >= 0 ? ctl?.getItems() : []) ?? []
  void drawingsVersion

  return (
    <div className="flex h-full flex-col text-xs" data-testid="drawings-panel">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="font-bold text-muted">{t('drawings')}</span>
        <span className="flex gap-1">
          <button title={t('drawUndo')} data-testid="draw-undo" className="rounded border border-border px-1.5 py-0.5 text-[10px] hover:text-txt" onClick={() => ctl?.undo()}>↶</button>
          <button title={t('drawRedo')} data-testid="draw-redo" className="rounded border border-border px-1.5 py-0.5 text-[10px] hover:text-txt" onClick={() => ctl?.redo()}>↷</button>
          <button title={t('drawClear')} data-testid="draw-clear" className="rounded border border-down/50 px-1.5 py-0.5 text-[10px] text-down" onClick={() => ctl?.clearAll()}>{t('drawClear')}</button>
        </span>
      </div>
      <label className="flex items-center gap-2 border-b border-border px-3 py-2 text-[11px] text-muted">
        <input type="checkbox" checked={crossTf} onChange={(e) => updateSettings({ crossTfDrawings: e.target.checked })} />
        {t('drawCrossTf')}
      </label>
      <div className="flex-1 overflow-y-auto">
        {items.length === 0 ? <div className="p-3 text-center text-[11px] text-muted">{t('drawNone')}</div> : items.map((o) => {
          const tool: ToolDef | undefined = ICON_BY_OVERLAY.get(o.name)
          const vis = o.visible !== false
          return (
            <div
              key={o.ovId}
              data-testid={'dw-' + o.name}
              className={`flex w-full items-center justify-between border-b border-border/60 px-3 py-1.5 ${selected === o.ovId ? 'bg-panel2 text-txt' : 'text-muted hover:bg-panel2/60'}`}
              role="button"
              onClick={() => setSelected(selected === o.ovId ? null : o.ovId)}
            >
              <span className="flex items-center gap-1.5">
                <span className="w-3 text-center text-[10px]">{tool?.icon ?? '—'}</span>
                <span className="text-[11px]">{tool ? t(tool.labelKey as 'appName') : o.name}</span>
                {o.lock ? <span title={t('lock')}>🔒</span> : null}
                {!vis ? <span title={t('hide')}>⊘</span> : null}
              </span>
              <span className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                <button title={t('lock')} onClick={() => void ctl?.toggleLock(o.ovId)} className={`text-[10px] ${o.lock ? 'text-accent' : 'text-muted hover:text-txt'}`}>🔗</button>
                <button title={t('hide')} onClick={() => void ctl?.toggleVisible(o.ovId)} className={`text-[10px] ${vis ? 'text-txt' : 'text-muted'}`}>👁</button>
                <button title={t('copy')} onClick={() => ctl?.copy(o.ovId)} className="text-[10px] text-muted hover:text-txt">⧉</button>
                <button title={t('delete')} data-testid={'dw-del-' + o.name} onClick={() => ctl?.remove(o.ovId)} className="text-[10px] text-down">✕</button>
              </span>
            </div>
          )
        })}
      </div>
      <div className="border-t border-border px-3 py-2">
        <div className="mb-1.5 font-bold text-muted">{t('riskSettings')}</div>
        <div className="grid grid-cols-2 gap-1.5 text-[10px] text-muted">
          {([['balance', t('balance')], ['riskPct', t('riskPct')], ['tickSize', t('tickSize')], ['pointValue', t('pointValue')], ['contractSize', t('contractSize')]] as const).map(([field, label]) => (
            <label key={field} className="flex flex-col gap-0.5">
              <span>{label}</span>
              <input
                type="number"
                data-testid={'risk-' + field}
                value={(risk as unknown as Record<string, number>)[field]}
                onChange={(e) => setRisk({ [field]: Number(e.target.value) || 0 } as never)}
                className="rounded border border-border bg-panel2 px-1 py-0.5 text-txt"
              />
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}
