import { useState, useMemo, useEffect } from 'react'
import { Plus, Pencil, Trash2, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { DrugCombobox } from '@/components/DrugCombobox'
import { HelpHint } from '@/components/HelpHint'
import { useLabRules, useSaveLabRule, useDelete, useDrugs } from '@/features/catalog/hooks'
import type { LabRule } from '@/types/drug'

// ===== dose_meta parser/serializer สำหรับ DoseMetaBuilder =====
type DoseOp = '<' | '<=' | '>' | '>=' | '=' | 'range'
interface DoseRow { op: DoseOp; v1: string; v2: string; action: string }

function parseDoseMetaRows(s: string): DoseRow[] {
  if (!s) return []
  return s
    .split(/[;\n]/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line): DoseRow | null => {
      const [condRaw, ...rest] = line.split(':')
      if (!condRaw || rest.length === 0) return null
      const action = rest.join(':').trim()
      // strip prefix
      const c = condRaw.replace(/^(?:CrCl|Cr\s*Cl|eGFR|GFR)\s*/i, '').trim()
      const range = c.match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)$/)
      if (range) return { op: 'range', v1: range[1], v2: range[2], action }
      const op = c.match(/^(<=|>=|<|>|=)\s*(\d+(?:\.\d+)?)$/)
      if (op) return { op: op[1] as DoseOp, v1: op[2], v2: '', action }
      return null
    })
    .filter((r): r is DoseRow => r !== null)
}

function serializeDoseRows(rows: DoseRow[]): string {
  return rows
    .filter((r) => r.action.trim() && r.v1.trim())
    .map((r) => {
      const cond = r.op === 'range' ? `${r.v1}-${r.v2}` : `${r.op}${r.v1}`
      return `${cond}:${r.action.trim()}`
    })
    .join('; ')
}

const OP_LABELS: Record<DoseOp, string> = {
  '<': 'น้อยกว่า',
  '<=': '≤ (น้อยกว่าหรือเท่ากับ)',
  '>': 'มากกว่า',
  '>=': '≥ (มากกว่าหรือเท่ากับ)',
  '=': 'เท่ากับ',
  range: 'อยู่ในช่วง',
}

interface BuilderProps {
  value: string | undefined
  onChange: (v: string) => void
  basisLabel: string
}

function DoseMetaBuilder({ value, onChange, basisLabel }: BuilderProps) {
  const [rows, setRows] = useState<DoseRow[]>(() => parseDoseMetaRows(value ?? ''))
  const [advanced, setAdvanced] = useState(false)
  const [raw, setRaw] = useState<string>(value ?? '')
  const unparsable = (value ?? '').trim().length > 0 && rows.length === 0 && !advanced

  // ถ้า value ภายนอกเปลี่ยน (เปิด rule ใหม่) → resync
  useEffect(() => {
    setRows(parseDoseMetaRows(value ?? ''))
    setRaw(value ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  function commit(next: DoseRow[]) {
    setRows(next)
    const s = serializeDoseRows(next)
    setRaw(s)
    onChange(s)
  }
  function addRow() { commit([...rows, { op: '<', v1: '', v2: '', action: '' }]) }
  function updateRow(i: number, patch: Partial<DoseRow>) {
    commit(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }
  function removeRow(i: number) { commit(rows.filter((_, idx) => idx !== i)) }

  return (
    <div className="space-y-2">
      {unparsable && (
        <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-2.5 py-1.5 text-xs">
          ⚠ ข้อความปัจจุบัน parse ไม่ออก: <code className="font-mono">{value}</code> — ลองสร้างใหม่ด้วยปุ่ม "+ เพิ่มเงื่อนไข" ด้านล่าง หรือกด "ขั้นสูง" เพื่อแก้ raw text
        </div>
      )}

      {!advanced && (
        <>
          {rows.length === 0 && (
            <p className="text-xs text-muted-foreground italic">ยังไม่มีเงื่อนไข — กด "+ เพิ่มเงื่อนไข" เพื่อเริ่ม</p>
          )}
          {rows.map((r, i) => (
            <div key={i} className="flex items-center gap-1.5 flex-wrap bg-card border rounded-md p-1.5">
              <span className="text-xs text-muted-foreground shrink-0">ถ้า {basisLabel}</span>
              <Select value={r.op} onValueChange={(v) => updateRow(i, { op: v as DoseOp })}>
                <SelectTrigger className="h-8 w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(OP_LABELS) as DoseOp[]).map((op) => (
                    <SelectItem key={op} value={op}>{OP_LABELS[op]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={r.v1}
                onChange={(e) => updateRow(i, { v1: e.target.value })}
                placeholder="ค่า"
                className="h-8 w-[80px]"
                inputMode="decimal"
              />
              {r.op === 'range' && (
                <>
                  <span className="text-xs">–</span>
                  <Input
                    value={r.v2}
                    onChange={(e) => updateRow(i, { v2: e.target.value })}
                    placeholder="ถึง"
                    className="h-8 w-[80px]"
                    inputMode="decimal"
                  />
                </>
              )}
              <span className="text-muted-foreground">→</span>
              <Input
                value={r.action}
                onChange={(e) => updateRow(i, { action: e.target.value })}
                placeholder="เช่น ห้ามใช้, ลด 50%, 1g q24h"
                className="h-8 flex-1 min-w-[160px]"
              />
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeRow(i)} aria-label="ลบเงื่อนไข">
                <X className="size-4 text-red-500" />
              </Button>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" className="h-8" onClick={addRow}>
              <Plus className="size-3.5" /> เพิ่มเงื่อนไข
            </Button>
            <button type="button" className="text-xs text-muted-foreground underline" onClick={() => setAdvanced(true)}>
              ขั้นสูง (raw text)
            </button>
          </div>
        </>
      )}

      {advanced && (
        <>
          <Textarea
            value={raw}
            onChange={(e) => { setRaw(e.target.value); onChange(e.target.value); setRows(parseDoseMetaRows(e.target.value)) }}
            placeholder="eGFR<30:ห้ามใช้; eGFR 30-60:ลด 50%"
            rows={2}
          />
          <button type="button" className="text-xs text-muted-foreground underline" onClick={() => setAdvanced(false)}>
            ← กลับไปแบบเลือก dropdown
          </button>
        </>
      )}
    </div>
  )
}

export function LabRuleAdmin() {
  const { data = [] } = useLabRules()
  const { data: drugs = [] } = useDrugs()
  const save = useSaveLabRule()
  const del = useDelete('lab')
  const [search, setSearch] = useState('')
  const [edit, setEdit] = useState<LabRule | null>(null)
  const [open, setOpen] = useState(false)

  // Map icode → drug_name สำหรับแสดงในตาราง
  const drugMap = useMemo(() => {
    const m = new Map<string, string>()
    drugs.forEach((d) => m.set(d.icode, d.drug_name))
    return m
  }, [drugs])

  const filtered = useMemo(() => {
    const s = search.toLowerCase()
    if (!s) return data
    return data.filter((d) => {
      const name = drugMap.get(d.icode) ?? d.drug_name ?? ''
      return d.icode.toLowerCase().includes(s) || d.param?.toLowerCase().includes(s) || name.toLowerCase().includes(s)
    })
  }, [data, search, drugMap])

  function openNew() {
    setEdit({ icode: '', param: '', priority: 'medium' })
    setOpen(true)
  }
  function openEdit(d: LabRule) {
    setEdit({ ...d })
    setOpen(true)
  }
  async function handleSave() {
    if (!edit?.icode) return
    await save.mutateAsync(edit)
    setOpen(false)
  }

  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input placeholder="ค้นหาด้วยชื่อยา / icode / param" className="pl-8 h-10" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Button onClick={openNew}><Plus className="size-4" /> เพิ่มกฎ</Button>
        </div>
        <div className="text-xs text-muted-foreground">{filtered.length} รายการ</div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ยา</TableHead>
              <TableHead>Param</TableHead>
              <TableHead>ช่วงปกติ</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>dose_meta</TableHead>
              <TableHead>pediatric</TableHead>
              <TableHead className="text-right">จัดการ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((d) => (
              <TableRow key={d.id}>
                <TableCell>
                  <div className="font-medium text-sm">{drugMap.get(d.icode) ?? d.drug_name ?? '-'}</div>
                  <div className="font-mono text-[10px] text-muted-foreground">{d.icode}</div>
                </TableCell>
                <TableCell>{d.param}</TableCell>
                <TableCell className="text-sm">{d.normal_range ?? '-'} {d.unit}</TableCell>
                <TableCell>
                  <Badge variant={d.priority === 'high' || d.priority === 'urgent' ? 'red' : d.priority === 'medium' ? 'orange' : 'yellow'}>{d.priority}</Badge>
                </TableCell>
                <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">{d.dose_meta ?? '-'}</TableCell>
                <TableCell className="max-w-[150px] truncate text-xs text-muted-foreground">{d.pediatric_dose ?? '-'}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(d)}><Pencil className="size-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => { if (confirm('ลบกฎนี้?')) del.mutate(d.id!) }}><Trash2 className="size-4 text-red-500" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{edit?.id ? 'แก้ไขกฎ Lab' : 'เพิ่มกฎ Lab ใหม่'}</DialogTitle>
          </DialogHeader>
          {edit && (
            <div className="space-y-4">
              {/* Drug selector */}
              <div>
                <Label className="mb-1.5 flex items-center gap-2">
                  ยา <span className="text-red-500">*</span>
                  <HelpHint title="ยา">เลือกยาจากรายการในระบบ — พิมพ์ชื่อยา (Amoxycillin, Warfarin ฯลฯ) แล้วเลือก ระบบจะดึง icode ให้</HelpHint>
                </Label>
                <DrugCombobox
                  drugs={drugs}
                  value={edit.icode}
                  onChange={(icode, drug) => setEdit({ ...edit, icode, drug_name: drug?.drug_name })}
                  placeholder="พิมพ์ชื่อยา…"
                  autoFocus
                />
              </div>

              {/* Lab/monitoring params */}
              <div className="rounded-xl border p-3 space-y-3 bg-muted/20">
                <div className="text-sm font-semibold flex items-center gap-2">
                  📋 ค่า lab ที่ต้อง monitor
                  <HelpHint title="ค่า Lab">
                    กรอกชื่อค่า lab ที่เภสัชกรต้องใช้ตัดสินใจ เช่น <b>SCr</b> สำหรับ renal-adjusted drugs,
                    <b>INR</b> สำหรับ Warfarin, <b>K+</b> สำหรับ ACEI/Spironolactone
                  </HelpHint>
                </div>
                <datalist id="dl-lab-param">
                  {['SCr', 'BUN', 'CrCl', 'eGFR', 'INR', 'PT', 'aPTT', 'K+', 'Na+', 'Mg2+', 'Ca2+', 'Albumin', 'AST', 'ALT', 'ALP', 'TB', 'DB', 'Hb', 'Hct', 'WBC', 'Plt', 'FBS', 'HbA1c', 'TSH', 'Free T4', 'CK', 'Trop-T', 'Lactate', 'Vit D'].map((v) => <option key={v} value={v} />)}
                </datalist>
                <datalist id="dl-lab-unit">
                  {['mg/dL', 'g/dL', 'mEq/L', 'mmol/L', 'U/L', 'IU/L', 'mcg/L', 'ng/mL', '%', 'sec', '×10³/µL', '×10⁶/µL', 'mL/min', 'mL/min/1.73m²'].map((v) => <option key={v} value={v} />)}
                </datalist>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="mb-1.5">ชื่อค่า (Param)</Label>
                    <Input list="dl-lab-param" value={edit.param ?? ''} onChange={(e) => setEdit({ ...edit, param: e.target.value })} placeholder="ตัวอย่าง: SCr / INR / K+ / Albumin" />
                  </div>
                  <div>
                    <Label className="mb-1.5">หน่วย</Label>
                    <Input list="dl-lab-unit" value={edit.unit ?? ''} onChange={(e) => setEdit({ ...edit, unit: e.target.value })} placeholder="ตัวอย่าง: mg/dL / mEq/L / U/L" />
                  </div>
                  <div>
                    <Label className="mb-1.5">ช่วงปกติ</Label>
                    <Input value={edit.normal_range ?? ''} onChange={(e) => setEdit({ ...edit, normal_range: e.target.value })} placeholder="ตัวอย่าง: 0.6-1.3 / 2-3 / 3.5-5.0" />
                  </div>
                  <div>
                    <Label className="mb-1.5 flex items-center gap-2">
                      ความสำคัญ
                      <HelpHint title="Priority">
                        <b>high/urgent</b> = เตือนเสมอ (สีแดง)<br />
                        <b>medium</b> = เตือนเมื่อค่าผิดปกติ (สีส้ม)<br />
                        <b>low/routine</b> = ข้อมูลเสริม (สีเหลือง)
                      </HelpHint>
                    </Label>
                    <Select value={edit.priority ?? 'medium'} onValueChange={(v) => setEdit({ ...edit, priority: v })}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="urgent">urgent (เร่งด่วน)</SelectItem>
                        <SelectItem value="high">high (สูง)</SelectItem>
                        <SelectItem value="medium">medium (ปานกลาง)</SelectItem>
                        <SelectItem value="low">low (ต่ำ)</SelectItem>
                        <SelectItem value="routine">routine (ทั่วไป)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label className="mb-1.5">เหตุผล / Note</Label>
                  <Input value={edit.reason ?? ''} onChange={(e) => setEdit({ ...edit, reason: e.target.value })} placeholder="เหตุผลที่ต้อง monitor เช่น 'ติดตาม INR เพื่อปรับขนาดยา'" />
                </div>
              </div>

              {/* Renal adjustment */}
              <div className="rounded-xl border p-3 space-y-2 bg-muted/20">
                <div className="text-sm font-semibold flex items-center gap-2">
                  🫘 ปรับขนาดตามไต (Renal)
                  <HelpHint title="ปรับขนาดตามไต">
                    เลือก operator จาก dropdown แล้วกรอกค่า + action เช่น "ห้ามใช้", "ลด 50%", "1g q24h"<br />
                    หลายเงื่อนไขได้ ระบบจะเลือกข้อที่ตรงเป็นข้อแรก<br /><br />
                    <b>คำที่ trigger สีแดง:</b> hold, avoid, ห้ามใช้, งด<br />
                    <b>คำที่ trigger สีส้ม:</b> reduce, ลด, ปรับ, q24, q48
                  </HelpHint>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">ฐานค่าไต:</span>
                  {(['crcl', 'egfr'] as const).map((b) => {
                    const activeBasis = (edit.renal_basis ?? 'crcl') === b
                    return (
                      <button
                        key={b}
                        type="button"
                        onClick={() => setEdit({ ...edit, renal_basis: b })}
                        className={`px-2.5 py-1 rounded-md border ${activeBasis ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent'}`}
                      >
                        {b === 'crcl' ? 'CrCl (ระบบคำนวณ)' : 'eGFR (กรอกค่าตรง)'}
                      </button>
                    )
                  })}
                </div>
                <DoseMetaBuilder
                  value={edit.dose_meta}
                  onChange={(v) => setEdit({ ...edit, dose_meta: v })}
                  basisLabel={(edit.renal_basis ?? 'crcl') === 'egfr' ? 'eGFR' : 'CrCl'}
                />
              </div>

              {/* Pediatric / dose limits */}
              <div className="rounded-xl border p-3 space-y-3 bg-muted/20">
                <div className="text-sm font-semibold flex items-center gap-2">
                  👶 ขนาดยาเด็ก + Dose limits
                  <HelpHint title="ขนาดยาเด็ก">
                    กรอกขนาดต่อ kg + max/day เช่น "10-15 mg/kg/dose q6h, max 4 g/day"<br />
                    ระบบจะแสดงเมื่อผู้ป่วยอายุ &lt; 15 ปี
                  </HelpHint>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div>
                    <Label className="mb-1.5">pediatric_dose (ข้อความอ้างอิง)</Label>
                    <Input value={edit.pediatric_dose ?? ''} onChange={(e) => setEdit({ ...edit, pediatric_dose: e.target.value })} placeholder="10-15 mg/kg/dose q6h" />
                  </div>
                  <div>
                    <Label className="mb-1.5">ความแรงต่อ 5 mL (ยาน้ำ)</Label>
                    <Input value={edit.conc_per_5ml ?? ''} onChange={(e) => setEdit({ ...edit, conc_per_5ml: e.target.value })} placeholder="250 mg/5 mL" />
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <Label className="mb-1.5 text-xs">min mg/kg/dose</Label>
                    <Input value={edit.min_dose_kg ?? ''} onChange={(e) => setEdit({ ...edit, min_dose_kg: e.target.value })} placeholder="10" />
                  </div>
                  <div>
                    <Label className="mb-1.5 text-xs">max mg/kg/dose</Label>
                    <Input value={edit.max_dose_kg ?? ''} onChange={(e) => setEdit({ ...edit, max_dose_kg: e.target.value })} placeholder="15" />
                  </div>
                  <div>
                    <Label className="mb-1.5 text-xs">frequency</Label>
                    <Input value={edit.frequency ?? ''} onChange={(e) => setEdit({ ...edit, frequency: e.target.value })} placeholder="q6h" />
                  </div>
                  <div>
                    <Label className="mb-1.5 text-xs">max mg/day</Label>
                    <Input value={edit.max_dose_day ?? ''} onChange={(e) => setEdit({ ...edit, max_dose_day: e.target.value })} placeholder="4000" />
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>ยกเลิก</Button>
            <Button onClick={handleSave} disabled={save.isPending || !edit?.icode}>บันทึก</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
