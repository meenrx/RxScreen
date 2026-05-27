import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Pill } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { listInrProtocol, listTwdTable, adjustWarfarin } from '@/features/tools/warfarinAdjuster'
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

  return (
    <Card className="soft-card border-violet-200 dark:border-violet-900">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="size-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 text-white grid place-items-center"><Pill className="size-4" /></span>
          Warfarin Adjustment
        </CardTitle>
        <CardDescription>
          ตรวจพบ Warfarin ในรายการยา — กรอก <b>TWD ปัจจุบัน</b> เพื่อให้ระบบใช้ protocol รพ. คำนวณขนาดใหม่
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {noProtocol && (
          <div className="rounded-xl border bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900 p-3 text-sm">
            ⚠ ยังไม่มี Warfarin protocol ในระบบ — กรุณา Import จาก Google Sheet ใน Admin
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label className="mb-1.5">INR (จากด้านบน)</Label>
            <Input
              value={inr ?? ''}
              readOnly
              className="h-12 text-xl text-center font-bold bg-muted"
              placeholder="กรอก INR ที่ฟอร์มด้านบน"
            />
          </div>
          <div>
            <Label className="mb-1.5">TWD ปัจจุบัน (mg/week) <span className="text-red-500">*</span></Label>
            <Input
              type="number"
              step="0.5"
              inputMode="decimal"
              value={twd}
              onChange={(e) => setTwd(e.target.value ? +e.target.value : '')}
              className="h-12 text-xl text-center font-bold"
              placeholder="เช่น 21"
            />
          </div>
          <div>
            <Label className="mb-1.5">ขนาดเม็ดยา</Label>
            <Select value={String(strength)} onValueChange={(v) => setStrength(+v)}>
              <SelectTrigger className="w-full h-12 text-lg"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="3">3 mg</SelectItem>
                <SelectItem value="5">5 mg</SelectItem>
              </SelectContent>
            </Select>
            {detectedStrength && <div className="text-xs text-muted-foreground mt-1">ตรวจพบจากรายการยา: {detectedStrength} mg</div>}
          </div>
        </div>

        {inr === undefined && twd !== '' && (
          <div className="text-sm text-amber-700 dark:text-amber-300 italic">⚠ กรอก INR ที่ฟอร์มด้านบนก่อน เพื่อคำนวณ</div>
        )}

        {result && (
          <div className="space-y-3 fade-up pt-2 border-t">
            <div className={
              'rounded-xl border p-4 ' +
              (result.action === 'increase' ? 'alert-orange'
                : result.action === 'decrease' ? 'alert-yellow'
                : result.action === 'hold_1d' || result.action === 'omit_vitk' ? 'alert-red'
                : 'alert-green')
            }>
              <div className="text-xs uppercase tracking-wider opacity-70">{result.rule?.note ?? 'INR ในเป้าหมาย'}</div>
              <div className="text-2xl md:text-3xl font-bold mt-1">
                {result.action === 'increase' && `เพิ่ม ${result.adjustPct}%`}
                {result.action === 'decrease' && `ลด ${result.adjustPct}%`}
                {result.action === 'maintain' && 'คงขนาดเดิม'}
                {result.action === 'hold_1d' && 'หยุด 1 วัน + ลด 10%'}
                {result.action === 'omit_vitk' && `งด + Vit K`}
              </div>
              {result.vitK && <div className="text-sm font-semibold mt-1">💉 {result.vitK}</div>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-xl border p-3 bg-card">
                <div className="text-xs text-muted-foreground">TWD ใหม่</div>
                <div className="text-2xl font-bold">{result.newTwd} <span className="text-sm font-normal">mg/week</span></div>
                <div className="text-xs text-muted-foreground mt-1">จากเดิม {twd} mg/week</div>
              </div>
              <div className="rounded-xl border p-3 bg-card">
                <div className="text-xs text-muted-foreground">Schedule แนะนำ</div>
                {result.schedule ? (
                  <>
                    <div className="text-base font-bold font-mono">{result.schedule.schedule_code}</div>
                    <div className="text-xs">{result.schedule.description}</div>
                  </>
                ) : <div className="text-sm text-muted-foreground italic">ไม่พบ schedule</div>}
              </div>
            </div>

            {result.closestSchedules.length > 1 && (
              <div>
                <div className="text-xs text-muted-foreground mb-1">ตัวเลือกใกล้เคียง</div>
                <div className="flex flex-wrap gap-1.5">
                  {result.closestSchedules.map((s, i) => (
                    <Badge key={i} variant={i === 0 ? 'default' : 'outline'} className="font-mono text-xs">
                      {s.twd_mg}mg · {s.schedule_code}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
