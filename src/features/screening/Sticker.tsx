import { useEffect, useState } from 'react'
import { Printer } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getCounselingByIcode } from '@/features/catalog/api'
import type { DrugCounseling } from '@/types/drug'
import type { DrugEntry, PatientInput } from '@/types/screening'

interface Props {
  drugs: DrugEntry[]
  patient: PatientInput
}

export function StickerPanel({ drugs, patient }: Props) {
  const [data, setData] = useState<Record<string, DrugCounseling | null>>({})
  useEffect(() => {
    (async () => {
      const map: Record<string, DrugCounseling | null> = {}
      for (const d of drugs) {
        if (!map[d.icode]) {
          map[d.icode] = await getCounselingByIcode(d.icode)
        }
      }
      setData(map)
    })()
  }, [drugs])

  function print() {
    window.print()
  }

  if (drugs.length === 0) return null

  return (
    <Card>
      <CardContent className="pt-6 space-y-3">
        <div className="flex items-center justify-between no-print">
          <h3 className="font-semibold">Sticker / Counseling</h3>
          <Button size="sm" variant="outline" onClick={print}><Printer className="size-4" /> พิมพ์</Button>
        </div>
        <div id="sticker-print" className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {drugs.map((d, i) => {
            const c = data[d.icode]
            return (
              <div key={i} className="border-2 border-dashed rounded-md p-3 break-inside-avoid">
                <div className="text-[10px] text-muted-foreground no-print">sticker · 8×4 cm</div>
                <div className="font-semibold text-sm">{d.master?.drug_name ?? d.drug_name}</div>
                <div className="text-xs text-muted-foreground">{patient.patient_name ?? '________'} · HN {patient.hn ?? '________'}</div>
                {d.sig && <div className="text-sm mt-1">{d.sig}</div>}
                {c?.short_label && <div className="text-sm mt-1 font-medium">💊 {c.short_label}</div>}
                {c?.warning && <div className="text-xs mt-1 text-red-600">⚠ {c.warning}</div>}
                {c?.storage && <div className="text-[10px] mt-1 text-muted-foreground">การเก็บ: {c.storage}</div>}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
