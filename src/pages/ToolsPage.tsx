import { useEffect, useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Wrench, Pill, Syringe, History as HistoryIcon, Calculator, Loader2, Search, AlertOctagon, ArrowRightLeft, MessageSquarePlus, ClipboardList, Wind, Megaphone } from 'lucide-react'
import { AdrTab } from '@/features/tools/AdrTab'
import { DischargeTab, HandoffTab, SubstitutionTab } from '@/features/tools/MoreTabs'
import { InhalerTab } from '@/features/tools/InhalerTab'
import { RecallTab } from '@/features/tools/RecallTab'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/PageHeader'
import { listInrProtocol, listTwdTable, adjustWarfarin } from '@/features/tools/warfarinAdjuster'
import { STANDARD_SCALE, AGGRESSIVE_SCALE, calcInsulinSlidingScale } from '@/features/tools/insulin'
import { getPatientRefillHistory, type DrugRefillInfo } from '@/features/tools/refill'
import { formatBE, formatBEDateTime } from '@/lib/format'
import { toast } from 'sonner'

export default function ToolsPage() {
  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <PageHeader
        icon={Wrench}
        iconColor="from-violet-500 to-purple-600"
        title="เครื่องมือเภสัชกร"
        description="Warfarin / Insulin / ตรวจ Compliance — เลือก tab ที่ต้องการ"
      />
      <Tabs defaultValue="warfarin">
        <TabsList className="bg-card shadow-sm border h-auto overflow-x-auto max-w-full flex-wrap p-1">
          <TabsTrigger value="warfarin" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-500 data-[state=active]:to-purple-600 data-[state=active]:text-white px-3 h-9"><Pill className="size-4" /> Warfarin</TabsTrigger>
          <TabsTrigger value="insulin" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-500 data-[state=active]:to-sky-600 data-[state=active]:text-white px-3 h-9"><Syringe className="size-4" /> Insulin</TabsTrigger>
          <TabsTrigger value="refill" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-teal-600 data-[state=active]:text-white px-3 h-9"><HistoryIcon className="size-4" /> Refill</TabsTrigger>
          <TabsTrigger value="adr" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-red-500 data-[state=active]:to-rose-600 data-[state=active]:text-white px-3 h-9"><AlertOctagon className="size-4" /> ADR</TabsTrigger>
          <TabsTrigger value="discharge" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-teal-500 data-[state=active]:to-emerald-600 data-[state=active]:text-white px-3 h-9"><ArrowRightLeft className="size-4" /> Discharge</TabsTrigger>
          <TabsTrigger value="handoff" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-indigo-600 data-[state=active]:text-white px-3 h-9"><MessageSquarePlus className="size-4" /> Handoff</TabsTrigger>
          <TabsTrigger value="substitute" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-600 data-[state=active]:text-white px-3 h-9"><ClipboardList className="size-4" /> Substitute</TabsTrigger>
          <TabsTrigger value="inhaler" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-sky-500 data-[state=active]:to-blue-600 data-[state=active]:text-white px-3 h-9"><Wind className="size-4" /> Inhaler</TabsTrigger>
          <TabsTrigger value="recall" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-rose-500 data-[state=active]:to-red-600 data-[state=active]:text-white px-3 h-9"><Megaphone className="size-4" /> Recall</TabsTrigger>
        </TabsList>
        <TabsContent value="warfarin" className="mt-4"><WarfarinTab /></TabsContent>
        <TabsContent value="insulin" className="mt-4"><InsulinTab /></TabsContent>
        <TabsContent value="refill" className="mt-4"><RefillTab /></TabsContent>
        <TabsContent value="adr" className="mt-4"><AdrTab /></TabsContent>
        <TabsContent value="discharge" className="mt-4"><DischargeTab /></TabsContent>
        <TabsContent value="handoff" className="mt-4"><HandoffTab /></TabsContent>
        <TabsContent value="substitute" className="mt-4"><SubstitutionTab /></TabsContent>
        <TabsContent value="inhaler" className="mt-4"><InhalerTab /></TabsContent>
        <TabsContent value="recall" className="mt-4"><RecallTab /></TabsContent>
      </Tabs>
    </div>
  )
}

// ─────────────────────────── Warfarin ───────────────────────────
function WarfarinTab() {
  const { data: protocol = [], isLoading: pLoading } = useQuery({ queryKey: ['warf-inr'], queryFn: listInrProtocol })
  const { data: twdTable = [], isLoading: tLoading } = useQuery({ queryKey: ['warf-twd'], queryFn: listTwdTable })

  const [inr, setInr] = useState<number | ''>('')
  const [twd, setTwd] = useState<number | ''>('')
  const [strength, setStrength] = useState(3)

  const result = useMemo(() => {
    if (inr === '' || twd === '' || protocol.length === 0) return null
    return adjustWarfarin(+inr, +twd, strength, protocol, twdTable)
  }, [inr, twd, strength, protocol, twdTable])

  const isLoading = pLoading || tLoading

  return (
    <Card className="soft-card">
      <CardHeader>
        <CardTitle>💊 Warfarin Dose Adjuster</CardTitle>
        <CardDescription>กรอก INR ปัจจุบัน + TWD เดิม → ระบบใช้ protocol รพ. + ตาราง TWD ที่ import จาก Sheet</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading && (
          <div className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="size-4 animate-spin" /> กำลังโหลด protocol...</div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label className="mb-1.5">INR ปัจจุบัน</Label>
            <Input type="number" step="0.1" inputMode="decimal" value={inr} onChange={(e) => setInr(e.target.value ? +e.target.value : '')} className="h-12 text-2xl text-center font-bold" autoFocus />
          </div>
          <div>
            <Label className="mb-1.5">TWD ปัจจุบัน (mg/week)</Label>
            <Input type="number" step="0.5" inputMode="decimal" value={twd} onChange={(e) => setTwd(e.target.value ? +e.target.value : '')} className="h-12 text-2xl text-center font-bold" />
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
          </div>
        </div>

        {result && (
          <div className="space-y-3 fade-up">
            {/* Verdict */}
            <div className={
              'rounded-2xl border p-4 ' +
              (result.action === 'increase' ? 'alert-orange'
                : result.action === 'decrease' ? 'alert-yellow'
                : result.action === 'hold_1d' || result.action === 'omit_vitk' ? 'alert-red'
                : 'alert-green')
            }>
              <div className="text-xs uppercase tracking-wider opacity-70">{result.rule?.note ?? 'INR ในเป้าหมาย'}</div>
              <div className="text-3xl font-bold mt-1">
                {result.action === 'increase' && `เพิ่ม ${result.adjustPct}%`}
                {result.action === 'decrease' && `ลด ${result.adjustPct}%`}
                {result.action === 'maintain' && 'คงขนาดเดิม'}
                {result.action === 'hold_1d' && 'หยุด 1 วัน + ลด 10%'}
                {result.action === 'omit_vitk' && `งด + Vit K`}
              </div>
              {result.vitK && <div className="text-sm font-semibold mt-1">💉 {result.vitK}</div>}
            </div>

            {/* New TWD */}
            <div className="grid grid-cols-2 gap-3">
              <Card>
                <CardContent className="pt-5">
                  <div className="text-xs text-muted-foreground">TWD ใหม่</div>
                  <div className="text-3xl font-bold">{result.newTwd} <span className="text-base font-normal">mg/week</span></div>
                  <div className="text-xs text-muted-foreground mt-1">จาก {twd} mg/week</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-5">
                  <div className="text-xs text-muted-foreground">Schedule แนะนำ</div>
                  {result.schedule ? (
                    <>
                      <div className="text-xl font-bold font-mono">{result.schedule.schedule_code}</div>
                      <div className="text-sm">{result.schedule.description}</div>
                      <div className="text-xs text-muted-foreground mt-1">TWD = {result.schedule.twd_mg} mg ({result.schedule.strength_mg} mg/tab)</div>
                    </>
                  ) : <div className="text-sm text-muted-foreground italic">ไม่พบ schedule ที่ตรง — ลองเปลี่ยนขนาดเม็ดยา</div>}
                </CardContent>
              </Card>
            </div>

            {/* Closest alternatives */}
            {result.closestSchedules.length > 1 && (
              <Card>
                <CardContent className="pt-5">
                  <div className="text-xs text-muted-foreground mb-2">ตัวเลือก schedule ใกล้เคียง</div>
                  <div className="space-y-1">
                    {result.closestSchedules.map((s, i) => (
                      <div key={i} className={'flex items-center gap-3 p-2 rounded-lg border ' + (i === 0 ? 'bg-accent' : '')}>
                        <Badge variant="outline" className="font-mono">{s.twd_mg} mg</Badge>
                        <span className="font-mono text-sm">{s.schedule_code}</span>
                        <span className="text-sm text-muted-foreground">{s.description}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─────────────────────────── Insulin ───────────────────────────
function InsulinTab() {
  const [bs, setBs] = useState<number | ''>('')
  const [scaleType, setScaleType] = useState<'standard' | 'aggressive'>('standard')
  const scale = scaleType === 'standard' ? STANDARD_SCALE : AGGRESSIVE_SCALE
  const result = useMemo(() => bs === '' ? null : calcInsulinSlidingScale(+bs, scale), [bs, scale])

  return (
    <Card className="soft-card">
      <CardHeader>
        <CardTitle>💉 Insulin Sliding Scale</CardTitle>
        <CardDescription>Regular insulin SC ก่อนอาหาร / ก่อนนอน</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label className="mb-1.5">BS ปัจจุบัน (mg/dL)</Label>
            <Input type="number" inputMode="numeric" value={bs} onChange={(e) => setBs(e.target.value ? +e.target.value : '')} className="h-12 text-2xl text-center font-bold" autoFocus />
          </div>
          <div>
            <Label className="mb-1.5">Scale</Label>
            <Select value={scaleType} onValueChange={(v) => setScaleType(v as 'standard' | 'aggressive')}>
              <SelectTrigger className="w-full h-12 text-lg"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="standard">Standard (default)</SelectItem>
                <SelectItem value="aggressive">Aggressive (insulin-resistant)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {result && (
          <div className={
            'rounded-2xl border p-5 fade-up ' +
            (result.units === 0 && +bs < 70 ? 'alert-red'
              : result.units === 0 ? 'alert-green'
              : result.units >= 10 ? 'alert-red'
              : result.units >= 6 ? 'alert-orange' : 'alert-yellow')
          }>
            <div className="text-xs uppercase tracking-wider opacity-70">ขนาดยา</div>
            <div className="text-5xl font-bold mt-1">{result.units} <span className="text-xl font-normal">units</span></div>
            {result.note && <div className="text-sm mt-2 font-medium">{result.note}</div>}
            <div className="text-xs text-muted-foreground mt-3">⏰ Recheck BS ใน {result.recheckMinutes} นาที</div>
          </div>
        )}

        {/* Reference table */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">ตาราง Scale ที่เลือก</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-sm">
              {scale.map((r, i) => (
                <div key={i} className={'rounded-lg border p-2 ' + (result?.rule === r ? 'ring-2 ring-primary bg-accent' : '')}>
                  <div className="text-xs text-muted-foreground">{r.bs_min}{r.bs_max < 9999 ? `-${r.bs_max}` : '+'} mg/dL</div>
                  <div className="font-bold">{r.units} units</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  )
}

// ─────────────────────────── Refill ───────────────────────────
function RefillTab() {
  const [hn, setHn] = useState('')
  const [data, setData] = useState<DrugRefillInfo[]>([])
  const [loading, setLoading] = useState(false)

  async function search() {
    if (!hn.trim()) return
    setLoading(true)
    try {
      const list = await getPatientRefillHistory(hn.trim())
      setData(list)
      if (list.length === 0) toast.info('ไม่พบประวัติยา')
    } catch (e) {
      toast.error('ดึงข้อมูลไม่สำเร็จ: ' + (e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { setData([]) }, [hn])

  return (
    <Card className="soft-card">
      <CardHeader>
        <CardTitle><Calculator className="inline size-5 mr-1.5" />Refill / Compliance Check</CardTitle>
        <CardDescription>ตรวจ pattern การรับยา (MPR) ของผู้ป่วยจาก DISPENSING_LOG</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input value={hn} onChange={(e) => setHn(e.target.value)} placeholder="HN ผู้ป่วย" className="pl-10 h-11" autoFocus onKeyDown={(e) => { if (e.key === 'Enter') search() }} />
          </div>
          <Button onClick={search} disabled={!hn.trim() || loading}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
            ค้นหา
          </Button>
        </div>

        {data.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">พบ {data.length} ยาที่เคยรับ — ในช่วง 1 ปีล่าสุด</div>
            {data.map((d) => (
              <Card key={d.icode} className={d.status === 'over_supply' ? 'border-orange-300' : d.status === 'under_supply' ? 'border-amber-300' : ''}>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <div className="font-medium">{d.drug_name}</div>
                      <div className="text-xs text-muted-foreground">{d.icode} · {d.totalDispenses} ครั้ง</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {d.mpr !== undefined && (
                        <Badge variant={d.status === 'compliant' ? 'green' : d.status === 'over_supply' ? 'orange' : 'yellow'}>
                          MPR {(d.mpr * 100).toFixed(0)}%
                        </Badge>
                      )}
                      {d.status === 'over_supply' && <Badge variant="orange">🔁 รับเร็วเกินไป</Badge>}
                      {d.status === 'under_supply' && <Badge variant="yellow">⏰ ขาดยา</Badge>}
                      {d.status === 'compliant' && <Badge variant="green">✓ ตรงเวลา</Badge>}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {d.firstDate && <>ครั้งแรก {formatBE(d.firstDate)} · </>}
                    {d.lastDate && <>ล่าสุด {formatBEDateTime(d.lastDate)}</>}
                  </div>
                </CardContent>
              </Card>
            ))}
            <p className="text-xs text-muted-foreground">
              <b>MPR (Medication Possession Ratio)</b> = สัดส่วนวันที่ผู้ป่วยมียา ÷ จำนวนวันทั้งหมด<br />
              สมมุติว่าทุก dispense = supply 30 วัน · 80-120% = ตรงเวลา · &gt;120% = รับซ้ำเร็วเกินไป · &lt;80% = ขาดยา
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
