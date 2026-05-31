import { useEffect, useState } from 'react'
import { ListChecks } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { getCounselingByIcode } from '@/features/catalog/api'
import type { DrugCounseling, DrugMaster } from '@/types/drug'
import type { DrugEntry } from '@/types/screening'

interface Props {
  drugs: DrugEntry[]
  onChange?: (checked: Record<string, string[]>) => void
}

/**
 * Smart checklist — แสดงเฉพาะข้อพิเศษของยาแต่ละตัว
 * ไม่รวมข้อ generic (ชื่อยา/วิธีกิน/การเก็บรักษา ยาเม็ด) ที่เภสัชกรทำเป็น routine อยู่แล้ว
 */
function buildSmartChecklist(master?: DrugMaster, c?: DrugCounseling | null): string[] {
  // ถ้า admin ตั้ง checklist เฉพาะของยาตัวนี้ใน DRUG_COUNSELING แล้ว → ใช้อันนั้นตรง ๆ
  if (c?.checklist?.length) return c.checklist

  const items: string[] = []
  const form = (master?.dosage_form ?? master?.form ?? '').toLowerCase()

  // High Alert Drug
  if (master?.is_HAD) items.push('🔴 HAD — double-check dose/route/identity ก่อนจ่าย')

  // DUE
  if (master?.is_DUE) items.push('📋 แนบใบ DUE + รอ approve อาจารย์ใน 96 ชม.')

  // Timing (ถ้ามีข้อ note พิเศษ)
  if (master?.timing_note) items.push(`⏰ ${master.timing_note}`)

  // SR no-crush
  if (master?.no_crush) items.push('⚠️ ห้ามบดเม็ดยา (SR/ER) — consult แพทย์ถ้าผู้ป่วยใช้ tube feeding')

  // Food / Smoking / Alcohol / Lab interference
  if (master?.food_interaction) items.push(`🍽 อาหาร: ${master.food_interaction}`)
  if (master?.smoking_interaction) items.push(`🚬 บุหรี่: ${master.smoking_interaction}`)
  if (master?.alcohol_interaction) items.push(`🍺 แอลกอฮอล์: ${master.alcohol_interaction}`)
  if (master?.lab_interference) items.push(`🧪 รบกวน lab: ${master.lab_interference}`)

  // Safety flags
  if (master?.g6pd_unsafe) items.push('🩸 G6PD-unsafe — เฝ้าระวัง hemolysis')
  if (master?.beers_avoid_elderly) items.push('👴 Beers — ระวังในผู้สูงอายุ ≥65')
  if (master?.pregnancy_category === 'D') items.push('🤰 Pregnancy D — เสี่ยง ใช้เมื่อจำเป็น')
  if (master?.pregnancy_category === 'X') items.push('🚫 Pregnancy X — ห้ามใช้ในหญิงตั้งครรภ์')
  if (master?.lactation_safe === false) items.push('🤱 ห้ามให้นมบุตร')

  // LASA
  if (master?.lasa_with?.length) {
    items.push(`⚠️ LASA — ระวังสับสนกับ ${master.lasa_with.join(', ')}`)
  }

  // Special form-specific (skip tablet/capsule = routine)
  if (form.includes('syrup') || form.includes('suspension')) {
    items.push('🧊 เก็บในตู้เย็น / หมดอายุหลังเปิด 1 เดือน (ดูฉลาก)')
  }
  if (form.includes('drop')) items.push('👁 วิธีหยอด · ปลายขวดอย่าแตะตา · ล้างมือก่อน/หลัง')
  if (form.includes('inhaler') || form.includes('nebulizer')) {
    items.push('💨 สอนเทคนิคพ่นยา + ล้างปากหลังพ่น (steroid)')
  }
  if (form.includes('injection') || form.includes('vial') || form.includes('ampoule') || form.includes('amp')) {
    items.push('💉 เทคนิคฉีด + หมุนเวียนตำแหน่งฉีด')
  }
  if (form.includes('suppository') || form.includes('supp')) items.push('💊 วิธีสอดยาเหน็บ')
  if (form.includes('patch')) items.push('🩹 ติด patch + หมุนเวียนตำแหน่ง')

  // Counseling extras จาก DB
  if (c?.when_to_er) items.push(`🚨 พบแพทย์ทันทีถ้า: ${c.when_to_er}`)
  if (c?.side_effect) items.push(`⚠️ อาการข้างเคียงสำคัญ: ${c.side_effect}`)
  if (c?.special_pop) items.push(`👥 กลุ่มพิเศษ: ${c.special_pop}`)
  if (c?.warning && c.warning !== c.when_to_er) items.push(`⚠️ ${c.warning}`)

  // ตรวจสอบความเข้าใจ — ใส่ตอนท้ายเสมอ
  items.push('✓ ตรวจสอบความเข้าใจของผู้ป่วย')

  return items
}

export function CounselingChecklist({ drugs, onChange }: Props) {
  const [counselingMap, setCounselingMap] = useState<Record<string, DrugCounseling | null>>({})
  const [checked, setChecked] = useState<Record<string, string[]>>({})

  useEffect(() => {
    (async () => {
      const map: Record<string, DrugCounseling | null> = {}
      for (const d of drugs) {
        if (!map[d.icode]) map[d.icode] = await getCounselingByIcode(d.icode)
      }
      setCounselingMap(map)
    })()
  }, [drugs])

  function toggle(icode: string, item: string) {
    setChecked((prev) => {
      const cur = prev[icode] ?? []
      const next = cur.includes(item) ? cur.filter((x) => x !== item) : [...cur, item]
      const updated = { ...prev, [icode]: next }
      onChange?.(updated)
      return updated
    })
  }

  if (drugs.length === 0) return null

  return (
    <Card className="soft-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="size-7 rounded-lg bg-emerald-100 text-emerald-700 grid place-items-center">
            <ListChecks className="size-4" />
          </span>
          Counseling Checklist
        </CardTitle>
        <CardDescription>ติ๊กเมื่ออธิบายให้ผู้ป่วยแล้ว (เลือกได้หลายข้อ)</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {drugs.map((d) => {
          const c = counselingMap[d.icode]
          const items: string[] = buildSmartChecklist(d.master, c)
          const ck = checked[d.icode] ?? []
          const allDone = ck.length === items.length
          return (
            <div key={d.icode} className="border rounded-xl p-3">
              <div className="font-medium mb-2 flex items-center gap-2">
                {d.master?.drug_name ?? d.drug_name}
                {allDone && <span className="text-emerald-600 text-sm">✓ ครบ</span>}
              </div>
              <div className="grid sm:grid-cols-2 gap-1.5">
                {items.map((item) => {
                  const on = ck.includes(item)
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => toggle(d.icode, item)}
                      className={`text-left text-sm rounded-lg border px-3 py-2 transition ${on ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : 'hover:bg-accent'}`}
                    >
                      <span className={`mr-2 inline-block size-4 rounded text-center text-xs leading-4 ${on ? 'bg-emerald-600 text-white' : 'bg-muted text-muted-foreground'}`}>{on ? '✓' : ''}</span>
                      {item}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
