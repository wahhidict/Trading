export interface Candle {
  t: number
  o: number
  h: number
  l: number
  c: number
  v: number
}

export type TfKey = '1m' | '3m' | '5m' | '15m' | '30m' | '1h' | '2h' | '4h' | '8h' | '1D' | '1W' | '1M' | 'custom'

export interface DatasetMeta {
  id: string
  symbol: string
  tf: TfKey
  count: number
  firstT: number
  lastT: number
  timezone: string
  source: string
  updatedAt: number
}

export interface DatasetRecord extends DatasetMeta {
  candles: Candle[]
}

export interface ImportReport {
  totalRows: number
  validCount: number
  invalidSamples: { row: number; reason: string }[]
  invalidCount: number
  duplicateCount: number
  sorted: boolean
  firstT: number | null
  lastT: number | null
  intervalMs: number | null
  detectedTf: TfKey
}

export interface ColumnMap {
  dateCol: number
  timeCol: number
  tsCol: number
  openCol: number
  highCol: number
  lowCol: number
  closeCol: number
  volCol: number
}

export interface ParseOptions {
  map: ColumnMap
  hasHeader: boolean
  timezone: string
  epochIsUtc: boolean
}

export const EMPTY_MAP: ColumnMap = {
  dateCol: -1, timeCol: -1, tsCol: -1, openCol: -1, highCol: -1, lowCol: -1, closeCol: -1, volCol: -1,
}
