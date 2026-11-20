import 'fake-indexeddb/auto'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { Chart } from 'klinecharts'
import { installLocalStorageStub } from './qa-helpers'
import { DrawingsCtl, serializeOverlays, setDrawingsCtl, getDrawingsCtl, activeDrawingsCtl } from '../src/features/drawings/controller'
import { putDrawings, getDrawings } from '../src/core/db'
import type { SymbolDrawings } from '../src/core/types'
import { useStore } from '../src/state/store'

class MockChart {
  overlays: {
    id?: string
    name: string
    points: { timestamp?: number; value?: number }[]
    styles?: unknown
    lock?: boolean
    visible?: boolean
    extendData?: unknown
    mode?: string
  }[] = []
  seq = 0
  createOverlay(o: { name: string; points: { timestamp?: number; value?: number }[]; styles?: unknown; lock?: boolean; visible?: boolean; extendData?: unknown; id?: string; mode?: string }): string {
    const rec = { ...o, id: o.id ?? `ov_${++this.seq}` }
    this.overlays.push(rec)
    return rec.id
  }
  removeOverlay(arg?: { id?: string }): void {
    if (!arg) { this.overlays = []; return }
    this.overlays = this.overlays.filter((x) => x.id !== arg.id)
  }
  getOverlays(): { id?: string; name: string; points: { timestamp?: number; value?: number }[]; styles?: unknown; lock?: boolean; visible?: boolean; extendData?: unknown }[] {
    return this.overlays
  }
}

function livePoint(timestamp: number, value: number): { timestamp?: number; value?: number } { return { timestamp, value } }
function screenPoint(value: number): { timestamp?: number; value?: number } { return { value, timestamp: undefined } }

function byId(items: SymbolDrawings['items'], id: string): SymbolDrawings['items'][number] | undefined {
  return items.find((x) => x.ovId === id)
}

let chart: MockChart
let ctl: DrawingsCtl
const pushUndo = (c: DrawingsCtl): void => (c as unknown as { pushUndo(): void }).pushUndo()

beforeAll(() => { installLocalStorageStub() })

beforeEach(async () => {
  const st = useStore.getState()
  st.setMetas([{ id: 'NQ__5m', symbol: 'NQ', tf: '5m', count: 100, firstT: 1000, lastT: 2000, timezone: 'UTC', source: 'test', updatedAt: 1 }])
  st.setPanes([{ symbol: 'NQ', tf: '5m', chartType: 'candle', indicators: [] }, { symbol: null, tf: null, chartType: 'candle', indicators: [] }, { symbol: null, tf: null, chartType: 'candle', indicators: [] }, { symbol: null, tf: null, chartType: 'candle', indicators: [] }])
  st.setActivePane(0)
  st.updateSettings({ crossTfDrawings: true, magnet: 'off' })
  await putDrawings({ id: 'NQ', items: [], updatedAt: 0 })
  chart = new MockChart()
  ctl = new DrawingsCtl(chart as unknown as Chart)
  setDrawingsCtl(0, ctl)
  await ctl.load('NQ')
})

afterAll(() => { setDrawingsCtl(0, null) })

describe('serialisation is market-anchored (timestamp + price)', () => {
  it('keeps only timestamp/value from points, discards screen coordinates', async () => {
    await ctl.load('NQ')
    chart.createOverlay({ name: 'segment', points: [livePoint(1500, 123.5), screenPoint(400)], lock: false, visible: true })
    const items = serializeOverlays(chart as unknown as Chart)
    expect(items.length).toBe(1)
    expect(items[0].points[0]).toEqual({ timestamp: 1500, value: 123.5 })
    expect(items[0].points[1].timestamp).toBeUndefined()
    await ctl.saveNow()
    const rec = await getDrawings('NQ')
    expect(rec?.items[0].points[0]).toEqual({ timestamp: 1500, value: 123.5 })
  })

  it('overlayCreate drops points that are not number:number pairs', async () => {
    await putDrawings({ id: 'NQ', items: [{ ovId: 'a1', name: 'segment', points: [livePoint(1500, 10), screenPoint(99)], lock: false, visible: true }], updatedAt: 1 })
    await ctl.load('NQ')
    const created = chart.overlays[0]
    expect(created?.points.length).toBe(1)
    expect(created?.points[0]).toEqual({ timestamp: 1500, value: 10 })
    expect(created?.id).toBe('a1')
  })
})

describe('load + cross-timeframe filtering', () => {
  it('loads all drawings when crossTfDrawings is on', async () => {
    await putDrawings({ id: 'NQ', items: [{ ovId: 'a1', name: 'segment', points: [livePoint(1500, 10), livePoint(1600, 12)] }, { ovId: 'a2', name: 'segment', points: [livePoint(99999, 1), livePoint(100000, 2)] }], updatedAt: 1 })
    await ctl.load('NQ')
    expect(chart.overlays.length).toBe(2)
    expect(ctl.getSymbol()).toBe('NQ')
  })

  it('filters drawings outside the current timeframe range when crossTfDrawings is off', async () => {
    useStore.getState().updateSettings({ crossTfDrawings: false })
    await putDrawings({ id: 'NQ', items: [
      { ovId: 'in1', name: 'segment', points: [livePoint(1500, 10), livePoint(1600, 12)] },
      { ovId: 'out1', name: 'segment', points: [livePoint(99999, 1), livePoint(100000, 2)] },
    ], updatedAt: 1 })
    await ctl.load('NQ')
    expect(chart.overlays.length).toBe(1)
    expect(chart.overlays[0].id).toBe('in1')
  })

  it('keeps a drawing whose range overlaps the timeframe even if first point is earlier', async () => {
    useStore.getState().updateSettings({ crossTfDrawings: false })
    await putDrawings({ id: 'NQ', items: [{ ovId: 'span', name: 'segment', points: [livePoint(500, 10), livePoint(1100, 12)] }], updatedAt: 1 })
    await ctl.load('NQ')
    expect(chart.overlays.length).toBe(1)
  })
})

describe('mutate operations', () => {
  beforeEach(async () => {
    chart.createOverlay({ name: 'segment', points: [livePoint(1500, 10), livePoint(1600, 12)], id: 'a1', lock: false, visible: true })
    chart.createOverlay({ name: 'rect', points: [livePoint(1500, 10), livePoint(1600, 12)], id: 'a2', lock: false, visible: true })
    pushUndo(ctl)
  })

  it('remove deletes one overlay and saves the remainder', async () => {
    ctl.remove('a1')
    expect(chart.overlays.map((o) => o.id)).toEqual(['a2'])
    await ctl.saveNow()
    const rec = await getDrawings('NQ')
    expect(rec?.items.map((x) => x.ovId)).toEqual(['a2'])
  })

  it('copy duplicates with value offset 1.001 and a new id', async () => {
    await ctl.load('NQ')
    chart.createOverlay({ name: 'segment', points: [livePoint(1500, 10), livePoint(1600, 12)], id: 'a1', lock: false, visible: true })
    const n0 = chart.overlays.length
    ctl.copy('a1')
    expect(chart.overlays.length).toBe(n0 + 1)
    const copy = chart.overlays[chart.overlays.length - 1]
    expect(copy.id).not.toBe('a1')
    expect(copy.points[0].value).toBeCloseTo(10 * 1.001, 9)
    expect(copy.points[0].timestamp).toBe(1500)
  })

  it('toggleLock / toggleVisible round-trip through serialisation', () => {
    ctl.toggleLock('a1')
    const a1 = byId(serializeOverlays(chart as unknown as Chart), 'a1')
    expect(a1?.lock).toBe(true)
    ctl.toggleVisible('a2')
    const a2 = byId(serializeOverlays(chart as unknown as Chart), 'a2')
    expect(a2?.visible).toBe(false)
  })

  it('writeStylesColor sets styles.line.color for built-ins and extendData.color for custom names', () => {
    ctl.writeStylesColor('a1', '#ff9900')
    const a1 = byId(serializeOverlays(chart as unknown as Chart), 'a1')
    expect((a1?.styles as { line?: { color?: string } }).line?.color).toBe('#ff9900')

    chart.createOverlay({ name: 'note', points: [livePoint(1500, 5)], id: 'n1' })
    ctl.writeStylesColor('n1', '#00ff00')
    const n1 = byId(serializeOverlays(chart as unknown as Chart), 'n1')
    expect((n1?.extendData as { color?: string }).color).toBe('#00ff00')
  })

  it('undo/redo removes then restores overlays', () => {
    const before = chart.overlays.length
    ctl.remove('a1')
    expect(chart.overlays.length).toBe(before - 1)
    expect(ctl.undo()).toBe(true)
    expect(chart.overlays.map((o) => o.id).sort()).toEqual(['a1', 'a2'])
    expect(ctl.redo()).toBe(true)
    expect(chart.overlays.map((o) => o.id)).toEqual(['a2'])
  })

  it('undo at stack bottom returns false without breaking state', () => {
    const fresh = new DrawingsCtl(chart as unknown as Chart)
    expect(fresh.undo()).toBe(false)
    expect(fresh.redo()).toBe(false)
    expect(chart.overlays.length).toBe(2)
  })

  it('clearAll wipes every overlay and persists the empty state', async () => {
    ctl.clearAll()
    expect(chart.overlays.length).toBe(0)
    await ctl.saveNow()
    const rec = await getDrawings('NQ')
    expect(rec?.items.length).toBe(0)
  })
})

describe('registry', () => {
  it('activeDrawingsCtl returns the ctl of the active pane', () => {
    expect(activeDrawingsCtl()?.getSymbol()).toBe('NQ')
    expect(getDrawingsCtl(3)).toBeNull()
    useStore.getState().setActivePane(1)
    expect(activeDrawingsCtl()).toBeNull()
  })
})

describe('magnet mode mapping', () => {
  it('maps settings.magnet to klinecharts modes on load', async () => {
    useStore.getState().updateSettings({ magnet: 'strong' })
    await putDrawings({ id: 'NQ', items: [{ ovId: 'm1', name: 'segment', points: [livePoint(1500, 10), livePoint(1600, 12)] }], updatedAt: 1 })
    await ctl.load('NQ')
    expect(chart.overlays[0]?.mode).toBe('strong_magnet')
  })
})
