import { describe, expect, it } from 'vitest'
import { positionCalc } from '../src/features/drawings/position'
import { toHeikinAshi } from '../src/features/chart/paneData'
import type { KLineData } from 'klinecharts'

describe('positionCalc', () => {
  it('computes risk/reward and sides for a long', () => {
    const r = positionCalc(100, 90, 130, { balance: 10000, riskPct: 1, tickSize: 1, pointValue: 1, contractSize: 1 })
    expect(r).not.toBeNull()
    expect(r!.isLong).toBe(true)
    expect(r!.risk).toBe(10)
    expect(r!.reward).toBe(30)
    expect(r!.rr).toBeCloseTo(1 / 3, 6)
    expect(r!.riskMoney).toBe(100)
  })

  it('computes size only when all specs are present', () => {
    const r = positionCalc(100, 95, 115, { balance: 5000, riskPct: 2, tickSize: 0.5, pointValue: 2, contractSize: 10 })
    expect(r!.riskMoney).toBe(100)
    expect(r!.riskTicks).toBe(10)
    expect(r!.size).toBeCloseTo(100 / (10 * 2 * 10), 6)
    const r2 = positionCalc(100, 95, 115, { balance: 5000, riskPct: 2, tickSize: 0, pointValue: 2, contractSize: 10 })
    expect(r2!.size).toBeNull()
  })

  it('rejects degenerate setups', () => {
    expect(positionCalc(100, 100, 110, { balance: 0, riskPct: 0, tickSize: 0, pointValue: 0, contractSize: 0 })).toBeNull()
    expect(positionCalc(NaN, 90, 120, { balance: 0, riskPct: 0, tickSize: 0, pointValue: 0, contractSize: 0 })).toBeNull()
  })
})

describe('toHeikinAshi', () => {
  it('keeps timestamps and smooths bodies', () => {
    const rows: KLineData[] = [
      { timestamp: 1, open: 10, high: 12, low: 9, close: 11 },
      { timestamp: 2, open: 11, high: 14, low: 10, close: 13 },
    ]
    const ha = toHeikinAshi(rows)
    expect(ha[0]!.timestamp).toBe(1)
    expect(ha[0]!.close).toBeCloseTo(10.5, 6)
    expect(ha[1]!.open).toBeCloseTo((10.5 + ha[0]!.close) / 2, 6)
    expect(ha[1]!.high).toBeGreaterThanOrEqual(ha[1]!.close!)
    expect(ha[1]!.low).toBeLessThanOrEqual(ha[1]!.open!)
  })
})
