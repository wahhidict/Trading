import { useEffect } from 'react'
import { I18nProvider } from './i18n'
import { useStore } from './state/store'
import TopBar from './features/layout/TopBar'
import Sidebar from './features/layout/Sidebar'
import StatusBar from './features/layout/StatusBar'
import ChartPanel from './features/chart/ChartPanel'
import ImportWizard from './features/import/ImportWizard'
import { allDatasets } from './core/db'

export default function App(): React.ReactNode {
  const lang = useStore((s) => s.lang)
  const ready = useStore((s) => s.ready)
  const setReady = useStore((s) => s.setReady)
  const setMetas = useStore((s) => s.setMetas)
  const metas = useStore((s) => s.metas)
  const setSymbol = useStore((s) => s.setSymbol)
  const setTf = useStore((s) => s.setTf)

  useEffect(() => {
    void allDatasets().then((recs) => {
      setMetas(recs)
      if (recs.length) {
        setSymbol(recs[0].symbol)
        setTf(recs[0].tf)
      }
      setReady(true)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <I18nProvider lang={lang}>
      <div className="flex h-screen flex-col overflow-hidden bg-bg text-txt font-ui">
        <TopBar />
        <div className="flex min-h-0 flex-1">
          <main className="min-w-0 flex-1" data-testid="main">
            <ChartPanel />
          </main>
          <Sidebar />
        </div>
        <StatusBar />
        {ready ? null : null}
        <ImportWizard />
        <div className="hidden">{metas.length}</div>
      </div>
    </I18nProvider>
  )
}
