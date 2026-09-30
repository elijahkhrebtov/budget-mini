import { openDB } from 'idb'

export type EntryKind = 'expense' | 'income'
export type Recurrence = 'once' | 'daily' | 'weekly' | 'fortnightly' | 'monthly'

export interface Entry {
  id: string
  description: string
  kind: EntryKind
  recurrence: Recurrence
  /** YYYY-MM-DD; for recurring entries, the first day of the series */
  date: string
  /** Positive amount in cents */
  amountCents: number
  /** Temporarily excluded from calculations */
  disabled?: boolean
  createdAt: number
}

const dbPromise = openDB('budget', 1, {
  upgrade(db) {
    db.createObjectStore('entries', { keyPath: 'id' })
  },
})

export async function getAllEntries(): Promise<Entry[]> {
  return (await dbPromise).getAll('entries')
}

export async function putEntry(entry: Entry): Promise<void> {
  await (await dbPromise).put('entries', entry)
}

export async function deleteEntry(id: string): Promise<void> {
  await (await dbPromise).delete('entries', id)
}

export async function putEntries(entries: Entry[]): Promise<void> {
  const tx = (await dbPromise).transaction('entries', 'readwrite')
  await Promise.all([...entries.map((e) => tx.store.put(e)), tx.done])
}
