export interface ToolDef {
  id: string
  overlay: string | null
  labelKey: string
  icon: string
  extendData?: unknown
  needsRisk?: boolean
}

export interface ToolGroup {
  id: string
  labelKey: string
  tools: ToolDef[]
}

export const TOOL_GROUPS: ToolGroup[] = [
  {
    id: 'lines',
    labelKey: 'gLines',
    tools: [
      { id: 'cursor', overlay: null, labelKey: 'tCursor', icon: '✛' },
      { id: 'trend', overlay: 'segment', labelKey: 'tTrend', icon: '╱' },
      { id: 'ray', overlay: 'rayLine', labelKey: 'tRay', icon: '→' },
      { id: 'hline', overlay: 'horizontalStraightLine', labelKey: 'tHline', icon: '─' },
      { id: 'vline', overlay: 'verticalStraightLine', labelKey: 'tVline', icon: '│' },
      { id: 'arrow', overlay: 'arrowSeg', labelKey: 'tArrow', icon: '⇗' },
      { id: 'channel', overlay: 'channel3', labelKey: 'tChannel', icon: '⫽' },
      { id: 'priceChannel', overlay: 'priceChannelLine', labelKey: 'tPriceChannel', icon: '∥' },
    ],
  },
  {
    id: 'shapes',
    labelKey: 'gShapes',
    tools: [
      { id: 'rect', overlay: 'rect', labelKey: 'tRect', icon: '▭' },
      { id: 'extRect', overlay: 'extRect2', labelKey: 'tExtRect', icon: '▯' },
      { id: 'circle', overlay: 'circle', labelKey: 'tCircle', icon: '○' },
      { id: 'brush', overlay: 'brush', labelKey: 'tBrush', icon: '✎' },
      { id: 'text', overlay: 'note', labelKey: 'tText', icon: 'T' },
    ],
  },
  {
    id: 'fib',
    labelKey: 'gFib',
    tools: [
      { id: 'fibRetrace', overlay: 'fibRetrace', labelKey: 'tFibRetrace', icon: '𝔽' },
      { id: 'fibExt', overlay: 'fibExt', labelKey: 'tFibExt', icon: '≡' },
      { id: 'fibFan', overlay: 'fibFan', labelKey: 'tFibFan', icon: '◺' },
      { id: 'ote', overlay: 'ote2', labelKey: 'tOte', icon: '⌊⌋' },
    ],
  },
  {
    id: 'measure',
    labelKey: 'gMeasure',
    tools: [
      { id: 'priceRange', overlay: 'priceRange', labelKey: 'tPriceRange', icon: '⇕' },
      { id: 'dateRange', overlay: 'dateRange2', labelKey: 'tDateRange', icon: '⇔' },
    ],
  },
  {
    id: 'position',
    labelKey: 'gPosition',
    tools: [
      { id: 'longPos', overlay: 'longPos', labelKey: 'tLongPos', icon: '▲', needsRisk: true },
      { id: 'shortPos', overlay: 'shortPos', labelKey: 'tShortPos', icon: '▼', needsRisk: true },
    ],
  },
  {
    id: 'ict',
    labelKey: 'gIct',
    tools: [
      { id: 'fvg', overlay: 'labeledRect', labelKey: 'tFvg', icon: '▦', extendData: { label: 'FVG', color: '#2962ff', dashed: false, extendRight: false } },
      { id: 'ifvg', overlay: 'labeledRect', labelKey: 'tIfvg', icon: '▨', extendData: { label: 'IFVG', color: '#e040fb', dashed: true } },
      { id: 'ob', overlay: 'labeledRect', labelKey: 'tOb', icon: '▩', extendData: { label: 'OB', color: '#ff9800', dashed: false } },
      { id: 'breaker', overlay: 'labeledRect', labelKey: 'tBreaker', icon: 'B', extendData: { label: 'Breaker', color: '#00e5ff', dashed: true } },
      { id: 'premDisc', overlay: 'labeledRect', labelKey: 'tPremDisc', icon: '↕', extendData: { label: 'P/D', color: '#787b86', midline: true, zones: true, extendRight: true } },
      { id: 'killzone', overlay: 'labeledRect', labelKey: 'tKillzone', icon: '◷', extendData: { label: 'Session', color: '#4caf50', dashed: true, extendRight: false } },
      { id: 'liquidity', overlay: 'labeledLine', labelKey: 'tLiquidity', icon: '⌇', extendData: { label: 'Liquidity', color: '#ffd166', dashed: true, straight: true } },
      { id: 'eqh', overlay: 'labeledLine', labelKey: 'tEqh', icon: '⌒', extendData: { label: 'EQH', color: '#f23645', dashed: true, straight: true } },
      { id: 'eql', overlay: 'labeledLine', labelKey: 'tEql', icon: '⌄', extendData: { label: 'EQL', color: '#22ab94', dashed: true, straight: true } },
      { id: 'swingH', overlay: 'labeledLine', labelKey: 'tSwingH', icon: '∧', extendData: { label: 'Swing High', color: '#f23645', dashed: false, straight: false } },
      { id: 'swingL', overlay: 'labeledLine', labelKey: 'tSwingL', icon: '∨', extendData: { label: 'Swing Low', color: '#22ab94', dashed: false, straight: false } },
      { id: 'bos', overlay: 'labeledLine', labelKey: 'tBos', icon: '⤴', extendData: { label: 'BOS', color: '#2962ff', dashed: false } },
      { id: 'mss', overlay: 'labeledLine', labelKey: 'tMss', icon: '⤵', extendData: { label: 'MSS', color: '#e040fb', dashed: false } },
      { id: 'choch', overlay: 'labeledLine', labelKey: 'tChoch', icon: '⤦', extendData: { label: 'CHoCH', color: '#ff9800', dashed: false } },
    ],
  },
]

export const TOOL_BY_ID = new Map(TOOL_GROUPS.flatMap((g) => g.tools.map((t) => [t.id, t] as const)))
