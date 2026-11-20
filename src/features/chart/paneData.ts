import type { KLineData } from 'klinecharts'
import type { TfKey, Candle, ChartKind } from '../../core/types'
import { resample, tfMinutes } from '../../core/timeframes'
import { getDataset } from '../../core/db'

export function toK(c: Candle): KLineData {
  return { timestamp: c.t, open: c.o, high: c.h, low: c.l, close: c.c, volume: c.v }
}

export function toHeikinAshi(rows: KLineData[]): KLineData[] {
  const out: KLineData[] = []
  let prevOpen = NaN
  let prevClose = NaN
  for (const d of rows) {
    const haClose = (d.open + d.high + d.low + d.close) / 4
    const haOpen = isFinite(prevOpen) ? (prevOpen + prevClose) / 2 : (d.open + d.close) / 2
    out.push({
      timestamp: d.timestamp,
      open: haOpen,
      high: Math.max(d.high, haOpen, haClose),
      low: Math.min(d.low, haOpen, haClose),
      close: haClose,
      volume: d.volume,
    })
    prevOpen = haOpen
    prevClose = haClose
  }
  return out
}

export function transformFor(rows: KLineData[], chartType: ChartKind): KLineData[] {
  return chartType === 'ha' ? toHeikinAshi(rows) : rows
}

const rowsCache = new Map<number, KLineData[]>()

export function setPaneRows(paneIndex: number, rows: KLineData[]): void {
  rowsCache.set(paneIndex, rows)
}

export function getPaneRows(paneIndex: number): KLineData[] {
  return rowsCache.get(paneIndex) ?? []
}

const fullCache = new Map<string, KLineData[]>()

function cacheFull(key: string, rows: KLineData[]): void {
  fullCache.set(key, rows)
  if (fullCache.size > 24) {
    const first = fullCache.keys().next().value
    if (first !== undefined) fullCache.delete(first)
  }
}

export function getFullRows(symbol: string, tf: TfKey): KLineData[] {
  return fullCache.get(`${symbol}|${tf}`) ?? []
}

const aggCache = new Map<string, KLineData[]>()

async function loadRecords(symbol: string, tf: TfKey, metas: { symbol: string; tf: TfKey; id: string }[], endTime: number | null): Promise<KLineData[] | null> {
  const slice = (rows: KLineData[]): KLineData[] => (endTime !== null ? rows.filter((r) => r.timestamp <= endTime) : rows)
  const fullKey = `${symbol}|${tf}`
  const exact = metas.find((m) => m.symbol === symbol && m.tf === tf)
  if (exact) {
    const rec = await getDataset(exact.id)
    if (!rec) return null
    const full = rec.candles.map(toK)
    cacheFull(fullKey, full)
    return slice(full)
  }
  const target = tfMinutes(tf)
  if (target === null) return null
  const candidates = metas
    .filter((m) => m.symbol === symbol && m.tf !== tf)
    .map((m) => ({ m, mins: tfMinutes(m.tf) }))
    .filter((x) => x.mins !== null && (x.mins as number) < target && target % (x.mins as number) === 0)
    .sort((a, b) => (a.mins as number) - (b.mins as number))
  for (const cand of candidates) {
    const rec = await getDataset(cand.m.id)
    if (!rec || rec.candles.length < 2) continue
    const base = slice(rec.candles.map(toK))
    if (base.length < 2) continue
    const cacheKey = `${cand.m.id}->${tf}:${base.length}:${base[base.length - 1].timestamp}`
    const cached = aggCache.get(cacheKey)
    if (cached) {
      cacheFull(fullKey, cached)
      return cached
    }
    const built = resample(base.map((d) => ({ t: d.timestamp, o: d.open, h: d.high, l: d.low, c: d.close, v: d.volume ?? 0 })), tf).map(toK)
    if (aggCache.size > 24) aggCache.clear()
    aggCache.set(cacheKey, built)
    cacheFull(fullKey, built)
    return built
  }
  return null
}

export async function loadPaneRecords(paneIndex: number, symbol: string, tf: TfKey, chartType: ChartKind, metas: { symbol: string; tf: TfKey; id: string }[], endTime: number | null): Promise<KLineData[] | null> {
  const raw = await loadRecords(symbol, tf, metas, endTime)
  if (raw === null) return null
  const rows = transformFor(raw, chartType)
  setPaneRows(paneIndex, rows)
  return rows
}
