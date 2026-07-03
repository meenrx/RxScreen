import { useMemo } from 'react'
import { FlaskConical, AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { LAB_META, evaluateLab, isAbnormal, isCritical, parseLabDate, type LabStatus } from './labDisplay'
import type { PatientInput } from '@/types/screening'

interface Props {
  patient: PatientInput
}

interface LabItem {
  key: string
  label: string
  unit: string
  value: number
  status: LabStatus
  rangeText: string
  date?: string
  staleDays?: number
}

const ORDER = ['crcl', 'scr', 'bun', 'k', 'mg', 'fbs', 'ast', 'alt', 'albumin', 'inr', 'plt', 'anc', 'aec']

/** แสดงผลแล็บที่ได้จาก QR/กรอกมือ — ไฮไลต์ค่าผิดปกติ/วิกฤต + วันที่ (เตือนค่าเก่า) */
export function ScannedLabPanel({ patient }: Props) {
  const items = useMemo<LabItem[]>(() => {
    const now = new Date()
    // รวมค่าจากฟิลด์ตรง (crcl/scr/inr) + labs map
    const raw: Record<string, number | undefined> = {
      crcl: patient.egfr,
      scr: patient.scr,
      inr: patient.inr,
      ...(patient.labs ?? {}),
    }
    const out: LabItem[] = []
    for (const key of ORDER) {
      const v = raw[key]
      if (v === undefined || !LAB_META[key]) continue
      const m = LAB_META[key]
      const date = patient.labDates?.[key]
      const d = parseLabDate(date)
      const staleDays = d ? Math.floor((now.getTime() - d.getTime()) / 86400000) : undefined
      out.push({ key, label: m.label, unit: m.unit, value: v, status: evaluateLab(key, v), rangeText: m.rangeText, date, staleDays })
    }
    // ผิดปกติ/วิกฤตขึ้นก่อน
    return out.sort((a, b) => rank(b.status) - rank(a.status))
  }, [patient])

  const abnormal = items.filter((i) => isAbnormal(i.status))
  if (items.length === 0) return null

  return (
    <Card className="soft-card">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="size-7 rounded-lg bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300 grid place-items-center">
            <FlaskConical className="size-4" />
          </span>
          ผลแล็บผู้ป่วย (จากการสแกน)
        </CardTitle>
        <CardDescription>
          {abnormal.length > 0
            ? <span className="text-rose-600 dark:text-rose-400 font-medium">พบผิดปกติ {abnormal.length} ค่า</span>
            : 'อยู่ในเกณฑ์ปกติทั้งหมด'}
          {' '}· รวม {items.length} ค่า
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {items.map((it) => (
            <div key={it.key} className={`rounded-lg border p-2 ${tileClass(it.status)}`}>
              <div className="flex items-baseline justify-between gap-1">
                <span className="text-[11px] font-medium opacity-80">{it.label}</span>
                {isAbnormal(it.status) && <span className="text-[10px] font-bold">{statusTag(it.status)}</span>}
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-bold tabular-nums leading-none">{it.value}</span>
                <span className="text-[10px] opacity-70">{it.unit}</span>
              </div>
              <div className="text-[9px] opacity-60 mt-0.5">ปกติ {it.rangeText}</div>
              {it.date && (
                <div className={`text-[9px] mt-0.5 flex items-center gap-0.5 ${it.staleDays !== undefined && it.staleDays > 90 ? 'text-amber-600 dark:text-amber-400 font-medium' : 'opacity-60'}`}>
                  {it.staleDays !== undefined && it.staleDays > 90 && <AlertTriangle className="size-2.5" />}
                  {fmtDate(it.date)}{it.staleDays !== undefined && it.staleDays > 90 ? ` · เก่า ${it.staleDays} วัน` : ''}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function rank(s: LabStatus): number {
  if (isCritical(s)) return 2
  if (isAbnormal(s)) return 1
  return 0
}

function statusTag(s: LabStatus): string {
  switch (s) {
    case 'critical-high': return '⚠ สูงวิกฤต'
    case 'critical-low': return '⚠ ต่ำวิกฤต'
    case 'high': return '↑ สูง'
    case 'low': return '↓ ต่ำ'
    default: return ''
  }
}

function tileClass(s: LabStatus): string {
  switch (s) {
    case 'critical-high':
    case 'critical-low':
      return 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200'
    case 'high':
      return 'bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-900 text-orange-800 dark:text-orange-200'
    case 'low':
      return 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-200'
    default:
      return 'bg-card border-border'
  }
}

function fmtDate(yymmdd: string): string {
  const d = parseLabDate(yymmdd)
  if (!d) return yymmdd
  return `${d.getDate()}/${d.getMonth() + 1}/${(d.getFullYear() + 543) % 100}`
}
