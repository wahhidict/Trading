import type { ColumnMap, TfKey } from '../types'
import { TFDEFS, detectIntervalMs, detectTfKey } from '../timeframes'
import type { Candle } from '../types'

export interface RawRow { cells: string[] }

export function detectDelimiter(line: string): string {
  const cands = [',', ';', '\t', '|']
  let best = ','
  let bestN = 0
  for (const d of cands) {
    const n = line.split(d).length - 1
    if (n > bestN) { best = d; bestN = n }
  }
  if (bestN === 0 && /\s{2,}/.test(line)) return '  '
  if (bestN === 0) return ' '
  return best
}

export function splitLine(line: string, delim: string): string[] {
  if (delim === ' ') return line.trim().split(/\s+/)
  if (delim === '  ') return line.trim().split(/\s{2,}/)
  return line.split(delim).map((c) => c.trim().replace(/^"|"$/g, ''))
}

function isName(t: string): boolean {
  return /[a-z]/i.test(t) && !/^[\d.\-/: +]+$/.test(t)
}

const FIELD_ALIASES: Record<keyof ColumnMap, string[]> = {
  tsCol: ['unix', 'timestamp', 'epoch', 'ts'],
  dateCol: ['date'],
  timeCol: ['time', 'clock'],
  openCol: ['open'],
  highCol: ['high'],
  lowCol: ['low'],
  closeCol: ['close', 'last', 'price'],
  volCol: ['volume', 'vol', 'tick_volume', 'tickvol'],
}

export function suggestMap(headers: string[], rows: string[][]): ColumnMap {
  const m: ColumnMap = { dateCol: -1, timeCol: -1, tsCol: -1, openCol: -1, highCol: -1, lowCol: -1, closeCol: -1, volCol: -1 }
  const lower = headers.map((h) => h.toLowerCase())
  const find = (names: string[], used: Set<number>): number =>
    lower.findIndex((h, i) => names.some((n) => h.includes(n)) && !used.has(i))
  const used = new Set<number>()
  for (const key of ['tsCol', 'dateCol', 'timeCol', 'openCol', 'highCol', 'lowCol', 'closeCol', 'volCol'] as (keyof ColumnMap)[]) {
    const i = find(FIELD_ALIASES[key], used)
    if (i >= 0) { (m[key] as number) = i; used.add(i) }
  }
  if (m.tsCol < 0 && rows.length) {
    const first = rows[0]
    const i = first.findIndex((c) => /^\d{10}$/.test(c.trim()))
    if (i >= 0) { m.tsCol = i; used.add(i) }
  }
  if (m.dateCol < 0 && m.timeCol < 0 && m.tsCol < 0 && rows.length) {
    const first = rows[0]
    const i = first.findIndex((c) => /\d{4}[-./]/.test(c) || /^\d{8}[ ,]/.test(c + ' '))
    if (i >= 0) { m.dateCol = i; used.add(i) }
  }
  if (m.openCol < 0 && rows.length && rows[0].length >= 4 && m.tsCol < 0 && m.dateCol < 0) {
    const c = rows[0].length
    if (c === 6 || c === 5) { m.dateCol = 0; used.add(0) }
    if (c === 4) { m.openCol = 0 }
  }
  return m
}

export function detectHasHeader(rows: string[][]): boolean {
  if (!rows.length) return false
  return rows[0].some(isName)
}

export interface TimeParts { y: number; mo: number; d: number; h: number; mi: number; s: number }

export function parseTimeParts(s: string, dateFirst: boolean | null): TimeParts | null {
  const v = s.trim()
  if (!v) return null
  let m = /^(\d{4})[-./](\d{1,2})[-./](\d{1,2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2}))?(?:[.,](\d+))?)?(?:\s*(?:Z|[+-]\d{2}:?\d{2}))?$/i.exec(v)
  if (m) return { y: +m[1], mo: +m[2], d: +m[3], h: +(m[4] ?? 0), mi: +(m[5] ?? 0), s: +(m[6] ?? 0) }
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2}))?(?:[.,](\d+))?)?$/i.exec(v)
  if (m) {
    let a = +m[1], b = +m[2]
    if (a > 12) { const tmp = a; a = b; b = tmp }
    else if (dateFirst === false && a <= 12) { const tmp = a; a = b; b = tmp }
    return { y: +m[3], mo: a, d: b, h: +(m[4] ?? 0), mi: +(m[5] ?? 0), s: +(m[6] ?? 0) }
  }
  m = /^(\d{4})(\d{2})(\d{2})$/.exec(v)
  if (m) return { y: +m[1], mo: +m[2], d: +m[3], h: 0, mi: 0, s: 0 }
  return null
}

export function parseHMS(s: string): { h: number; mi: number; s: number } | null {
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(s.trim())
  if (!m) return null
  return { h: +m[1], mi: +m[2], s: +(m[3] ?? 0) }
}

export function tzOffsetMinutes(tz: string, ts: number): number {
  try {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
    const parts = dtf.formatToParts(new Date(ts))
    const get = (k: string): number => +(parts.find((p) => p.type === k)?.value ?? '0')
    const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'))
    return (asUtc - ts) / 60000
  } catch {
    return 0
  }
}

export function toUtc(parts: TimeParts, tz: string): number {
  const guess = Date.UTC(parts.y, parts.mo - 1, parts.d, parts.h, parts.mi, parts.s)
  const off = tzOffsetMinutes(tz, guess)
  const off2 = tzOffsetMinutes(tz, guess - off * 60000)
  return guess - off2 * 60000
}

export function rowToCandle(
  cells: string[],
  map: ColumnMap,
  opts: { timezone: string; epochIsUtc: boolean; dateFirst: boolean | null },
): Candle | { error: string } {
  const num = (i: number): number | null => (i < 0 || i >= cells.length ? null : Number(cells[i]))
  const o = num(map.openCol), h = num(map.highCol), l = num(map.lowCol), c = num(map.closeCol)
  if (o === null || h === null || l === null || c === null || !isFinite(o) || !isFinite(h) || !isFinite(l) || !isFinite(c)) {
    return { error: 'bad_ohlc' }
  }
  if (h < Math.max(o, c) || l > Math.min(o, c) || l > h) return { error: 'ohlc_range' }
  let t: number
  if (map.tsCol >= 0) {
    const raw = cells[map.tsCol]?.trim() ?? ''
    const n = Number(raw)
    if (raw && isFinite(n)) {
      t = n < 1e11 ? n * 1000 : n
      if (!opts.epochIsUtc) t -= tzOffsetMinutes(opts.timezone, t) * 60000
    } else {
      const parts = parseTimeParts(raw, opts.dateFirst)
      if (!parts) return { error: 'bad_time' }
      t = /[Zz]$/.test(raw) ? Date.parse(raw.replace(' ', 'T')) : toUtc(parts, opts.timezone)
      if (!isFinite(t)) return { error: 'bad_time' }
    }
  } else {
    const dv = map.dateCol >= 0 ? (cells[map.dateCol] ?? '') : ''
    const tv = map.timeCol >= 0 ? (cells[map.timeCol] ?? '') : ''
    let parts = parseTimeParts(dv, opts.dateFirst)
    if (parts && tv) {
      const hms = parseHMS(tv)
      if (hms) parts = { ...parts, h: hms.h, mi: hms.mi, s: hms.s }
      else {
        const combined = parseTimeParts(tv, opts.dateFirst)
        if (combined) parts = combined
      }
    }
    if (!parts && tv) parts = parseTimeParts(tv, opts.dateFirst)
    if (!parts) return { error: 'bad_time' }
    t = toUtc(parts, opts.timezone)
  }
  const v = num(map.volCol)
  const vol = v !== null && isFinite(v) ? v : 0
  return { t, o, h, l, c, v: vol }
}

export function detectDateOrder(rows: string[][], map: ColumnMap): boolean | null {
  for (const r of rows.slice(0, 40)) {
    const v = r[map.dateCol] ?? r[map.tsCol] ?? ''
    const m = /^(\d{1,2})\/(\d{1,2})\//.exec(v.trim())
    if (m) {
      if (+m[1] > 12) return true
      if (+m[2] > 12) return false
    }
  }
  return null
}

export function candlesMeta(candles: Candle[]): { intervalMs: number | null; tf: TfKey; firstT: number | null; lastT: number | null } {
  const intervalMs = candles.length > 1 ? detectIntervalMs(candles) : null
  return {
    intervalMs,
    tf: detectTfKey(intervalMs),
    firstT: candles.length ? candles[0].t : null,
    lastT: candles.length ? candles[candles.length - 1].t : null,
  }
}

export function tfLabel(key: TfKey): string {
  return TFDEFS.find((d) => d.key === key)?.label ?? key
}
