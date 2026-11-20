import { create } from 'zustand'
import type { DatasetMeta, TfKey, IndicatorConf, PaneState, ReplayState, RiskSettings } from '../core/types'
import { loadSettings, saveSettings, type UiSettings } from '../core/db'

export type ChartTypeKind = PaneState['chartType']
export type PanelTab = 'watch' | 'data' | 'ind' | 'draw' | 'ws'

function emptyPane(): PaneState {
  return { symbol: null, tf: null, chartType: 'candle', indicators: [] }
}

interface LayoutSave {
  panes: PaneState[]
  layout: number
  activePane: number
}

const LS_LAYOUT = 'ta_layout_v1'

function loadLayout(): LayoutSave {
  try {
    const raw = localStorage.getItem(LS_LAYOUT)
    if (!raw) return { panes: [emptyPane(), emptyPane(), emptyPane(), emptyPane()], layout: 1, activePane: 0 }
    const v = JSON.parse(raw) as Partial<LayoutSave>
    const panes = Array.isArray(v.panes) && v.panes.length === 4
      ? v.panes.map((p) => ({ ...emptyPane(), ...p }))
      : [emptyPane(), emptyPane(), emptyPane(), emptyPane()]
    return { panes, layout: v.layout === 2 || v.layout === 4 ? v.layout : 1, activePane: Math.min(Math.max(v.activePane ?? 0, 0), 3) }
  } catch {
    return { panes: [emptyPane(), emptyPane(), emptyPane(), emptyPane()], layout: 1, activePane: 0 }
  }
}

function persistLayout(panes: PaneState[], layout: number, activePane: number): void {
  try {
    localStorage.setItem(LS_LAYOUT, JSON.stringify({ panes, layout, activePane }))
  } catch (e) {
    console.error('layout save failed', e)
  }
}

export interface AppState {
  ready: boolean
  lang: 'ar' | 'en'
  settings: UiSettings
  metas: DatasetMeta[]
  panes: PaneState[]
  layout: 1 | 2 | 4
  activePane: number
  drawingTool: string | null
  importOpen: boolean
  replaceTarget: { id: string; symbol: string } | null
  panelTab: PanelTab
  statusMsg: string
  hoverCandles: Record<number, { o: number; h: number; l: number; c: number; v: number } | null>
  selectedOverlay: string | null
  contextMenu: { x: number; y: number } | null
  replay: ReplayState
  replayWidget: boolean
  risk: RiskSettings
  drawingsVersion: number
  workspaceTick: number
  setReady: (v: boolean) => void
  setLang: (l: 'ar' | 'en') => void
  updateSettings: (patch: Partial<UiSettings>) => void
  setMetas: (m: DatasetMeta[]) => void
  setPane: (i: number, patch: Partial<PaneState>) => void
  setPanes: (panes: PaneState[]) => void
  setPaneSymbol: (i: number, sym: string | null) => void
  setPaneTf: (i: number, tf: TfKey | null) => void
  setLayout: (l: 1 | 2 | 4) => void
  setActivePane: (i: number) => void
  setDrawingTool: (t: string | null) => void
  setPaneIndicators: (i: number, list: IndicatorConf[]) => void
  addIndicator: (i: number, conf: IndicatorConf) => void
  openImport: (target?: { id: string; symbol: string } | null) => void
  closeImport: () => void
  setPanelTab: (t: PanelTab) => void
  setStatus: (m: string) => void
  setHoverCandle: (pane: number, d: { o: number; h: number; l: number; c: number; v: number } | null) => void
  setSelectedOverlay: (id: string | null) => void
  openContextMenu: (x: number, y: number) => void
  closeContextMenu: () => void
  setReplay: (patch: Partial<ReplayState>) => void
  setReplayWidget: (open: boolean) => void
  setRisk: (patch: Partial<RiskSettings>) => void
  bumpDrawings: () => void
  bumpWorkspace: () => void
}

export const DEFAULT_RISK: RiskSettings = { balance: 0, riskPct: 1, tickSize: 0, pointValue: 0, contractSize: 0 }

const LS_RISK = 'ta_risk_v1'

function loadRisk(): RiskSettings {
  try {
    const raw = localStorage.getItem(LS_RISK)
    if (!raw) return { ...DEFAULT_RISK }
    return { ...DEFAULT_RISK, ...(JSON.parse(raw) as Partial<RiskSettings>) }
  } catch {
    return { ...DEFAULT_RISK }
  }
}

function metaToSummary(m: DatasetMeta): DatasetMeta {
  return { id: m.id, symbol: m.symbol, tf: m.tf, count: m.count, firstT: m.firstT, lastT: m.lastT, timezone: m.timezone, source: m.source, updatedAt: m.updatedAt }
}

export const useStore = create<AppState>((set, get) => {
  const s = loadSettings()
  const lay = loadLayout()
  if (typeof document !== 'undefined') {
    document.documentElement.lang = s.lang
    document.documentElement.dir = s.lang === 'ar' ? 'rtl' : 'ltr'
  }
  return {
    ready: false,
    lang: s.lang,
    settings: s,
    metas: [],
    panes: lay.panes,
    layout: lay.layout as 1 | 2 | 4,
    activePane: lay.activePane,
    drawingTool: null,
    importOpen: false,
    replaceTarget: null,
    panelTab: 'watch',
    statusMsg: '',
    hoverCandles: { 0: null },
    selectedOverlay: null,
    contextMenu: null,
    replay: { active: false, endTime: null, startTime: null, playing: false, speed: 500 },
    replayWidget: false,
    risk: loadRisk(),
    drawingsVersion: 0,
    workspaceTick: 0,
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
    setPane: (i, patch) => {
      const panes = get().panes.map((p, k) => (k === i ? { ...p, ...patch } : p))
      persistLayout(panes, get().layout, get().activePane)
      set({ panes })
    },
    setPanes: (newPanes) => {
      const complete = Array.from({ length: 4 }, (_, i) => ({ ...emptyPane(), ...(newPanes[i] ?? {}) }))
      persistLayout(complete, get().layout, get().activePane)
      set({ panes: complete })
    },
    setPaneSymbol: (i, sym) => {
      const { metas, panes } = get()
      const cur = panes[i] ?? emptyPane()
      const tf = cur.tf && metas.some((m) => m.symbol === sym && m.tf === cur.tf) ? cur.tf : null
      get().setPane(i, { symbol: sym, tf })
    },
    setPaneTf: (i, tf) => get().setPane(i, { tf }),
    setLayout: (l) => {
      const panes = [...get().panes]
      while (panes.length < 4) panes.push(emptyPane())
      persistLayout(panes, l, get().activePane)
      set({ panes, layout: l, activePane: get().activePane })
    },
    setActivePane: (i) => {
      persistLayout(get().panes, get().layout, i)
      set({ activePane: i })
    },
    setDrawingTool: (drawingTool) => set({ drawingTool, selectedOverlay: drawingTool ? null : get().selectedOverlay }),
    setPaneIndicators: (i, list) => get().setPane(i, { indicators: list }),
    addIndicator: (i, conf) => {
      const panes = get().panes.map((p, k) => (k === i ? { ...p, indicators: [...p.indicators, conf] } : p))
      persistLayout(panes, get().layout, get().activePane)
      set({ panes })
    },
    openImport: (target) => set({ importOpen: true, replaceTarget: target ?? null }),
    closeImport: () => set({ importOpen: false, replaceTarget: null }),
    setPanelTab: (panelTab) => set({ panelTab }),
    setStatus: (statusMsg) => set({ statusMsg }),
    setHoverCandle: (pane, d) => set({ hoverCandles: { ...get().hoverCandles, [pane]: d } }),
    setSelectedOverlay: (selectedOverlay) => set({ selectedOverlay }),
    openContextMenu: (x, y) => set({ contextMenu: { x, y } }),
    closeContextMenu: () => set({ contextMenu: null }),
    setReplay: (patch) => set({ replay: { ...get().replay, ...patch } }),
    setReplayWidget: (replayWidget) => set({ replayWidget }),
    setRisk: (patch) => {
      const risk = { ...get().risk, ...patch }
      try { localStorage.setItem(LS_RISK, JSON.stringify(risk)) } catch (e) { console.error('risk save failed', e) }
      set({ risk })
    },
    bumpDrawings: () => set({ drawingsVersion: get().drawingsVersion + 1 }),
    bumpWorkspace: () => set({ workspaceTick: get().workspaceTick + 1 }),
  }
})

export function activePaneState(): PaneState {
  const st = useStore.getState()
  return st.panes[st.activePane] ?? emptyPane()
}
