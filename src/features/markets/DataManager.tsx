import { useStore } from '../../state/store'
import { useT } from '../../i18n'
import { TFDEFS } from '../../core/timeframes'
import { removeDataset, candlesToCsv } from '../../core/db'

function fmt(ts: number): string {
  return ts ? new Date(ts).toISOString().slice(0, 16).replace('T', ' ') : '—'
}

export default function DataManager(): React.ReactNode {
  const { t } = useT()
  const metas = useStore((s) => s.metas)
  const setMetas = useStore((s) => s.setMetas)
  const openImport = useStore((s) => s.openImport)
  const symbol = useStore((s) => s.symbol)
  const tf = useStore((s) => s.tf)
  const setSymbol = useStore((s) => s.setSymbol)
  const setTf = useStore((s) => s.setTf)

  const onDelete = async (id: string): Promise<void> => {
    if (!window.confirm(t('confirmDelete'))) return
    await removeDataset(id)
    const { allDatasets } = await import('../../core/db')
    setMetas(await allDatasets())
  }

  const onExport = async (id: string): Promise<void> => {
    const { getDataset } = await import('../../core/db')
    const rec = await getDataset(id)
    if (!rec) return
    const csv = candlesToCsv(rec.symbol, rec.candles)
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `${rec.symbol}_${rec.tf}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="flex h-full flex-col" data-testid="data-manager">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-xs font-bold text-muted">{t('dataManager')}</span>
        <button className="rounded bg-accent px-2 py-1 text-[11px] font-bold text-white" onClick={() => openImport(null)}>{t('importData')}</button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {metas.map((m) => (
          <div key={m.id} className="border-b border-border/60 px-3 py-2 text-xs">
            <button className="flex w-full items-center justify-between" onClick={() => { setSymbol(m.symbol); setTf(m.tf) }}>
              <span className={`font-bold ${symbol === m.symbol && tf === m.tf ? 'text-txt' : 'text-muted'}`}>{m.symbol} · {TFDEFS.find((d) => d.key === m.tf)?.label ?? m.tf}</span>
              <span className="text-[10px] text-muted">{m.count.toLocaleString()} {t('candles')}</span>
            </button>
            <div className="mt-1 flex flex-wrap items-center justify-between gap-1 text-[10px] text-muted">
              <span>{fmt(m.firstT)} → {fmt(m.lastT)}</span>
              <span className="flex gap-1.5">
                <button className="rounded border border-border px-1.5 py-0.5 hover:text-txt" onClick={(e) => { e.stopPropagation(); void onExport(m.id) }}>{t('exportCsv')}</button>
                <button className="rounded border border-border px-1.5 py-0.5 hover:text-txt" onClick={(e) => { e.stopPropagation(); openImport({ id: m.id, symbol: m.symbol }) }}>{t('replaceData')}</button>
                <button className="rounded border border-down/50 px-1.5 py-0.5 text-down hover:bg-down/10" data-testid={'dm-del-' + m.id} onClick={(e) => { e.stopPropagation(); void onDelete(m.id) }}>{t('deleteData')}</button>
              </span>
            </div>
          </div>
        ))}
        {metas.length === 0 ? <div className="p-3 text-center text-[11px] text-muted">{t('noDataHint')}</div> : null}
      </div>
    </div>
  )
}
