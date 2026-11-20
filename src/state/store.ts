import { create } from 'zustand'
import type { DatasetMeta, TfKey } from '../core/types'
import { loadSettings, saveSettings, type UiSettings } from '../core/db'

export type ChartTypeKind = UiSettings['chartType']

export interface AppState {
  ready: boolean
  lang: 'ar' | 'en'
  settings: UiSettings
  metas: DatasetMeta[]
  symbol: string | null
  tf: TfKey | null
  chartType: ChartTypeKind
  importOpen: boolean
  panelTab: 'watch' | 'data'
  statusMsg: string
  hoverCandle: { o: number; h: number; l: number; c: number; v: number } | null
  replaceTarget: { id: string; symbol: string } | null
  setReady: (v: boolean) => void
  setLang: (l: 'ar' | 'en') => void
  updateSettings: (patch: Partial<UiSettings>) => void
  setMetas: (m: DatasetMeta[]) => void
  setSymbol: (s: string | null) => void
  setTf: (t: TfKey | null) => void
  setChartType: (t: ChartTypeKind) => void
  openImport: (target?: { id: string; symbol: string } | null) => void
  closeImport: () => void
  setPanelTab: (t: 'watch' | 'data') => void
  setStatus: (m: string) => void
  setHoverCandle: (d: { o: number; h: number; l: number; c: number; v: number } | null) => void
}

function metaToSummary(m: DatasetMeta): DatasetMeta {
  return { id: m.id, symbol: m.symbol, tf: m.tf, count: m.count, firstT: m.firstT, lastT: m.lastT, timezone: m.timezone, source: m.source, updatedAt: m.updatedAt }
}

export const useStore = create<AppState>((set, get) => {
  const s = loadSettings()
  if (typeof document !== 'undefined') {
    document.documentElement.lang = s.lang
    document.documentElement.dir = s.lang === 'ar' ? 'rtl' : 'ltr'
  }
  return {
    ready: false,
    lang: s.lang,
    settings: s,
    metas: [],
    symbol: null,
    tf: null,
    chartType: s.chartType,
    importOpen: false,
    panelTab: 'watch',
    statusMsg: '',
    hoverCandle: null,
    replaceTarget: null,
    setReady: (v) => set({ ready: v }),
    setLang: (l) => {
      const settings = { ...get().settings, lang: l }
      saveSettings(settings)
      if (typeof document !== 'undefined') {
        document.documentElement.lang = l
        document.documentElement.dir = l === 'ar' ? 'rtl' : 'ltr'
      }
      set({ lang: l, settings })
    },
    updateSettings: (patch) => {
      const settings = { ...get().settings, ...patch }
      saveSettings(settings)
      set({ settings })
    },
    setMetas: (m) => set({ metas: m.map(metaToSummary) }),
    setSymbol: (sym) => {
      const { metas, tf } = get()
      const cur = tf && metas.some((m) => m.symbol === sym && m.tf === tf) ? tf : null
      set({ symbol: sym, tf: cur })
    },
    setTf: (tf) => set({ tf }),
    setChartType: (chartType) => {
      const settings = { ...get().settings, chartType }
      saveSettings(settings)
      set({ chartType, settings })
    },
    openImport: (target) => set({ importOpen: true, replaceTarget: target ?? null }),
    closeImport: () => set({ importOpen: false, replaceTarget: null }),
    setPanelTab: (panelTab) => set({ panelTab }),
    setStatus: (statusMsg) => set({ statusMsg }),
    setHoverCandle: (hoverCandle) => set({ hoverCandle }),
  }
})
