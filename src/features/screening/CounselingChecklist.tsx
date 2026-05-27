import { useEffect, useState } from 'react'
import { ListChecks } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { getCounselingByIcode } from '@/features/catalog/api'
import type { DrugCounseling } from '@/types/drug'
import type { DrugEntry } from '@/types/screening'

interface Props {
  drugs: DrugEntry[]
  onChange?: (checked: Record<string, string[]>) => void
}

const DEFAULT_CHECKLIST = [
  'อธิบายชื่อยา + ข้อบ่งใช้',
  'แจ้งวิธีรับประทาน (ก่อน/หลังอาหาร + จำนวน)',
  'แจ้งอาการข้างเคียงสำคัญ',
  'แจ้งการเก็บรักษา',
  'แจ้งสิ่งที่ต้องระวัง (ห้ามหยุดยา/รับประทานกับยาอื่น)',
  'ตรวจสอบความเข้าใจของผู้ป่วย',
]

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
          const items = c?.checklist?.length ? c.checklist : DEFAULT_CHECKLIST
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
