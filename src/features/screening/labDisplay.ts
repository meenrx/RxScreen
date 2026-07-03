/**
 * ค่าอ้างอิงแล็บผู้ใหญ่ + ประเมินปกติ/ผิดปกติ/วิกฤต — สำหรับแสดงผลแล็บที่สแกนจาก QR
 * (ค่าอ้างอิงทั่วไป — เภสัชกรใช้ประกอบดุลยพินิจ ไม่แทนการแปลผลของแพทย์)
 */
export type LabStatus = 'normal' | 'low' | 'high' | 'critical-low' | 'critical-high'

export interface LabMeta {
  key: string
  label: string
  unit: string
  low?: number          // ต่ำกว่านี้ = low
  high?: number         // สูงกว่านี้ = high
  critLow?: number      // ต่ำกว่านี้ = วิกฤต
  critHigh?: number     // สูงกว่านี้ = วิกฤต
  rangeText: string
}

/** อ่านจาก patient.labs (key) + ฟิลด์ตรง scr/egfr(→crcl)/inr */
export const LAB_META: Record<string, LabMeta> = {
  crcl: { key: 'crcl', label: 'CrCl', unit: 'mL/min', low: 60, critLow: 15, rangeText: '≥90 (ปกติ)' },
  gfr: { key: 'gfr', label: 'GFR', unit: 'mL/min/1.73', low: 60, critLow: 15, rangeText: '≥90 (ปกติ)' },
  scr: { key: 'scr', label: 'SCr', unit: 'mg/dL', high: 1.2, critHigh: 4, rangeText: '0.6–1.2' },
  bun: { key: 'bun', label: 'BUN', unit: 'mg/dL', high: 20, critHigh: 100, rangeText: '7–20' },
  k: { key: 'k', label: 'K⁺', unit: 'mmol/L', low: 3.5, high: 5.0, critLow: 2.5, critHigh: 6.0, rangeText: '3.5–5.0' },
  hb: { key: 'hb', label: 'Hb', unit: 'g/dL', low: 12, high: 18, critLow: 7, rangeText: '12–16' },
  fbs: { key: 'fbs', label: 'FBS', unit: 'mg/dL', low: 70, high: 125, critLow: 50, critHigh: 250, rangeText: '70–100' },
  hba1c: { key: 'hba1c', label: 'HbA1c', unit: '%', high: 7, critHigh: 10, rangeText: '<7 (เป้าหมาย)' },
  ast: { key: 'ast', label: 'AST', unit: 'U/L', high: 40, critHigh: 200, rangeText: '0–40' },
  alt: { key: 'alt', label: 'ALT', unit: 'U/L', high: 40, critHigh: 200, rangeText: '0–40' },
  albumin: { key: 'albumin', label: 'Albumin', unit: 'g/dL', low: 3.5, critLow: 2.0, rangeText: '3.5–5.0' },
  inr: { key: 'inr', label: 'INR', unit: '', high: 1.2, critHigh: 4.0, rangeText: '0.8–1.2 (ไม่ได้กินวาร์ฟาริน)' },
  plt: { key: 'plt', label: 'Plt', unit: '×10³/µL', low: 150, high: 450, critLow: 50, critHigh: 1000, rangeText: '150–450' },
  mg: { key: 'mg', label: 'Mg', unit: 'mg/dL', low: 1.7, high: 2.2, critHigh: 4, rangeText: '1.7–2.2' },
  anc: { key: 'anc', label: 'ANC', unit: '/µL', low: 1500, critLow: 500, rangeText: '≥1500' },
  aec: { key: 'aec', label: 'AEC', unit: '/µL', high: 500, rangeText: '0–500' },
}

export function evaluateLab(key: string, value: number): LabStatus {
  const m = LAB_META[key]
  if (!m) return 'normal'
  if (m.critHigh !== undefined && value > m.critHigh) return 'critical-high'
  if (m.critLow !== undefined && value < m.critLow) return 'critical-low'
  if (m.high !== undefined && value > m.high) return 'high'
  if (m.low !== undefined && value < m.low) return 'low'
  return 'normal'
}

export function isAbnormal(s: LabStatus): boolean {
  return s !== 'normal'
}
export function isCritical(s: LabStatus): boolean {
  return s === 'critical-high' || s === 'critical-low'
}

/** YYMMDD → Date (พ.ศ.? — ใช้ ค.ศ. 20YY) */
export function parseLabDate(yymmdd?: string): Date | undefined {
  if (!yymmdd || !/^\d{6}$/.test(yymmdd)) return undefined
  const yy = Number(yymmdd.slice(0, 2))
  const mm = Number(yymmdd.slice(2, 4))
  const dd = Number(yymmdd.slice(4, 6))
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return undefined
  return new Date(2000 + yy, mm - 1, dd)
}
