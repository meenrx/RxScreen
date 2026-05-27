import { useState, useMemo } from 'react'
import { Baby, Search } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useLabRules, useDrugs } from '@/features/catalog/hooks'

export default function PediatricPage() {
  const [age, setAge] = useState<number | ''>('')
  const [weight, setWeight] = useState<number | ''>('')
  const [search, setSearch] = useState('')

  const { data: rules = [] } = useLabRules()
  const { data: drugs = [] } = useDrugs()

  const pedRules = useMemo(() => rules.filter((r) => r.pediatric_dose), [rules])

  const filtered = useMemo(() => {
    if (!search.trim()) return pedRules
    const s = search.toLowerCase()
    return pedRules.filter((r) => {
      const drug = drugs.find((d) => d.icode === r.icode)
      return r.icode.toLowerCase().includes(s) || drug?.drug_name.toLowerCase().includes(s) || drug?.generic_name?.toLowerCase().includes(s)
    })
  }, [pedRules, drugs, search])

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Baby className="size-6 text-primary" /> ขนาดยาเด็ก</h1>
        <p className="text-sm text-muted-foreground">ค้นจาก LAB_RULES.pediatric_dose — แสดงตามน้ำหนักผู้ป่วย</p>
      </div>

      <Card>
        <CardHeader><CardTitle>ข้อมูลผู้ป่วยเด็ก</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-3 gap-3">
          <div><Label>อายุ (ปี)</Label><Input type="number" step="0.1" value={age} onChange={(e) => setAge(e.target.value ? +e.target.value : '')} /></div>
          <div><Label>น้ำหนัก (kg)</Label><Input type="number" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value ? +e.target.value : '')} /></div>
          <div className="flex items-end">
            {age && +age < 15 ? <Badge variant="blue">เด็ก ({age} ปี)</Badge> : age && +age >= 15 ? <Badge variant="outline">ผู้ใหญ่ ({age} ปี)</Badge> : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Search className="size-5" /> ค้นยาเด็ก</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="ค้นหา icode/ชื่อยา" value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="text-xs text-muted-foreground">{filtered.length} รายการ</div>
          <ul className="space-y-2">
            {filtered.map((r) => {
              const drug = drugs.find((d) => d.icode === r.icode)
              return (
                <li key={r.id} className="border rounded-md p-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{r.icode}</span>
                    <span className="font-medium">{drug?.drug_name ?? r.icode}</span>
                  </div>
                  <div className="text-sm mt-1">{r.pediatric_dose}</div>
                  {weight && r.pediatric_dose && (
                    <div className="text-xs text-muted-foreground mt-1">
                      คำนวณจากน้ำหนัก {weight} kg: ดู mg/kg ใน sig แล้วคูณ — เช่น 10 mg/kg × {weight} = <b>{(10 * +weight).toFixed(0)} mg</b>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
