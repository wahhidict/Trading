export interface RiskCfg {
  balance: number
  riskPct: number
  tickSize: number
  pointValue: number
  contractSize: number
}

export interface PosInfo {
  entry: number
  sl: number
  tp: number
  risk: number
  reward: number
  rr: number
  riskTicks: number
  rewardTicks: number
  riskMoney: number
  size: number | null
  isLong: boolean
}

export function positionCalc(entry: number, sl: number, tp: number | null, cfg: RiskCfg): PosInfo | null {
  if (!isFinite(entry) || !isFinite(sl) || entry === sl) return null
  const risk = Math.abs(entry - sl)
  const reward = tp !== null && isFinite(tp) ? Math.abs(tp - entry) : 0
  const rr = reward > 0 ? risk / reward : 0
  const riskMoney = cfg.balance > 0 && cfg.riskPct > 0 ? (cfg.balance * cfg.riskPct) / 100 : 0
  let size: number | null = null
  if (riskMoney > 0 && cfg.tickSize > 0 && cfg.pointValue > 0 && cfg.contractSize > 0) {
    const ticks = risk / cfg.tickSize
    if (ticks > 0) size = riskMoney / (ticks * cfg.pointValue * cfg.contractSize)
  }
  return {
    entry, sl, tp: tp ?? NaN,
    risk, reward, rr,
    riskTicks: cfg.tickSize > 0 ? risk / cfg.tickSize : 0,
    rewardTicks: cfg.tickSize > 0 && reward > 0 ? reward / cfg.tickSize : 0,
    riskMoney, size, isLong: tp !== null ? tp > entry : sl < entry,
  }
}

export function fmtNum(n: number, digits = 2): string {
  if (!isFinite(n)) return '—'
  const abs = Math.abs(n)
  const d = abs >= 1000 ? 0 : abs >= 10 ? 2 : abs >= 1 ? 3 : 5
  const s = n.toFixed(Math.max(d, digits))
  return s.replace(/\.?0+$/, '') || '0'
}

export function fmtDuration(ms: number): string {
  const abs = Math.abs(ms)
  const s = Math.round(abs / 1000)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${sec}s`
  return `${sec}s`
}

export const FIB_RATIOS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1]
export const FIB_EXT_RATIOS = [1, 1.272, 1.618, 2.0, 2.618]
export const OTE_RATIOS = [0.618, 0.705, 0.79]
