import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import type { DatasetMeta } from '../src/core/types'
import { loadPaneRecords, getFullRows, transformFor, toK } from '../src/features/chart/paneData'
import { putDataset } from '../src/core/db'

const MIN = 60000
function m1(symbol: string, n: number, startT = Date.UTC(2024, 0, 2, 9, 30)): { t: number; o: number; h: number; l: number; c: number; v: number }[] {
  const out: { t: number; o: number; h: number; l: number; c: number; v: number }[] = []
  let p = 100
  for (let i = 0; i < n; i++) {
    const t = startT + i * MIN
    const o = p
    const h = o + 1.5
    const l = o - 1
    const c = o + (i % 2 === 0 ? 0.5 : -0.5)
    p = c
    out.push({ t, o, h, l, c, v: 100 + i })
  }
  return out
}

const metas = (recs: DatasetMeta[]): { symbol: string; tf: DatasetMeta['tf']; id: string }[] => recs.map((r) => ({ symbol: r.symbol, tf: r.tf, id: r.id }))

beforeEach(async () => {
  const { 'default': FDBFactory } = (await import('fake-indexeddb')) as never as { default?: unknown }
  void FDBFactory
})

describe('bar replay data slicing (no future leakage)', () => {
  it('exact tf + endTime returns only visible candles and keeps full rows cached', async () => {
    const rows1m = m1('NQ', 500)
    const rec = { id: 'NQ__1m', symbol: 'NQ', tf: '1m' as const, count: rows1m.length, firstT: rows1m[0].t, lastT: rows1m[rows1m.length - 1].t, timezone: 'UTC', source: 'test', updatedAt: 1, candles: rows1m }
    await putDataset(rec)
    const list = metas([{ id: rec.id, symbol: 'NQ', tf: '1m', count: rec.count, firstT: rec.firstT, lastT: rec.lastT } as DatasetMeta])
    const cut = rows1m[300].t
    const slice = await loadPaneRecords(0, 'NQ', '1m', 'candle', list, cut)
    expect(slice).not.toBeNull()
    expect(slice!.length).toBe(301)
    expect(slice!.every((r) => r.timestamp <= cut)).toBe(true)
    expect(slice![slice!.length - 1].timestamp).toBe(cut)
    expect(getFullRows('NQ', '1m').length).toBe(500)
    const next = getFullRows('NQ', '1m').find((r) => r.timestamp > cut)
    expect(next?.timestamp).toBe(rows1m[301].t)
  })

  it('aggregated tf (5m from 1m) slices cleanly and aggregates OHLCV exactly', async () => {
    const rows1m = m1('ES', 200)
    await putDataset({ id: 'ES__1m', symbol: 'ES', tf: '1m', count: rows1m.length, firstT: rows1m[0].t, lastT: rows1m[rows1m.length - 1].t, timezone: 'UTC', source: 'test', updatedAt: 1, candles: rows1m })
    const list = metas([{ id: 'ES__1m', symbol: 'ES', tf: '1m', count: rows1m.length, firstT: rows1m[0].t, lastT: rows1m[rows1m.length - 1].t } as DatasetMeta])
    const cut = rows1m[29].t
    const slice = await loadPaneRecords(0, 'ES', '5m', 'candle', list, cut)
    expect(slice).not.toBeNull()
    expect(slice!.every((r) => r.timestamp <= cut)).toBe(true)
    const b0 = rows1m.slice(0, 5)
    expect(slice![0].open).toBe(b0[0].o)
    expect(slice![0].close).toBe(b0[b0.length - 1].c)
    expect(slice![0].high).toBe(Math.max(...b0.map((x) => x.h)))
    expect(slice![0].low).toBe(Math.min(...b0.map((x) => x.l)))
    expect(slice![0].volume).toBe(b0.reduce((a, b) => a + b.v, 0))
    expect(getFullRows('ES', '5m').length).toBe(40)
  })

  it('Heikin Ashi transform keeps timestamps monotonic', async () => {
    const rows1m = m1('GC', 50)
    const ha = transformFor(rows1m.map(toK), 'ha')
    expect(ha.length).toBe(50)
    expect(ha.every((r, i) => i === 0 || r.timestamp > ha[i - 1].timestamp)).toBe(true)
    expect(ha.every((r) => r.high >= Math.max(r.open, r.close) && r.low <= Math.min(r.open, r.close))).toBe(true)
  })
})
