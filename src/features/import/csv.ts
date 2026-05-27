/**
 * Simple CSV parser — รองรับค่าใน quotes + newlines ในเซลล์ + escaped quotes
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let i = 0
  const n = text.length

  while (i < n) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i++
        continue
      }
      field += c
      i++
      continue
    }
    if (c === '"') { inQuotes = true; i++; continue }
    if (c === ',') { row.push(field); field = ''; i++; continue }
    if (c === '\r') { i++; continue }
    if (c === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      i++
      continue
    }
    field += c
    i++
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

export function csvToObjects(text: string): Record<string, string>[] {
  const rows = parseCsv(text)
  if (rows.length === 0) return []
  const headers = rows[0].map((h) => h.trim())
  return rows.slice(1)
    .filter((r) => r.some((c) => c.trim() !== ''))
    .map((r) => {
      const obj: Record<string, string> = {}
      headers.forEach((h, i) => { obj[h] = (r[i] ?? '').trim() })
      return obj
    })
}

/** Build Google Sheets gviz CSV URL */
export function gvizCsvUrl(spreadsheetId: string, sheetName: string): string {
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`
}

export async function fetchSheetCsv(spreadsheetId: string, sheetName: string): Promise<Record<string, string>[]> {
  const res = await fetch(gvizCsvUrl(spreadsheetId, sheetName))
  if (!res.ok) throw new Error(`โหลด ${sheetName} ไม่สำเร็จ (${res.status})`)
  const text = await res.text()
  if (text.includes('<!DOCTYPE')) throw new Error(`Sheet "${sheetName}" ไม่พบหรือยังไม่เปิดเป็นสาธารณะ`)
  return csvToObjects(text)
}

export function toBool(s: string | undefined): boolean | undefined {
  if (s === undefined || s === '') return undefined
  const v = s.toUpperCase().trim()
  if (v === 'TRUE' || v === '1' || v === 'YES' || v === 'Y') return true
  if (v === 'FALSE' || v === '0' || v === 'NO' || v === 'N') return false
  return undefined
}

export function toNumber(s: string | undefined): number | undefined {
  if (s === undefined || s === '') return undefined
  const n = Number(s)
  return Number.isFinite(n) ? n : undefined
}
