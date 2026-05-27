import dayjs from './dayjs'

/** Format date เป็น พ.ศ. เช่น 15 พ.ค. 2569 */
export function formatBE(date: Date | string | number | undefined | null, fmt = 'D MMM BBBB'): string {
  if (!date) return '-'
  const d = dayjs(date)
  if (!d.isValid()) return '-'
  return d.format(fmt)
}

/** Format datetime เป็น พ.ศ. เช่น 15 พ.ค. 2569 14:32 */
export function formatBEDateTime(date: Date | string | number | undefined | null): string {
  return formatBE(date, 'D MMM BBBB HH:mm')
}

/** Format ตัวเลขไทย e.g. 1,234.56 */
export function formatNumber(n: number | undefined | null, digits = 2): string {
  if (n === undefined || n === null || Number.isNaN(n)) return '-'
  return n.toLocaleString('th-TH', { maximumFractionDigits: digits })
}

export function relativeTime(date: Date | string | number | undefined | null): string {
  if (!date) return '-'
  return dayjs(date).fromNow()
}
