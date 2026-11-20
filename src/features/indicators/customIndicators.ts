import { registerIndicator, type KLineData, type IndicatorTemplate } from 'klinecharts'

interface LineRec { vwap: number | null }
interface AtrRec { atr: number | null }
interface AdxRec { pdi: number | null; mdi: number | null; adx: number | null }

type VwapTpl = IndicatorTemplate<LineRec, number>
type AtrTpl = IndicatorTemplate<AtrRec, number>
type AdxTpl = IndicatorTemplate<AdxRec, number>

const vwap: VwapTpl = {
  name: 'VWAP',
  shortName: 'VWAP',
  calcParams: [],
  figures: [{ key: 'vwap', type: 'line', title: 'VWAP: ', styles: () => ({ color: '#ffd166', lineSize: 1 }) }],
  calc: (dataList: KLineData[]): LineRec[] => {
    let pv = 0, vv = 0
    return dataList.map((d) => {
      const vol = d.volume ?? 0
      const tp = (d.high + d.low + d.close) / 3
      pv += tp * vol
      vv += vol
      return { vwap: vv > 0 ? pv / vv : null }
    })
  },
}

const atr: AtrTpl = {
  name: 'ATR',
  shortName: 'ATR(14)',
  calcParams: [14],
  figures: [{ key: 'atr', type: 'line', title: 'ATR: ', styles: () => ({ color: '#b39ddb', lineSize: 1 }) }],
  regenerateFigures: (params: number[]) => [{ key: 'atr', type: 'line', title: `ATR(${params[0] ?? 14}): `, styles: () => ({ color: '#b39ddb', lineSize: 1 }) }],
  calc: (dataList: KLineData[], indicator: { calcParams: number[] }): AtrRec[] => {
    const n = Math.max(1, Math.round(indicator.calcParams[0] ?? 14))
    const out: AtrRec[] = []
    let prevClose = NaN
    let atrVal = NaN
    const trs: number[] = []
    for (const d of dataList) {
      const tr = isFinite(prevClose) ? Math.max(d.high - d.low, Math.abs(d.high - prevClose), Math.abs(d.low - prevClose)) : d.high - d.low
      trs.push(tr)
      if (trs.length === n) atrVal = trs.reduce((a, b) => a + b, 0) / n
      else if (trs.length > n) atrVal = (atrVal * (n - 1) + tr) / n
      prevClose = d.close
      out.push({ atr: isFinite(atrVal) ? atrVal : null })
    }
    return out
  },
}

const adx: AdxTpl = {
  name: 'ADX',
  shortName: 'ADX(14)',
  calcParams: [14],
  figures: [
    { key: 'pdi', type: 'line', title: 'DI+: ', styles: () => ({ color: '#22ab94', lineSize: 1 }) },
    { key: 'mdi', type: 'line', title: 'DI-: ', styles: () => ({ color: '#f23645', lineSize: 1 }) },
    { key: 'adx', type: 'line', title: 'ADX: ', styles: () => ({ color: '#ffd166', lineSize: 1 }) },
  ],
  regenerateFigures: (params: number[]) => [
    { key: 'pdi', type: 'line', title: `DI+(${params[0] ?? 14}): `, styles: () => ({ color: '#22ab94', lineSize: 1 }) },
    { key: 'mdi', type: 'line', title: `DI-(${params[0] ?? 14}): `, styles: () => ({ color: '#f23645', lineSize: 1 }) },
    { key: 'adx', type: 'line', title: `ADX(${params[0] ?? 14}): `, styles: () => ({ color: '#ffd166', lineSize: 1 }) },
  ],
  calc: (dataList: KLineData[], indicator: { calcParams: number[] }): AdxRec[] => {
    const n = Math.max(1, Math.round(indicator.calcParams[0] ?? 14))
    const out: AdxRec[] = []
    let trS = 0, pS = 0, mS = 0, adx: number | null = null
    const dxs: number[] = []
    const smooth = (cur: number, prev: number, len: number, first: boolean): number => (first ? (prev + cur) : (prev - prev / len + cur))
    let firstPass = true
    const adxProb: number[] = []
    for (let i = 0; i < dataList.length; i++) {
      const d = dataList[i]!
      const prev = dataList[i - 1]
      let pdi: number | null = null
      let mdi: number | null = null
      if (prev) {
        const up = d.high - prev.high
        const dn = prev.low - d.low
        const pdm = up > dn && up > 0 ? up : 0
        const mdm = dn > up && dn > 0 ? dn : 0
        const tr = Math.max(d.high - d.low, Math.abs(d.high - prev.close), Math.abs(d.low - prev.close))
        if (firstPass) { trS = (trS * 0 + tr) || 0; pS = pdm; mS = mdm; firstPass = false; for (let k = 1; k < n; k++) out.push({ pdi: null, mdi: null, adx: null }) }
        else { trS = smooth(tr, trS, n, false); pS = smooth(pdm, pS, n, false); mS = smooth(mdm, mS, n, false) }
        if (trS > 0) {
          const pdiV = (100 * pS) / trS
          const mdiV = (100 * mS) / trS
          pdi = pdiV
          mdi = mdiV
          const dx = pdiV + mdiV > 0 ? (100 * Math.abs(pdiV - mdiV)) / (pdiV + mdiV) : 0
          dxs.push(dx)
          if (dxs.length === n) { adx = dxs.reduce((a, b) => a + b, 0) / n; adxProb.push(adx) }
          else if (dxs.length > n) { adx = (adx !== null ? adx : dx) - (adx !== null ? adx : 0) / n + dx / n; adxProb.push(adx) }
        } else {
          for (let k = 0; k < 1; k++) out.push({ pdi: null, mdi: null, adx: null })
        }
        out.push({ pdi, mdi, adx })
      } else {
        out.push({ pdi: null, mdi: null, adx: null })
      }
    }
    void adxProb
    return out
  },
}

let registered = false

export function registerCustomIndicators(): void {
  if (registered) return
  registered = true
  registerIndicator(adx)
  registerIndicator(atr)
  registerIndicator(vwap)
}
