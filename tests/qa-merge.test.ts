import { describe, expect, it } from 'vitest'
import { mergeCandles } from '../src/core/import/validate'
import { parseDelimited } from '../src/core/import/parse'
import { canAggregate, availableTfs, resample } from '../src/core/timeframes'
import type { Candle } from '../src/core/types'

const c = (t: number, o: number, h: number, l: number, cl: number, v = 0): Candle => ({ t, o, h, l, c: cl, v })

describe('mergeCandles', () => {
  it('merges, dedupes by timestamp, sorts, and reports added count', () => {
    const existing = [c(1000, 1, 2, 0.5, 1.5), c(2000, 1.5, 2.5, 1, 2)]
    const incoming = [c(2000, 9, 9, 9, 9), c(3000, 2, 3, 1.5, 2.5)]
    const r = mergeCandles(existing, incoming)
    expect(r.added).toBe(1)
    expect(r.candles.map((x) => x.t)).toEqual([1000, 2000, 3000])
    expect(r.candles[1].c).toBe(9)
  })

  it('incoming overrides existing on the same timestamp', () => {
    const r = mergeCandles([c(5, 1, 2, 1, 2, 5)], [c(5, 1, 2, 1, 2, 9)])
    expect(r.candles[0].v).toBe(9)
  })
})

describe('aggregation availability rules', () => {
  it('aggregates only when target is a clean multiple of the base', () => {
    expect(canAggregate('1m', '5m')).toBe(true)
    expect(canAggregate('1m', '1h')).toBe(true)
    expect(canAggregate('5m', '15m')).toBe(true)
    expect(canAggregate('1h', '15m')).toBe(false)
    expect(canAggregate('1m', '1W')).toBe(true)
    expect(canAggregate('1m', '1M')).toBe(true)
    expect(canAggregate('1W', '5m')).toBe(false)
    expect(canAggregate('custom', '5m')).toBe(false)
  })

  it('availableTfs lists every larger/aggregatable period — never smaller than data', () => {
    const out = availableTfs('NQ', [{ symbol: 'NQ', tf: '1m' }])
    expect(out).toContain('5m')
    expect(out).toContain('1h')
    expect(out).toContain('1W')
    expect(out).toContain('1M')
    expect(out.every((k) => k !== 'custom')).toBe(true)

    const h1 = availableTfs('ES', [{ symbol: 'ES', tf: '1h' }])
    expect(h1).toContain('1h')
    expect(h1).toContain('4h')
    expect(h1).not.toContain('5m')
    expect(h1).not.toContain('15m')
    expect(h1).not.toContain('30m')
  })
})

describe('resample session-gap integrity', () => {
  it('never fabricates bars for missing periods', () => {
    const base = [
      c(Date.UTC(2024, 0, 2, 14, 54), 100, 101, 99, 100.5, 10),
      c(Date.UTC(2024, 0, 2, 14, 56), 100.5, 102, 100, 101.5, 5),
      c(Date.UTC(2024, 0, 2, 15, 2), 103, 104, 102, 103.5, 7),
    ]
    const out = resample(base, '5m')
    expect(out.map((x) => x.t)).toEqual([Date.UTC(2024, 0, 2, 14, 50), Date.UTC(2024, 0, 2, 14, 55), Date.UTC(2024, 0, 2, 15, 0)])
    expect(out[0]).toEqual({ t: Date.UTC(2024, 0, 2, 14, 50), o: 100, h: 101, l: 99, c: 100.5, v: 10 })
    expect(out[1]).toEqual({ t: Date.UTC(2024, 0, 2, 14, 55), o: 100.5, h: 102, l: 100, c: 101.5, v: 5 })
    expect(out[2]).toEqual({ t: Date.UTC(2024, 0, 2, 15, 0), o: 103, h: 104, l: 102, c: 103.5, v: 7 })
  })

  it('timezone combinations: ISO-Z, ISO naive, MT5 dotted, epoch seconds all parse to exact OHLC', () => {
    const csv = [
      'datetime,open,high,low,close,vol',
      '2024-01-02T09:30:00.000Z,1,2,0.5,1.5,7',
      '2024-01-02 10:00:00,2,3,1,2.5,8',
      '2024.01.02 10:30:00,3,4,2,3.5,9',
      '1704195000,4,5,3,4.5,10',
    ].join('\n')
    const map = { dateCol: -1, timeCol: -1, tsCol: 0, openCol: 1, highCol: 2, lowCol: 3, closeCol: 4, volCol: 5 }
    const res = parseDelimited(csv, { map, hasHeader: true, timezone: 'UTC', epochIsUtc: false })
    expect(res.candles.length).toBe(4)
    expect(res.report.invalidCount).toBe(0)
    expect(res.candles[0].t).toBe(Date.parse('2024-01-02T09:30:00Z'))
    expect(res.candles[0].h).toBe(2)
    expect(res.candles[1].t).toBe(Date.UTC(2024, 0, 2, 10, 0))
    expect(res.candles[1].l).toBe(1)
    expect(res.candles[2].t).toBe(Date.UTC(2024, 0, 2, 10, 30))
    expect(res.candles[2].c).toBe(3.5)
    expect(res.candles[3].t).toBe(1704195000 * 1000)
    expect(res.candles[3].v).toBe(10)
    expect(res.report.duplicateCount).toBe(0)
  })
})
