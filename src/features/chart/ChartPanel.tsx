import { useEffect, useRef, useState } from 'react'
import { init, dispose, type Chart, type KLineData, type DeepPartial, type Styles } from 'klinecharts'
import type { ChartTypeKind } from '../../state/store'
import type { TfKey, Candle } from '../../core/types'
import { tfPeriod, resample, tfMinutes } from '../../core/timeframes'
import { getDataset } from '../../core/db'
import { setChartRef } from './chartRef'
import { useStore } from '../../state/store'
import { useT } from '../../i18n'

const aggCache = new Map<string, KLineData[]>()

function toK(c: Candle): KLineData {
  return { timestamp: c.t, open: c.o, high: c.h, low: c.l, close: c.c, volume: c.v }
}

async function loadRecords(symbol: string, tf: TfKey, metas: { symbol: string; tf: TfKey; id: string }[]): Promise<KLineData[] | null> {
  const exact = metas.find((m) => m.symbol === symbol && m.tf === tf)
  if (exact) {
    const rec = await getDataset(exact.id)
    return rec ? rec.candles.map(toK) : null
  }
  const target = tfMinutes(tf)
  if (target === null) return null
  const candidates = metas
    .filter((m) => m.symbol === symbol && m.tf !== tf)
    .map((m) => ({ m, mins: tfMinutes(m.tf) }))
    .filter((x) => x.mins !== null && x.mins < target && target % x.mins === 0)
    .sort((a, b) => (a.mins as number) - (b.mins as number))
  for (const cand of candidates) {
    const rec = await getDataset(cand.m.id)
    if (!rec || rec.candles.length < 2) continue
    const cacheKey = `${cand.m.id}->${tf}:${rec.candles.length}:${rec.candles[rec.candles.length - 1].t}`
    const cached = aggCache.get(cacheKey)
    if (cached) return cached
    const built = resample(rec.candles, tf).map(toK)
    if (aggCache.size > 24) aggCache.clear()
    aggCache.set(cacheKey, built)
    return built
  }
  return null
}

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

const TYPE_MAP: Record<ChartTypeKind, 'candle_solid' | 'ohlc' | 'area'> = {
  candle: 'candle_solid',
  bar: 'ohlc',
  line: 'area',
  area: 'area',
}

export default function ChartPanel(): React.ReactNode {
  const el = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<Chart | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { t } = useT()
  const symbol = useStore((s) => s.symbol)
  const tf = useStore((s) => s.tf)
  const chartType = useStore((s) => s.chartType)
  const metas = useStore((s) => s.metas)
  const settings = useStore((s) => s.settings)
  const prevTf = useRef<TfKey | null>(null)

  useEffect(() => {
    if (!el.current) return
    const chart = init(el.current)
    if (!chart) { setError('chart_init_failed'); return }
    chart.setDataLoader({
      getBars: ({ callback }) => {
        const st = useStore.getState()
        const sym = st.symbol
        const period = st.tf
        if (!sym || !period) { callback([]); return }
        void loadRecords(sym, period, st.metas).then((rows) => { callback(rows ?? []) })
      },
    })
    chart.createIndicator('VOL', false)
    chart.setOffsetRightDistance(40)
    chart.subscribeAction('onCrosshairChange', (data) => {
      const st = useStore.getState()
      const k = (data as { kLineData?: KLineData } | undefined)?.kLineData
      st.setHoverCandle(k ? { o: k.open, h: k.high, l: k.low, c: k.close, v: k.volume ?? 0 } : null)
    })
    chartRef.current = chart
    setChartRef(chart)
    return () => {
      dispose(chart)
      chartRef.current = null
      setChartRef(null)
    }
  }, [])

  useEffect(() => {
    const chart = chartRef.current
    if (chart) {
      chart.setStyles(chartStyles(settings.upColor, settings.downColor))
      chart.setTimezone(settings.timezone)
      chart.setOffsetRightDistance(settings.futureBars)
    }
  }, [settings.upColor, settings.downColor, settings.timezone, settings.futureBars])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    chart.setStyles({ candle: { type: TYPE_MAP[chartType] } })
  }, [chartType])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart || !symbol || !tf) return
    const period = tfPeriod(tf)
    setError(null)
    setLoading(true)
    const priceDecimals = metas.some((m) => m.symbol === symbol) ? 5 : 4
    chart.setSymbol({ ticker: symbol, pricePrecision: priceDecimals, volumePrecision: 0 })
    if (!period) { setError('no_data'); setLoading(false); return }
    chart.setPeriod({ type: period.type, span: period.span })
    void loadRecords(symbol, tf, metas).then((rows) => {
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
  }, [symbol, tf, metas])

  return (
    <div className="relative h-full w-full bg-bg" data-testid="chart-panel">
      <div ref={el} className="h-full w-full" data-testid="chart" />
      {loading ? (
        <div className="pointer-events-none absolute top-2 start-3 text-xs text-muted">{t('parsing')}</div>
      ) : null}
      {error && !loading ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-bg/85 text-center">
          <div className="text-lg font-semibold text-txt">{t('noData')}</div>
          <div className="max-w-md text-sm text-muted">{t('noDataHint')}</div>
        </div>
      ) : null}
    </div>
  )
}
