import { useStore } from '../../state/store'
import { useT } from '../../i18n'
import { TFDEFS } from '../../core/timeframes'
import { activeDrawingsCtl } from '../drawings/controller'

export default function StatusBar(): React.ReactNode {
  const { t } = useT()
  const activePane = useStore((s) => s.activePane)
  const hoverAll = useStore((s) => s.hoverCandles)
  const statusMsg = useStore((s) => s.statusMsg)
  const p = useStore((s) => s.panes[s.activePane])
  const replay = useStore((s) => s.replay)
  const drawingsCount = activeDrawingsCtl()?.getItems().length ?? 0
  const hover = hoverAll[activePane] ?? null

  const tfLabel = p?.tf ? TFDEFS.find((d) => d.key === p.tf)?.label ?? p.tf : '\u2014'

  return (
    <div className="flex items-center gap-3 border-t border-border bg-panel px-3 py-1 text-[11px] text-muted" data-testid="statusbar">
      <span className="font-bold text-txt">{p?.symbol ?? '\u2014'}</span>
      <span>{tfLabel}</span>
      {replay.active ? <span className="rounded bg-accent/20 px-1.5 py-0.5 font-bold text-accent">{t('replay')}</span> : null}
      {hover ? (
        <span data-testid="hover-ohlcv">
          O <b className="text-up">{hover.o}</b> H <b className="text-up">{hover.h}</b> L <b className="text-down">{hover.l}</b> C <b className="text-up">{hover.c}</b> V <b className="text-txt">{hover.v}</b>
        </span>
      ) : null}
      <span className="flex-1" />
      {drawingsCount > 0 ? <span data-testid="sb-drawings">{`${t('drawings')}: ${drawingsCount}`}</span> : null}
      <span data-testid="status-msg">{statusMsg}</span>
      <span className="text-[10px]">{t('saved')} · IndexedDB</span>
    </div>
  )
}
