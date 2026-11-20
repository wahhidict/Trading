import { useStore } from '../../state/store'
import { useT } from '../../i18n'
import Watchlist from '../markets/Watchlist'
import DataManager from '../markets/DataManager'
import IndicatorsPanel from '../indicators/IndicatorsPanel'
import DrawingsPanel from '../drawings/DrawingsPanel'
import WorkspacePanel from '../workspaces/WorkspacePanel'

const TABS = [
  { id: 'watch', labelKey: 'watchlist', testid: 'tab-watch' },
  { id: 'data', labelKey: 'dataManager', testid: 'tab-data' },
  { id: 'ind', labelKey: 'indicators', testid: 'tab-ind' },
  { id: 'draw', labelKey: 'drawings', testid: 'tab-draw' },
  { id: 'ws', labelKey: 'workspace', testid: 'tab-ws' },
] as const

export default function Sidebar(): React.ReactNode {
  const { t } = useT()
  const tab = useStore((s) => s.panelTab)
  const setTab = useStore((s) => s.setPanelTab)

  return (
    <aside className="flex w-64 shrink-0 flex-col border-s border-border bg-panel" data-testid="sidebar">
      <div className="flex border-b border-border">
        {TABS.map((tb) => (
          <button
            key={tb.id}
            data-testid={tb.testid}
            title={t(tb.labelKey as 'appName')}
            className={`flex-1 px-1 py-2 text-[10px] leading-4 ${tab === tb.id ? 'border-b-2 border-accent bg-panel2/60 text-txt' : 'text-muted hover:text-txt'}`}
            onClick={() => setTab(tb.id)}
          >{t(tb.labelKey as 'appName')}</button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        {tab === 'watch' ? <Watchlist /> : null}
        {tab === 'data' ? <DataManager /> : null}
        {tab === 'ind' ? <IndicatorsPanel /> : null}
        {tab === 'draw' ? <DrawingsPanel /> : null}
        {tab === 'ws' ? <WorkspacePanel /> : null}
      </div>
    </aside>
  )
}
