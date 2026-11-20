import { useCallback, useRef, useState } from 'react'
import { ImportClient, fileKind, columnMapFields, type FileKind } from '../../core/import/client'
import type { ColumnMap, Candle, TfKey } from '../../core/types'
import { TFDEFS } from '../../core/timeframes'
import { putDataset, getDataset } from '../../core/db'
import { useStore } from '../../state/store'
import { useT } from '../../i18n'

const TIMEZONES = ['UTC', 'Etc/GMT-2', 'Etc/GMT-3', 'Europe/London', 'Europe/Berlin', 'America/New_York', 'America/Chicago', 'Asia/Tokyo', 'Asia/Singapore', 'Australia/Sydney']

interface ProbeState {
  headers: string[]
  sample: string[][]
  map: ColumnMap
  delim: string
  hasHeader: boolean
}

interface FinalState {
  candles: Candle[]
  detectedTf: TfKey
  invalidCount: number
  duplicateCount: number
  totalRows: number
  firstT: number | null
  lastT: number | null
  invalidSamples: { row: number; reason: string }[]
}

function guessSymbol(name: string): string {
  const base = name.replace(/\.(csv|json|xlsx|xls|txt|ndjson)$/i, '')
  return base.replace(/[-_]?(\d+(m|h|d|w|min)$)/i, '').replace(/[-_]+$/, '') || base
}

export default function ImportWizard(): React.ReactNode {
  const { t } = useT()
  const importOpen = useStore((s) => s.importOpen)
  const closeImport = useStore((s) => s.closeImport)
  const metas = useStore((s) => s.metas)
  const setMetas = useStore((s) => s.setMetas)
  const activePane = useStore((s) => s.activePane)
  const paneSymbol = useStore((s) => s.panes[s.activePane]?.symbol ?? null)
  const paneTf = useStore((s) => s.panes[s.activePane]?.tf ?? null)
  const setPaneSymbol = useStore((s) => s.setPaneSymbol)
  const setPaneTf = useStore((s) => s.setPaneTf)
  const setStatus = useStore((s) => s.setStatus)

  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)
  const fileRef = useRef<File | null>(null)
  const clientRef = useRef<ImportClient | null>(null)
  const outcomeRef = useRef<{ kind: FileKind; text: string | null; buffer: ArrayBuffer | null } | null>(null)

  const [probe, setProbe] = useState<ProbeState | null>(null)
  const [symbolName, setSymbolName] = useState('')
  const [tfChoice, setTfChoice] = useState<'auto' | TfKey>('auto')
  const [timezone, setTimezone] = useState('UTC')
  const [epochIsUtc, setEpochIsUtc] = useState(true)
  const [hasHeader, setHasHeader] = useState(true)
  const [map, setMap] = useState<ColumnMap>({ dateCol: -1, timeCol: -1, tsCol: -1, openCol: -1, highCol: -1, lowCol: -1, closeCol: -1, volCol: -1 })
  const [final_, setFinal] = useState<FinalState | null>(null)
  const [mode, setMode] = useState<'replace' | 'merge'>('replace')
  const [savedMsg, setSavedMsg] = useState<string | null>(null)

  const getClient = useCallback((): ImportClient => {
    if (!clientRef.current) clientRef.current = new ImportClient()
    return clientRef.current
  }, [])

  const reset = useCallback(() => {
    setStep(0); setBusy(false); setFileError(null); setProbe(null); setFinal(null); setSavedMsg(null)
    fileRef.current = null; outcomeRef.current = null
  }, [])

  const onClose = useCallback(() => {
    closeImport()
    reset()
  }, [closeImport, reset])

  const onFile = useCallback(async (file: File) => {
    reset()
    setBusy(true)
    setFileError(null)
    try {
      const client = getClient()
      const out = await client.probe(file)
      fileRef.current = file
      outcomeRef.current = { kind: fileKind(file.name), text: out.text, buffer: out.buffer }
      setProbe({ headers: out.probe.headers, sample: out.probe.sampleRows, map: out.probe.suggestedMap, delim: out.probe.delim, hasHeader: out.probe.hasHeader })
      setMap(out.probe.suggestedMap)
      setHasHeader(out.probe.hasHeader)
      setSymbolName(guessSymbol(file.name))
      setStep(1)
    } catch (e) {
      setFileError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [getClient, reset])

  const runImport = useCallback(async () => {
    if (!outcomeRef.current || !probe) return
    setBusy(true)
    setFileError(null)
    try {
      const client = getClient()
      const { kind, text, buffer } = outcomeRef.current
      const res = await client.runImport(kind, text, buffer, { map, hasHeader, timezone, epochIsUtc })
      if (res.candles.length === 0) {
        setFileError(fileErrorKey(res.report))
        return
      }
      setFinal({
        candles: res.candles,
        detectedTf: res.report.detectedTf,
        invalidCount: res.report.invalidCount,
        duplicateCount: res.report.duplicateCount,
        totalRows: res.report.totalRows,
        firstT: res.report.firstT,
        lastT: res.report.lastT,
        invalidSamples: res.report.invalidSamples,
      })
      setMode('replace')
      setStep(2)
    } catch (e) {
      setFileError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [probe, map, hasHeader, timezone, epochIsUtc, getClient])

  const save = useCallback(async () => {
    if (!final_) return
    const useTf: TfKey = tfChoice === 'auto' ? final_.detectedTf : tfChoice
    const id = `${symbolName}__${useTf}`
    setBusy(true)
    try {
      const existing = await getDataset(id)
      let candles = final_.candles
      if (existing && mode === 'merge') {
        const merged = mergeIn(existing.candles, candles)
        candles = merged
      }
      const record = {
        id, symbol: symbolName, tf: useTf,
        count: candles.length,
        firstT: candles.length ? candles[0].t : 0,
        lastT: candles.length ? candles[candles.length - 1].t : 0,
        timezone, source: fileRef.current?.name ?? 'file',
        updatedAt: Date.now(), candles,
      }
      await putDataset(record)
      const { allDatasets } = await import('../../core/db')
      setMetas(await allDatasets())
      setStatus(t('saved'))
      if (!paneSymbol) setPaneSymbol(activePane, symbolName)
      if (!paneTf) setPaneTf(activePane, useTf)
      setSavedMsg(`${candles.length} ${t('candles')}${mode === 'merge' ? ' · ' + t('done') : ''}`)
      setStep(3)
    } catch (e) {
      setFileError(t('saveFail') + ' ' + String(e))
    } finally {
      setBusy(false)
    }
  }, [final_, tfChoice, symbolName, timezone, mode, paneSymbol, paneTf, activePane, setMetas, setStatus, setPaneSymbol, setPaneTf, t])

  if (!importOpen) return null

  const colCount = probe ? Math.max(probe.headers.length, ...(probe.sample.length ? probe.sample.map((r) => r.length) : [1])) : 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" data-testid="import-wizard">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-border bg-panel shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-bold text-txt">{t('importTitle')}</h2>
          <button className="rounded px-2 text-muted hover:text-txt" onClick={onClose}>✕</button>
        </div>
        <div className="space-y-4 p-4">
          {fileError ? <div className="rounded border border-down/60 bg-down/10 px-3 py-2 text-xs text-down">{fileError}</div> : null}

          {step === 0 ? (
            <div>
              <label
                className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border p-8 text-center hover:border-accent"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) void onFile(f) }}
              >
                <span className="text-sm text-txt">{busy ? t('parsing') : t('chooseFile')}</span>
                <span className="text-xs text-muted">{t('dropHere')}</span>
                <input type="file" accept=".csv,.json,.xlsx,.xls,.txt,.ndjson" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f) }} />
              </label>
            </div>
          ) : null}

          {step === 1 && probe ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs text-muted">
                  <div className="mb-1">{t('symbolName')}</div>
                  <input data-testid="wf-symbol" value={symbolName} onChange={(e) => setSymbolName(e.target.value)} className="w-full rounded border border-border bg-panel2 px-2 py-1.5 text-sm text-txt" />
                </label>
                <label className="text-xs text-muted">
                  <div className="mb-1">{t('tfDetected')}</div>
                  <select data-testid="wf-tf" value={tfChoice} onChange={(e) => setTfChoice(e.target.value as 'auto' | TfKey)} className="w-full rounded border border-border bg-panel2 px-2 py-1.5 text-sm text-txt">
                    <option value="auto">auto</option>
                    {TFDEFS.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
                  </select>
                </label>
                <label className="text-xs text-muted">
                  <div className="mb-1">{t('timezone')}</div>
                  <select data-testid="wf-tz" value={timezone} onChange={(e) => setTimezone(e.target.value)} className="w-full rounded border border-border bg-panel2 px-2 py-1.5 text-sm text-txt">
                    {TIMEZONES.map((z) => <option key={z} value={z}>{z}</option>)}
                  </select>
                  <div className="mt-1 text-[10px] leading-4 text-muted">{t('timeZoneHint')}</div>
                </label>
                <div className="flex flex-col justify-center gap-1.5 text-xs text-muted">
                  <label className="flex items-center gap-2"><input type="checkbox" checked={hasHeader} onChange={(e) => setHasHeader(e.target.checked)} />{t('headerRow')}</label>
                  <label className="flex items-center gap-2"><input type="checkbox" data-testid="wf-epoch" checked={epochIsUtc} onChange={(e) => setEpochIsUtc(e.target.checked)} />{t('epochIsUtc')}</label>
                </div>
              </div>
              <div className="rounded border border-border bg-panel2 p-2">
                <div className="mb-1 text-[11px] text-muted">{t('preview')}</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[11px] text-txt">
                    <thead><tr>{probe.headers.slice(0, 9).map((h, i) => <th key={i} className="border-b border-border px-1.5 py-1">{h}</th>)}</tr></thead>
                    <tbody>{probe.sample.slice(0, 6).map((r, i) => <tr key={i}>{r.slice(0, 9).map((c, j) => <td key={j} className="border-b border-border/50 px-1.5 py-1">{c}</td>)}</tr>)}</tbody>
                  </table>
                </div>
              </div>
              <div>
                <div className="mb-1 text-[11px] text-muted">{t('stepMap')}</div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {columnMapFields.map(({ key, label }) => (
                    <label key={key} className="text-[11px] text-muted">
                      <div className="mb-0.5">{label}</div>
                      <select
                        data-testid={'wf-map-' + key}
                        value={map[key] as number}
                        onChange={(e) => setMap({ ...map, [key]: +e.target.value })}
                        className="w-full rounded border border-border bg-panel2 px-1.5 py-1 text-xs text-txt"
                      >
                        <option value={-1}>—</option>
                        {Array.from({ length: colCount }, (_, i) => <option key={i} value={i}>{probe.headers[i] ?? `#${i + 1}`}</option>)}
                      </select>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button className="rounded border border-border px-3 py-1.5 text-xs text-muted hover:text-txt" onClick={() => setStep(0)}>{t('stepFile')}</button>
                <button data-testid="wf-run" disabled={busy} className="rounded bg-accent px-4 py-1.5 text-xs font-bold text-white disabled:opacity-50" onClick={() => void runImport()}>{busy ? t('parsing') : t('doImport')}</button>
              </div>
            </div>
          ) : null}

          {step === 2 && final_ ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3" data-testid="wf-report">
                <Stat label={t('reportTotal')} value={String(final_.totalRows)} />
                <Stat label={t('reportValid')} value={String(final_.candles.length)} tone="up" />
                <Stat label={t('reportInvalid')} value={String(final_.invalidCount)} tone={final_.invalidCount ? 'down' : undefined} />
                <Stat label={t('reportDup')} value={String(final_.duplicateCount)} tone={final_.duplicateCount ? 'down' : undefined} />
                <Stat label={t('reportRange')} value={`${fmtTs(final_.firstT)} → ${fmtTs(final_.lastT)}`} />
                <Stat label={t('reportTf')} value={tfChoice === 'auto' ? final_.detectedTf : tfChoice} />
              </div>
              <div className="overflow-x-auto rounded border border-border bg-panel2 p-2">
                <table className="w-full text-left text-[11px] text-txt">
                  <thead><tr>{['time', 'O', 'H', 'L', 'C', 'V'].map((h) => <th key={h} className="border-b border-border px-1.5 py-1">{h}</th>)}</tr></thead>
                  <tbody>
                    {final_.candles.slice(0, 8).map((c) => (
                      <tr key={c.t}>
                        <td className="px-1.5 py-1">{fmtTs(c.t)}</td>
                        <td className="px-1.5 py-1">{c.o}</td><td className="px-1.5 py-1">{c.h}</td>
                        <td className="px-1.5 py-1">{c.l}</td><td className="px-1.5 py-1">{c.c}</td><td className="px-1.5 py-1">{c.v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {final_.invalidSamples.length ? (
                <div className="rounded border border-border bg-panel2 p-2 text-[11px] text-down">
                  <div className="mb-1 text-muted">{t('invalidSample')}</div>
                  {final_.invalidSamples.slice(0, 6).map((s, i) => (
                    <div key={i}>#{s.row}: {t(('err_' + s.reason) as never) === 'err_' + s.reason ? s.reason : t(('err_' + s.reason) as never)}</div>
                  ))}
                </div>
              ) : null}
              {metas.some((m) => m.id === `${symbolName}__${tfChoice === 'auto' ? final_.detectedTf : tfChoice}`) ? (
                <div className="flex items-center gap-3 text-xs">
                  <label className="flex items-center gap-1.5 text-muted"><input type="radio" checked={mode === 'replace'} onChange={() => setMode('replace')} />{t('modeReplace')}</label>
                  <label className="flex items-center gap-1.5 text-muted"><input type="radio" checked={mode === 'merge'} onChange={() => setMode('merge')} />{t('modeMerge')}</label>
                </div>
              ) : null}
              <div className="flex justify-end gap-2">
                <button className="rounded border border-border px-3 py-1.5 text-xs text-muted hover:text-txt" onClick={() => setStep(1)}>{t('stepMap')}</button>
                <button data-testid="wf-save" disabled={busy} className="rounded bg-accent px-4 py-1.5 text-xs font-bold text-white disabled:opacity-50" onClick={() => void save()}>{busy ? t('parsing') : t('doImport')}</button>
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-3 text-center">
              <div className="text-sm text-up">✓ {savedMsg}</div>
              <button className="rounded bg-accent px-4 py-1.5 text-xs font-bold text-white" onClick={onClose}>{t('done')}</button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function mergeIn(existing: Candle[], incoming: Candle[]): Candle[] {
  const map = new Map<number, Candle>()
  for (const c of existing) map.set(c.t, c)
  for (const c of incoming) map.set(c.t, c)
  return [...map.values()].sort((a, b) => a.t - b.t)
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'up' | 'down' }): React.ReactNode {
  return (
    <div className="rounded border border-border bg-panel2 px-2 py-1.5">
      <div className="text-[10px] text-muted">{label}</div>
      <div className={`truncate text-[11px] font-semibold ${tone === 'up' ? 'text-up' : tone === 'down' ? 'text-down' : 'text-txt'}`}>{value}</div>
    </div>
  )
}

function fmtTs(ts: number | null): string {
  if (!ts) return '—'
  return new Date(ts).toISOString().slice(0, 16).replace('T', ' ')
}

function fileErrorKey(res: { invalidSamples: { reason: string }[] }): string {
  const first = res.invalidSamples[0]?.reason
  if (first === 'bad_time') return 'err_bad_time'
  if (first === 'bad_ohlc' || first === 'ohlc_range') return 'err_bad_ohlc'
  return 'err_bad_row'
}
