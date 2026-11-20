import type { Candle, TfKey } from './types'

export interface TfDef {
  key: TfKey
  label: string
  minutes: number | 'W' | 'M'
  type: 'minute' | 'hour' | 'day' | 'week' | 'month'
  span: number
}

export const TFDEFS: TfDef[] = [
  { key: '1m', label: 'M1', minutes: 1, type: 'minute', span: 1 },
  { key: '3m', label: 'M3', minutes: 3, type: 'minute', span: 3 },
  { key: '5m', label: 'M5', minutes: 5, type: 'minute', span: 5 },
  { key: '15m', label: 'M15', minutes: 15, type: 'minute', span: 15 },
  { key: '30m', label: 'M30', minutes: 30, type: 'minute', span: 30 },
  { key: '1h', label: 'H1', minutes: 60, type: 'hour', span: 1 },
  { key: '2h', label: 'H2', minutes: 120, type: 'hour', span: 2 },
  { key: '4h', label: 'H4', minutes: 240, type: 'hour', span: 4 },
  { key: '8h', label: 'H8', minutes: 480, type: 'hour', span: 8 },
  { key: '1D', label: '1D', minutes: 1440, type: 'day', span: 1 },
  { key: '1W', label: '1W', minutes: 'W', type: 'week', span: 1 },
  { key: '1M', label: '1M', minutes: 'M', type: 'month', span: 1 },
]

export function tfDef(key: TfKey): TfDef | null {
  return TFDEFS.find((d) => d.key === key) ?? null
}

export function tfMinutes(key: TfKey): number | null {
  const d = tfDef(key)
  if (!d || d.minutes === 'W' || d.minutes === 'M') return null
  return d.minutes
}

export function tfPeriod(key: TfKey): { type: TfDef['type'], span: number } | null {
  const d = tfDef(key)
  if (!d) return null
  return { type: d.type, span: d.span }
}

export function tfKeyTime(t: number, key: TfKey): number {
  const mins = tfMinutes(key)
  if (mins !== null) return Math.floor(t / (mins * 60000)) * mins * 60000
  const d = new Date(t)
  if (key === '1W') {
    const day = (d.getUTCDay() + 6) % 7
    return t - day * 86400000 - ((d.getUTCHours() * 60 + d.getUTCMinutes()) * 60 + d.getUTCSeconds()) * 1000
  }
  if (key === '1M') return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)
  return t
}

export function resample(base: Candle[], key: TfKey): Candle[] {
  const out: Candle[] = []
  let cur: Candle | null = null
  let curKey = NaN
  for (const c of base) {
    const k = tfKeyTime(c.t, key)
    if (!cur || k !== curKey) {
      cur = { t: k, o: c.o, h: c.h, l: c.l, c: c.c, v: c.v }
      curKey = k
      out.push(cur)
    } else {
      if (c.h > cur.h) cur.h = c.h
      if (c.l < cur.l) cur.l = c.l
      cur.c = c.c
      cur.v += c.v
    }
  }
  return out
}

export function detectIntervalMs(candles: Candle[]): number | null {
  if (candles.length < 2) return null
  const diffs: number[] = []
  const step = Math.max(1, Math.floor(candles.length / 200))
  let prev = 0
  for (let i = 0; i < candles.length; i += step) {
    if (prev && candles[i].t > prev) diffs.push(candles[i].t - prev)
    prev = candles[i].t
  }
  if (!diffs.length) return null
  diffs.sort((a, b) => a - b)
  return diffs[Math.floor(diffs.length / 2)]
}

export function detectTfKey(intervalMs: number | null): TfKey {
  if (!intervalMs || intervalMs <= 0) return 'custom'
  for (const d of TFDEFS) {
    if (typeof d.minutes === 'number' && d.minutes * 60000 === intervalMs) return d.key
  }
  return 'custom'
}

export function canAggregate(from: TfKey, to: TfKey): boolean {
  if (from === to) return true
  const f = tfMinutes(from)
  if (f === null) return false
  const target = tfMinutes(to)
  if (target !== null) return target % f === 0 && target > f
  return f >= 0
}

export function availableTfs(symbol: string, metas: { symbol: string; tf: TfKey }[]): TfKey[] {
  const bases = metas.filter((m) => m.symbol === symbol && m.tf !== 'custom').map((m) => m.tf)
  const out: TfKey[] = []
  for (const def of TFDEFS) {
    if (bases.some((b) => canAggregate(b, def.key))) out.push(def.key)
  }
  return out
}
