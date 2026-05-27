import { useQuery } from '@tanstack/react-query'
import { History } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { listAllHistory } from '@/features/history/api'
import { formatBEDateTime } from '@/lib/format'
import { useAuthStore } from '@/features/auth/authStore'

export default function HistoryPage() {
  const user = useAuthStore((s) => s.user)
  const { data = [], isLoading } = useQuery({
    queryKey: ['history-all'],
    queryFn: () => listAllHistory(200),
  })

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><History className="size-6 text-primary" /> ประวัติการคัดกรอง</h1>
        <p className="text-sm text-muted-foreground">รายการล่าสุด 200 รายการ — เห็นทุกคน, role admin ลบได้</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>วันที่</TableHead>
                <TableHead>HN/ชื่อ</TableHead>
                <TableHead>อายุ/นน</TableHead>
                <TableHead>ยา</TableHead>
                <TableHead>Alerts</TableHead>
                <TableHead>เภสัชกร</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">กำลังโหลด...</TableCell></TableRow>
              )}
              {!isLoading && data.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">ยังไม่มีประวัติ</TableCell></TableRow>
              )}
              {data.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="text-xs whitespace-nowrap">{formatBEDateTime(row.createdAt)}</TableCell>
                  <TableCell>
                    <div className="font-medium">{row.hn ?? '-'}</div>
                    <div className="text-xs text-muted-foreground">{row.patient_name ?? '-'}</div>
                  </TableCell>
                  <TableCell className="text-xs">{row.age ?? '-'} ปี / {row.weight ?? '-'} kg</TableCell>
                  <TableCell className="text-xs">{row.drugs?.length ?? 0} รายการ</TableCell>
                  <TableCell>
                    <Badge variant={row.alerts_count > 0 ? 'orange' : 'green'}>{row.alerts_count}</Badge>
                  </TableCell>
                  <TableCell className="text-xs">
                    {row.pharmacist_name}
                    {row.pharmacist_uid === user?.uid && <Badge variant="outline" className="ml-1 text-[9px]">ฉัน</Badge>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
