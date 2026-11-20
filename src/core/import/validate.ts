import type { Candle, ImportReport, TfKey } from '../types'
import { detectIntervalMs, detectTfKey } from '../timeframes'

export interface ValidateResult {
  candles: Candle[]
  report: ImportReport
}

export function validateCandles(rows: (Candle | { error: string })[], intervalHintSmallest = false): ValidateResult {
  void intervalHintSmallest
  const candles: Candle[] = []
  const invalidSamples: { row: number; reason: string }[] = []
  let invalidCount = 0
  rows.forEach((r, i) => {
    if ('error' in r) {
      invalidCount++
      if (invalidSamples.length < 25) invalidSamples.push({ row: i + 1, reason: r.error })
      return
    }
    if (!isFinite(r.t) || r.t <= 0) { invalidCount++; if (invalidSamples.length < 25) invalidSamples.push({ row: i + 1, reason: 'bad_time' }); return }
    if (r.v < 0) r = { ...r, v: 0 }
    candles.push(r)
  })
  const seen = new Set<number>()
  let duplicateCount = 0
  const deduped: Candle[] = []
  for (const c of candles) {
    if (seen.has(c.t)) { duplicateCount++; continue }
    seen.add(c.t)
    deduped.push(c)
  }
  let sorted = true
  for (let i = 1; i < deduped.length; i++) {
    if (deduped[i].t < deduped[i - 1].t) { sorted = false; break }
  }
  if (!sorted) deduped.sort((a, b) => a.t - b.t)
  const intervalMs = deduped.length > 1 ? detectIntervalMs(deduped) : null
  const report: ImportReport = {
    totalRows: rows.length,
    validCount: deduped.length,
    invalidSamples,
    invalidCount,
    duplicateCount,
    sorted,
    firstT: deduped.length ? deduped[0].t : null,
    lastT: deduped.length ? deduped[deduped.length - 1].t : null,
    intervalMs,
    detectedTf: detectTfKey(intervalMs),
  }
  return { candles: deduped, report }
}

export function mergeCandles(existing: Candle[], incoming: Candle[]): { candles: Candle[]; added: number } {
  const map = new Map<number, Candle>()
  for (const c of existing) map.set(c.t, c)
  let added = 0
  for (const c of incoming) { if (!map.has(c.t)) added++; map.set(c.t, c) }
  const candles = [...map.values()].sort((a, b) => a.t - b.t)
  return { candles, added }
}
