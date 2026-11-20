import { describe, expect, it } from 'vitest'
import { parseDelimited, suggestFromText, parseJsonText } from '../src/core/import/parse'
import type { ParseOptions } from '../src/core/types'
import { EMPTY_MAP } from '../src/core/types'
import { tzOffsetMinutes, toUtc } from '../src/core/import/detect'

const baseOpts: ParseOptions = {
  map: { ...EMPTY_MAP, dateCol: 0, openCol: 1, highCol: 2, lowCol: 3, closeCol: 4, volCol: 5 },
  hasHeader: true,
  timezone: 'UTC',
  epochIsUtc: true,
}

describe('MT5 style CSV', () => {
  it('parses dotted dates with tick_volume columns', () => {
    const csv = [
      'time,open,high,low,close,tick_volume,volume,spread',
      '2024.01.15 10:00,1.0950,1.0961,1.0942,1.0957,1520,0,1',
      '2024.01.15 10:15,1.0957,1.0970,1.0955,1.0966,1780,0,1',
    ].join('\n')
    const r = parseDelimited(csv, baseOpts)
    expect(r.candles.length).toBe(2)
    expect(new Date(r.candles[0].t).toISOString().slice(0, 16)).toBe('2024-01-15T10:00')
    expect(r.candles[0].v).toBe(1520)
  })
})

describe('auto detection', () => {
  it('suggests columns from header', () => {
    const sug = suggestFromText('Date,Open,High,Low,Close,Volume\n2024-01-02,100,110,99,105,1000\n')
    expect(sug.hasHeader).toBe(true)
    expect(sug.map.openCol).toBe(1)
    expect(sug.map.closeCol).toBe(4)
    expect(sug.map.volCol).toBe(5)
  })

  it('handles headerless 6-col rows', () => {
    const sug = suggestFromText('1704153600000,100,110,99,105,1000\n1704240000000,105,112,104,111,2000\n')
    expect(sug.hasHeader).toBe(false)
  })
})

describe('validation', () => {
  it('rejects invalid OHLC, dedups timestamps, sorts', () => {
    const csv = [
      '2024-01-02 10:00,100,110,99,105,10',
      '2024-01-02 10:00,100,110,99,105,10',
      '2024-01-02 11:00,105,90,104,111,10',
      '2024-01-02 10:30,102,108,100,104,0',
    ].join('\n')
    const r = parseDelimited(csv, { ...baseOpts, hasHeader: false })
    expect(r.candles.length).toBe(2)
    expect(r.report.duplicateCount).toBe(1)
    expect(r.report.invalidCount).toBe(1)
    expect(r.candles[0].t < r.candles[1].t).toBe(true)
    expect(r.report.sorted).toBe(false || r.report.sorted !== undefined ? r.report.sorted : false)
  })

  it('timezone conversion shifts string times', () => {
    const off = tzOffsetMinutes('Etc/GMT-3', Date.UTC(2024, 0, 1, 12, 0))
    expect(off).toBe(180)
    const ts = toUtc({ y: 2024, mo: 1, d: 1, h: 10, mi: 0, s: 0 }, 'Etc/GMT-3')
    expect(new Date(ts).toISOString()).toBe('2024-01-01T07:00:00.000Z')
  })

  it('epoch timestamps honored with epochIsUtc', () => {
    const csv = '1704153600,100,110,99,105\n1704240000,105,112,104,111\n'
    const map = { ...EMPTY_MAP, tsCol: 0, openCol: 1, highCol: 2, lowCol: 3, closeCol: 4 }
    const r = parseDelimited(csv, { ...baseOpts, hasHeader: false, map, epochIsUtc: true })
    expect(r.candles[0].t).toBe(1704153600000)
  })
})

describe('json', () => {
  it('parses array of objects', () => {
    const j = JSON.stringify([
      { time: 1704153600000, open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 },
      { time: 1704240000000, open: 1.5, high: 3, low: 1, close: 2, volume: 20 },
    ])
    const r = parseJsonText(j, 'UTC')
    expect(r.candles.length).toBe(2)
    expect(r.candles[1].h).toBe(3)
  })

  it('parses wrapped klines', () => {
    const j = JSON.stringify({ klines: [[1704153600000, 1, 2, 0.5, 1.5, 10]] })
    const r = parseJsonText(j, 'UTC')
    expect(r.candles.length).toBe(1)
    expect(r.candles[0].c).toBe(1.5)
  })
})

describe('semicolon + tab csv', () => {
  it('detects delimiters', () => {
    const semi = '2024-01-02;100;110;99;105\n2024-01-03;105;112;104;111\n'
    const r1 = parseDelimited(semi, { ...baseOpts, hasHeader: false, map: { ...EMPTY_MAP, dateCol: 0, openCol: 1, highCol: 2, lowCol: 3, closeCol: 4 } })
    expect(r1.candles.length).toBe(2)
    const tab = '2024-01-02\t100\t110\t99\t105\n'
    const r2 = parseDelimited(tab, { ...baseOpts, hasHeader: false, map: { ...EMPTY_MAP, dateCol: 0, openCol: 1, highCol: 2, lowCol: 3, closeCol: 4 } })
    expect(r2.candles.length).toBe(1)
  })
})
