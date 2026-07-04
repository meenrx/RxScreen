import { ShieldAlert, Check, X, CheckCircle2 } from 'lucide-react'
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
 * บันทึกอัตโนมัติเมื่อกดยืนยัน — ไม่ต้องกดบันทึกซ้ำ
 */
export function MedErrorPanel({ alerts, status, note, onStatus, onNote }: Props) {
  const errors = alerts.filter((a) => a.severity === 'red' || a.severity === 'orange')
  if (errors.length === 0) return null

  const decided = status !== 'unset'

  return (
    <div
      className={cn(
        'rounded-2xl border-2 shadow-sm overflow-hidden',
        status === 'confirmed'
          ? 'border-rose-400 dark:border-rose-700'
          : status === 'not_me'
            ? 'border-slate-300 dark:border-slate-700'
            : 'border-amber-400 dark:border-amber-600 ring-2 ring-amber-200 dark:ring-amber-900/50',
      )}
    >
      {/* แถบหัว เด่นชัด */}
      <div
        className={cn(
          'flex items-center gap-2.5 px-4 py-2.5 text-white',
          status === 'not_me'
            ? 'bg-gradient-to-r from-slate-500 to-slate-600'
            : 'bg-gradient-to-r from-amber-500 to-orange-600',
        )}
      >
        <ShieldAlert className="size-6 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="font-bold leading-tight">
            อาจมี Prescribing Error {errors.length} จุด
          </div>
          <div className="text-[11px] opacity-90 leading-tight">ดักได้ก่อนจ่าย · NCC MERP ระดับ B</div>
        </div>
        {decided && (
          <span className="flex items-center gap-1 text-[11px] font-semibold bg-white/20 rounded-full px-2 py-1">
            <CheckCircle2 className="size-3.5" /> บันทึกแล้ว
          </span>
        )}
      </div>

      <div className="p-3 space-y-2.5 bg-card">
        {/* รายการปัญหา — กระชับ */}
        <div className="flex flex-wrap gap-1.5">
          {errors.slice(0, 6).map((a) => (
            <span
              key={a.id}
              className={cn(
                'text-xs px-2 py-1 rounded-md font-medium',
                a.severity === 'red'
                  ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                  : 'bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300',
              )}
            >
              {a.title}
            </span>
          ))}
          {errors.length > 6 && <span className="text-xs text-muted-foreground self-center">+{errors.length - 6}</span>}
        </div>

        {/* ปุ่มยืนยัน — เด่น */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            size="lg"
            variant={status === 'confirmed' ? 'default' : 'outline'}
            className={cn('gap-1.5 h-11', status === 'confirmed' && 'bg-rose-600 hover:bg-rose-700')}
            onClick={() => onStatus(status === 'confirmed' ? 'unset' : 'confirmed')}
          >
            <Check className="size-5" /> เป็น ME (B)
          </Button>
          <Button
            size="lg"
            variant={status === 'not_me' ? 'default' : 'outline'}
            className={cn('gap-1.5 h-11', status === 'not_me' && 'bg-slate-600 hover:bg-slate-700')}
            onClick={() => onStatus(status === 'not_me' ? 'unset' : 'not_me')}
          >
            <X className="size-5" /> ไม่นับเป็น ME
          </Button>
        </div>

        {decided && (
          <Textarea
            rows={2}
            value={note}
            onChange={(e) => onNote(e.target.value)}
            placeholder={status === 'confirmed' ? 'รายละเอียด / การแก้ไข (เช่น แจ้งแพทย์ปรับขนาดยา)…' : 'เหตุผลที่ไม่นับ (เช่น แพทย์ยืนยันสั่งตามเดิม)…'}
            className="text-sm"
          />
        )}
      </div>
    </div>
  )
}
