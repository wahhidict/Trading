import type { Chart } from 'klinecharts'

const charts = new Map<number, Chart>()

export function setPaneChart(paneIndex: number, chart: Chart | null): void {
  if (chart === null) charts.delete(paneIndex)
  else charts.set(paneIndex, chart)
}

export function getPaneChart(paneIndex: number): Chart | null {
  return charts.get(paneIndex) ?? null
}

export function allPaneCharts(): { pane: number; chart: Chart }[] {
  return [...charts.entries()].map(([pane, chart]) => ({ pane, chart })).sort((a, b) => a.pane - b.pane)
}
