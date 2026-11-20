import { useMemo } from 'react'
import { useStore } from '../../state/store'
import { useT } from '../../i18n'
import { TFDEFS, availableTfs } from '../../core/timeframes'
import type { TfKey } from '../../core/types'

export default function Watchlist(): React.ReactNode {
  const { t } = useT()
  const metas = useStore((s) => s.metas)
  const symbol = useStore((s) => s.symbol)
  const tf = useStore((s) => s.tf)
  const setSymbol = useStore((s) => s.setSymbol)
  const setTf = useStore((s) => s.setTf)
  const openImport = useStore((s) => s.openImport)

  const symbols = useMemo(() => [...new Set(metas.map((m) => m.symbol))].sort(), [metas])

  return (
    <div className="flex h-full flex-col" data-testid="watchlist">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-xs font-bold text-muted">{t('watchlist')}</span>
        <button data-testid="wl-add" className="rounded bg-accent px-2 py-1 text-[11px] font-bold text-white" onClick={() => openImport(null)}>{t('importData')}</button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {symbols.length === 0 ? (
          <div className="p-3 text-center text-[11px] text-muted">{t('importData')}</div>
        ) : symbols.map((sym) => {
          const tfs = availableTfs(sym, metas)
          return (
            <div key={sym} className="border-b border-border/60" data-testid={'wl-' + sym}>
              <button
                className={`flex w-full items-center justify-between px-3 py-2 text-start text-xs ${symbol === sym ? 'bg-panel2 text-txt' : 'text-muted hover:bg-panel2/60'}`}
                onClick={() => setSymbol(sym)}
              >
                <span className="font-bold">{sym}</span>
                <span className="text-[10px]">{metas.filter((m) => m.symbol === sym).reduce((n, m) => n + m.count, 0).toLocaleString()} {t('candles')}</span>
              </button>
              <div className="flex flex-wrap gap-1 px-3 pb-2">
                {tfs.map((k) => (
                  <button
                    key={k}
                    data-testid={'wl-tf-' + k}
                    className={`rounded px-1.5 py-0.5 text-[10px] ${symbol === sym && tf === k ? 'bg-accent text-white' : 'bg-panel2 text-muted hover:text-txt'}`}
                    onClick={() => { setSymbol(sym); setTf(k) }}
                  >
                    {TFDEFS.find((d) => d.key === (k as TfKey))?.label ?? k}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
