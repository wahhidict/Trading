import { useStore } from '../../state/store'
import { useT } from '../../i18n'
import { TFDEFS } from '../../core/timeframes'

export default function StatusBar(): React.ReactNode {
  const { t } = useT()
  const symbol = useStore((s) => s.symbol)
  const tf = useStore((s) => s.tf)
  const statusMsg = useStore((s) => s.statusMsg)
  const hover = useStore((s) => s.hoverCandle)

  const tfLabel = tf ? TFDEFS.find((d) => d.key === tf)?.label ?? tf : '—'

  return (
    <div className="flex items-center gap-3 border-t border-border bg-panel px-3 py-1 text-[11px] text-muted" data-testid="statusbar">
      <span className="font-bold text-txt">{symbol ?? '—'}</span>
      <span>{tfLabel}</span>
      {hover ? (
        <span data-testid="hover-ohlcv">
          O <b className="text-txt">{hover.o}</b> H <b className="text-txt">{hover.h}</b> L <b className="text-txt">{hover.l}</b> C <b className="text-txt">{hover.c}</b> V <b className="text-txt">{hover.v}</b>
        </span>
      ) : null}
      <span className="flex-1" />
      <span data-testid="status-msg">{statusMsg}</span>
      <span className="text-[10px]">{t('saved')} · IndexedDB</span>
    </div>
  )
}
