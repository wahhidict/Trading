import type { Candle, ParseOptions } from '../types'
import { detectDelimiter, detectHasHeader, detectDateOrder, rowToCandle, splitLine, suggestMap } from './detect'
import { validateCandles, type ValidateResult } from './validate'

export interface TextParseResult extends ValidateResult {
  headers: string[]
  delimiter: string
  hasHeader: boolean
  dateOrder: boolean | null
}

export function parseDelimited(text: string, opts: ParseOptions): TextParseResult {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#') && !l.startsWith('//'))
  if (!lines.length) throw new Error('empty_file')
  const delim = detectDelimiter(lines[0])
  const allRows = lines.map((l) => splitLine(l, delim))
  const hasHeader = opts.hasHeader ?? detectHasHeader(allRows)
  const headers = hasHeader ? allRows[0] : allRows[0].map((_, i) => `#${i + 1}`)
  const body = hasHeader ? allRows.slice(1) : allRows
  const dataRows = body.filter((r) => r.length >= 4 && r.some((c) => c !== ''))
  const dateOrder = detectDateOrder(dataRows, opts.map)
  const rows = dataRows.map((r) => rowToCandle(r, opts.map, { timezone: opts.timezone, epochIsUtc: opts.epochIsUtc, dateFirst: dateOrder }))
  const res = validateCandles(rows)
  return { ...res, headers, delimiter: delim, hasHeader, dateOrder }
}

export function suggestFromText(text: string): { headers: string[]; rows: string[][]; map: ReturnType<typeof suggestMap>; delim: string; hasHeader: boolean } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim()).slice(0, 40)
  const delim = detectDelimiter(lines[0] ?? '')
  const rows = lines.map((l) => splitLine(l, delim))
  const hasHeader = detectHasHeader(rows)
  const headers = hasHeader ? rows[0] : (rows[0] ?? []).map((_, i) => `#${i + 1}`)
  const body = hasHeader ? rows.slice(1) : rows
  const map = suggestMap(headers, body)
  return { headers, rows: body.slice(0, 12), map, delim, hasHeader }
}

const JSON_KEY_ALIASES: Record<string, string[]> = {
  ts: ['time', 'timestamp', 't', 'date', 'datetime', 'ts', 'unix'],
  open: ['open', 'o'],
  high: ['high', 'h'],
  low: ['low', 'l'],
  close: ['close', 'c', 'last', 'price'],
  volume: ['volume', 'v', 'vol', 'tick_volume', 'tickvol'],
}

function pick(obj: Record<string, unknown>, names: string[]): unknown {
  for (const n of names) {
    if (n in obj && obj[n] !== '' && obj[n] !== null && obj[n] !== undefined) return obj[n]
  }
  return undefined
}

export function parseJsonText(text: string, timezone: string): ValidateResult {
  const data: unknown = JSON.parse(text)
  let list: unknown = data
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const obj = data as Record<string, unknown>
    list = obj.data ?? obj.klines ?? obj.candles ?? obj.bars ?? obj.list ?? null
  }
  if (!Array.isArray(list)) throw new Error('json_no_array')
  const rows: (Candle | { error: string })[] = []
  for (const item of list) {
    if (Array.isArray(item)) {
      if (item.length >= 5) {
        const raw0 = item[0]
        const t = typeof raw0 === 'number' ? (raw0 < 1e11 ? raw0 * 1000 : raw0) : Date.parse(String(raw0))
        const o = Number(item[1]), h = Number(item[2]), l = Number(item[3]), c = Number(item[4])
        const v = item.length > 5 ? Number(item[5]) : 0
        rows.push(isFinite(t) && isFinite(o) && isFinite(h) && isFinite(l) && isFinite(c)
          ? { t, o, h, l, c, v: isFinite(v) ? v : 0 }
          : { error: 'bad_row' })
      } else if (item.length === 4) {
        const o = Number(item[0]), h = Number(item[1]), l = Number(item[2]), c = Number(item[3])
        rows.push(isFinite(o) && isFinite(h) && isFinite(l) && isFinite(c) ? { error: 'no_time' } : { error: 'bad_ohlc' })
      } else rows.push({ error: 'bad_row' })
      continue
    }
    if (item && typeof item === 'object') {
      const obj = item as Record<string, unknown>
      const rawT = pick(obj, JSON_KEY_ALIASES.ts)
      let t: number
      if (typeof rawT === 'number') t = rawT < 1e11 ? rawT * 1000 : rawT
      else if (typeof rawT === 'string') {
        const p = Date.parse(rawT.replace(' ', 'T') + (rawT.length <= 10 ? 'T00:00:00Z' : rawT.includes('Z') || rawT.includes('+') ? '' : 'Z'))
        t = isFinite(p) ? p : NaN
        if (!isFinite(t)) {
          const dt = Date.parse(rawT)
          t = isFinite(dt) ? dt : NaN
        }
      } else t = NaN
      const o = Number(pick(obj, JSON_KEY_ALIASES.open))
      const h = Number(pick(obj, JSON_KEY_ALIASES.high))
      const l = Number(pick(obj, JSON_KEY_ALIASES.low))
      const c = Number(pick(obj, JSON_KEY_ALIASES.close))
      const rawV = pick(obj, JSON_KEY_ALIASES.volume)
      const v = rawV === undefined ? 0 : Number(rawV)
      rows.push(isFinite(t) && isFinite(o) && isFinite(h) && isFinite(l) && isFinite(c)
        ? { t, o, h, l, c, v: isFinite(v) ? v : 0 }
        : { error: t === t ? 'bad_ohlc' : 'bad_time' })
      continue
    }
    rows.push({ error: 'bad_row' })
  }
  void timezone
  return validateCandles(rows)
}
