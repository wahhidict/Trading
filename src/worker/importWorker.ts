/// <reference lib="webworker" />
import * as XLSX from 'xlsx'
import { parseDelimited, parseJsonText, suggestFromText } from '../core/import/parse'
import type { ParseOptions, ColumnMap } from '../core/types'
import type { ValidateResult } from '../core/import/validate'

export type ImportMsg =
  | { op: 'probe'; kind: 'csv' | 'json' | 'xlsx'; text?: string; buffer?: ArrayBuffer }
  | { op: 'import'; kind: 'csv' | 'json' | 'xlsx'; text?: string; buffer?: ArrayBuffer; opts: ParseOptions }

export interface ProbeResult {
  headers: string[]
  sampleRows: string[][]
  suggestedMap: ColumnMap
  delim: string
  hasHeader: boolean
  sheetName?: string
}

export type WorkerResp =
  | { op: 'probe'; ok: boolean; error?: string; probe?: ProbeResult }
  | { op: 'import'; ok: boolean; error?: string; result?: ValidateResult }

type ImportMsgWithId = { id?: number }

self.onmessage = (ev: MessageEvent<ImportMsg>) => {
  const req = ev.data as ImportMsg & ImportMsgWithId
  const reqId = req.id ?? -1
  try {
    if (req.op === 'probe') {
      if (req.kind === 'json') {
        const text = req.text ?? ''
        const arrSample = text.slice(0, 4000)
        const probe: ProbeResult = {
          headers: ['#0', '#1', '#2', '#3', '#4', '#5'],
          sampleRows: [[arrSample.slice(0, 400)]],
          suggestedMap: { dateCol: -1, timeCol: -1, tsCol: -1, openCol: 1, highCol: 2, lowCol: 3, closeCol: 4, volCol: -1 },
          delim: ',',
          hasHeader: false,
        }
        post({ op: 'probe', ok: true, probe }, reqId)
        return
      }
      if (req.kind === 'xlsx') {
        const wb = XLSX.read(req.buffer as ArrayBuffer, { type: 'array' })
        const sheetName = wb.SheetNames[0]
        const csv = XLSX.utils.sheet_to_csv(wb.Sheets[sheetName])
        const sug = suggestFromText(csv)
        const probe: ProbeResult = { headers: sug.headers, sampleRows: sug.rows, suggestedMap: sug.map, delim: sug.delim, hasHeader: sug.hasHeader, sheetName }
        post({ op: 'probe', ok: true, probe }, reqId)
        return
      }
      post({ op: 'probe', ok: true, probe: toProbe(suggestFromText(req.text ?? '')) }, reqId)
      return
    }
    let result: ValidateResult
    if (req.kind === 'json') {
      result = parseJsonText(req.text ?? '', req.opts.timezone)
    } else if (req.kind === 'xlsx') {
      const wb = XLSX.read(req.buffer as ArrayBuffer, { type: 'array' })
      const csv = XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]])
      result = parseDelimited(csv, req.opts)
    } else {
      result = parseDelimited(req.text ?? '', req.opts)
    }
    post({ op: 'import', ok: true, result }, reqId)
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e)
    post({ op: req.op, ok: false, error } as WorkerResp, reqId)
  }
}

function post(msg: WorkerResp, id: number): void {
  ;(self as unknown as Worker).postMessage({ ...msg, id })
}

function toProbe(sug: ReturnType<typeof suggestFromText>): ProbeResult {
  return { headers: sug.headers, sampleRows: sug.rows, suggestedMap: sug.map, delim: sug.delim, hasHeader: sug.hasHeader }
}
