import type { ColumnMap, ParseOptions } from '../types'
import type { ValidateResult } from './validate'
import type { ProbeResult } from '../../worker/importWorker'

export type FileKind = 'csv' | 'json' | 'xlsx'

export function fileKind(name: string): FileKind {
  const n = name.toLowerCase()
  if (n.endsWith('.json') || n.endsWith('.ndjson')) return 'json'
  if (n.endsWith('.xlsx') || n.endsWith('.xls')) return 'xlsx'
  return 'csv'
}

export interface ProbeOutcome {
  probe: ProbeResult
  text: string | null
  buffer: ArrayBuffer | null
}

type WorkerLike = {
  postMessage: (m: unknown) => void
  onmessage: ((ev: { data: unknown }) => void) | null
  onerror: ((e: unknown) => void) | null
  terminate: () => void
}

async function readWhole(file: File): Promise<{ text: string | null; buffer: ArrayBuffer | null }> {
  const kind = fileKind(file.name)
  if (kind === 'xlsx') return { text: null, buffer: await file.arrayBuffer() }
  return { text: await file.text(), buffer: null }
}

function fallbackProbe(kind: FileKind, text: string | null, buffer: ArrayBuffer | null): Promise<ProbeOutcome> {
  void buffer
  return (async () => {
    if (kind === 'json') {
      const probe: ProbeResult = {
        headers: ['#0', '#1', '#2', '#3', '#4', '#5'],
        sampleRows: [['(JSON preview)']],
        suggestedMap: { dateCol: -1, timeCol: -1, tsCol: -1, openCol: 1, highCol: 2, lowCol: 3, closeCol: 4, volCol: -1 },
        delim: ',',
        hasHeader: false,
      }
      return { probe, text, buffer: null }
    }
    const { suggestFromText } = await import('./parse')
    if (kind === 'xlsx') throw new Error('xlsx_fallback_missing')
    const sug = suggestFromText((text ?? '').slice(0, 64000))
    return {
      probe: {
        headers: sug.headers,
        sampleRows: sug.rows,
        suggestedMap: sug.map,
        delim: sug.delim,
        hasHeader: sug.hasHeader,
      },
      text,
      buffer: null,
    }
  })()
}

function fallbackImport(kind: FileKind, text: string | null, buffer: ArrayBuffer | null, opts: ParseOptions): Promise<ValidateResult> {
  return (async () => {
    if (kind === 'json') { const { parseJsonText } = await import('./parse'); return parseJsonText(text ?? '', opts.timezone) }
    if (kind === 'xlsx') throw new Error('xlsx_fallback_missing')
    const { parseDelimited } = await import('./parse')
    return parseDelimited(text ?? '', opts)
  })()
}

export class ImportClient {
  private worker: WorkerLike | null = null
  private seq = 0
  private pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: unknown) => void }>()

  private ensure(): WorkerLike {
    if (this.worker) return this.worker
    const w = new Worker(new URL('../../worker/importWorker.ts', import.meta.url), { type: 'module' })
    const wrapped = w as unknown as WorkerLike
    w.onmessage = (ev) => { this.onMessage(wrapped, (ev as unknown as { data: unknown }).data) }
    w.onerror = () => { /* handled per request timeout/fallback */ }
    this.worker = wrapped
    return wrapped
  }

  private onMessage(_w: WorkerLike, data: unknown): void {
    const msg = data as { id?: number; op: string; ok: boolean; error?: string; probe?: ProbeResult; result?: ValidateResult }
    const id = msg.id ?? -1
    const p = this.pending.get(id)
    if (!p) return
    this.pending.delete(id)
    if (msg.ok) p.resolve(msg)
    else p.reject(new Error(msg.error ?? 'worker_error'))
  }

  private call(op: 'probe' | 'import', payload: Record<string, unknown>): Promise<unknown> {
    const w = this.ensure()
    const id = ++this.seq
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve: (v) => resolve(v), reject })
      try {
        w.postMessage({ id, op, ...payload })
      } catch (e) {
        this.pending.delete(id)
        reject(e)
      }
    })
  }

  async probe(file: File): Promise<ProbeOutcome> {
    const kind = fileKind(file.name)
    const { text, buffer } = await readWhole(file)
    try {
      const msg = (await this.call('probe', {
        kind,
        text: kind === 'csv' ? (text ?? '').slice(0, 64000) : text,
        buffer,
      })) as { probe: ProbeResult }
      return { probe: msg.probe, text, buffer }
    } catch {
      return fallbackProbe(kind, text, buffer)
    }
  }

  async runImport(kind: FileKind, text: string | null, buffer: ArrayBuffer | null, opts: ParseOptions): Promise<ValidateResult> {
    try {
      const msg = (await this.call('import', { kind, text, buffer, opts })) as { result: ValidateResult }
      return msg.result
    } catch (e) {
      if (e instanceof Error && e.message === 'xlsx_fallback_missing') throw e
      return fallbackImport(kind, text, buffer, opts)
    }
  }
}

export const columnMapFields: { key: keyof ColumnMap; label: string }[] = [
  { key: 'tsCol', label: 'timestamp/epoch' },
  { key: 'dateCol', label: 'date' },
  { key: 'timeCol', label: 'time' },
  { key: 'openCol', label: 'open' },
  { key: 'highCol', label: 'high' },
  { key: 'lowCol', label: 'low' },
  { key: 'closeCol', label: 'close' },
  { key: 'volCol', label: 'volume' },
]
