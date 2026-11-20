import { describe, expect, it } from 'vitest'
import { parseDelimited } from '../src/core/import/parse'
import { resample } from '../src/core/timeframes'
import type { Candle, ParseOptions } from '../src/core/types'
import { EMPTY_MAP } from '../src/core/types'

function bigCsv(n: number): { csv: string; first: Candle; last: Candle } {
  const start = Date.UTC(2023, 0, 2, 0, 0)
  const lines: string[] = ['time,open,high,low,close,volume']
  let price = 15000
  const mk = (t: number, i: number): Candle => {
    const w = ((i * 7919) % 100) / 5
    const o = price
    const c = o + (((i * 104729) % 40) - 20) / 10
    const h = Math.max(o, c) + w
    const l = Math.min(o, c) - w / 2
    price = c
    return { t, o: +o.toFixed(2), h: +h.toFixed(2), l: +l.toFixed(2), c: +c.toFixed(2), v: (i % 500) + 1 }
  }
  let first = mk(start, 0)
  let last = first
  for (let i = 0; i < n; i++) {
    last = mk(start + i * 60000, i)
    if (i === 0) first = last
    lines.push(`${new Date(last.t).toISOString()},${last.o},${last.h},${last.l},${last.c},${last.v}`)
  }
  return { csv: lines.join('\n'), first, last }
}

const opts: ParseOptions = {
  map: { ...EMPTY_MAP, tsCol: 0, openCol: 1, highCol: 2, lowCol: 3, closeCol: 4, volCol: 5 },
  hasHeader: true,
  timezone: 'UTC',
  epochIsUtc: true,
}

describe('large file (300,000 candles)', () => {
  const N = 300000
  const big = bigCsv(N)
  const t0 = performance.now()
  const res = parseDelimited(big.csv, opts)
  const ms = performance.now() - t0

  it('parses within acceptable time and keeps every value', () => {
    console.log(`[perf] 300k CSV parse: ${ms.toFixed(0)} ms`)
    expect(res.candles.length).toBe(N)
    expect(res.report.validCount).toBe(N)
    expect(res.report.invalidCount).toBe(0)
    expect(res.report.duplicateCount).toBe(0)
    expect(res.candles[0].t).toBe(big.first.t)
    expect(res.candles[0].o).toBe(big.first.o)
    expect(res.candles[N - 1].c).toBe(big.last.c)
    expect(res.report.firstT).toBe(big.first.t)
    expect(res.report.lastT).toBe(big.last.t)
    expect(ms).toBeLessThan(20000)
  })

  it('aggregating 300k 1m candles to 1h is fast and exact', () => {
    const t1 = performance.now()
    const h1 = resample(res.candles, '1h')
    const ms2 = performance.now() - t1
    console.log(`[perf] 300k resample to 1h: ${ms2.toFixed(0)} ms (${h1.length} bars)`)
    const spanMs = 3600000
    for (let i = 1; i < h1.length; i++) {
      if (h1[i].t - h1[i - 1].t !== spanMs) {
        expect(h1[i].t % spanMs).toBe(0)
      }
    }
    const sumV: number = res.candles.filter((x) => x.t >= h1[0].t && x.t < h1[0].t + spanMs).reduce((a, b) => a + b.v, 0)
    expect(h1[0].v).toBe(sumV)
    expect(h1[0].o).toBe(res.candles[0].o)
    expect(ms2).toBeLessThan(20000)
  })

  it('order is strictly monotonic with no duplicates after validation', () => {
    for (let i = 1; i < res.candles.length; i++) {
      expect(res.candles[i].t).toBeGreaterThan(res.candles[i - 1].t)
    }
    expect(new Set(res.candles.map((x) => x.t)).size).toBe(N)
  })
})
