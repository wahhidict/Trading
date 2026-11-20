import { useStore } from '../../state/store'
import { useT } from '../../i18n'
import Watchlist from '../markets/Watchlist'
import DataManager from '../markets/DataManager'

export default function Sidebar(): React.ReactNode {
  const { t } = useT()
  const tab = useStore((s) => s.panelTab)
  const setTab = useStore((s) => s.setPanelTab)

  return (
    <aside className="flex w-64 flex-col border-s border-border bg-panel" data-testid="sidebar">
      <div className="flex border-b border-border">
        <button
          data-testid="tab-watch"
          className={`flex-1 px-3 py-2 text-xs ${tab === 'watch' ? 'border-b-2 border-accent text-txt' : 'text-muted hover:text-txt'}`}
          onClick={() => setTab('watch')}
        >{t('watchlist')}</button>
        <button
          data-testid="tab-data"
          className={`flex-1 px-3 py-2 text-xs ${tab === 'data' ? 'border-b-2 border-accent text-txt' : 'text-muted hover:text-txt'}`}
          onClick={() => setTab('data')}
        >{t('dataManager')}</button>
      </div>
      <div className="min-h-0 flex-1">{tab === 'watch' ? <Watchlist /> : <DataManager />}</div>
    </aside>
  )
}
