import { registerOverlay, type Chart, type Overlay, type OverlayCreateFiguresCallbackParams, type OverlayFigure, type OverlayTemplate } from 'klinecharts'
import { positionCalc, fmtNum, fmtDuration, FIB_RATIOS, FIB_EXT_RATIOS, OTE_RATIOS } from './position'
import type { RiskCfg } from './position'

export interface RectData {
  label?: string
  color?: string
  dashed?: boolean
  extendRight?: boolean
  midline?: boolean
  zones?: boolean
}

export interface LineData {
  label?: string
  color?: string
  dashed?: boolean
  straight?: boolean
}

export interface PosData {
  risk: RiskCfg
}

const FONT = { size: 10, color: '#d1d4dc', weight: 'normal' }

function hexAlpha(hex: string, a: number): string {
  const h = hex.replace('#', '')
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const r = parseInt(v.slice(0, 2), 16), g = parseInt(v.slice(2, 4), 16), b = parseInt(v.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${a})`
}

function fig(type: string, attrs: Record<string, unknown>, styles?: Record<string, unknown>): OverlayFigure {
  return { type, attrs, styles } as OverlayFigure
}

function lineStyle(color: string, dashed?: boolean, size = 1): Record<string, unknown> {
  return { color, style: dashed ? 'dashed' : 'solid', size }
}

function rectBetween(c1: { x: number; y: number }, c2: { x: number; y: number }, color: string, border: string, dashed?: boolean): OverlayFigure {
  const x = Math.min(c1.x, c2.x)
  const y = Math.min(c1.y, c2.y)
  return fig('rect', {
    x, y,
    width: Math.max(Math.abs(c2.x - c1.x), 1),
    height: Math.abs(c2.y - c1.y),
  }, { color: hexAlpha(color, 0.14), borderColor: border, borderSize: 1, borderStyle: dashed ? 'dashed' : 'solid' })
}

const PRECISION = (chart: Chart): number => chart.getSymbol()?.pricePrecision ?? 2

function defaultData<T>(overlay: Overlay<T>, patch: Partial<T>): T {
  return { ...(patch as T), ...(overlay.extendData ?? {}) }
}

function entryLinesFigures(p: OverlayCreateFiguresCallbackParams<PosData>, entryY: number, labelColors: string[]): OverlayFigure[] {
  const { bounding } = p
  return [
    fig('line', { coordinates: [{ x: 0, y: entryY }, { x: bounding.width, y: entryY }] }, lineStyle(labelColors[0], false, 1)),
  ]
}

function posFigures(isLong: boolean) {
  return (p: OverlayCreateFiguresCallbackParams<PosData>): OverlayFigure[] => {
    const { coordinates, overlay, bounding } = p
    if (coordinates.length < 2 || coordinates[0] === undefined) return []
    const entryC = coordinates[0]!
    const slC = coordinates[1]!
    const tpC = coordinates.length > 2 ? coordinates[2] : null
    const data = defaultData(overlay, { risk: { balance: 0, riskPct: 0, tickSize: 0, pointValue: 0, contractSize: 0 } })
    const upColor = isLong ? '#22ab94' : '#22ab94'
    const downColor = '#f23645'
    const profitColor = isLong ? upColor : downColor
    const lossColor = isLong ? downColor : upColor
    const prec = PRECISION(p.chart)
    const entryVal = overlay.points[0]?.value as number
    const slVal = overlay.points[1]?.value as number
    const tpVal = tpC ? (overlay.points[2]?.value as number) : null
    const info2 = positionCalc(entryVal, slVal, tpVal, data.risk)
    if (!info2) return []
    const out: OverlayFigure[] = []
    if (tpC) out.push(rectBetween(entryC, tpC, profitColor, profitColor))
    out.push(rectBetween(entryC, slC, lossColor, lossColor, true))
    out.push(...entryLinesFigures(p, entryC.y, [entryVal === undefined ? '#888' : '#888c99']))
    out.push(fig('line', { coordinates: [{ x: 0, y: slC.y }, { x: bounding.width, y: slC.y }] }, lineStyle(lossColor, true, 1)))
    if (tpC) out.push(fig('line', { coordinates: [{ x: 0, y: tpC.y }, { x: bounding.width, y: tpC.y }] }, lineStyle(profitColor, false, 1)))
    const tx = Math.max(entryC.x, slC.x, tpC?.x ?? 0) + 6
    const label = (y: number, text: string, color: string): void => {
      out.push(fig('text', { x: tx, y, text, baseline: 'middle' }, { ...FONT, color, style: 'fill' }))
    }
    label(slC.y, `SL ${fmtNum(info2.sl, prec)}  (${fmtNum(info2.riskTicks, 1)} pts, -${fmtNum(info2.riskMoney)}$)`, lossColor)
    label(entryC.y, `${isLong ? 'LONG' : 'SHORT'} ${fmtNum(info2.entry, prec)}`, '#d1d4dc')
    if (tpC) label(tpC.y, `TP ${fmtNum(info2.tp, prec)}  (${fmtNum(info2.rewardTicks, 1)} pts)`, profitColor)
    if (tpC && info2.rr > 0) label((entryC.y + tpC.y) / 2, `R:R 1:${fmtNum(info2.rr, 2)}${info2.size !== null ? `  ·  size ${fmtNum(info2.size, 4)}` : ''}`, '#ffd166')
    return out
  }
}

function priceRangeFigures(p: OverlayCreateFiguresCallbackParams<RectData>): OverlayFigure[] {
  const { coordinates, overlay } = p
  if (coordinates.length < 2) return []
  const [a, b] = [coordinates[0]!, coordinates[1]!]
  const v1 = overlay.points[0]?.value ?? NaN
  const v2 = overlay.points[1]?.value ?? NaN
  const pct = v1 !== 0 ? ((v2 - v1) / Math.abs(v1)) * 100 : 0
  const color = v2 >= v1 ? '#22ab94' : '#f23645'
  return [
    rectBetween(a, b, color, color),
    fig('line', { coordinates: [a, { x: b.x, y: a.y }] }, lineStyle(color, true, 1)),
    fig('line', { coordinates: [{ x: a.x, y: a.y }, { x: a.x, y: b.y }] }, lineStyle(color, true, 1)),
    fig('line', { coordinates: [{ x: a.x, y: b.y }, b] }, lineStyle(color, true, 1)),
    fig('text', { x: Math.max(a.x, b.x) + 6, y: (a.y + b.y) / 2, text: `${fmtNum(Math.abs(v2 - v1), PRECISION(p.chart))}  (${pct >= 0 ? '+' : ''}${fmtNum(pct)}%)`, baseline: 'middle' }, { ...FONT, color, style: 'fill' }),
  ]
}

function dateRangeFigures(p: OverlayCreateFiguresCallbackParams<RectData>): OverlayFigure[] {
  const { coordinates, overlay, bounding } = p
  if (coordinates.length < 2) return []
  const [a, b] = [coordinates[0]!, coordinates[1]!]
  const t1 = overlay.points[0]?.timestamp ?? 0
  const t2 = overlay.points[1]?.timestamp ?? 0
  const color = '#2962ff'
  const out: OverlayFigure[] = [
    fig('rect', { x: a.x, y: 0, width: Math.abs(b.x - a.x), height: bounding.height }, { color: hexAlpha(color, 0.08), borderColor: hexAlpha(color, 0.3), borderSize: 1, borderStyle: 'dashed' }),
    fig('line', { coordinates: [{ x: a.x, y: 0 }, { x: a.x, y: bounding.height }] }, lineStyle(color, true, 1)),
    fig('line', { coordinates: [{ x: b.x, y: 0 }, { x: b.x, y: bounding.height }] }, lineStyle(color, true, 1)),
    fig('text', { x: (a.x + b.x) / 2, y: 10, text: fmtDuration(t2 - t1), align: 'center' }, { ...FONT, color, style: 'fill' }),
  ]
  return out
}

function extRectFigures(p: OverlayCreateFiguresCallbackParams<RectData>): OverlayFigure[] {
  const { coordinates } = p
  if (coordinates.length < 2 || coordinates[0] === undefined) return []
  const [a, b] = [coordinates[0]!, coordinates[1]!]
  const color = '#787b86'
  const out: OverlayFigure[] = [
    fig('rect', { x: a.x, y: a.y, width: Math.max(Math.abs(b.x - a.x), 1), height: Math.abs(b.y - a.y) }, { color: hexAlpha(color, 0.06), borderColor: color, borderSize: 1, borderStyle: 'dashed' }),
    fig('line', { coordinates: [{ x: 0, y: a.y }, { x: p.bounding.width, y: a.y }] }, lineStyle(color, true, 1)),
    fig('line', { coordinates: [{ x: 0, y: b.y }, { x: p.bounding.width, y: b.y }] }, lineStyle(color, true, 1)),
  ]
  return out
}

function fiberFigures(p: OverlayCreateFiguresCallbackParams<RectData>): OverlayFigure[] {
  const { coordinates, overlay, bounding } = p
  if (coordinates.length < 2) return []
  const a = coordinates[0]!
  const b = coordinates[1]!
  const v1 = overlay.points[0]?.value ?? 0
  const v2 = overlay.points[1]?.value ?? 0
  const out: OverlayFigure[] = []
  for (const r of FIB_RATIOS) {
    const value = v1 + (v2 - v1) * r
    const y = a.y + (b.y - a.y) * r
    out.push(fig('line', { coordinates: [{ x: a.x, y }, { x: bounding.width, y }] }, lineStyle('#787b86', true, 1)))
    out.push(fig('text', { x:bounding.width - 2, y: y - 8, text: `${(r * 100).toFixed(1)}%  ${fmtNum(value, PRECISION(p.chart))}`, align: 'right' }, { ...FONT, color: '#ffd166', style: 'fill' }))
  }
  return out
}

function fibExtFigures(p: OverlayCreateFiguresCallbackParams<RectData>): OverlayFigure[] {
  const { coordinates, overlay, bounding } = p
  if (coordinates.length < 3) return []
  const c0 = coordinates[0]!, c2 = coordinates[2]!
  const v0 = overlay.points[0]?.value ?? 0
  const v1 = overlay.points[1]?.value ?? 0
  const v2 = overlay.points[2]?.value ?? 0
  const out: OverlayFigure[] = []
  for (const r of FIB_EXT_RATIOS) {
    const value = v2 + (v1 - v0) * r
    const y = c2.y + (coordinates[1]!.y - c0.y) * r
    out.push(fig('line', { coordinates: [{ x: c2.x, y }, { x: bounding.width, y }] }, lineStyle('#2962ff', r === 1, 1)))
    out.push(fig('text', { x: bounding.width - 2, y: y - 8, text: `${(r * 100).toFixed(1)}%  ${fmtNum(value, PRECISION(p.chart))}`, align: 'right' }, { ...FONT, color: '#2962ff', style: 'fill' }))
  }
  return out
}

function fibFanFigures(p: OverlayCreateFiguresCallbackParams<RectData>): OverlayFigure[] {
  const { coordinates, bounding } = p
  if (coordinates.length < 2) return []
  const a = coordinates[0]!
  const b = coordinates[1]!
  const out: OverlayFigure[] = []
  for (const r of [0.236, 0.382, 0.5, 0.618, 0.786, 1]) {
    const y = a.y + (b.y - a.y) * r
    const endX = a.x + (b.x - a.x) / r
    out.push(fig('line', { coordinates: [a, { x: Math.min(endX, bounding.width), y }] }, lineStyle('#787b86', true, 1)))
  }
  return out
}

function arrowSegFigures(p: OverlayCreateFiguresCallbackParams<RectData>): OverlayFigure[] {
  const { coordinates } = p
  if (coordinates.length < 2) return []
  const a = coordinates[0]!, b = coordinates[1]!
  const ang = Math.atan2(b.y - a.y, b.x - a.x)
  const head = 10
  const h1 = { x: b.x - head * Math.cos(ang - Math.PI / 7), y: b.y - head * Math.sin(ang - Math.PI / 7) }
  const h2 = { x: b.x - head * Math.cos(ang + Math.PI / 7), y: b.y - head * Math.sin(ang + Math.PI / 7) }
  return [
    fig('line', { coordinates: [a, b] }, lineStyle('#d1d4dc', false, 1)),
    fig('polygon', { coordinates: [b, h1, h2] }, { color: '#d1d4dc', borderColor: '#d1d4dc', borderSize: 1 }),
  ]
}

function channelFigures(p: OverlayCreateFiguresCallbackParams<RectData>): OverlayFigure[] {
  const { coordinates, overlay } = p
  if (coordinates.length < 2) return []
  const a = coordinates[0]!, b = coordinates[1]!
  const c = coordinates.length > 2 ? coordinates[2]! : null
  const color = (overlay.extendData as RectData | undefined)?.color ?? '#2962ff'
  const out: OverlayFigure[] = [
    fig('line', { coordinates: [a, b] }, lineStyle(color, false, 1)),
  ]
  if (c) {
    const dx = b.x - a.x, dy = b.y - a.y
    const off = { x: c.x - a.x, y: c.y - a.y }
    out.push(fig('line', { coordinates: [{ x: a.x + off.x, y: a.y + off.y }, { x: b.x + off.x, y: b.y + off.y }] }, lineStyle(color, false, 1)))
    out.push(fig('polygon', { coordinates: [a, b, { x: b.x + off.x, y: b.y + off.y }, { x: a.x + off.x, y: a.y + off.y }] }, { color: hexAlpha(color, 0.1), borderColor: hexAlpha(color, 0.1), borderSize: 0 }))
  }
  return out
}

function labeledRectFigures(p: OverlayCreateFiguresCallbackParams<RectData>): OverlayFigure[] {
  const { coordinates, overlay, bounding } = p
  if (coordinates.length < 2 || coordinates[0] === undefined) return []
  const [a, b] = [coordinates[0]!, coordinates[1]!]
  const data = defaultData(overlay, { color: '#ffd166', label: '', dashed: false, extendRight: false, midline: false, zones: false })
  const color = data.color ?? '#ffd166'
  const right = data.extendRight ? bounding.width : b.x
  const out: OverlayFigure[] = [
    fig('rect', { x: a.x, y: Math.min(a.y, b.y), width: Math.max(right - a.x, 1), height: Math.abs(b.y - a.y) }, { color: hexAlpha(color, 0.12), borderColor: color, borderSize: 1, borderStyle: data.dashed ? 'dashed' : 'solid' }),
  ]
  if (data.midline) {
    out.push(fig('line', { coordinates: [{ x: a.x, y: (a.y + b.y) / 2 }, { x: right, y: (a.y + b.y) / 2 }] }, lineStyle(color, true, 1)))
  }
  if (data.zones) {
    const q1y = Math.min(a.y, b.y) + Math.abs(b.y - a.y) * 0.25
    const q3y = Math.min(a.y, b.y) + Math.abs(b.y - a.y) * 0.75
    for (const y of [q1y, q3y]) {
      out.push(fig('line', { coordinates: [{ x: a.x, y }, { x: right, y }] }, lineStyle(color, true, 1)))
    }
  }
  if (data.label) {
    out.push(fig('text', { x: a.x + 4, y: Math.min(a.y, b.y) - 6, text: data.label }, { ...FONT, color, style: 'fill' }))
  }
  return out
}

function labeledLineFigures(p: OverlayCreateFiguresCallbackParams<LineData>): OverlayFigure[] {
  const { coordinates, overlay, bounding } = p
  if (coordinates.length < 1 || coordinates[0] === undefined) return []
  const a = coordinates[0]!
  const b = coordinates.length > 1 ? coordinates[1]! : a
  const data = defaultData(overlay, { color: '#ffd166', label: '', dashed: true, straight: false })
  const color = data.color ?? '#ffd166'
  const coords = data.straight ? [{ x: 0, y: a.y }, { x: bounding.width, y: a.y }] : [a, b]
  const out: OverlayFigure[] = [fig('line', { coordinates: coords }, lineStyle(color, data.dashed, 1))]
  if (data.label) {
    const end = coords[coords.length - 1]!
    out.push(fig('text', { x: end.x, y: end.y - 8, text: data.label, align: data.straight ? 'start' : 'center' }, { ...FONT, color, style: 'fill' }))
  }
  return out
}

function oteFigures(p: OverlayCreateFiguresCallbackParams<RectData>): OverlayFigure[] {
  const { coordinates, overlay, bounding } = p
  if (coordinates.length < 2) return []
  const a = coordinates[0]!, b = coordinates[1]!
  const v1 = overlay.points[0]?.value ?? 0
  const v2 = overlay.points[1]?.value ?? 0
  const out: OverlayFigure[] = []
  const yFor = (r: number): number => a.y + (b.y - a.y) * r
  const valFor = (r: number): number => v1 + (v2 - v1) * r
  const y618 = yFor(0.618), y79 = yFor(0.79)
  out.push(fig('rect', { x: a.x, y: y618, width: Math.max(bounding.width - a.x, 1), height: Math.abs(y79 - y618) }, { color: hexAlpha('#2962ff', 0.15), borderColor: '#2962ff', borderSize: 1, borderStyle: 'dashed' }))
  for (const r of OTE_RATIOS) {
    out.push(fig('line', { coordinates: [{ x: a.x, y: yFor(r) }, { x: bounding.width, y: yFor(r) }] }, lineStyle('#2962ff', true, 1)))
    out.push(fig('text', { x: bounding.width - 2, y: yFor(r) - 8, text: `${fmtNum(valFor(r), PRECISION(p.chart))}`, align: 'right' }, { ...FONT, color: '#2962ff', style: 'fill' }))
  }
  return out
}

function textFigures(p: OverlayCreateFiguresCallbackParams<LineData>): OverlayFigure[] {
  const { coordinates, overlay } = p
  if (coordinates.length < 1 || coordinates[0] === undefined) return []
  const data = defaultData(overlay, { label: '', color: '#d1d4dc' })
  return [fig('text', { x: coordinates[0]!.x, y: coordinates[0]!.y, text: data.label ?? '' }, { ...FONT, color: data.color ?? '#d1d4dc', size: 12, style: 'fill' })]
}

const ev = {
  onDoubleClick: (e: { overlay: Overlay<LineData> & { extendData?: LineData } }): void => {
    const cur = (e.overlay.extendData as LineData | undefined)?.label ?? ''
    const v = window.prompt('Text:', cur)
    if (v !== null) e.overlay.extendData = { ...(e.overlay.extendData as LineData | undefined), label: v }
  },
}

function reg(name: string, tpl: unknown): void {
  registerOverlay(tpl as OverlayTemplate)
  void name
}

reg('priceRange', { name: 'priceRange', totalStep: 3, needDefaultPointFigure: true, needDefaultXAxisFigure: false, needDefaultYAxisFigure: false, createPointFigures: priceRangeFigures })
reg('dateRange2', { name: 'dateRange2', totalStep: 3, needDefaultPointFigure: true, needDefaultXAxisFigure: false, needDefaultYAxisFigure: false, createPointFigures: dateRangeFigures })
reg('extRect2', { name: 'extRect2', totalStep: 3, needDefaultPointFigure: true, createPointFigures: extRectFigures })
reg('fibRetrace', { name: 'fibRetrace', totalStep: 3, needDefaultPointFigure: true, createPointFigures: fiberFigures })
reg('fibExt', { name: 'fibExt', totalStep: 4, needDefaultPointFigure: true, createPointFigures: fibExtFigures })
reg('fibFan', { name: 'fibFan', totalStep: 3, needDefaultPointFigure: true, createPointFigures: fibFanFigures })
reg('arrowSeg', { name: 'arrowSeg', totalStep: 3, needDefaultPointFigure: false, createPointFigures: arrowSegFigures })
reg('channel3', { name: 'channel3', totalStep: 4, needDefaultPointFigure: true, createPointFigures: channelFigures })
reg('note', { name: 'note', totalStep: 2, needDefaultPointFigure: false, createPointFigures: textFigures, ...ev })
reg('labeledRect', { name: 'labeledRect', totalStep: 3, needDefaultPointFigure: true, createPointFigures: labeledRectFigures })
reg('labeledLine', { name: 'labeledLine', totalStep: 3, needDefaultPointFigure: true, createPointFigures: labeledLineFigures })
reg('ote2', { name: 'ote2', totalStep: 3, needDefaultPointFigure: true, createPointFigures: oteFigures })
reg('longPos', { name: 'longPos', totalStep: 4, needDefaultPointFigure: false, createPointFigures: posFigures(true), styles: { point: { color: 'transparent', borderColor: 'transparent' } } })
reg('shortPos', { name: 'shortPos', totalStep: 4, needDefaultPointFigure: false, createPointFigures: posFigures(false), styles: { point: { color: 'transparent', borderColor: 'transparent' } } })
