import type { Chart } from 'klinecharts'

let current: Chart | null = null

export function setChartRef(c: Chart | null): void {
  current = c
}

export function getChartRef(): Chart | null {
  return current
}
