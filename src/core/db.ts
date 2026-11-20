import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { DatasetRecord, SymbolDrawings, WorkspaceRecord } from './types'

interface TaDB extends DBSchema {
  datasets: { key: string; value: DatasetRecord }
  drawings: { key: string; value: SymbolDrawings }
  workspaces: { key: string; value: WorkspaceRecord }
}

let dbp: Promise<IDBPDatabase<TaDB>> | null = null

function open(): Promise<IDBPDatabase<TaDB>> {
  if (!dbp) {
    dbp = openDB<TaDB>('ta_platform', 2, {
      upgrade(db, oldV) {
        if (!db.objectStoreNames.contains('datasets')) db.createObjectStore('datasets', { keyPath: 'id' })
        if (oldV < 2) {
          if (!db.objectStoreNames.contains('drawings')) db.createObjectStore('drawings', { keyPath: 'id' })
          if (!db.objectStoreNames.contains('workspaces')) db.createObjectStore('workspaces', { keyPath: 'id' })
        }
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

export async function getDrawings(symbol: string): Promise<SymbolDrawings | undefined> {
  try {
    const db = await open()
    return db.get('drawings', symbol)
  } catch (e) {
    console.error('drawings read failed', e)
    return undefined
  }
}

export async function putDrawings(d: SymbolDrawings): Promise<void> {
  const db = await open()
  await db.put('drawings', d)
}

export async function removeDrawings(symbol: string): Promise<void> {
  const db = await open()
  await db.delete('drawings', symbol)
}

export async function allDrawings(): Promise<SymbolDrawings[]> {
  try {
    const db = await open()
    return (await db.getAll('drawings')) ?? []
  } catch (e) {
    console.error('drawings read failed', e)
    return []
  }
}

export async function allWorkspaces(): Promise<WorkspaceRecord[]> {
  try {
    const db = await open()
    return (await db.getAll('workspaces')) ?? []
  } catch (e) {
    console.error('workspaces read failed', e)
    return []
  }
}

export async function putWorkspace(w: WorkspaceRecord): Promise<void> {
  const db = await open()
  await db.put('workspaces', w)
}

export async function removeWorkspace(id: string): Promise<void> {
  const db = await open()
  await db.delete('workspaces', id)
}

export async function getWorkspace(id: string): Promise<WorkspaceRecord | undefined> {
  const db = await open()
  return db.get('workspaces', id)
}

export interface UiSettings {
  lang: 'ar' | 'en'
  upColor: string
  downColor: string
  timezone: string
  futureBars: number
  defaultBars: number
  magnet: 'off' | 'weak' | 'strong'
  crossTfDrawings: boolean
  syncScroll: boolean
  syncZoom: boolean
}

export const DEFAULT_SETTINGS: UiSettings = {
  lang: 'ar',
  upColor: '#22ab94',
  downColor: '#f23645',
  timezone: 'UTC',
  futureBars: 40,
  defaultBars: 160,
  magnet: 'off',
  crossTfDrawings: true,
  syncScroll: false,
  syncZoom: false,
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
