import { ShieldCheck, Check, X } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type { ScreeningAlert } from '@/types/screening'

export type MeStatus = 'unset' | 'confirmed' | 'not_me'

interface Props {
  alerts: ScreeningAlert[]
  status: MeStatus
  note: string
  onStatus: (s: MeStatus) => void
  onNote: (n: string) => void
}

/**
 * ประเมิน Medication Error — prescribing error ที่คัดกรองพบ "ก่อนจ่าย"
 * = NCC MERP ระดับ B (error เกิดขึ้นแต่ยังไม่ถึงผู้ป่วย เพราะถูกดักไว้)
 * ให้เภสัชกรยืนยันว่านับเป็น ME หรือไม่ (เช่น แพทย์ตั้งใจสั่ง/มีเหตุผล = ไม่นับ)
 */
export function MedErrorPanel({ alerts, status, note, onStatus, onNote }: Props) {
  // prescribing error ที่ต้องประเมิน = ระดับแดง/ส้ม (ปัญหาใบสั่งยา ไม่ใช่แค่ monitoring)
  const errors = alerts.filter((a) => a.severity === 'red' || a.severity === 'orange')
  if (errors.length === 0) return null

  return (
    <Card className={cn('soft-card border-2', status === 'confirmed' ? 'border-rose-300 dark:border-rose-800' : status === 'not_me' ? 'border-slate-300' : 'border-amber-300 dark:border-amber-800')}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="size-7 rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 grid place-items-center">
            <ShieldCheck className="size-4" />
          </span>
          ประเมิน Medication Error
          <span className="text-[11px] font-normal px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">ระดับ B</span>
        </CardTitle>
        <CardDescription>
          พบสิ่งที่อาจเป็น <b className="text-foreground">prescribing error {errors.length} รายการ</b> — คัดกรองพบ
          <b> ก่อนจ่าย</b> (NCC MERP ระดับ B: เกิด error แต่ยังไม่ถึงผู้ป่วย) · ยืนยันการประเมิน
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2.5">
        <ul className="text-sm space-y-1">
          {errors.slice(0, 8).map((a) => (
            <li key={a.id} className="flex items-start gap-1.5">
              <span className={cn('mt-1 size-1.5 rounded-full shrink-0', a.severity === 'red' ? 'bg-red-500' : 'bg-orange-500')} />
              <span className="min-w-0">{a.title}{a.recommendation ? <span className="text-muted-foreground"> — {a.recommendation}</span> : ''}</span>
            </li>
          ))}
          {errors.length > 8 && <li className="text-xs text-muted-foreground">…และอีก {errors.length - 8} รายการ</li>}
        </ul>

        <div className="flex flex-wrap gap-2">
          <Button
            variant={status === 'confirmed' ? 'default' : 'outline'}
            className={cn('gap-1.5', status === 'confirmed' && 'bg-rose-600 hover:bg-rose-700')}
            onClick={() => onStatus(status === 'confirmed' ? 'unset' : 'confirmed')}
          >
            <Check className="size-4" /> ยืนยันเป็น ME (ระดับ B)
          </Button>
          <Button
            variant={status === 'not_me' ? 'default' : 'outline'}
            className={cn('gap-1.5', status === 'not_me' && 'bg-slate-600 hover:bg-slate-700')}
            onClick={() => onStatus(status === 'not_me' ? 'unset' : 'not_me')}
          >
            <X className="size-4" /> ไม่นับเป็น ME
          </Button>
          {status === 'confirmed' && <span className="self-center text-xs text-rose-600 font-medium">✓ บันทึกเป็น ME ระดับ B</span>}
          {status === 'not_me' && <span className="self-center text-xs text-muted-foreground">ไม่นับเป็น ME (เช่น แพทย์ตั้งใจสั่ง/มีเหตุผล)</span>}
        </div>

        {status !== 'unset' && (
          <Textarea
            rows={2}
            value={note}
            onChange={(e) => onNote(e.target.value)}
            placeholder={status === 'confirmed' ? 'รายละเอียด ME / การแก้ไข (เช่น แจ้งแพทย์เปลี่ยนขนาดยา)…' : 'เหตุผลที่ไม่นับเป็น ME (เช่น แพทย์ยืนยันสั่งตามเดิม มีข้อบ่งใช้)…'}
            className="text-sm"
          />
        )}
      </CardContent>
    </Card>
  )
}
