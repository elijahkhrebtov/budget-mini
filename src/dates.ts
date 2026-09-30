export const START_DATE = '2026-09-28'
export const END_DATE = '2026-12-31'

const DAY_MS = 24 * 60 * 60 * 1000

function parse(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`)
}

function format(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function addDays(iso: string, days: number): string {
  return format(new Date(parse(iso).getTime() + days * DAY_MS))
}

export function daysBetween(from: string, to: string): number {
  return Math.round((parse(to).getTime() - parse(from).getTime()) / DAY_MS)
}

/** 0 = Monday ... 6 = Sunday */
export function weekdayMonFirst(iso: string): number {
  return (parse(iso).getUTCDay() + 6) % 7
}

export function daysInRange(start: string, end: string): string[] {
  const days: string[] = []
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d)
  return days
}

/** Weeks (Mon–Sun) covering the range; days outside the range are null. */
export function weeksInRange(start: string, end: string): (string | null)[][] {
  const weeks: (string | null)[][] = []
  let d = addDays(start, -weekdayMonFirst(start))
  while (d <= end) {
    const week: (string | null)[] = []
    for (let i = 0; i < 7; i++) {
      week.push(d >= start && d <= end ? d : null)
      d = addDays(d, 1)
    }
    weeks.push(week)
  }
  return weeks
}

export function formatShort(iso: string): string {
  return parse(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

/**
 * Whether `day` falls on the monthly anniversary of `start`. A start on a day
 * the month lacks (e.g. the 31st) lands on that month's last day instead.
 */
export function isMonthlyOn(start: string, day: string): boolean {
  const [y, m, d] = day.split('-').map(Number)
  const lastOfMonth = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return d === Math.min(Number(start.slice(8, 10)), lastOfMonth)
}
