import { useCallback, useEffect, useState } from 'react'
import type { BackupFile, WorkspaceSnapshot, SymbolDrawings } from '../../core/types'
import { useStore } from '../../state/store'
import { useT } from '../../i18n'
import { loadSettings, saveSettings, allDrawings, putDrawings, allWorkspaces, putWorkspace, removeWorkspace, getWorkspace, type UiSettings } from '../../core/db'

export function currentSnapshot(): WorkspaceSnapshot {
  const st = useStore.getState()
  return {
    panes: st.panes,
    layout: st.layout,
    activePane: st.activePane,
    settings: loadSettings() as unknown as Record<string, unknown>,
    drawings: [],
  }
}

export function snapshotWithDrawings(): Promise<WorkspaceSnapshot> {
  return allDrawings().then((drawings) => ({ ...currentSnapshot(), drawings }))
}

export async function downloadBackup(): Promise<void> {
  const [workspaces, drawings] = await Promise.all([allWorkspaces(), allDrawings()])
  const file: BackupFile = {
    version: 1,
    exportedAt: Date.now(),
    workspaces,
    drawings,
    settings: loadSettings() as unknown as Record<string, unknown>,
  }
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([JSON.stringify(file)], { type: 'application/json' }))
  a.download = `ta-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(a.href)
}

export async function applySnapshot(snap: WorkspaceSnapshot): Promise<void> {
  const st = useStore.getState()
  for (const d of snap.drawings ?? []) await putDrawings(d)
  const next = { ...loadSettings(), ...(snap.settings ?? {}) } as unknown as UiSettings
  saveSettings(next)
  const snapLang = (snap.settings as { lang?: 'ar' | 'en' } | undefined)?.lang
  if (snapLang && snapLang !== st.lang) st.setLang(snapLang)
  st.setPanes(snap.panes)
  st.setLayout(snap.layout === 2 || snap.layout === 4 ? snap.layout : 1)
  st.setActivePane(snap.activePane ?? 0)
  st.updateSettings(next)
  st.bumpWorkspace()
}

export default function WorkspacePanel(): React.ReactNode {
  const { t } = useT()
  const workspaceTick = useStore((s) => s.workspaceTick)
  const setStatus = useStore((s) => s.setStatus)
  const panes = useStore((s) => s.panes)
  const layout = useStore((s) => s.layout)
  const activePane = useStore((s) => s.activePane)
  const [list, setList] = useState<{ id: string; name: string; updatedAt: number }[]>([])
  const [name, setName] = useState('')

  const refresh = useCallback((): void => {
    void allWorkspaces().then((ws) => setList(ws.map((w) => ({ id: w.id, name: w.name, updatedAt: w.updatedAt })).sort((a, b) => b.updatedAt - a.updatedAt)))
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh, workspaceTick])

  useEffect(() => {
    const id = window.setTimeout(() => {
      void snapshotWithDrawings()
        .then((snap) => putWorkspace({ id: '__auto__', name: t('wsAuto'), updatedAt: Date.now(), snapshot: snap }))
        .then(() => refresh())
        .catch(() => setStatus('indexeddb_full'))
    }, 2000)
    return () => window.clearTimeout(id)
  }, [panes, layout, activePane, refresh, setStatus, t])

  const saveNew = (): void => {
    const label = name.trim() || `WS-${new Date().toISOString().slice(0, 16).replace('T', ' ')}`
    void snapshotWithDrawings()
      .then((snap) => putWorkspace({ id: `ws_${Date.now().toString(36)}`, name: label, updatedAt: Date.now(), snapshot: snap }))
      .then(() => { setStatus(t('wsSaved')); setName(''); refresh() })
      .catch(() => setStatus('indexeddb_full'))
  }

  const restore = (id: string): void => {
    void getWorkspace(id).then((w) => {
      if (!w) return
      applySnapshot(w.snapshot)
        .then(() => { setStatus(t('wsSaved')) })
        .catch(() => setStatus('indexeddb_full'))
    })
  }

  const del = (id: string): void => {
    if (!window.confirm(t('wsConfirmDelete'))) return
    void removeWorkspace(id).then(refresh)
  }

  const importBackup = (f: File): void => {
    void f.text().then((txt) => {
      const parsed = JSON.parse(txt) as Partial<BackupFile>
      if (!Array.isArray(parsed.workspaces) && !Array.isArray(parsed.drawings)) throw new Error('bad backup')
      const jobs: Promise<void>[] = []
      for (const d of parsed.drawings ?? []) jobs.push(putDrawings(d as SymbolDrawings))
      for (const w of parsed.workspaces ?? []) jobs.push(putWorkspace(w))
      void Promise.all(jobs).then(() => { setStatus(t('wsImported')); refresh() }).catch(() => setStatus('indexeddb_full'))
    }).catch(() => setStatus('indexeddb_full'))
  }

  return (
    <div className="flex h-full flex-col text-xs" data-testid="workspace-panel">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="font-bold text-muted">{t('workspace')}</span>
        <button data-testid="ws-export" className="rounded border border-border px-1.5 py-0.5 text-[10px] hover:text-txt" onClick={() => void downloadBackup()}>{t('wsExport')}</button>
      </div>
      <label className="flex items-center gap-2 border-b border-border px-3 py-2 text-[11px] text-muted">
        {t('wsImport')}
        <input
          type="file"
          accept=".json"
          className="text-[10px]"
          data-testid="ws-import"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) importBackup(f); e.target.value = '' }}
        />
      </label>
      <div className="flex items-center gap-1.5 border-b border-border px-3 py-2">
        <input
          data-testid="ws-name"
          placeholder={t('wsName')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="min-w-0 flex-1 rounded border border-border bg-panel2 px-2 py-1 text-[11px] text-txt"
        />
        <button data-testid="ws-save-new" className="rounded bg-accent px-2 py-1 text-[10px] font-bold text-white" onClick={saveNew}>{t('wsNew')}</button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {list.length === 0 ? null : list.map((w) => (
          <div key={w.id} className="flex items-center justify-between border-b border-border/60 px-3 py-1.5">
            <span className={`truncate ${w.id === '__auto__' ? 'italic text-muted' : 'text-txt'}`}>{w.name}</span>
            <span className="flex shrink-0 gap-1">
              <button
                data-testid={'ws-restore-' + w.name}
                className="rounded border border-border px-1.5 py-0.5 text-[10px] text-accent hover:bg-accent/10"
                onClick={() => restore(w.id)}
              >{t('wsSwitch')}</button>
              {w.id === '__auto__' ? null : (
                <button className="rounded border border-down/50 px-1.5 py-0.5 text-[10px] text-down" onClick={() => del(w.id)}>{t('delete')}</button>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
