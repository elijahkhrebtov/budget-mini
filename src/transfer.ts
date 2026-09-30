import type { Entry, EntryKind, Recurrence } from './db'

const KINDS: EntryKind[] = ['expense', 'income']
const RECURRENCES: Recurrence[] = ['once', 'daily', 'weekly', 'fortnightly', 'monthly']

interface ExportFile {
  version: 1
  exportedAt: string
  entries: Entry[]
}

export function downloadEntries(entries: Entry[]): void {
  const file: ExportFile = { version: 1, exportedAt: new Date().toISOString(), entries }
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `budget-entries-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function toEntry(raw: unknown, index: number): Entry {
  const fail = (field: string) => {
    throw new Error(`Entry #${index + 1}: invalid or missing "${field}"`)
  }
  if (typeof raw !== 'object' || raw === null) throw new Error(`Entry #${index + 1}: not an object`)
  const r = raw as Record<string, unknown>
  if (typeof r.id !== 'string' || !r.id) fail('id')
  if (!KINDS.includes(r.kind as EntryKind)) fail('kind')
  if (!RECURRENCES.includes(r.recurrence as Recurrence)) fail('recurrence')
  if (typeof r.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(r.date)) fail('date')
  if (!Number.isInteger(r.amountCents) || (r.amountCents as number) <= 0) fail('amountCents')
  return {
    id: r.id as string,
    description: typeof r.description === 'string' ? r.description : '',
    kind: r.kind as EntryKind,
    recurrence: r.recurrence as Recurrence,
    date: r.date as string,
    amountCents: r.amountCents as number,
    disabled: r.disabled === true || undefined,
    createdAt: typeof r.createdAt === 'number' ? r.createdAt : Date.now() + index,
  }
}

/** Accepts the export format, or a bare array of entries. Throws with a readable message if invalid. */
export async function readEntriesFile(file: File): Promise<Entry[]> {
  let data: unknown
  try {
    data = JSON.parse(await file.text())
  } catch {
    throw new Error('File is not valid JSON')
  }
  const list = Array.isArray(data) ? data : (data as Partial<ExportFile> | null)?.entries
  if (!Array.isArray(list)) throw new Error('Expected an "entries" array')
  return list.map(toEntry)
}
