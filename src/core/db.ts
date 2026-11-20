import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { DatasetRecord } from './types'

interface TaDB extends DBSchema {
  datasets: { key: string; value: DatasetRecord }
}

let dbp: Promise<IDBPDatabase<TaDB>> | null = null

function open(): Promise<IDBPDatabase<TaDB>> {
  if (!dbp) {
    dbp = openDB<TaDB>('ta_platform', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('datasets')) db.createObjectStore('datasets', { keyPath: 'id' })
      },
    })
  }
  return dbp
}

export async function allDatasets(): Promise<DatasetRecord[]> {
  try {
    const db = await open()
    return (await db.getAll('datasets')) ?? []
  } catch (e) {
    console.error('db read failed', e)
    return []
  }
}

export async function getDataset(id: string): Promise<DatasetRecord | undefined> {
  const db = await open()
  return db.get('datasets', id)
}

export async function putDataset(rec: DatasetRecord): Promise<void> {
  const db = await open()
  await db.put('datasets', rec)
}

export async function removeDataset(id: string): Promise<void> {
  const db = await open()
  await db.delete('datasets', id)
}

export interface UiSettings {
  lang: 'ar' | 'en'
  chartType: 'candle' | 'bar' | 'line' | 'area'
  upColor: string
  downColor: string
  timezone: string
  futureBars: number
  defaultBars: number
}

export const DEFAULT_SETTINGS: UiSettings = {
  lang: 'ar',
  chartType: 'candle',
  upColor: '#22ab94',
  downColor: '#f23645',
  timezone: 'UTC',
  futureBars: 40,
  defaultBars: 160,
}

const LS_KEY = 'ta_settings_v1'

export function loadSettings(): UiSettings {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<UiSettings>) }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(s: UiSettings): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(s))
  } catch (e) {
    console.error('settings save failed', e)
  }
}

export function candlesToCsv(sym: string, candles: { t: number; o: number; h: number; l: number; c: number; v: number }[]): string {
  const rows = ['time,open,high,low,close,volume']
  for (const c of candles) {
    rows.push(`${new Date(c.t).toISOString()},${c.o},${c.h},${c.l},${c.c},${c.v}`)
  }
  void sym
  return rows.join('\n')
}
