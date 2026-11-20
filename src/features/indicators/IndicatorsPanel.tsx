import { useStore } from '../../state/store'
import { useT } from '../../i18n'
import type { IndicatorConf } from '../../core/types'

interface CatalogItem {
  name: string
  params: number[]
  colors: string[]
  onMain: boolean
}

const CATALOG: CatalogItem[] = [
  { name: 'SMA', params: [20], colors: ['#ffd166'], onMain: true },
  { name: 'EMA', params: [20], colors: ['#2962ff'], onMain: true },
  { name: 'VWAP', params: [], colors: ['#ffd166'], onMain: true },
  { name: 'BOLL', params: [20, 2], colors: ['#2962ff', '#e040fb', '#787b86'], onMain: true },
  { name: 'RSI', params: [14], colors: ['#e040fb'], onMain: false },
  { name: 'MACD', params: [12, 26, 9], colors: ['#2962ff', '#f23645', '#787b86'], onMain: false },
  { name: 'KDJ', params: [9, 3, 3], colors: ['#2962ff', '#ffd166', '#e040fb'], onMain: false },
  { name: 'ATR', params: [14], colors: ['#b39ddb'], onMain: false },
  { name: 'ADX', params: [14], colors: ['#22ab94', '#f23645', '#ffd166'], onMain: false },
  { name: 'OBV', params: [], colors: ['#22ab94'], onMain: false },
]

let seq = 0
function makeConf(item: CatalogItem): IndicatorConf {
  seq += 1
  return { key: `${item.name}_${Date.now().toString(36)}${seq}`, name: item.name, params: [...item.params], colors: [...item.colors], visible: true, onMain: item.onMain }
}

export default function IndicatorsPanel(): React.ReactNode {
  const { t } = useT()
  const activePane = useStore((s) => s.activePane)
  const pane = useStore((s) => s.panes[s.activePane])
  const addIndicator = useStore((s) => s.addIndicator)
  const setPaneIndicators = useStore((s) => s.setPaneIndicators)
  const list = pane?.indicators ?? []

  const patch = (i: number, p: Partial<IndicatorConf>): void => {
    setPaneIndicators(activePane, list.map((c, k) => (k === i ? { ...c, ...p } : c)))
  }

  return (
    <div className="flex h-full flex-col text-xs" data-testid="indicators-panel">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="font-bold text-muted">{t('indicators')}</span>
      </div>
      <div className="flex flex-wrap gap-1 border-b border-border px-3 py-2">
        {CATALOG.map((item) => (
          <button
            key={item.name}
            data-testid={'ind-add-' + item.name}
            className="rounded bg-panel2 px-2 py-1 text-[10px] text-muted hover:bg-accent hover:text-white"
            onClick={() => addIndicator(activePane, makeConf(item))}
          >+ {item.name}</button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto">
        {list.length === 0 ? <div className="p-3 text-center text-[11px] text-muted">{t('indNone')}</div> : list.map((conf, i) => (
          <div key={conf.key} className="border-b border-border/60 px-3 py-2" data-testid={'ind-' + conf.name}>
            <div className="flex items-center justify-between">
              <span className="font-bold text-txt">{conf.name}</span>
              <span className="flex items-center gap-1.5">
                <button title={t('hide')} className={`text-[11px] ${conf.visible ? 'text-txt' : 'text-muted'}`} onClick={() => patch(i, { visible: !conf.visible })}>{conf.visible ? '👁' : '⊘'}</button>
                <button title={t('delete')} data-testid={'ind-del-' + conf.name} className="text-[11px] text-down" onClick={() => setPaneIndicators(activePane, list.filter((_, k) => k !== i))}>✕</button>
              </span>
            </div>
            {conf.params.length > 0 ? (
              <div className="mt-1.5 flex items-center gap-1 text-[10px] text-muted">
                <span>{t('indParams')}</span>
                {conf.params.map((v, k) => (
                  <input
                    key={k}
                    type="number"
                    value={v}
                    min={1}
                    className="w-14 rounded border border-border bg-panel2 px-1 py-0.5 text-txt"
                    onChange={(e) => {
                      const params = conf.params.map((x, kk) => (kk === k ? Math.max(1, Number(e.target.value) || 1) : x))
                      patch(i, { params })
                    }}
                  />
                ))}
              </div>
            ) : null}
            <div className="mt-1.5 flex items-center gap-1">
              {conf.colors.map((c, k) => (
                <input key={k} type="color" value={c} className="h-4 w-4 cursor-pointer bg-transparent" onChange={(e) => patch(i, { colors: conf.colors.map((x, kk) => (kk === k ? e.target.value : x)) })} />
              ))}
              <span className="flex-1" />
              <button
                className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted hover:text-txt"
                onClick={() => patch(i, { onMain: !conf.onMain })}
              >{conf.onMain ? t('indMain') : t('indSub')}</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
