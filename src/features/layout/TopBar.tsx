import { useMemo } from 'react'
import { useStore } from '../../state/store'
import { useT } from '../../i18n'
import { TFDEFS, availableTfs } from '../../core/timeframes'
import { getChartRef } from '../chart/chartRef'

export default function TopBar(): React.ReactNode {
  const { t } = useT()
  const metas = useStore((s) => s.metas)
  const symbol = useStore((s) => s.symbol)
  const tf = useStore((s) => s.tf)
  const chartType = useStore((s) => s.chartType)
  const lang = useStore((s) => s.lang)
  const setLang = useStore((s) => s.setLang)
  const setSymbol = useStore((s) => s.setSymbol)
  const setTf = useStore((s) => s.setTf)
  const setChartType = useStore((s) => s.setChartType)
  const openImport = useStore((s) => s.openImport)
  const updateSettings = useStore((s) => s.updateSettings)
  const settings = useStore((s) => s.settings)

  const symbols = useMemo(() => [...new Set(metas.map((m) => m.symbol))].sort(), [metas])
  const tfs = symbol ? availableTfs(symbol, metas) : []

  const zoom = (factor: number): void => {
    const chart = getChartRef()
    if (!chart) return
    const w = document.querySelector<HTMLDivElement>('[data-testid="chart"]')
    chart.zoomAtCoordinate(factor, { x: (w?.clientWidth ?? 400) / 2, y: (w?.clientHeight ?? 300) / 2 })
  }

  const resetView = (): void => {
    const chart = getChartRef()
    if (!chart) return
    chart.setBarSpace(8)
    chart.scrollToRealTime()
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b border-border bg-panel px-2 py-1.5" data-testid="topbar">
      <span className="hidden px-1 text-xs font-bold text-txt sm:inline">{t('appName')}</span>
      <select
        data-testid="symbol-select"
        className="rounded border border-border bg-panel2 px-2 py-1 text-xs text-txt disabled:opacity-50"
        value={symbol ?? ''}
        disabled={symbols.length === 0}
        onChange={(e) => setSymbol(e.target.value)}
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
            onClick={() => setTf(k)}
          >
            {TFDEFS.find((d) => d.key === k)?.label ?? k}
          </button>
        ))}
      </div>
      <select
        data-testid="chart-type"
        className="rounded border border-border bg-panel2 px-2 py-1 text-xs text-txt"
        value={chartType}
        onChange={(e) => setChartType(e.target.value as typeof chartType)}
        title={t('chartType')}
      >
        <option value="candle">Candles</option>
        <option value="bar">OHLC Bars</option>
        <option value="line">Line</option>
        <option value="area">Area</option>
      </select>
      <div className="mx-1 h-5 w-px bg-border" />
      <TopBtn testid="zoom-in" label={t('zoomIn')} onClick={() => zoom(1.25)}>＋</TopBtn>
      <TopBtn testid="zoom-out" label={t('zoomOut')} onClick={() => zoom(0.8)}>－</TopBtn>
      <TopBtn testid="reset-view" label={t('resetChart')} onClick={resetView}>⤾</TopBtn>
      <TopBtn
        testid="future-space"
        label={t('futureSpace')}
        active={settings.futureBars > 0}
        onClick={() => updateSettings({ futureBars: settings.futureBars > 0 ? 0 : 40 })}
      >→</TopBtn>
      <TopBtn testid="fullscreen" label={t('fullscreen')} onClick={() => {
        const el = document.querySelector<HTMLDivElement>('[data-testid="chart-panel"]')
        if (!el) return
        if (document.fullscreenElement) void document.exitFullscreen()
        else void el.requestFullscreen()
      }}>⛶</TopBtn>
      <div className="mx-1 h-5 w-px bg-border" />
      <button data-testid="import-btn" className="rounded bg-accent px-2.5 py-1 text-[11px] font-bold text-white" onClick={() => openImport(null)}>⬆ {t('importData')}</button>
      <div className="flex-1" />
      <button data-testid="lang-toggle" className="rounded border border-border px-2 py-1 text-[11px] text-muted hover:text-txt" onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}>{lang === 'ar' ? 'EN' : 'ع'}</button>
    </div>
  )
}

function TopBtn({ testid, label, onClick, active, children }: { testid: string; label: string; onClick: () => void; active?: boolean; children: React.ReactNode }): React.ReactNode {
  return (
    <button
      title={label}
      data-testid={testid}
      onClick={onClick}
      className={`h-6 min-w-6 rounded border border-border px-1 text-xs leading-4 ${active ? 'text-accent' : 'text-muted hover:text-txt'}`}
    >{children}</button>
  )
}
