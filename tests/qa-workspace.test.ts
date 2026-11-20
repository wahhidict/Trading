import 'fake-indexeddb/auto'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { installLocalStorageStub, localStorageMock } from './qa-helpers'
import { currentSnapshot, snapshotWithDrawings, applySnapshot } from '../src/features/workspaces/WorkspacePanel'
import { allDrawings, putDrawings, putWorkspace, getWorkspace, removeWorkspace, allWorkspaces } from '../src/core/db'
import { useStore } from '../src/state/store'
import type { WorkspaceSnapshot, BackupFile } from '../src/core/types'

beforeAll(() => { installLocalStorageStub() })

beforeEach(() => {
  localStorageMock()['ta_settings_v1'] = ''
  const st = useStore.getState()
  st.setMetas([])
  st.setPanes([])
  st.setLayout(1)
  st.setActivePane(0)
  st.updateSettings({ futureBars: 40 })
  st.setLang('ar')
})

describe('workspace snapshot + restore round-trip', () => {
  it('snapshot captures panes, layout, activePane and settings', async () => {
    const st = useStore.getState()
    st.setPanes([
      { symbol: 'NQ', tf: '5m', chartType: 'ha', indicators: [{ key: 'EMA:1', name: 'EMA', params: [21], colors: ['#ffd166'], visible: true, onMain: true }] },
      { symbol: 'ES', tf: '1m', chartType: 'candle', indicators: [] },
    ])
    st.setLayout(2)
    st.setActivePane(1)
    st.updateSettings({ futureBars: 90, syncScroll: true })
    const snap = await snapshotWithDrawings()
    expect(snap.layout).toBe(2)
    expect(snap.activePane).toBe(1)
    expect(snap.panes[0].symbol).toBe('NQ')
    expect(snap.panes[0].chartType).toBe('ha')
    expect(snap.panes[0].indicators[0].params).toEqual([21])
    expect(snap.panes[1].symbol).toBe('ES')
    expect((snap.settings as Record<string, unknown>).futureBars).toBe(90)
    expect((snap.settings as Record<string, unknown>).syncScroll).toBe(true)
    expect(snap.drawings).toEqual([])
  })

  it('applySnapshot restores everything after the store is mutated', async () => {
    const st = useStore.getState()
    st.setPanes([{ symbol: 'NQ', tf: '5m', chartType: 'ha', indicators: [{ key: 'EMA:1', name: 'EMA', params: [21], colors: ['#ffd166'], visible: true, onMain: true }] }])
    st.setLayout(2)
    st.setActivePane(1)
    st.updateSettings({ futureBars: 90, syncZoom: true })
    st.setLang('en')
    const snap = await currentSnapshot()

    st.setPanes([{ symbol: 'GC', tf: '1D', chartType: 'line', indicators: [] }])
    st.setLayout(4)
    st.setActivePane(0)
    st.updateSettings({ futureBars: 10, syncZoom: false })
    st.setLang('ar')
    expect(useStore.getState().panes[0].symbol).toBe('GC')

    await applySnapshot(snap)
    const after = useStore.getState()
    expect(after.panes[0].symbol).toBe('NQ')
    expect(after.panes[0].tf).toBe('5m')
    expect(after.panes[0].chartType).toBe('ha')
    expect(after.panes[0].indicators[0].key).toBe('EMA:1')
    expect(after.layout).toBe(2)
    expect(after.activePane).toBe(1)
    expect(after.settings.futureBars).toBe(90)
    expect(after.settings.syncZoom).toBe(true)
    expect(after.lang).toBe('en')
  })

  it('snapshot includes drawings stored in IndexedDB', async () => {
    await putDrawings({ id: 'NQ', items: [{ ovId: 'a1', name: 'segment', points: [{ timestamp: 1500, value: 10 }, { timestamp: 1600, value: 12 }] }], updatedAt: 1 })
    const snap = await snapshotWithDrawings()
    expect(snap.drawings.length).toBe(1)
    expect(snap.drawings[0].id).toBe('NQ')
    expect(snap.drawings[0].items[0].ovId).toBe('a1')
  })
})

describe('workspace records and backup JSON round-trip', () => {
  it('save → getWorkspace → restore → delete lifecycle', async () => {
    const st = useStore.getState()
    st.setPanes([{ symbol: 'NQ', tf: '5m', chartType: 'candle', indicators: [] }])
    st.setLayout(2)
    const snap = await snapshotWithDrawings()
    const rec = { id: 'ws_test1', name: 'My WS', updatedAt: 42, snapshot: snap }
    await putWorkspace(rec)
    const got = await getWorkspace('ws_test1')
    expect(got?.name).toBe('My WS')
    expect(got?.snapshot.layout).toBe(2)
    expect(got?.snapshot.panes[0].symbol).toBe('NQ')

    const list = await allWorkspaces()
    expect(list.some((w) => w.id === 'ws_test1')).toBe(true)
    await removeWorkspace('ws_test1')
    expect((await getWorkspace('ws_test1')) ?? undefined).toBeUndefined()
  })

  it('BackupFile JSON survives a stringify/parse round-trip and restores its records', async () => {
    const snap = await currentSnapshot()
    const ws = { id: 'ws_a', name: 'A', updatedAt: 1, snapshot: snap }
    const drawings = { id: 'NQ', items: [{ ovId: 'n1', name: 'note', points: [{ timestamp: 1, value: 2 }] }], updatedAt: 3 }
    const backup: BackupFile = { version: 1, exportedAt: Date.now(), workspaces: [ws], drawings: [drawings], settings: snap.settings }
    const json = JSON.stringify(backup)
    const parsed = JSON.parse(json) as Partial<BackupFile>
    expect(Array.isArray(parsed.workspaces)).toBe(true)
    expect(Array.isArray(parsed.drawings)).toBe(true)
    for (const d of parsed.drawings ?? []) await putDrawings(d)
    for (const w of parsed.workspaces ?? []) await putWorkspace(w)
    const dRec = await allDrawings()
    expect(dRec.find((x) => x.id === 'NQ')?.items[0].points[0].value).toBe(2)
    const wRec = await getWorkspace('ws_a')
    expect(wRec?.snapshot).toBeTruthy()
  })

  it('applySnapshot keeps existing settings for keys the snapshot does not override', async () => {
    const st = useStore.getState()
    st.updateSettings({ upColor: '#123456', futureBars: 5 })
    const snap: WorkspaceSnapshot = { panes: st.panes, layout: 1, activePane: 0, settings: { lang: 'en' }, drawings: [] }
    await applySnapshot(snap)
    const after = useStore.getState()
    expect(after.settings.upColor).toBe('#123456')
    expect(after.settings.futureBars).toBe(5)
    expect(after.lang).toBe('en')
  })
})
