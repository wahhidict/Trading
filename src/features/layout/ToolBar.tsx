import { useState } from 'react'
import { TOOL_GROUPS } from '../tools/toolDefs'
import { useStore } from '../../state/store'
import { useT } from '../../i18n'

export default function ToolBar(): React.ReactNode {
  const { t } = useT()
  const drawingTool = useStore((s) => s.drawingTool)
  const setDrawingTool = useStore((s) => s.setDrawingTool)
  const magnet = useStore((s) => s.settings.magnet)
  const updateSettings = useStore((s) => s.updateSettings)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ lines: true, shapes: true, fib: true, measure: true, position: true, ict: true })

  const toggleGroup = (id: string): void => setOpenGroups((o) => ({ ...o, [id]: !o[id] }))

  return (
    <div className="flex w-11 shrink-0 flex-col overflow-y-auto border-e border-border bg-panel py-1.5" data-testid="toolbar">
      <button
        title={t('magnet') + ': ' + t(('mag' + magnet) as 'magoff')}
        data-testid="magnet-btn"
        onClick={() => updateSettings({ magnet: magnet === 'off' ? 'weak' : magnet === 'weak' ? 'strong' : 'off' })}
        className={`mx-auto mb-1.5 h-7 w-7 rounded text-xs ${magnet !== 'off' ? 'bg-accent/25 text-accent' : 'text-muted hover:text-txt'}`}
      >{magnet === 'strong' ? '⭅' : '🧲'}</button>
      {TOOL_GROUPS.map((g) => (
        <div key={g.id} className="mb-0.5 border-t border-border first:border-t-0 first:pt-0">
          <button className="flex w-full items-center justify-between px-1 py-1 text-[9px] uppercase tracking-wide text-muted hover:text-txt" onClick={() => toggleGroup(g.id)}>
            <span>{g.tools[0]?.icon}</span>
          </button>
          {openGroups[g.id] ? (
            <div className="flex flex-col items-center gap-1">
              {g.tools.map((tool) => (
                <button
                  key={tool.id}
                  title={t(tool.labelKey as 'appName')}
                  data-testid={'tool-' + tool.id}
                  className={`h-7 w-7 rounded text-[10px] leading-4 ${drawingTool === tool.id ? 'bg-accent text-white' : 'text-muted hover:bg-panel2 hover:text-txt'}`}
                  onClick={() => setDrawingTool(drawingTool === tool.id ? 'cursor' : tool.id)}
                >
                  {tool.icon}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  )
}
