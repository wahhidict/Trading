export type LsLike = {
  getItem: (k: string) => string | null
  setItem: (k: string, v: string) => void
  removeItem: (k: string) => void
} & Record<string, unknown>

export function installLocalStorageStub(): void {
  const g = globalThis as unknown as { localStorage?: unknown; window?: unknown; navigator?: unknown }
  const ls: LsLike = {} as LsLike
  const rec: Record<string, string> = {}
  ls.getItem = (k: string) => (k in rec ? rec[k] : null)
  ls.setItem = (k: string, v: string) => { rec[k] = String(v); ls[k] = rec[k] }
  ls.removeItem = (k: string) => { delete rec[k]; delete ls[k] }
  g.localStorage = ls
  if (!g.window) g.window = g
  if (!g.navigator) (g as unknown as { navigator: unknown }).navigator = { userAgent: 'node-test' }
}

export function localStorageMock(): Record<string, unknown> {
  return (globalThis as unknown as { localStorage: Record<string, unknown> }).localStorage
}
