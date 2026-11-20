import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { putDataset, getDataset, removeDataset, allDatasets, putDrawings, getDrawings, removeDrawings } from '../src/core/db'
import type { Candle } from '../src/core/types'

const c = (t: number): Candle => ({ t, o: 1, h: 2, l: 0.5, c: 1.5, v: 3 })

beforeEach(async () => {
  for (const r of await allDatasets()) await removeDataset(r.id)
  await removeDrawings('NQ')
})

describe('datasets IndexedDB CRUD (Data Manager replace/append/delete)', () => {
  it('append merges by re-putting the dataset with more candles', async () => {
    await putDataset({ id: 'NQ__1m', symbol: 'NQ', tf: '1m', count: 3, firstT: 1, lastT: 3, timezone: 'UTC', source: 'csv', updatedAt: 1, candles: [c(1), c(2), c(3)] })
    let rec = await getDataset('NQ__1m')
    expect(rec?.candles.length).toBe(3)

    await putDataset({ ...rec!, count: 5, lastT: 5, updatedAt: 2, candles: [c(1), c(2), c(3), c(4), c(5)] })
    rec = await getDataset('NQ__1m')
    expect(rec?.candles.length).toBe(5)
    expect(rec?.count).toBe(5)
    expect(rec?.updatedAt).toBe(2)
    expect((await allDatasets()).length).toBe(1)
  })

  it('replace overwrites the candles exactly', async () => {
    await putDataset({ id: 'NQ__1m', symbol: 'NQ', tf: '1m', count: 3, firstT: 1, lastT: 3, timezone: 'UTC', source: 'csv', updatedAt: 1, candles: [c(1), c(2), c(3)] })
    await putDataset({ id: 'NQ__1m', symbol: 'NQ', tf: '1m', count: 1, firstT: 100, lastT: 100, timezone: 'UTC', source: 'csv', updatedAt: 3, candles: [c(100)] })
    const rec = await getDataset('NQ__1m')
    expect(rec?.candles.map((x) => x.t)).toEqual([100])
  })

  it('delete removes the dataset', async () => {
    await putDataset({ id: 'ES__5m', symbol: 'ES', tf: '5m', count: 1, firstT: 1, lastT: 1, timezone: 'UTC', source: 'csv', updatedAt: 1, candles: [c(1)] })
    await removeDataset('ES__5m')
    expect(await getDataset('ES__5m')).toBeUndefined()
    expect((await allDatasets()).length).toBe(0)
  })

  it('values survive a fresh re-read with the same handle', async () => {
    await putDataset({ id: 'GC__1D', symbol: 'GC', tf: '1D', count: 2, firstT: 1, lastT: 2, timezone: 'UTC', source: 'csv', updatedAt: 1, candles: [c(1), c(2)] })
    const again = await getDataset('GC__1D')
    expect(again?.candles[1].t).toBe(2)
  })
})

describe('drawings storage', () => {
  it('put/get/clear per symbol', async () => {
    await putDrawings({ id: 'NQ', items: [{ ovId: 'a1', name: 'segment', points: [{ timestamp: 1, value: 2 }] }], updatedAt: 5 })
    const rec = await getDrawings('NQ')
    expect(rec?.items[0].ovId).toBe('a1')
    await removeDrawings('NQ')
    expect(await getDrawings('NQ')).toBeUndefined()
  })
})
