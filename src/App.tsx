import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { deleteEntry, getAllEntries, putEntries, putEntry, type Entry, type EntryKind, type Recurrence } from './db'
import BalanceChart from './BalanceChart'
import { downloadEntries, readEntriesFile } from './transfer'
import {
  END_DATE,
  START_DATE,
  daysBetween,
  daysInRange,
  formatShort,
  isMonthlyOn,
  weekdayMonFirst,
  weeksInRange,
} from './dates'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const RECURRENCE_LABELS: Record<Recurrence, string> = {
  once: 'One time',
  daily: 'Daily',
  weekly: 'Weekly',
  fortnightly: 'Every two weeks',
  monthly: 'Monthly',
}

const money = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function fmt(cents: number, signed = false): string {
  const s = money.format(Math.abs(cents) / 100)
  if (cents < 0) return `−${s}`
  return signed && cents > 0 ? `+${s}` : s
}

function ordinal(n: number): string {
  const suffix = n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'
  return `${n}${suffix}`
}

function signedCents(e: Entry): number {
  return e.kind === 'income' ? e.amountCents : -e.amountCents
}

function appliesOn(e: Entry, day: string): boolean {
  if (day < e.date) return false
  switch (e.recurrence) {
    case 'daily':
      return true
    case 'weekly':
      return weekdayMonFirst(e.date) === weekdayMonFirst(day)
    case 'fortnightly':
      return daysBetween(e.date, day) % 14 === 0
    case 'monthly':
      return isMonthlyOn(e.date, day)
    default:
      return e.date === day
  }
}

function describeSchedule(e: Entry): string {
  const from = formatShort(e.date)
  switch (e.recurrence) {
    case 'daily':
      return `Daily from ${from}`
    case 'weekly':
      return `Every ${WEEKDAYS[weekdayMonFirst(e.date)]} from ${from}`
    case 'fortnightly':
      return `Every other ${WEEKDAYS[weekdayMonFirst(e.date)]} from ${from}`
    case 'monthly':
      return `Monthly on the ${ordinal(Number(e.date.slice(8, 10)))} from ${from}`
    default:
      return from
  }
}

export default function App() {
  const [entries, setEntries] = useState<Entry[]>([])
  const [selectedDate, setSelectedDate] = useState(START_DATE)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formDate, setFormDate] = useState(START_DATE)

  useEffect(() => {
    getAllEntries().then(setEntries)
  }, [])

  const editing = entries.find((e) => e.id === editingId) ?? null
  const enabledEntries = useMemo(() => entries.filter((e) => !e.disabled), [entries])

  const dayStats = useMemo(() => {
    const stats = new Map<string, { delta: number; total: number; active: boolean }>()
    let total = 0
    for (const day of daysInRange(START_DATE, END_DATE)) {
      let delta = 0
      let active = false
      for (const e of enabledEntries) {
        if (!appliesOn(e, day)) continue
        delta += signedCents(e)
        active = true
      }
      total += delta
      stats.set(day, { delta, total, active })
    }
    return stats
  }, [enabledEntries])

  /** Per-entry cumulative amount (as if enabled) through the selected day */
  const cumulativeByEntry = useMemo(() => {
    const days = daysInRange(START_DATE, selectedDate)
    const result = new Map<string, number>()
    for (const e of entries) {
      const count = days.filter((d) => appliesOn(e, d)).length
      result.set(e.id, count * signedCents(e))
    }
    return result
  }, [entries, selectedDate])

  const chartData = useMemo(() => [...dayStats].map(([day, { total }]) => ({ day, total })), [dayStats])

  const weeks = useMemo(() => weeksInRange(START_DATE, END_DATE), [])

  const sortedEntries = useMemo(
    () => [...entries].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt),
    [entries],
  )

  function selectDay(day: string) {
    setSelectedDate(day)
    if (!editing) setFormDate(day)
  }

  function changeFormDate(day: string) {
    setFormDate(day)
    if (!editing) setSelectedDate(day)
  }

  function startEditing(entry: Entry) {
    if (entry.id === editingId) return stopEditing()
    setEditingId(entry.id)
    setFormDate(entry.date)
  }

  function stopEditing() {
    setEditingId(null)
    setFormDate(selectedDate)
  }

  async function handleSave(entry: Entry) {
    await putEntry(entry)
    setEntries((prev) => (prev.some((e) => e.id === entry.id) ? prev.map((e) => (e.id === entry.id ? entry : e)) : [...prev, entry]))
    if (editing) stopEditing()
  }

  async function handleToggle(entry: Entry) {
    const updated = { ...entry, disabled: !entry.disabled }
    await putEntry(updated)
    setEntries((prev) => prev.map((e) => (e.id === entry.id ? updated : e)))
  }

  async function handleImport(file: File) {
    let imported: Entry[]
    try {
      imported = await readEntriesFile(file)
    } catch (err) {
      alert(`Import failed: ${(err as Error).message}`)
      return
    }
    await putEntries(imported)
    const byId = new Map(entries.map((e) => [e.id, e]))
    for (const e of imported) byId.set(e.id, e)
    setEntries([...byId.values()])
    stopEditing()
  }

  async function handleDelete(id: string) {
    await deleteEntry(id)
    setEntries((prev) => prev.filter((e) => e.id !== id))
    if (id === editingId) stopEditing()
  }

  return (
    <div className="app">
      <div className="main-column">
        <main className="calendar">
          <div className="week header">
            {WEEKDAYS.map((w) => (
              <div key={w} className="weekday">{w}</div>
            ))}
          </div>
          {weeks.map((week, i) => (
            <div key={i} className="week">
              {week.map((day, j) => {
                if (!day) return <div key={j} className="day empty" />
                const { delta, total, active } = dayStats.get(day)!
                return (
                  <button
                    key={day}
                    type="button"
                    className={`day${day === selectedDate ? ' selected' : ''}${day.endsWith('-01') ? ' month-start' : ''}${Number(day.slice(5, 7)) % 2 === 0 ? ' alt-month' : ''}`}
                    onClick={() => selectDay(day)}
                  >
                    <span className="date">{formatShort(day)}</span>
                    <span className={`delta ${delta > 0 ? 'pos' : delta < 0 ? 'neg' : 'zero'}`}>
                      {active ? fmt(delta, true) : '—'}
                    </span>
                    <span className={`total ${total < 0 ? 'neg' : ''}`}>{fmt(total)}</span>
                  </button>
                )
              })}
            </div>
          ))}
        </main>

        <BalanceChart data={chartData} />
      </div>

      <aside className="sidebar">
        <EntryForm
          key={editingId ?? 'new'}
          editing={editing}
          date={formDate}
          onDateChange={changeFormDate}
          onSave={handleSave}
          onCancel={stopEditing}
        />
        <EntryList
          entries={sortedEntries}
          selectedDate={selectedDate}
          editingId={editingId}
          cumulativeByEntry={cumulativeByEntry}
          onSelect={startEditing}
          onToggle={handleToggle}
          onDelete={handleDelete}
          onExport={() => downloadEntries(sortedEntries)}
          onImport={handleImport}
        />
      </aside>
    </div>
  )
}

function EntryForm({
  editing,
  date,
  onDateChange,
  onSave,
  onCancel,
}: {
  editing: Entry | null
  date: string
  onDateChange: (d: string) => void
  onSave: (e: Entry) => Promise<void>
  onCancel: () => void
}) {
  const [description, setDescription] = useState(editing?.description ?? '')
  const [amount, setAmount] = useState(editing ? String(editing.amountCents / 100) : '')
  const [kind, setKind] = useState<EntryKind>(editing?.kind ?? 'expense')
  const [recurrence, setRecurrence] = useState<Recurrence>(editing?.recurrence ?? 'once')

  async function submit(ev: FormEvent) {
    ev.preventDefault()
    const amountCents = Math.round(parseFloat(amount) * 100)
    if (!Number.isFinite(amountCents) || amountCents <= 0) return
    await onSave({
      id: editing?.id ?? crypto.randomUUID(),
      createdAt: editing?.createdAt ?? Date.now(),
      disabled: editing?.disabled,
      description: description.trim(),
      kind,
      recurrence,
      date,
      amountCents,
    })
    setDescription('')
    setAmount('')
  }

  return (
    <form className={`panel entry-form${editing ? ' editing' : ''}`} onSubmit={submit}>
      <h2>{editing ? 'Edit entry' : 'New entry'}</h2>
      <div className="toggle">
        {(['expense', 'income'] as const).map((k) => (
          <button key={k} type="button" className={kind === k ? `on ${k}` : ''} onClick={() => setKind(k)}>
            {k === 'expense' ? 'Expense' : 'Income'}
          </button>
        ))}
      </div>
      <label>
        Repeats
        <select value={recurrence} onChange={(e) => setRecurrence(e.target.value as Recurrence)}>
          {(Object.keys(RECURRENCE_LABELS) as Recurrence[]).map((r) => (
            <option key={r} value={r}>{RECURRENCE_LABELS[r]}</option>
          ))}
        </select>
      </label>
      <label>
        {recurrence === 'once' ? 'Date' : 'Start date'}
        <input
          type="date"
          required
          min={START_DATE}
          max={END_DATE}
          value={date}
          onChange={(e) => e.target.value && onDateChange(e.target.value)}
        />
      </label>
      <label>
        Amount
        <input
          type="number"
          required
          min="0.01"
          step="0.01"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </label>
      <label>
        Description
        <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" />
      </label>
      <div className="form-actions">
        <button type="submit" className="primary">{editing ? 'Save' : 'Add'}</button>
        {editing && (
          <button type="button" className="secondary" onClick={onCancel}>Cancel</button>
        )}
      </div>
    </form>
  )
}

function EntryList({
  entries,
  selectedDate,
  editingId,
  cumulativeByEntry,
  onSelect,
  onToggle,
  onDelete,
  onExport,
  onImport,
}: {
  entries: Entry[]
  selectedDate: string
  editingId: string | null
  cumulativeByEntry: Map<string, number>
  onSelect: (e: Entry) => void
  onToggle: (e: Entry) => void
  onDelete: (id: string) => void
  onExport: () => void
  onImport: (file: File) => void
}) {
  let income = 0
  let expense = 0
  for (const e of entries) {
    if (e.disabled) continue
    const c = cumulativeByEntry.get(e.id) ?? 0
    if (c > 0) income += c
    else expense += c
  }

  return (
    <section className="panel entry-list">
      <div className="entry-list-header">
        <h2>Entries</h2>
        <div className="io-actions">
          <label className="link-button">
            Import
            <input
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(ev) => {
                const file = ev.target.files?.[0]
                ev.target.value = ''
                if (file) onImport(file)
              }}
            />
          </label>
          <button type="button" className="link-button" disabled={entries.length === 0} onClick={onExport}>
            Export
          </button>
        </div>
      </div>
      <div className="summary">
        <div className="summary-title">Through {formatShort(selectedDate)}</div>
        <div className="summary-row">
          <span>Income</span>
          <span className="pos">{fmt(income, true)}</span>
        </div>
        <div className="summary-row">
          <span>Expense</span>
          <span className="neg">{fmt(expense, true)}</span>
        </div>
        <div className="summary-row net">
          <span>Net</span>
          <span className={income + expense < 0 ? 'neg' : ''}>{fmt(income + expense, true)}</span>
        </div>
      </div>
      {entries.length === 0 && <p className="muted">No entries yet.</p>}
      <ul>
        {entries.map((e) => {
          const cumulative = cumulativeByEntry.get(e.id) ?? 0
          const classes = [
            appliesOn(e, selectedDate) && 'highlight',
            e.id === editingId && 'editing',
            e.disabled && 'disabled',
          ].filter(Boolean)
          return (
            <li key={e.id} className={classes.join(' ')}>
              <input
                type="checkbox"
                className="enabled-toggle"
                checked={!e.disabled}
                title={e.disabled ? 'Include in calculations' : 'Exclude from calculations'}
                onChange={() => onToggle(e)}
              />
              <button type="button" className="entry-body" title="Edit" onClick={() => onSelect(e)}>
                <div className="entry-main">
                  <span className={`amount ${e.kind === 'income' ? 'pos' : 'neg'}`}>{fmt(signedCents(e), true)}</span>
                  <span className="desc">{e.description || <span className="muted">(no description)</span>}</span>
                </div>
                <div className="entry-meta">
                  <span>{describeSchedule(e)}</span>
                  <span className={`cumulative ${cumulative > 0 ? 'pos' : cumulative < 0 ? 'neg' : 'zero'}`}>
                    Σ {fmt(cumulative, true)}
                  </span>
                </div>
              </button>
              <button
                type="button"
                className="delete"
                title={e.recurrence === 'once' ? 'Delete' : 'Delete entire series'}
                onClick={() => onDelete(e.id)}
              >
                ×
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
