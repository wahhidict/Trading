import { useEffect } from 'react'
import { I18nProvider } from './i18n'
import { useStore } from './state/store'
import TopBar from './features/layout/TopBar'
import ToolBar from './features/layout/ToolBar'
import Sidebar from './features/layout/Sidebar'
import StatusBar from './features/layout/StatusBar'
import ReplayBar from './features/layout/ReplayBar'
import ContextMenu from './features/layout/ContextMenu'
import OverlayBar from './features/layout/OverlayBar'
import ChartPanel from './features/chart/ChartPanel'
import ImportWizard from './features/import/ImportWizard'
import { activeDrawingsCtl } from './features/drawings/controller'

const LAYOUT_PANES: Record<number, number> = { 1: 1, 2: 2, 4: 4 }

function AppInner(): React.ReactNode {
  const layout = useStore((s) => s.layout)
  const workspaceTick = useStore((s) => s.workspaceTick)

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const st = useStore.getState()
      const el = e.target as HTMLElement | null
      const typing = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')
      if (e.key === 'Escape') {
        st.setDrawingTool('cursor')
        st.closeContextMenu()
        if (st.selectedOverlay) st.setSelectedOverlay(null)
        return
      }
      if (typing) return
      if ((e.key === 'Delete' || e.key === 'Backspace') && st.selectedOverlay) {
        activeDrawingsCtl()?.remove(st.selectedOverlay)
        st.setSelectedOverlay(null)
        return
      }
      if (e.key === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
        activeDrawingsCtl()?.undo()
        e.preventDefault()
        return
      }
      if (((e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey) && e.shiftKey) || (e.key === 'y' && (e.ctrlKey || e.metaKey))) {
        activeDrawingsCtl()?.redo()
        e.preventDefault()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const count = LAYOUT_PANES[layout] ?? 1
  const gridClass = layout === 1 ? 'grid-cols-1 grid-rows-1' : layout === 2 ? 'grid-cols-2 grid-rows-1' : 'grid-cols-2 grid-rows-2'

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-bg font-ui text-txt">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <ToolBar />
        <main className="relative flex min-w-0 flex-1 flex-col" data-testid="main">
          <div className={`grid min-h-0 flex-1 ${gridClass}`}>
            {Array.from({ length: count }, (_, i) => (
              <ChartPanel key={`${workspaceTick}-${i}`} paneIndex={i} className="border-b border-border" />
            ))}
          </div>
          <OverlayBar />
          <ReplayBar />
        </main>
        <Sidebar />
      </div>
      <StatusBar />
      <ContextMenu />
      <ImportWizard />
    </div>
  )
}

export default function App(): React.ReactNode {
  const lang = useStore((s) => s.lang)
  return (
    <I18nProvider lang={lang}>
      <AppInner />
    </I18nProvider>
  )
}
