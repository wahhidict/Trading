import type { Chart, OverlayCreate } from 'klinecharts'
import type { SavedOverlay } from '../../core/types'
import { getDrawings, putDrawings } from '../../core/db'
import { useStore } from '../../state/store'

export function serializeOverlays(chart: Chart): SavedOverlay[] {
  return chart.getOverlays().map((o) => ({
    ovId: o.id,
    name: o.name,
    points: o.points.map((p) => ({ timestamp: p.timestamp ?? undefined, value: p.value ?? undefined })),
    styles: o.styles ?? undefined,
    lock: o.lock,
    visible: o.visible,
    extendData: o.extendData ?? undefined,
  }))
}

export type MagnetMode = 'normal' | 'weak_magnet' | 'strong_magnet'
type MagnetSetting = 'off' | 'weak' | 'strong'

function onClickSel(e: unknown): void {
  const { setSelectedOverlay } = useStore.getState()
  const ov = (e as { overlay?: { id?: string } }).overlay
  setSelectedOverlay(ov?.id ?? null)
}

function onRightClickSel(e: unknown): void {
  const st = useStore.getState()
  const ov = (e as { overlay?: { id?: string; x?: number; y?: number } }).overlay
  st.setSelectedOverlay(ov?.id ?? null)
  st.openContextMenu(ov?.x ?? 0, ov?.y ?? 0)
}

function overlayCreate(item: SavedOverlay, mode: MagnetMode, onMutate: () => void): OverlayCreate {
  return {
    id: item.ovId,
    name: item.name,
    points: item.points.filter((p) => typeof p.timestamp === 'number' && typeof p.value === 'number'),
    styles: (item.styles ?? undefined) as OverlayCreate['styles'],
    lock: item.lock ?? false,
    visible: item.visible ?? true,
    extendData: item.extendData,
    mode,
    onDrawEnd: onMutate,
    onPressedMoveEnd: onMutate,
    onClick: onClickSel,
    onRightClick: onRightClickSel,
  }
}

export class DrawingsCtl {
  private chart: Chart
  private symbol: string | null = null
  private timer: number | null = null
  private undoStack: SavedOverlay[][] = []
  private redoStack: SavedOverlay[][] = []
  private loading = false

  constructor(chart: Chart) {
    this.chart = chart
  }

  getSymbol(): string | null {
    return this.symbol
  }

  async load(symbol: string): Promise<void> {
    this.symbol = symbol
    const rec = await getDrawings(symbol)
    const crossTf = useStore.getState().settings.crossTfDrawings
    const mode = useStore.getState().settings.magnet
    this.loading = true
    const items = rec?.items ?? []
    for (const item of items) {
      if (!crossTf && !this.tfContains(item.points)) continue
      try { this.chart.createOverlay(overlayCreate(item, this.mapMode(mode), () => this.mutated())) } catch { /* skip broken overlay */ }
    }
    this.loading = false
    this.pushUndo()
  }

  private tfContains(points: SavedOverlay['points']): boolean {
    const st = useStore.getState()
    const meta = st.metas.find((m) => m.symbol === this.symbol && m.tf === (st.panes[st.activePane]?.tf ?? null))
    if (!meta) return true
    return points.some((p) => typeof p.timestamp === 'number' && p.timestamp >= meta.firstT && p.timestamp <= meta.lastT)
  }

  private mapMode(m: 'off' | 'weak' | 'strong'): MagnetMode {
    return m === 'weak' ? 'weak_magnet' : m === 'strong' ? 'strong_magnet' : 'normal'
  }

  detach(): void {
    this.chart.removeOverlay()
  }

  mutated(): void {
    if (this.loading || !this.symbol) return
    this.pushUndo()
    this.scheduleSave()
  }

  scheduleSave(): void {
    if (!this.symbol) return
    if (this.timer !== null) window.clearTimeout(this.timer)
    this.timer = window.setTimeout(() => {
      this.timer = null
      void this.saveNow()
    }, 500)
  }

  async saveNow(): Promise<void> {
    if (!this.symbol) return
    const items = serializeOverlays(this.chart)
    try {
      await putDrawings({ id: this.symbol, items, updatedAt: Date.now() })
      useStore.getState().bumpDrawings()
    } catch (e) {
      useStore.getState().setStatus('indexeddb_full')
      console.error('drawings save failed', e)
    }
  }

  private pushUndo(): void {
    this.undoStack.push(serializeOverlays(this.chart))
    if (this.undoStack.length > 50) this.undoStack.shift()
    this.redoStack = []
  }

  private rebuild(items: SavedOverlay[]): void {
    const mode = this.mapMode(useStore.getState().settings.magnet)
    const current = this.chart.getOverlays()
    for (const o of current) {
      try { this.chart.removeOverlay({ id: o.id }) } catch { /* ignore */ }
    }
    this.loading = true
    for (const item of items) {
      try { this.chart.createOverlay(overlayCreate(item, mode, () => this.mutated())) } catch { /* ignore */ }
    }
    this.loading = false
    void this.saveNow()
  }

  undo(): boolean {
    if (this.undoStack.length < 2) return false
    const cur = this.undoStack.pop() as SavedOverlay[]
    this.redoStack.push(cur)
    const prev = this.undoStack[this.undoStack.length - 1]
    if (prev) this.rebuild(prev)
    return true
  }

  redo(): boolean {
    const next = this.redoStack.pop()
    if (!next) return false
    this.undoStack.push(next)
    this.rebuild(next)
    return true
  }

  remove(id: string): void {
    try { this.chart.removeOverlay({ id }) } catch { /* ignore */ }
    this.mutated()
  }

  copy(id: string): void {
    const item = serializeOverlays(this.chart).find((o) => o.ovId === id)
    if (!item) return
    const copy = { ...item, ovId: `ov_${Date.now()}_${Math.floor(Math.random() * 1e5)}`, points: item.points.map((p) => ({ ...p, value: (p.value ?? 0) * 1.001 })) }
    const mode = this.mapMode(useStore.getState().settings.magnet)
    try { this.chart.createOverlay(overlayCreate(copy, mode, () => this.mutated())) } catch { /* ignore */ }
    this.mutated()
  }

  update(id: string, patch: Partial<SavedOverlay>): void {
    const mode = this.mapMode(useStore.getState().settings.magnet)
    const item = (() => {
      const cur = serializeOverlays(this.chart).find((o) => o.ovId === id)
      return cur ? { ...cur, ...patch } : null
    })()
    if (!item) return
    try { this.chart.removeOverlay({ id }) } catch { /* ignore */ }
    try { this.chart.createOverlay(overlayCreate(item, mode, () => this.mutated())) } catch { /* ignore */ }
    this.mutated()
  }

  getItems(): SavedOverlay[] {
    return serializeOverlays(this.chart)
  }

  writeStylesColor(id: string, color: string): void {
    const cur = serializeOverlays(this.chart).find((o) => o.ovId === id)
    if (!cur) return
    const customNames = ['labeledRect', 'labeledLine', 'note', 'channel3']
    const ed = (cur.extendData ?? {}) as Record<string, unknown>
    if (customNames.includes(cur.name)) {
      this.update(id, { extendData: { ...ed, color } })
      return
    }
    const st = (cur.styles ?? {}) as Record<string, unknown>
    this.update(id, {
      styles: {
        ...st,
        line: { ...(st.line as Record<string, unknown> | undefined), color },
        rect: { ...(st.rect as Record<string, unknown> | undefined), borderColor: color, color: typeof (st.rect as Record<string, unknown> | undefined)?.color === 'string' ? color : (st.rect as Record<string, unknown> | undefined)?.color },
        point: { ...(st.point as Record<string, unknown> | undefined), color, borderColor: color },
      },
    })
  }

  toggleLock(id: string): void {
    const cur = this.chart.getOverlays().find((o) => o.id === id)
    if (!cur) return
    this.update(id, { lock: !cur.lock })
  }

  toggleVisible(id: string): void {
    const cur = this.chart.getOverlays().find((o) => o.id === id)
    if (!cur) return
    this.update(id, { visible: !cur.visible })
  }

  clearAll(): void {
    try { this.chart.removeOverlay() } catch { /* ignore */ }
    this.mutated()
  }
}

const ctls = new Map<number, DrawingsCtl>()

export function setDrawingsCtl(paneIndex: number, ctl: DrawingsCtl | null): void {
  if (ctl === null) ctls.delete(paneIndex)
  else ctls.set(paneIndex, ctl)
}

export function getDrawingsCtl(paneIndex: number): DrawingsCtl | null {
  return ctls.get(paneIndex) ?? null
}

export function activeDrawingsCtl(): DrawingsCtl | null {
  const st = useStore.getState()
  return ctls.get(st.activePane) ?? null
}
