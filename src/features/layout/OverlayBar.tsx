import { useStore } from '../../state/store'
import { useT } from '../../i18n'
import { activeDrawingsCtl } from '../drawings/controller'

const COLORS = ['#2962ff', '#22ab94', '#f23645', '#ffd166', '#e040fb', '#00e5ff', '#ffffff']

export default function OverlayBar(): React.ReactNode {
  const { t } = useT()
  const selected = useStore((s) => s.selectedOverlay)
  const ctl = activeDrawingsCtl()
  if (!selected || !ctl) return null
  return (
    <div className="absolute top-1.5 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-lg border border-border bg-panel px-1.5 py-1 shadow-xl" data-testid="overlay-bar">
      <div className="flex gap-0.5">
        {COLORS.map((c) => (
          <button key={c} className="h-4 w-4 rounded-full border border-border" style={{ backgroundColor: c }} title={t('color')} onClick={() => void ctl?.writeStylesColor(selected, c)} />
        ))}
      </div>
      <div className="mx-0.5 h-4 w-px bg-border" />
      <button className="rounded px-1.5 text-[11px]" data-testid="ob-copy" title={t('copy')} onClick={() => ctl?.copy(selected)}>⧉</button>
      <button className="rounded px-1.5 text-[11px]" data-testid="ob-lock" title={t('lock')} onClick={() => void ctl?.toggleLock(selected)}>🔒</button>
      <button className="rounded px-1.5 text-[11px]" data-testid="ob-hide" title={t('hide')} onClick={() => void ctl?.toggleVisible(selected)}>👁</button>
      <button className="rounded px-1.5 text-[11px] text-down" data-testid="ob-del" title={t('delete')} onClick={() => { ctl?.remove(selected); useStore.getState().setSelectedOverlay(null) }}>✕</button>
    </div>
  )
}
