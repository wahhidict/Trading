import { beforeAll, describe, expect, it } from 'vitest'
import type { KLineData } from 'klinecharts'
import type { customTemplates as CustomTemplates } from '../src/features/indicators/customIndicators'

let customTemplates: typeof CustomTemplates
beforeAll(async () => {
  const g = globalThis as unknown as { window?: unknown; navigator?: unknown }
  if (!g.window) g.window = g
  if (!g.navigator) (g as { navigator: unknown }).navigator = { userAgent: 'node-test' }
  const mod = await import('../src/features/indicators/customIndicators')
  customTemplates = mod.customTemplates
})

function series(n: number): KLineData[] {
  let p = 50
  const out: KLineData[] = []
  for (let i = 0; i < n; i++) {
    const o = p
    const h = o + 2 + (i % 3)
    const l = o - 1 - (i % 2)
    const c = o + ((i * 37) % 11) - 5
    p = c
    out.push({ timestamp: 1700000000000 + i * 60000, open: o, high: h, low: l, close: c, volume: 100 + (i % 17) })
  }
  return out
}

describe('VWAP (reference-verified)', () => {
  it('equals cumulative sum(tp*vol)/sum(vol) computed independently', () => {
    const data = series(120)
    const got = customTemplates.vwap.calc(data, { calcParams: [], figures: [] } as unknown as Parameters<NonNullable<typeof customTemplates.vwap.calc>>[1]) as { vwap: number | null }[]
    let pv = 0
    let vv = 0
    const expectV: (number | null)[] = []
    for (const d of data) {
      const v = d.volume ?? 0
      const tp = (d.high + d.low + d.close) / 3
      pv += tp * v
      vv += v
      expectV.push(vv > 0 ? pv / vv : null)
    }
    expect(got.length).toBe(data.length)
    for (let i = 0; i < got.length; i++) {
      const g = got[i].vwap
      const e = expectV[i]
      if (e === null) expect(g).toBeNull()
      else expect(g).toBeCloseTo(e, 8)
    }
  })
})

describe('ATR (Wilder, reference-verified)', () => {
  it('equals an independently computed Wilder ATR', () => {
    const data = series(80)
    const n = 14
    const got = customTemplates.atr.calc(data, { calcParams: [n], figures: [] } as unknown as Parameters<NonNullable<typeof customTemplates.atr.calc>>[1]) as { atr: number | null }[]
    let prevClose = NaN
    let atr = NaN
    const trs: number[] = []
    for (const d of data) {
      const tr = isFinite(prevClose) ? Math.max(d.high - d.low, Math.abs(d.high - prevClose), Math.abs(d.low - prevClose)) : d.high - d.low
      trs.push(tr)
      if (trs.length === n) atr = trs.reduce((a, b) => a + b, 0) / n
      else if (trs.length > n) atr = (atr * (n - 1) + tr) / n
      prevClose = d.close
    }
    expect(got.at(-1)!.atr).toBeCloseTo(atr, 6)
  })
})

interface AdxRow { pdi: number | null; mdi: number | null; adx: number | null }

describe('ADX (hand-computed micro series, n=1)', () => {
  it('nulls before the first period, then DI+/ADX per hand calculations', () => {
    const data: KLineData[] = [
      { timestamp: 1, open: 10, high: 12, low: 9, close: 11 },
      { timestamp: 2, open: 11, high: 15, low: 10.5, close: 14 },
      { timestamp: 3, open: 14, high: 18, low: 13, close: 17 },
    ]
    const got = customTemplates.adx.calc(data, { calcParams: [1], figures: [] } as unknown as Parameters<NonNullable<typeof customTemplates.adx.calc>>[1]) as AdxRow[]
    expect(got.length).toBe(3)
    expect(got[0].pdi).toBeNull()
    expect(got[0].adx).toBeNull()

    // bar 2 (Wilder DM is high-to-high): up = 15-12 = 3 (pdm), down = 9-10.5 < 0 => mdm = 0
    // TR = max(15-10.5, |15-11|, |10.5-11|) = 4.5  =>  DI+ = 100*3/4.5 = 66.666...
    // n=1 => smoothing = value itself; DI+ - DI- = 66.67 > 0 => DX = 100
    expect(got[1].pdi).toBeCloseTo(66.6666667, 4)
    expect(got[1].mdi).toBeCloseTo(0, 8)
    expect(got[1].adx).toBeCloseTo(100, 6)

    // bar 3: up = 18-15 = 3, down = 10.5-13 < 0 => mdm = 0
    // TR = max(18-13, |18-14|, |13-14|) = 5  =>  DI+ = 100*3/5 = 60, DX = 100, ADX = 100
    expect(got[2].pdi).toBeCloseTo(60, 6)
    expect(got[2].adx).toBeCloseTo(100, 6)
  })
})
