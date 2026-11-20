import { describe, expect, it } from 'vitest'
import { resample, tfKeyTime, canAggregate, availableTfs, detectTfKey, detectIntervalMs } from '../src/core/timeframes'
import type { Candle } from '../src/core/types'

function gen(minutes: number, count: number, start = Date.UTC(2024, 0, 1, 9, 0)): Candle[] {
  const out: Candle[] = []
  let price = 100
  for (let i = 0; i < count; i++) {
    const t = start + i * minutes * 60000
    price += 0.5
    out.push({ t, o: price, h: price + 1, l: price - 1, c: price + 0.25, v: 10 })
  }
  return out
}

describe('resample', () => {
  it('aggregates M1 to H1 with correct OHLCV', () => {
    const base = gen(1, 120)
    const h1 = resample(base, '1h')
    expect(h1.length).toBe(2)
    expect(h1[0].o).toBe(base[0].o)
    expect(h1[0].h).toBe(Math.max(...base.slice(0, 60).map((c) => c.h)))
    expect(h1[0].l).toBe(Math.min(...base.slice(0, 60).map((c) => c.l)))
    expect(h1[0].c).toBe(base[59].c)
    expect(h1[0].v).toBe(600)
  })

  it('aligns weekly bars to Monday', () => {
    const k = tfKeyTime(Date.UTC(2024, 0, 3, 10, 30), '1W')
    expect(new Date(k).toISOString()).toBe('2024-01-01T00:00:00.000Z')
  })

  it('aligns monthly bars to first of month', () => {
    const k = tfKeyTime(Date.UTC(2024, 4, 20, 13, 0), '1M')
    expect(new Date(k).toISOString()).toBe('2024-05-01T00:00:00.000Z')
  })

  it('never fabricates smaller timeframes from larger', () => {
    expect(canAggregate('1h', '1m')).toBe(false)
  })

  it('allows aggregation when divisible', () => {
    expect(canAggregate('1m', '15m')).toBe(true)
    expect(canAggregate('5m', '15m')).toBe(true)
    expect(canAggregate('5m', '1h')).toBe(true)
    expect(canAggregate('15m', '5m')).toBe(false)
  })

  it('detects tf from intervals', () => {
    const base = gen(5, 50)
    expect(detectIntervalMs(base)).toBe(300000)
    expect(detectTfKey(300000)).toBe('5m')
    expect(detectTfKey(700000)).toBe('custom')
  })

  it('availableTfs filters by base data', () => {
    const metas = [{ symbol: 'NQ', tf: '5m' as const }, { symbol: 'ES', tf: '1D' as const }]
    const nq = availableTfs('NQ', metas)
    expect(nq).toContain('15m')
    expect(nq).toContain('1D')
    expect(nq).not.toContain('1m')
    const es = availableTfs('ES', metas)
    expect(es).toEqual(['1D', '1W', '1M'])
  })
})
