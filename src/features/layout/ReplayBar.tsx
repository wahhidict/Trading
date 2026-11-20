import { useEffect, useRef, useState } from 'react'
import { useStore } from '../../state/store'
import { useT } from '../../i18n'
import { getFullRows, loadPaneRecords } from '../chart/paneData'

const SPEEDS = [1000, 500, 250, 100, 40]

function fmtLocal(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function ReplayBar(): React.ReactNode {
  const { t } = useT()
  const replay = useStore((s) => s.replay)
  const replayWidget = useStore((s) => s.replayWidget)
  const setReplay = useStore((s) => s.setReplay)
  const setReplayWidget = useStore((s) => s.setReplayWidget)
  const activePane = useStore((s) => s.activePane)
  const pane = useStore((s) => s.panes[s.activePane])
  const [startVal, setStartVal] = useState('')
  const [notFound, setNotFound] = useState(false)
  const timer = useRef<number | null>(null)

  useEffect(() => {
    if (timer.current !== null) window.clearInterval(timer.current)
    timer.current = null
    if (!replay.active || !replay.playing) return
    timer.current = window.setInterval(() => {
      step(+1)
    }, replay.speed)
    return () => {
      if (timer.current !== null) window.clearInterval(timer.current)
      timer.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replay.active, replay.playing, replay.speed, replay.endTime, activePane])

  const step = (dir: 1 | -1): void => {
    const st = useStore.getState()
    if (!st.replay.active) return
    const p = st.panes[st.activePane]
    if (!p?.symbol || !p.tf) return
    const list = getFullRows(p.symbol, p.tf)
    if (!list) return
    if (dir === 1) {
      const next = list.find((c) => c.timestamp > (st.replay.endTime ?? 0))
      if (!next) {
        st.setReplay({ playing: false })
        st.setStatus(st.lang === 'ar' ? 'نهاية البيانات' : 'End of data')
        return
      }
      st.setReplay({ endTime: next.timestamp })
    } else {
      const prev = [...list].reverse().find((c) => c.timestamp < (st.replay.endTime ?? 0))
      if (prev) st.setReplay({ endTime: prev.timestamp })
    }
  }

  const begin = (): void => {
    const st = useStore.getState()
    if (!pane?.symbol || !pane.tf || !st.metas.length) { setNotFound(true); return }
    void loadPaneRecords(st.activePane, pane.symbol, pane.tf, pane.chartType, st.metas, null).then((rows) => {
      if (!rows || rows.length === 0) {
        setNotFound(true)
        return
      }
      setNotFound(false)
      const target = startVal ? new Date(startVal).getTime() : null
      if (target !== null && isFinite(target)) {
        const idx = rows.findIndex((c) => c.timestamp as number >= target)
        const at = idx === -1 ? rows.length - 1 : idx
        setReplay({ active: true, playing: false, startTime: rows[at].timestamp as number, endTime: rows[at].timestamp as number })
        return
      }
      const from = Math.floor(rows.length * 0.8)
      setReplay({ active: true, playing: false, startTime: rows[from].timestamp as number, endTime: rows[from].timestamp as number })
    })
  }

  if (!replayWidget && !replay.active) return null

  return (
    <div className="absolute bottom-2 left-1/2 z-30 flex -translate-x-1/2 flex-wrap items-center justify-center gap-1.5 rounded-xl border border-border bg-panel px-3 py-1.5 shadow-2xl" data-testid="replay-bar">
      {replay.active ? null : (
        <span className="flex items-center gap-1.5">
          <span className="text-[11px] text-muted">{t('replayStartAt')}</span>
          <input
            type="datetime-local"
            data-testid="replay-start"
            value={startVal}
            onChange={(e) => setStartVal(e.target.value)}
            className="rounded border border-border bg-panel2 px-1.5 py-0.5 text-[11px] text-txt"
          />
        </span>
      )}
      {replay.active ? null : (
        <button data-testid="replay-begin" onClick={begin} className="rounded bg-accent px-2 py-1 text-[11px] font-bold text-white">{t('replay')}</button>
      )}
      {notFound ? <span className="text-[11px] text-down">{t('replayNoData')}</span> : null}
      {replay.active ? (
        <>
          <span className="rounded bg-accent/15 px-1.5 py-0.5 text-[10px] font-bold text-accent">{t('replay')}</span>
          <button data-testid="replay-play" title={t(replay.playing ? 'replayPause' : 'replayPlay')} onClick={() => setReplay({ playing: !replay.playing })} className="h-6 w-6 rounded text-[11px] text-txt hover:bg-panel2">
            {replay.playing ? '⏸' : '▶'}
          </button>
          <button data-testid="replay-back" title={t('replayBack')} onClick={() => step(-1)} className="h-6 w-6 rounded text-[11px] text-txt hover:bg-panel2">⏮</button>
          <button data-testid="replay-fwd" title={t('replayStep')} onClick={() => step(1)} className="h-6 w-6 rounded text-[11px] text-txt hover:bg-panel2">⏭</button>
          <select
            data-testid="replay-speed"
            title={t('replaySpeed')}
            value={replay.speed}
            onChange={(e) => setReplay({ speed: Number(e.target.value) })}
            className="rounded border border-border bg-panel2 px-1 py-0.5 text-[10px] text-txt"
          >
            {SPEEDS.map((s) => <option key={s} value={s}>{s}ms</option>)}
          </select>
          <button data-testid="replay-restart" title={t('replayRestart')} onClick={() => setReplay({ playing: false, endTime: replay.startTime })} className="h-6 w-6 rounded text-[11px] text-txt hover:bg-panel2">⟲</button>
          <span className="text-[10px] text-muted" title="timestamp">{replay.endTime ? fmtLocal(replay.endTime) : ''}</span>
          <button data-testid="replay-exit" onClick={() => setReplay({ active: false, playing: false, endTime: null })} className="rounded border border-border px-2 py-0.5 text-[10px] text-down hover:bg-down/10">{t('replayExit')}</button>
        </>
      ) : null}
    </div>
  )
}
