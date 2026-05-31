import { useState } from 'react'
import { Coins, TrendingDown } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import type { Intervention } from '@/types/drug'

interface Props {
  open: boolean
  intervention: Intervention | null
  /** confirm: บันทึกจำนวน + มูลค่าประหยัด */
  onConfirm: (qty: number) => void
  /** ข้ามรอบนี้ (ไม่นับ) */
  onSkip: () => void
}

/** Popup เมื่อยาที่เคย off ถูกหมอสั่งซ้ำ — ถามจำนวนเพื่อคำนวณมูลค่าประหยัด */
export function InterventionReorderDialog({ open, intervention, onConfirm, onSkip }: Props) {
  const [qty, setQty] = useState('1')
  const unitCost = intervention?.unit_cost ?? 0
  const n = Number(qty)
  const saved = Number.isFinite(n) && n > 0 ? n * unitCost : 0

  if (!intervention) return null

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onSkip() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coins className="size-5 text-amber-500" />
            ยานี้เคยบันทึก {intervention.status === 'off' ? 'off' : 'เปลี่ยนยา'} ไว้
          </DialogTitle>
          <DialogDescription>
            <b>{intervention.drug_name}</b> — รอบนี้หมอสั่งมาอีก กรอกจำนวนที่สั่งเพื่อคำนวณต้นทุนที่ประหยัดได้
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant={intervention.status === 'off' ? 'red' : 'orange'}>
              {intervention.status === 'off' ? 'หยุดยา (off)' : 'เปลี่ยนยา'}
            </Badge>
            {intervention.reason && <Badge variant="outline">{intervention.reason}</Badge>}
            <Badge variant="secondary">ราคาทุน {unitCost.toLocaleString()} บาท/หน่วย</Badge>
          </div>

          <div>
            <Label className="mb-1.5">จำนวนที่หมอสั่งรอบนี้ (หน่วย)</Label>
            <Input
              type="number"
              min={1}
              value={qty}
              autoFocus
              onChange={(e) => setQty(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && n > 0) onConfirm(n) }}
            />
          </div>

          <div className="rounded-xl border bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 p-3 flex items-center gap-3">
            <TrendingDown className="size-6 text-emerald-600 shrink-0" />
            <div>
              <div className="text-xs text-muted-foreground">ต้นทุนที่ประหยัดได้รอบนี้</div>
              <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
                {saved.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท
              </div>
            </div>
          </div>
          {unitCost === 0 && (
            <p className="text-xs text-amber-600">⚠ ยานี้ไม่มีข้อมูลราคาทุน — มูลค่าประหยัดจะเป็น 0 (แก้ราคาได้ที่ Admin → ฐานข้อมูลยา)</p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={onSkip}>ข้ามรอบนี้</Button>
          <Button
            onClick={() => onConfirm(n)}
            disabled={!(n > 0)}
            className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700"
          >
            <Coins className="size-4" /> บันทึกประหยัด {saved > 0 ? `${saved.toLocaleString()} บาท` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
