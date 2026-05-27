import { useState, useMemo } from 'react'
import { AlertTriangle, Search } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useDdiOverrides } from '@/features/catalog/hooks'

export default function DdiPage() {
  const { data = [], isLoading } = useDdiOverrides()
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search.trim()) return data
    const s = search.toLowerCase()
    return data.filter((d) => d.drug_a.toLowerCase().includes(s) || d.drug_b.toLowerCase().includes(s))
  }, [data, search])

  const grouped = useMemo(() => {
    const out: Record<string, typeof data> = { contraindicated: [], major: [], moderate: [], minor: [] }
    for (const d of filtered) out[d.severity]?.push(d)
    return out
  }, [filtered])

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><AlertTriangle className="size-6 text-primary" /> ตรวจ DDI</h1>
        <p className="text-sm text-muted-foreground">ฐานข้อมูล {data.length} คู่ — ค้นได้จากชื่อ/icode</p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input placeholder="ค้นหายา (พิมพ์ชื่อยาตัวใดตัวหนึ่ง)" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
          </div>
          {isLoading && <p className="text-muted-foreground text-sm">กำลังโหลด...</p>}
          {(['contraindicated', 'major', 'moderate', 'minor'] as const).map((sev) => {
            const list = grouped[sev]
            if (!list || list.length === 0) return null
            const variant = sev === 'contraindicated' || sev === 'major' ? 'red' : sev === 'moderate' ? 'orange' : 'yellow'
            return (
              <div key={sev} className="space-y-2">
                <h3 className="font-semibold capitalize flex items-center gap-2">
                  <Badge variant={variant}>{sev}</Badge>
                  <span className="text-sm text-muted-foreground">({list.length})</span>
                </h3>
                <ul className="space-y-1.5">
                  {list.map((d) => (
                    <li key={d.id} className={`border rounded-md p-3 alert-${variant}`}>
                      <div className="font-medium text-sm">{d.drug_a} ↔ {d.drug_b}</div>
                      {d.mechanism && <div className="text-xs">Mechanism: {d.mechanism}</div>}
                      {d.local_note && <div className="text-xs mt-1">Local: {d.local_note}</div>}
                      {d.recommendation && <div className="text-xs mt-1 font-medium">💡 {d.recommendation}</div>}
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
          {data.length === 0 && !isLoading && (
            <p className="text-muted-foreground text-sm">ยังไม่มีข้อมูล DDI — เพิ่มได้ที่หน้า Admin</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
