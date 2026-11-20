import 'fake-indexeddb/auto'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { installLocalStorageStub, localStorageMock } from './qa-helpers'
import { useStore, DEFAULT_RISK } from '../src/state/store'
import type { DatasetMeta, PaneState, IndicatorConf } from '../src/core/types'

beforeAll(() => { installLocalStorageStub() })

const meta = (symbol: string, tf: DatasetMeta['tf'], firstT: number, lastT: number): DatasetMeta =>
  ({ id: `${symbol}__${tf}`, symbol, tf, count: 100, firstT, lastT, timezone: 'UTC', source: 'test', updatedAt: 1 })

const pane = (symbol: string | null, tf: string | null, indicators: IndicatorConf[] = []): PaneState =>
  ({ symbol, tf: (tf as PaneState['tf']), chartType: 'candle', indicators })

beforeEach(() => {
  const st = useStore.getState()
  st.setMetas([
    meta('NQ', '1m', 1000, 2000),
    meta('NQ', '5m', 1000, 2000),
    meta('ES', '1m', 1000, 2000),
  ])
  st.setPanes([
    pane('NQ', '5m'),
    pane('ES', '1m'),
    pane(null, null),
    pane(null, null),
  ])
  st.setLayout(2)
  st.setActivePane(0)
})

describe('store: pane symbol/tf coordination', () => {
  it('keeps the timeframe when the same tf exists for the new symbol', () => {
    useStore.getState().setPanes([pane('ES', '1m')])
    useStore.getState().setPaneSymbol(0, 'NQ')
    const p = useStore.getState().panes[0]
    expect(p.symbol).toBe('NQ')
    expect(p.tf).toBe('1m')
  })

  it('keeps tf when symbol is the same market with that tf (NQ has 5m)', () => {
    useStore.getState().setPaneSymbol(0, 'NQ')
    expect(useStore.getState().panes[0].tf).toBe('5m')
  })

  it('drops the tf when the new symbol lacks that tf', () => {
    useStore.getState().setPaneSymbol(0, 'GC')
    const p = useStore.getState().panes[0]
    expect(p.symbol).toBe('GC')
    expect(p.tf).toBeNull()
  })

  it('clears symbol and tf together', () => {
    useStore.getState().setPaneSymbol(0, null)
    const p = useStore.getState().panes[0]
    expect(p.symbol).toBeNull()
    expect(p.tf).toBeNull()
  })

  it('setPaneTf updates only the given pane', () => {
    useStore.getState().setPaneTf(1, '5m')
    expect(useStore.getState().panes[1].tf).toBe('5m')
    expect(useStore.getState().panes[0].tf).toBe('5m')
  })
})

describe('store: layout and panes', () => {
  it('setPanes completes short lists to 4 panes', () => {
    useStore.getState().setPanes([pane('NQ', '1m')])
    const panes = useStore.getState().panes
    expect(panes.length).toBe(4)
    expect(panes[0].symbol).toBe('NQ')
    expect(panes[1].symbol).toBeNull()
  })

  it('setLayout persists and keeps panes', () => {
    useStore.getState().setLayout(4)
    expect(useStore.getState().layout).toBe(4)
    const raw = JSON.parse(localStorageMock()['ta_layout_v1'] as string) as { layout: number }
    expect(raw.layout).toBe(4)
  })

  it('layout persistence round-trips through localStorage', () => {
    useStore.getState().setLayout(4)
    useStore.getState().setActivePane(2)
    const raw = JSON.parse(localStorageMock()['ta_layout_v1'] as string) as { layout: number; activePane: number }
    expect(raw.layout).toBe(4)
    expect(raw.activePane).toBe(2)
  })
})

describe('store: indicators per pane', () => {
  it('addIndicator appends and setPaneIndicators replaces', () => {
    const conf: IndicatorConf = { key: 'EMA:1', name: 'EMA', params: [21], colors: ['#ffd166'], visible: true, onMain: true }
    useStore.getState().addIndicator(0, conf)
    expect(useStore.getState().panes[0].indicators.length).toBe(1)
    useStore.getState().setPaneIndicators(0, [])
    expect(useStore.getState().panes[0].indicators.length).toBe(0)
    expect(useStore.getState().panes[1].indicators.length).toBe(0)
  })
})

describe('store: replay state', () => {
  it('setReplay merges patches and toggles widget', () => {
    useStore.getState().setReplay({ active: true, endTime: 1234, startTime: 1000 })
    expect(useStore.getState().replay).toMatchObject({ active: true, endTime: 1234, startTime: 1000, playing: false })
    useStore.getState().setReplayWidget(true)
    expect(useStore.getState().replayWidget).toBe(true)
  })
})

describe('store: risk settings', () => {
  it('defaults match DEFAULT_RISK and setRisk merges + persists', () => {
    expect(useStore.getState().risk).toMatchObject(DEFAULT_RISK)
    useStore.getState().setRisk({ balance: 10000, riskPct: 0.5, tickSize: 0.25, pointValue: 5, contractSize: 2 })
    expect(useStore.getState().risk).toEqual({ balance: 10000, riskPct: 0.5, tickSize: 0.25, pointValue: 5, contractSize: 2 })
    const raw = JSON.parse(localStorageMock()['ta_risk_v1'] as string) as Record<string, number>
    expect(raw.balance).toBe(10000)
  })
})

describe('store: misc', () => {
  it('bumpDrawings and bumpWorkspace increment counters', () => {
    const d0 = useStore.getState().drawingsVersion
    const w0 = useStore.getState().workspaceTick
    useStore.getState().bumpDrawings()
    useStore.getState().bumpWorkspace()
    expect(useStore.getState().drawingsVersion).toBe(d0 + 1)
    expect(useStore.getState().workspaceTick).toBe(w0 + 1)
  })

  it('setMetas strips to summary fields', () => {
    useStore.getState().setMetas([meta('CL', '1h', 5000, 6000)])
    const m = useStore.getState().metas[0]
    expect(m).toEqual({ id: 'CL__1h', symbol: 'CL', tf: '1h', count: 100, firstT: 5000, lastT: 6000, timezone: 'UTC', source: 'test', updatedAt: 1 })
  })

  it('setDrawingTool clears selection; selecting overlay works', () => {
    useStore.getState().setSelectedOverlay('ov1')
    useStore.getState().setDrawingTool('fibRetrace')
    expect(useStore.getState().selectedOverlay).toBeNull()
    useStore.getState().setDrawingTool(null)
  })
})
