import { useState, useMemo } from 'react'
import { Plus, Pencil, Trash2, Search } from 'lucide-react'
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
                  <HelpHint title="dose_meta — Renal adjustment">
                    คั่นด้วย <code>;</code> หรือขึ้นบรรทัดใหม่<br /><br />
                    <b>ตัวอย่าง:</b><br />
                    <code className="block bg-muted p-1 rounded my-1 text-[11px]">CrCl&lt;10:hold; CrCl 10-50:1g q24h; CrCl&gt;50:1g q12h</code>
                    <b>Operators:</b> &lt;, &lt;=, &gt;, &gt;=, a-b (ช่วง)<br />
                    ระบบจะคำนวณ CrCl อัตโนมัติจากผู้ป่วย (Cockcroft-Gault) แล้วเลือก rule ที่ตรง
                  </HelpHint>
                </div>
                <Textarea
                  value={edit.dose_meta ?? ''}
                  onChange={(e) => setEdit({ ...edit, dose_meta: e.target.value })}
                  placeholder="CrCl<10:hold; CrCl 10-50:1g q24h; CrCl>50:1g q12h"
                  rows={2}
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
                <div>
                  <Label className="mb-1.5">pediatric_dose</Label>
                  <Input value={edit.pediatric_dose ?? ''} onChange={(e) => setEdit({ ...edit, pediatric_dose: e.target.value })} placeholder="10-15 mg/kg/dose q6h, max 4 g/day" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="mb-1.5 text-xs">min mg/kg</Label>
                    <Input value={edit.min_dose_kg ?? ''} onChange={(e) => setEdit({ ...edit, min_dose_kg: e.target.value })} placeholder="10" />
                  </div>
                  <div>
                    <Label className="mb-1.5 text-xs">max mg/kg</Label>
                    <Input value={edit.max_dose_kg ?? ''} onChange={(e) => setEdit({ ...edit, max_dose_kg: e.target.value })} placeholder="15" />
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
