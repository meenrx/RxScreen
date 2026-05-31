import { AlertTriangle, Info } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import type { DrugEntry } from '@/types/screening'

interface Props {
  drugs: DrugEntry[]
}

/** Info-only panel for the screening result.
 *
 * Since we can't import the patient's actual allergy history from HIS, this
 * panel surfaces — without matching against anything — every drug in the Rx
 * that has either:
 *   • an `allergens` entry (concrete trigger substances such as "egg",
 *     "peanut", "sulfa"), or
 *   • a `cross_react` entry (drug-class groups that share allergic
 *     reactivity, e.g. Cephalosporin ↔ Penicillin).
 *
 * The pharmacist is expected to ask the patient or check the chart against
 * this list. We deliberately do NOT escalate severity here — patient.allergies
 * matching is handled separately in engine.ts and produces its own alerts.
 */
export function AllergyRiskPanel({ drugs }: Props) {
  if (drugs.length === 0) return null

  // Map: allergen text → list of drug_names from the Rx that declare it.
  const allergenMap = new Map<string, string[]>()
  for (const d of drugs) {
    const m = d.master
    if (!m?.allergens?.length) continue
    for (const a of m.allergens) {
      const key = a.trim()
      if (!key) continue
      const arr = allergenMap.get(key) ?? []
      arr.push(m.drug_name)
      allergenMap.set(key, arr)
    }
  }

  // Same for cross_react — these are class names (Penicillin, Sulfa, etc.).
  const crossMap = new Map<string, string[]>()
  for (const d of drugs) {
    const m = d.master
    if (!m?.cross_react?.length) continue
    for (const c of m.cross_react) {
      const key = c.trim()
      if (!key) continue
      const arr = crossMap.get(key) ?? []
      arr.push(m.drug_name)
      crossMap.set(key, arr)
    }
  }

  if (allergenMap.size === 0 && crossMap.size === 0) return null

  return (
    <Card className="soft-card border-amber-300 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="size-7 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 text-white grid place-items-center">
            <AlertTriangle className="size-3.5" />
          </span>
          ตรวจประวัติแพ้ก่อนจ่าย
        </CardTitle>
        <CardDescription className="text-xs">
          ระบบไม่ได้เชื่อมประวัติแพ้ยา HIS — กรุณาถามผู้ป่วย/เปิดเวชระเบียนเทียบรายการด้านล่าง
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {allergenMap.size > 0 && (
          <Section
            title="สารกระตุ้นแพ้ที่อยู่ในยา"
            subtitle="ถ้าผู้ป่วยแพ้สิ่งเหล่านี้ → ห้ามจ่าย"
            entries={[...allergenMap.entries()].sort()}
            badgeClass="bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-300 dark:border-red-800"
          />
        )}
        {crossMap.size > 0 && (
          <Section
            title="ระวังแพ้ข้าม (cross-reactivity)"
            subtitle="ถ้าผู้ป่วยแพ้ยากลุ่มนี้ → ยาในใบสั่งอาจกระตุ้นได้"
            entries={[...crossMap.entries()].sort()}
            badgeClass="bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-800"
          />
        )}
      </CardContent>
    </Card>
  )
}

function Section({
  title,
  subtitle,
  entries,
  badgeClass,
}: {
  title: string
  subtitle: string
  entries: [string, string[]][]
  badgeClass: string
}) {
  return (
    <div>
      <div className="flex items-baseline gap-2 mb-1.5">
        <h4 className="text-sm font-semibold flex items-center gap-1.5">
          <Info className="size-3.5 opacity-60" />
          {title}
        </h4>
        <span className="text-[11px] text-muted-foreground">{subtitle}</span>
      </div>
      <ul className="space-y-1">
        {entries.map(([key, drugNames]) => (
          <li key={key} className="flex flex-wrap items-center gap-1.5 text-sm">
            <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${badgeClass}`}>
              {key}
            </span>
            <span className="text-muted-foreground text-xs">→</span>
            <span className="text-xs">{[...new Set(drugNames)].join(', ')}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
