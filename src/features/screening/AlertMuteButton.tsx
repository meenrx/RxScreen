import { useState } from 'react'
import { BellOff } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { addMute, muteKey } from './alertMute'
import { useAuthStore } from '@/features/auth/authStore'
import { toast } from 'sonner'
import type { ScreeningAlert } from '@/types/screening'

/** ปุ่ม 🔕 "ไม่ต้องแสดงกรณีนี้อีก" ต่อ 1 alert — ยืนยันก่อน แล้วบันทึกลง ALERT_MUTES (ยกเลิกได้ในจัดการฐานข้อมูล) */
export function AlertMuteButton({ alert, className }: { alert: ScreeningAlert; className?: string }) {
  const user = useAuthStore((s) => s.user)
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')

  async function confirm() {
    try {
      await addMute({ id: muteKey(alert), type: alert.type, drugs: alert.drugs ?? [], label: alert.title, note: note || undefined }, user?.uid)
      await qc.invalidateQueries({ queryKey: ['alert-mutes'] })
      toast.success('ปิดเตือนกรณีนี้แล้ว — ยกเลิกได้ที่ จัดการฐานข้อมูล → 🔕 ปิดเตือน')
    } catch (e) { toast.error('ปิดเตือนไม่สำเร็จ: ' + (e as Error).message) }
    setOpen(false); setNote('')
  }

  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(true) }}
        title="ไม่ต้องแสดงกรณีนี้อีก"
        className={className ?? 'shrink-0 text-muted-foreground/40 hover:text-amber-600 transition p-0.5'}
      >
        <BellOff className="size-3.5" />
      </button>
      <Dialog open={open} onOpenChange={(o) => { if (!o) { setOpen(false); setNote('') } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><BellOff className="size-5 text-amber-600" /> ไม่ต้องแสดงเตือนกรณีนี้อีก?</DialogTitle>
            <DialogDescription>
              ระบบจะ<b className="text-foreground">ซ่อนเตือนนี้ทุกครั้ง</b>ที่เข้าเกณฑ์เดียวกัน (ชนิด + ยาเดิม)
              และบันทึกไว้ใน “จัดการฐานข้อมูล → 🔕 ปิดเตือน” (ยกเลิกได้ภายหลัง)
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">
            <div className="font-medium">{alert.title}</div>
            <div className="text-xs text-muted-foreground">ชนิด: {alert.type} · เกณฑ์นี้จะไม่แสดงกับทุกคนไข้ที่เข้าเงื่อนไข</div>
          </div>
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="เหตุผล (เช่น มีข้อบ่งใช้/แพทย์ยืนยัน) — ไม่บังคับ" className="text-sm" />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); setNote('') }}>ยกเลิก</Button>
            <Button className="bg-amber-600 hover:bg-amber-700" onClick={confirm}>ยืนยัน ปิดเตือน</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
