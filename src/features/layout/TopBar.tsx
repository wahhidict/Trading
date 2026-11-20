import { useMemo, useState } from 'react'
import { useStore } from '../../state/store'
import { useT } from '../../i18n'
import { TFDEFS, availableTfs } from '../../core/timeframes'
import { getPaneChart } from '../chart/paneRegistry'
import { TIMEZONES } from '../markets/timezones'

export default function TopBar(): React.ReactNode {
  const { t } = useT()
  const metas = useStore((s) => s.metas)
  const panes = useStore((s) => s.panes)
  const layout = useStore((s) => s.layout)
  const activePane = useStore((s) => s.activePane)
  const lang = useStore((s) => s.lang)
  const setLang = useStore((s) => s.setLang)
  const setPaneSymbol = useStore((s) => s.setPaneSymbol)
  const setPaneTf = useStore((s) => s.setPaneTf)
  const setPane = useStore((s) => s.setPane)
  const setLayout = useStore((s) => s.setLayout)
  const openImport = useStore((s) => s.openImport)
  const updateSettings = useStore((s) => s.updateSettings)
  const settings = useStore((s) => s.settings)
  const setReplayWidget = useStore((s) => s.setReplayWidget)
  const replayWidget = useStore((s) => s.replayWidget)
  const replayActive = useStore((s) => s.replay.active)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const pane = panes[activePane]
  const symbol = pane?.symbol ?? null
  const tf = pane?.tf ?? null
  const chartType = pane?.chartType ?? 'candle'

  const symbols = useMemo(() => [...new Set(metas.map((m) => m.symbol))].sort(), [metas])
  const tfs = symbol ? availableTfs(symbol, metas) : []

  const chart = getPaneChart(activePane)

  const zoom = (factor: number): void => {
    if (!chart) return
    const w = document.querySelector<HTMLDivElement>('[data-testid="main"]')
    chart.zoomAtCoordinate(factor, { x: (w?.clientWidth ?? 400) / 2, y: (w?.clientHeight ?? 300) / 2 })
  }

  const resetView = (): void => {
    if (!chart) return
    chart.setBarSpace(8)
    chart.scrollToRealTime()
  }

  return (
    <div className="relative z-20 flex flex-wrap items-center gap-1.5 border-b border-border bg-panel px-2 py-1.5" data-testid="topbar">
      <span className="hidden px-1 text-sm font-extrabold tracking-wide text-txt sm:inline">⚡ {t('appName')}</span>
      <select
        data-testid="symbol-select"
        className="rounded border border-border bg-panel2 px-2 py-1 text-xs text-txt disabled:opacity-50"
        value={symbol ?? ''}
        disabled={symbols.length === 0}
        onChange={(e) => setPaneSymbol(activePane, e.target.value)}
      >
        {symbols.length === 0 ? <option value="">{t('symbol')}</option> : symbols.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <div className="flex overflow-hidden rounded border border-border">
        {tfs.length === 0 ? <span className="px-2 py-1 text-[10px] text-muted">{t('timeframe')}</span> : null}
        {tfs.map((k) => (
          <button
            key={k}
            data-testid={'tf-' + k}
            className={`px-2 py-1 text-[11px] ${tf === k ? 'bg-accent text-white' : 'bg-panel2 text-muted hover:text-txt'}`}
            onClick={() => setPaneTf(activePane, k)}
          >
            {TFDEFS.find((d) => d.key === k)?.label ?? k}
          </button>
        ))}
      </div>
      <select
        data-testid="chart-type"
        className="rounded border border-border bg-panel2 px-2 py-1 text-xs text-txt"
        value={chartType}
        onChange={(e) => setPane(activePane, { chartType: e.target.value as typeof chartType })}
        title={t('chartType')}
      >
        <option value="candle">Candles</option>
        <option value="bar">OHLC Bars</option>
        <option value="line">Line</option>
        <option value="area">Area</option>
        <option value="ha">Heikin Ashi</option>
      </select>
      <div className="mx-1 h-5 w-px bg-border" />
      <TopBtn testid="layout-1" label={t('singlePane')} active={layout === 1} onClick={() => setLayout(1)}>&#9633;</TopBtn>
      <TopBtn testid="layout-2" label={t('twoPanes')} active={layout === 2} onClick={() => setLayout(2)}>&#9641;</TopBtn>
      <TopBtn testid="layout-4" label={t('fourPanes')} active={layout === 4} onClick={() => setLayout(4)}>&#8862;</TopBtn>
      <div className="mx-1 h-5 w-px bg-border" />
      <TopBtn testid="zoom-in" label={t('zoomIn')} onClick={() => zoom(1.25)}>&#65291;</TopBtn>
      <TopBtn testid="zoom-out" label={t('zoomOut')} onClick={() => zoom(0.8)}>&#65293;</TopBtn>
      <TopBtn testid="reset-view" label={t('resetChart')} onClick={resetView}>&#8962;</TopBtn>
      <TopBtn
        testid="future-space"
        label={t('futureSpace')}
        active={settings.futureBars > 0}
        onClick={() => updateSettings({ futureBars: settings.futureBars > 0 ? 0 : 40 })}
      >&#8594;</TopBtn>
      <TopBtn testid="sync-scroll" label={t('syncScroll')} active={settings.syncScroll} onClick={() => updateSettings({ syncScroll: !settings.syncScroll })}>&#8676;&#8677;</TopBtn>
      <TopBtn testid="sync-zoom" label={t('syncZoom')} active={settings.syncZoom} onClick={() => updateSettings({ syncZoom: !settings.syncZoom })}>&#10547;</TopBtn>
      <TopBtn
        testid="replay-toggle"
        label={t('replay')}
        active={replayWidget || replayActive}
        onClick={() => setReplayWidget(!replayWidget)}
      >&#9201;</TopBtn>
      <TopBtn testid="fullscreen" label={t('fullscreen')} onClick={() => {
        const el = document.querySelector<HTMLDivElement>('[data-testid="main"]')
        if (!el) return
        if (document.fullscreenElement) void document.exitFullscreen()
        else void el.requestFullscreen()
      }}>&#9974;</TopBtn>
      <div className="mx-1 h-5 w-px bg-border" />
      <button data-testid="import-btn" className="rounded bg-accent px-2.5 py-1 text-[11px] font-bold text-white" onClick={() => openImport(null)}>&#11014; {t('importData')}</button>
      <div className="flex-1" />
      <TopBtn testid="settings-toggle" label={t('settings')} active={settingsOpen} onClick={() => setSettingsOpen(!settingsOpen)}>&#9881;</TopBtn>
      <button data-testid="lang-toggle" className="rounded border border-border px-2 py-1 text-[11px] text-muted hover:text-txt" onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}>{lang === 'ar' ? 'EN' : '\u0639'}</button>
      {settingsOpen ? (
        <div className="absolute end-2 top-11 z-40 flex flex-col gap-2 rounded-lg border border-border bg-panel p-3 text-xs shadow-2xl" data-testid="settings-pop">
          <span className="font-bold text-muted">{t('settings')}</span>
          <span className="flex items-center gap-2">
            <span>{t('upColor')}</span>
            <input type="color" data-testid="up-color" value={settings.upColor} onChange={(e) => updateSettings({ upColor: e.target.value })} className="h-5 w-8 bg-transparent" />
            <span>{t('downColor')}</span>
            <input type="color" data-testid="down-color" value={settings.downColor} onChange={(e) => updateSettings({ downColor: e.target.value })} className="h-5 w-8 bg-transparent" />
          </span>
          <span className="flex items-center gap-2">
            <span>{t('timezone')}</span>
            <select data-testid="timezone-select" value={settings.timezone} onChange={(e) => updateSettings({ timezone: e.target.value })} className="rounded border border-border bg-panel2 px-1 py-0.5 text-txt">
              {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </span>
        </div>
      ) : null}
    </div>
  )
}

function TopBtn({ testid, label, onClick, active, children }: { testid: string; label: string; onClick: () => void; active?: boolean; children: React.ReactNode }): React.ReactNode {
  return (
    <button
      title={label}
      data-testid={testid}
      onClick={onClick}
      className={`h-6 min-w-6 rounded border border-border px-1 text-xs leading-4 ${active ? 'border-accent/50 text-accent' : 'text-muted hover:text-txt'}`}
    >{children}</button>
  )
}
