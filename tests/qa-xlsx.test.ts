import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { parseDelimited, suggestFromText } from '../src/core/import/parse'
import type { ParseOptions } from '../src/core/types'
import { EMPTY_MAP } from '../src/core/types'

const mt5Opts: ParseOptions = {
  map: { ...EMPTY_MAP, dateCol: 0, openCol: 1, highCol: 2, lowCol: 3, closeCol: 4, volCol: 5 },
  hasHeader: true,
  timezone: 'UTC',
  epochIsUtc: true,
}

describe('XLSX (MT5 export round-trip through worker pipeline)', () => {
  it('parses an XLSX buffer exactly like the worker does', () => {
    const aoa = [
      ['time', 'open', 'high', 'low', 'close', 'tick_volume'],
      ['2024.01.15 10:00', 1.095, 1.0961, 1.0942, 1.0957, 1520],
      ['2024.01.15 10:15', 1.0957, 1.097, 1.0955, 1.0966, 1780],
      ['2024.01.15 10:30', 1.0966, 1.0975, 1.0961, 1.0962, 1610],
    ]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'S1')
    const written = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
    const bytes = written instanceof Uint8Array ? written : new Uint8Array(written as ArrayBuffer)
    const wb2 = XLSX.read(bytes, { type: 'array' })
    const csv = XLSX.utils.sheet_to_csv(wb2.Sheets[wb2.SheetNames[0]])
    const r = parseDelimited(csv, mt5Opts)
    expect(r.candles.length).toBe(3)
    expect(r.candles[0]).toEqual({ t: Date.UTC(2024, 0, 15, 10, 0), o: 1.095, h: 1.0961, l: 1.0942, c: 1.0957, v: 1520 })
    expect(r.candles[2]).toEqual({ t: Date.UTC(2024, 0, 15, 10, 30), o: 1.0966, h: 1.0975, l: 1.0961, c: 1.0962, v: 1610 })
    expect(r.report.invalidCount).toBe(0)
    expect(r.report.duplicateCount).toBe(0)
  })

  it('auto-detects XLSX-derived CSV columns', () => {
    const aoa = [['time', 'open', 'high', 'low', 'close', 'tick_volume'], ['2024.01.15 10:00', 1.095, 1.0961, 1.0942, 1.0957, 1520]]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'S1')
    const csv = XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]])
    const sug = suggestFromText(csv)
    expect(sug.map.openCol).toBe(1)
    expect(sug.map.closeCol).toBe(4)
    expect(sug.map.volCol).toBe(5)
    expect(sug.hasHeader).toBe(true)
  })
})
