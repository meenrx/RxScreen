import { BellOff, RotateCcw, Loader2 } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { useMutes, removeMute } from '@/features/screening/alertMute'
import { toast } from 'sonner'

export function AlertMuteAdmin() {
  const { data: mutes, isLoading } = useMutes()
  const qc = useQueryClient()

  async function unmute(id: string) {
    try {
      await removeMute(id)
      await qc.invalidateQueries({ queryKey: ['alert-mutes'] })
      toast.success('เปิดเตือนกลับแล้ว')
    } catch (e) { toast.error('ยกเลิกไม่สำเร็จ: ' + (e as Error).message) }
  }

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2"><BellOff className="size-5 text-amber-600" /> เกณฑ์ที่ปิดเตือน</h2>
        <p className="text-sm text-muted-foreground">กรณีที่เภสัชกด“ไม่ต้องแสดงอีก” — ระบบซ่อนเตือนนี้ทุกครั้งที่คนไข้เข้าเกณฑ์เดียวกัน · กด “เปิดกลับ” เพื่อยกเลิก</p>
      </div>

      {isLoading ? <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> กำลังโหลด…</div>
        : !mutes?.length ? <div className="text-sm text-muted-foreground py-6 text-center border rounded-xl">ยังไม่มีเกณฑ์ที่ปิดเตือน</div>
          : (
            <div className="border rounded-xl divide-y">
              {mutes.map((m) => (
                <div key={m.id} className="flex items-start gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm">{m.label || m.id}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      ชนิด: <b>{m.type}</b>{m.drugs?.length ? ` · icode: ${m.drugs.join(', ')}` : ''}
                    </div>
                    {m.note && <div className="text-xs text-muted-foreground mt-0.5">📝 {m.note}</div>}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => unmute(m.id)} className="shrink-0">
                    <RotateCcw className="size-3.5" /> เปิดกลับ
                  </Button>
                </div>
              ))}
            </div>
          )}
    </div>
  )
}
