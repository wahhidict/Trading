import { useEffect, useRef, useState } from 'react'
import { init, dispose, type Chart, type KLineData, type DeepPartial, type Styles, type OverlayCreate, type IndicatorCreate } from 'klinecharts'
import type { TfKey, IndicatorConf, ChartKind } from '../../core/types'
import { tfPeriod } from '../../core/timeframes'
import { loadPaneRecords } from './paneData'
import { setPaneChart, allPaneCharts } from './paneRegistry'
import { DrawingsCtl, setDrawingsCtl } from '../drawings/controller'
import { TOOL_BY_ID } from '../tools/toolDefs'
import { useStore } from '../../state/store'
import { useT } from '../../i18n'
import { registerCustomIndicators } from '../indicators/customIndicators'

registerCustomIndicators()

const syncGuard = new Set<number>()

function chartStyles(up: string, down: string): DeepPartial<Styles> {
  return {
    grid: {
      horizontal: { color: 'rgba(42,46,57,.55)' },
      vertical: { color: 'rgba(42,46,57,.55)' },
    },
    candle: {
      bar: { upColor: up, downColor: down, noChangeColor: '#888c99', upWickColor: up, downWickColor: down, noChangeWickColor: '#888c99' },
      tooltip: { rect: { color: '#1e222d' } },
    },
    indicator: {
      bars: [{ upColor: up, downColor: down, noChangeColor: '#888c99' }],
      lastValueMark: { show: false },
    },
    xAxis: { tickText: { size: 10, color: '#787b86' }, axisLine: { show: false }, tickLine: { show: false } },
    yAxis: { tickText: { size: 10, color: '#787b86' }, axisLine: { show: false }, tickLine: { show: false } },
    crosshair: {
      horizontal: { line: { color: '#5a6b85', style: 'dashed' }, text: { backgroundColor: '#333b4f', color: '#e3e6ee' } },
      vertical: { line: { color: '#5a6b85', style: 'dashed' }, text: { backgroundColor: '#333b4f', color: '#e3e6ee' } },
    },
    separator: { color: '#2a2e39' },
  }
}

function typeStyles(kind: ChartKind, up: string, down: string): DeepPartial<Styles> {
  switch (kind) {
    case 'bar':
      return { candle: { type: 'ohlc', bar: { upColor: up, downColor: down } } }
    case 'line':
      return { candle: { type: 'area', area: { lineSize: 2, lineColor: up, backgroundColor: 'rgba(0,0,0,0)' } } }
    case 'area':
      return { candle: { type: 'area', area: { lineSize: 2, lineColor: up, backgroundColor: up + '55' } } }
    default:
      return { candle: { type: 'candle_solid', bar: { upColor: up, downColor: down } } }
  }
}

function indicatorCreateFor(conf: IndicatorConf): IndicatorCreate {
  const styles = conf.colors.length ? { lines: conf.colors.map((color) => ({ color, size: 1 })) } : undefined
  return {
    id: conf.key,
    name: conf.name,
    calcParams: conf.params,
    visible: conf.visible,
    ...(conf.onMain ? { paneId: 'candle_pane' } : {}),
    styles,
  } as unknown as IndicatorCreate
}

function magnetToMode(m: 'off' | 'weak' | 'strong'): OverlayCreate['mode'] {
  return m === 'weak' ? 'weak_magnet' : m === 'strong' ? 'strong_magnet' : 'normal'
}

interface Props {
  paneIndex: number
  className?: string
}

export default function ChartPanel({ paneIndex, className }: Props): React.ReactNode {
  const el = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<Chart | null>(null)
  const ctlRef = useRef<DrawingsCtl | null>(null)
  const prevSymbol = useRef<string | null>(null)
  const prevTf = useRef<TfKey | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [readyTick, setReadyTick] = useState(0)
  const { t } = useT()
  const pane = useStore((s) => s.panes[paneIndex])
  const symbol = pane?.symbol ?? null
  const tf = pane?.tf ?? null
  const chartType = pane?.chartType ?? 'candle'
  const indicators = pane?.indicators ?? []
  const metas = useStore((s) => s.metas)
  const settings = useStore((s) => s.settings)
  const drawingTool = useStore((s) => s.drawingTool)
  const replayEndTime = useStore((s) => (s.replay.active ? s.replay.endTime : null))
  const replayActive = useStore((s) => s.replay.active)

  useEffect(() => {
    if (!el.current) return
    const chart = init(el.current)
    if (!chart) { setError('chart_init_failed'); return }
    chart.setStyles(chartStyles(settings.upColor, settings.downColor))
    chart.setTimezone(settings.timezone)
    chart.setOffsetRightDistance(settings.futureBars)
    chart.setDataLoader({
      getBars: ({ callback }) => {
        const st = useStore.getState()
        const p = st.panes[paneIndex]
        if (!p?.symbol || !p.tf) { callback([]); return }
        const endTime = st.replay.active ? st.replay.endTime : null
        void loadPaneRecords(paneIndex, p.symbol, p.tf, p.chartType, st.metas, endTime).then((rows) => { callback(rows ?? []) })
      },
    })
    chart.createIndicator('VOL', false)
    chart.subscribeAction('onCrosshairChange', (data) => {
      const st = useStore.getState()
      const k = (data as { kLineData?: KLineData } | undefined)?.kLineData
      st.setHoverCandle(paneIndex, k ? { o: k.open, h: k.high, l: k.low, c: k.close, v: k.volume ?? 0 } : null)
      for (const { pane: other, chart: oc } of allPaneCharts()) {
        if (other === paneIndex || syncGuard.has(other)) continue
        syncGuard.add(other)
        try { oc.executeAction('onCrosshairChange', data as never) } catch { /* ignore */ }
        syncGuard.delete(other)
      }
    })
    chart.subscribeAction('onVisibleRangeChange', () => {
      const st = useStore.getState()
      if (!st.settings.syncScroll) return
      const c = chartRef.current
      if (!c) return
      const ts = c.getVisibleRange().from
      for (const { pane: other, chart: oc } of allPaneCharts()) {
        if (other === paneIndex || syncGuard.has(other)) continue
        syncGuard.add(other)
        try { oc.scrollToTimestamp(ts) } catch { /* ignore */ }
        syncGuard.delete(other)
      }
    })
    chart.subscribeAction('onZoom', () => {
      const st = useStore.getState()
      if (!st.settings.syncZoom) return
      const c = chartRef.current
      if (!c) return
      const bar = c.getBarSpace().bar
      for (const { pane: other, chart: oc } of allPaneCharts()) {
        if (other === paneIndex || syncGuard.has(other)) continue
        syncGuard.add(other)
        try { oc.setBarSpace(bar) } catch { /* ignore */ }
        syncGuard.delete(other)
      }
    })
    chartRef.current = chart
    setPaneChart(paneIndex, chart)
    const ctl = new DrawingsCtl(chart)
    ctlRef.current = ctl
    setDrawingsCtl(paneIndex, ctl)
    setReadyTick((v) => v + 1)
    return () => {
      dispose(chart)
      chartRef.current = null
      ctlRef.current = null
      setPaneChart(paneIndex, null)
      setDrawingsCtl(paneIndex, null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paneIndex])

  const chart = chartRef.current
  const tick = readyTick

  useEffect(() => {
    if (chart) {
      chart.setStyles(chartStyles(settings.upColor, settings.downColor))
      chart.setTimezone(settings.timezone)
      chart.setOffsetRightDistance(settings.futureBars)
    }
  }, [settings.upColor, settings.downColor, settings.timezone, settings.futureBars, chart, tick])

  useEffect(() => {
    if (chart) chart.setStyles(typeStyles(chartType, settings.upColor, settings.downColor))
  }, [chartType, chart, tick, settings.upColor, settings.downColor])

  useEffect(() => {
    if (chart && symbol) chart.setSymbol({ ticker: symbol, pricePrecision: 5, volumePrecision: 0 })
  }, [symbol, chart, tick])

  useEffect(() => {
    if (!chart || !symbol || !tf) return
    const period = tfPeriod(tf)
    if (!period) return
    setError(null)
    setLoading(true)
    chart.setPeriod({ type: period.type, span: period.span })
    void loadPaneRecords(paneIndex, symbol, tf, chartType, metas, replayEndTime).then((rows) => {
      setLoading(false)
      if (!rows || rows.length === 0) {
        setError('no_data')
        chart.setDataLoader({ getBars: ({ callback }) => callback([]) })
        return
      }
      const wasTf = prevTf.current
      const anchor = wasTf && wasTf !== tf ? chart.getVisibleRange() : null
      chart.setDataLoader({ getBars: ({ callback }) => callback(rows) })
      prevTf.current = tf
      if (anchor) {
        const idx = Math.min(Math.max(Math.floor(anchor.to), 0), rows.length - 1)
        chart.scrollToTimestamp(rows[idx].timestamp)
      } else {
        chart.scrollToRealTime()
      }
    })
  }, [paneIndex, symbol, tf, chartType, metas, replayEndTime, replayActive, chart, tick])

  useEffect(() => {
    const ctl = ctlRef.current
    if (!chart || !symbol || !ctl) return
    if (prevSymbol.current === symbol) return
    prevSymbol.current = symbol
    try { chart.removeOverlay() } catch { /* ignore */ }
    void ctl.load(symbol)
  }, [symbol, chart, tick])

  useEffect(() => {
    if (!chart) return
    const want = new Map(indicators.map((c) => [c.key, c] as const))
    const existing = chart.getIndicators().filter((i) => i.name !== 'VOL')
    for (const ind of existing) {
      if (!want.has(ind.id)) {
        try { chart.removeIndicator({ id: ind.id }) } catch { /* ignore */ }
      }
    }
    const stillActive = new Set(chart.getIndicators().map((i) => i.id))
    for (const conf of indicators) {
      if (stillActive.has(conf.key)) {
        try {
          chart.overrideIndicator({
            id: conf.key,
            calcParams: conf.params,
            visible: conf.visible,
            styles: conf.colors.length ? { lines: conf.colors.map((color) => ({ color, size: 1 })) } : undefined,
          } as never)
        } catch { /* ignore */ }
      } else {
        try { chart.createIndicator(indicatorCreateFor(conf), conf.onMain) } catch { /* ignore */ }
      }
    }
  }, [indicators, chart, tick])

  useEffect(() => {
    const chartC = chartRef.current
    if (!chartC || !drawingTool || drawingTool === 'cursor') return
    const def = TOOL_BY_ID.get(drawingTool)
    if (!def || !def.overlay) return
    const st = useStore.getState()
    const extendData = def.extendData ?? (def.needsRisk ? { risk: st.risk } : undefined)
    const ctl = ctlRef.current
    const onDone = (): void => {
      ctl?.mutated()
      st.setDrawingTool('cursor')
    }
    try {
      chartC.createOverlay({
        name: def.overlay,
        extendData: extendData as never,
        mode: magnetToMode(st.settings.magnet),
        onDrawEnd: onDone,
        onPressedMoveEnd: () => ctl?.mutated(),
      } as unknown as OverlayCreate)
    } catch { /* ignore */ }
  }, [drawingTool, chart, tick])

  return (
    <div
      className={`relative h-full w-full bg-bg ${className ?? ''}`}
      data-testid="chart-panel"
      data-pane={paneIndex}
      onPointerDown={() => {
        const st = useStore.getState()
        if (st.activePane !== paneIndex) st.setActivePane(paneIndex)
      }}
    >
      <div ref={el} className="h-full w-full" data-testid={'chart-' + paneIndex} />
      {loading ? (
        <div className="pointer-events-none absolute top-2 start-3 text-xs text-muted">{t('parsing')}</div>
      ) : null}
      {error && !loading ? (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-bg/85 text-center">
          <div className="text-lg font-semibold text-txt">{t('noData')}</div>
          <div className="max-w-md text-sm text-muted">{t('noDataHint')}</div>
        </div>
      ) : null}
    </div>
  )
}
