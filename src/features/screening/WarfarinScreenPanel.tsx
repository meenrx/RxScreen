import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Pill } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { listInrProtocol, listTwdTable, adjustWarfarin } from '@/features/tools/warfarinAdjuster'
import { cn } from '@/lib/utils'
import type { DrugEntry } from '@/types/screening'

interface Props {
  drugs: DrugEntry[]
  inr: number | undefined
}

/** ตรวจจับว่ามี Warfarin ในรายการยา */
export function hasWarfarin(drugs: DrugEntry[]): boolean {
  return drugs.some((d) => {
    const n = (d.master?.drug_name ?? d.drug_name ?? '').toLowerCase()
    const g = d.master?.generic_name?.toLowerCase() ?? ''
    return n.includes('warfarin') || g.includes('warfarin')
  })
}

/** ตรวจหา strength ของ Warfarin ตัวแรกที่เจอ (3 หรือ 5 mg) */
function detectWarfarinStrength(drugs: DrugEntry[]): number | null {
  for (const d of drugs) {
    const n = (d.master?.drug_name ?? d.drug_name ?? '').toLowerCase()
    const g = d.master?.generic_name?.toLowerCase() ?? ''
    if (!n.includes('warfarin') && !g.includes('warfarin')) continue
    const strengthStr = d.master?.strength ?? ''
    const m = (n + ' ' + strengthStr).match(/(\d+(?:\.\d+)?)\s*mg/)
    if (m) return parseFloat(m[1])
  }
  return null
}

/** Panel แสดงในหน้า Screening เมื่อมี Warfarin */
export function WarfarinScreenPanel({ drugs, inr }: Props) {
  const { data: protocol = [], isLoading: pLoading } = useQuery({ queryKey: ['warf-inr'], queryFn: listInrProtocol })
  const { data: twdTable = [], isLoading: tLoading } = useQuery({ queryKey: ['warf-twd'], queryFn: listTwdTable })

  const detectedStrength = useMemo(() => detectWarfarinStrength(drugs), [drugs])
  const [twd, setTwd] = useState<number | ''>('')
  const [strength, setStrength] = useState(detectedStrength ?? 3)

  const result = useMemo(() => {
    if (inr === undefined || twd === '' || protocol.length === 0) return null
    return adjustWarfarin(inr, +twd, strength, protocol, twdTable)
  }, [inr, twd, strength, protocol, twdTable])

  const isLoading = pLoading || tLoading
  const noProtocol = !isLoading && protocol.length === 0

  const actionLabel =
    result?.action === 'increase' ? `เพิ่ม ${result.adjustPct}%` :
    result?.action === 'decrease' ? `ลด ${result.adjustPct}%` :
    result?.action === 'maintain' ? 'คงเดิม' :
    result?.action === 'hold_1d' ? 'หยุด 1 วัน + ลด 10%' :
    result?.action === 'omit_vitk' ? 'งด + Vit K' : null

  const actionTone =
    result?.action === 'increase' ? 'alert-orange' :
    result?.action === 'decrease' ? 'alert-yellow' :
    result?.action === 'hold_1d' || result?.action === 'omit_vitk' ? 'alert-red' :
    'alert-green'

  return (
    <Card className="soft-card border-violet-200 dark:border-violet-900">
      <CardContent className="pt-3 pb-3 space-y-2">
        {noProtocol && (
          <div className="rounded-md border bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900 px-2.5 py-1.5 text-xs">
            ⚠ ยังไม่มี Warfarin protocol — Import จาก Admin ก่อน
          </div>
        )}

        {/* แถวเดียว: icon + INR + TWD + strength + ผลลัพธ์ */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1.5 h-10 px-2.5 rounded-md bg-gradient-to-br from-violet-500 to-purple-600 text-white text-sm font-semibold">
            <Pill className="size-4" /> Warfarin
          </span>
          <div className="flex flex-col items-center">
            <Input
              value={inr ?? ''}
              readOnly
              className="h-10 w-[90px] text-center font-bold bg-muted"
              placeholder="—"
              title="INR (จาก QR)"
            />
            <span className="text-[9px] text-muted-foreground mt-0.5">INR (จาก QR)</span>
          </div>
          {/* ช่องกรอกเอง — เน้นให้ชัด (ต้องกรอกขนาดปัจจุบัน mg/สัปดาห์) */}
          <div className="flex flex-col items-center">
            <Input
              type="number"
              step="0.5"
              inputMode="decimal"
              value={twd}
              onChange={(e) => setTwd(e.target.value ? +e.target.value : '')}
              className={cn(
                'h-10 w-[120px] text-center font-bold text-base',
                twd === '' && 'ring-2 ring-violet-500 border-violet-500 bg-violet-50 dark:bg-violet-950/40 placeholder:text-violet-500',
              )}
              placeholder="กรอก mg/wk"
              title="TWD ปัจจุบัน (mg/สัปดาห์) — กรอกเอง"
              autoFocus
            />
            <span className={cn('text-[9px] mt-0.5', twd === '' ? 'text-violet-600 font-semibold' : 'text-muted-foreground')}>
              {twd === '' ? '★ กรอกขนาดปัจจุบัน' : 'ขนาดปัจจุบัน (mg/wk)'}
            </span>
          </div>
          <Select value={String(strength)} onValueChange={(v) => setStrength(+v)}>
            <SelectTrigger className="h-10 w-[90px]" title={detectedStrength ? `ตรวจพบจากใบสั่ง: ${detectedStrength} mg` : 'ขนาดเม็ดยา'}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3">3 mg</SelectItem>
              <SelectItem value="5">5 mg</SelectItem>
            </SelectContent>
          </Select>

          {inr === undefined && twd !== '' && (
            <span className="text-xs text-amber-700 dark:text-amber-300 italic">⚠ ไม่มีค่า INR</span>
          )}
        </div>

        {/* สรุปคำแนะนำ — กระชับ นำไปใช้ได้เลย */}
        {result && actionLabel && (
          <div className={cn('rounded-lg border px-3 py-2 flex flex-wrap items-center gap-x-2 gap-y-0.5', actionTone)}>
            <span className="font-bold text-sm">💊 INR {inr} → {actionLabel}</span>
            <span className="font-bold text-sm">· ปรับเป็น {result.newTwd} mg/สัปดาห์</span>
            {result.schedule && <span className="font-mono text-xs bg-card/70 px-1.5 py-0.5 rounded">{result.schedule.schedule_code}</span>}
            {result.vitK && <span className="text-xs font-semibold">· 💉 {result.vitK}</span>}
            {result.rule?.note && <span className="text-xs font-normal opacity-80 w-full mt-0.5">{result.rule.note}</span>}
          </div>
        )}

        {result && result.closestSchedules.length > 1 && (
          <div className="flex flex-wrap items-center gap-1 text-xs">
            <span className="text-muted-foreground">ใกล้เคียง:</span>
            {result.closestSchedules.map((s, i) => (
              <Badge key={i} variant={i === 0 ? 'default' : 'outline'} className="font-mono text-[10px]">
                {s.twd_mg}·{s.schedule_code}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
