import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { UserSearch, Search, ClipboardCheck } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/PageHeader'
import { listAllHistory } from '@/features/history/api'
import { formatBEDateTime } from '@/lib/format'

export default function PatientHistoryPage() {
  const [hn, setHn] = useState('')
  const { data = [] } = useQuery({ queryKey: ['history-all'], queryFn: () => listAllHistory(500) })

  const filtered = useMemo(() => {
    if (!hn.trim()) return []
    const k = hn.trim().toLowerCase()
    return data.filter((d) => d.hn?.toLowerCase().includes(k) || d.patient_name?.toLowerCase().includes(k))
  }, [data, hn])

  const allDrugs = useMemo(() => {
    const map = new Map<string, { name: string; count: number; last: Date }>()
    for (const log of filtered) {
      for (const dr of log.drugs ?? []) {
        const ex = map.get(dr.icode)
        if (ex) { ex.count++; if (log.createdAt > ex.last) ex.last = log.createdAt }
        else map.set(dr.icode, { name: dr.drug_name, count: 1, last: log.createdAt })
      }
    }
    return [...map.entries()].sort((a, b) => b[1].count - a[1].count)
  }, [filtered])

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <PageHeader
        icon={UserSearch}
        iconColor="from-rose-500 to-pink-600"
        title="ค้นประวัติผู้ป่วย"
        description="ใส่ HN หรือชื่อ → ดูรายการยาที่เคยรับ + ครั้งที่คัดกรอง"
      />
      <Card className="soft-card">
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-muted-foreground" />
            <Input className="h-12 pl-10 text-lg" placeholder="พิมพ์ HN หรือชื่อ" value={hn} onChange={(e) => setHn(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {hn.trim() && (
        <>
          <div className="text-sm text-muted-foreground">พบ {filtered.length} ครั้ง</div>

          {allDrugs.length > 0 && (
            <Card className="soft-card">
              <CardHeader>
                <CardTitle>รายการยาที่เคยได้รับ ({allDrugs.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5">
                  {allDrugs.map(([icode, info]) => (
                    <li key={icode} className="flex flex-wrap items-center gap-2 py-1 border-b last:border-0">
                      <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{icode}</span>
                      <span className="flex-1 font-medium">{info.name}</span>
                      <Badge variant="secondary">{info.count} ครั้ง</Badge>
                      <span className="text-xs text-muted-foreground">ล่าสุด {formatBEDateTime(info.last)}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <Card className="soft-card">
            <CardHeader>
              <CardTitle>ประวัติคัดกรองทั้งหมด</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {filtered.length === 0 && <p className="text-sm text-muted-foreground italic">ไม่พบประวัติ</p>}
              {filtered.map((log) => (
                <div key={log.id} className="border rounded-xl p-3 hover:shadow-sm transition">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <ClipboardCheck className="size-4 text-emerald-600" />
                      <span className="font-medium">{log.patient_name ?? log.hn ?? '-'}</span>
                      <span className="text-xs text-muted-foreground">{formatBEDateTime(log.createdAt)}</span>
                    </div>
                    <Badge variant={log.alerts_count > 0 ? 'orange' : 'green'}>{log.alerts_count} alerts</Badge>
                  </div>
                  <div className="mt-2 text-sm">
                    {(log.drugs ?? []).map((d) => d.drug_name).join(', ')}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    เภสัชกร: {log.pharmacist_name}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
