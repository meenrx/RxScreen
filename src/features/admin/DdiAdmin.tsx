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
import { useDdiOverrides, useSaveDdi, useDelete, useDrugs } from '@/features/catalog/hooks'
import type { DdiOverride } from '@/types/drug'

export function DdiAdmin() {
  const { data = [] } = useDdiOverrides()
  const { data: drugs = [] } = useDrugs()
  const save = useSaveDdi()
  const del = useDelete('ddi')
  const [search, setSearch] = useState('')
  const [edit, setEdit] = useState<DdiOverride | null>(null)
  const [open, setOpen] = useState(false)

  // อนุญาตให้ใส่ทั้ง icode หรือ generic name (เพราะ DDI ใช้ทั้ง 2 รูปแบบ)
  // ใช้ DrugCombobox สำหรับเลือกจาก master, แต่ยังเก็บค่าเป็นสิ่งที่ผู้ใช้พิมพ์ก็ได้

  const filtered = useMemo(() => {
    const s = search.toLowerCase()
    if (!s) return data
    return data.filter((d) => d.drug_a.toLowerCase().includes(s) || d.drug_b.toLowerCase().includes(s))
  }, [data, search])

  function openNew() {
    setEdit({ drug_a: '', drug_b: '', severity: 'moderate' })
    setOpen(true)
  }
  function openEdit(d: DdiOverride) {
    setEdit({ ...d })
    setOpen(true)
  }
  async function handleSave() {
    if (!edit?.drug_a || !edit?.drug_b) return
    await save.mutateAsync(edit)
    setOpen(false)
  }

  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input placeholder="ค้นหาคู่ยา" className="pl-8 h-10" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Button onClick={openNew}><Plus className="size-4" /> เพิ่ม DDI</Button>
        </div>
        <div className="text-xs text-muted-foreground">{filtered.length} คู่</div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ยา A</TableHead>
              <TableHead>ยา B</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead>Local note</TableHead>
              <TableHead className="text-right">จัดการ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((d) => (
              <TableRow key={d.id}>
                <TableCell className="font-medium">{d.drug_a}</TableCell>
                <TableCell className="font-medium">{d.drug_b}</TableCell>
                <TableCell>
                  <Badge variant={d.severity === 'contraindicated' || d.severity === 'major' ? 'red' : d.severity === 'moderate' ? 'orange' : 'yellow'}>
                    {d.severity}
                  </Badge>
                </TableCell>
                <TableCell className="max-w-xs truncate text-xs">{d.local_note ?? '-'}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(d)}><Pencil className="size-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => { if (confirm('ลบ DDI นี้?')) del.mutate(d.id!) }}><Trash2 className="size-4 text-red-500" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{edit?.id ? 'แก้ไข DDI' : 'เพิ่ม DDI'}</DialogTitle></DialogHeader>
          {edit && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <Label className="mb-1.5 flex items-center gap-2">
                    ยา A <span className="text-red-500">*</span>
                    <HelpHint title="ยา A">เลือกยาตัวแรก — พิมพ์ชื่อยาแล้วเลือก หรือพิมพ์ generic name ตรงๆ (เช่น "Warfarin")</HelpHint>
                  </Label>
                  <DrugCombobox
                    drugs={drugs}
                    value={drugs.find((x) => x.icode === edit.drug_a || x.drug_name === edit.drug_a)?.icode ?? ''}
                    onChange={(_icode, d) => setEdit({ ...edit, drug_a: d?.generic_name || d?.drug_name || edit.drug_a })}
                    placeholder={edit.drug_a || 'พิมพ์ชื่อยา…'}
                    autoFocus
                  />
                  <div className="text-xs text-muted-foreground mt-1">ค่าปัจจุบัน: <b>{edit.drug_a || '-'}</b> · <button type="button" onClick={() => { const v = prompt('กรอกชื่อยา/generic ที่จะเทียบ', edit.drug_a) ?? edit.drug_a; setEdit({ ...edit, drug_a: v }) }} className="text-primary underline">แก้ด้วยตนเอง</button></div>
                </div>
                <div>
                  <Label className="mb-1.5">
                    ยา B <span className="text-red-500">*</span>
                  </Label>
                  <DrugCombobox
                    drugs={drugs}
                    value={drugs.find((x) => x.icode === edit.drug_b || x.drug_name === edit.drug_b)?.icode ?? ''}
                    onChange={(_icode, d) => setEdit({ ...edit, drug_b: d?.generic_name || d?.drug_name || edit.drug_b })}
                    placeholder={edit.drug_b || 'พิมพ์ชื่อยา…'}
                  />
                  <div className="text-xs text-muted-foreground mt-1">ค่าปัจจุบัน: <b>{edit.drug_b || '-'}</b> · <button type="button" onClick={() => { const v = prompt('กรอกชื่อยา/generic ที่จะเทียบ', edit.drug_b) ?? edit.drug_b; setEdit({ ...edit, drug_b: v }) }} className="text-primary underline">แก้ด้วยตนเอง</button></div>
                </div>
              </div>
              <div>
                <Label className="mb-1.5 flex items-center gap-2">
                  Severity
                  <HelpHint title="Severity">
                    <b>contraindicated</b> = ห้ามใช้ร่วมเด็ดขาด<br />
                    <b>major</b> = ร้ายแรง ระวังเสมอ<br />
                    <b>moderate</b> = ปานกลาง ปรับ dose/monitor<br />
                    <b>minor</b> = เล็กน้อย
                  </HelpHint>
                </Label>
                <Select value={edit.severity} onValueChange={(v) => setEdit({ ...edit, severity: v as DdiOverride['severity'] })}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contraindicated">contraindicated (ห้ามใช้)</SelectItem>
                    <SelectItem value="major">major (รุนแรง)</SelectItem>
                    <SelectItem value="moderate">moderate (ปานกลาง)</SelectItem>
                    <SelectItem value="minor">minor (เล็กน้อย)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1.5 flex items-center gap-2">
                  Mechanism (ไม่บังคับ)
                  <HelpHint title="Mechanism">กลไกทางเภสัชวิทยา เช่น "CYP3A4 inhibition", "Additive QT prolongation"</HelpHint>
                </Label>
                <Input value={edit.mechanism ?? ''} onChange={(e) => setEdit({ ...edit, mechanism: e.target.value })} />
              </div>
              <div>
                <Label className="mb-1.5 flex items-center gap-2">
                  Local note (โน้ตของ รพ.รือเสาะ)
                  <HelpHint title="Local note">หมายเหตุของโรงพยาบาล — จะแสดงใน alert ตอนคัดกรอง</HelpHint>
                </Label>
                <Textarea value={edit.local_note ?? ''} onChange={(e) => setEdit({ ...edit, local_note: e.target.value })} rows={2} placeholder="เพิ่มเสี่ยงเลือดออก GI สูงมาก ถ้าจำเป็นต้องใช้ร่วม ติดตาม INR ถี่ขึ้น" />
              </div>
              <div>
                <Label className="mb-1.5 flex items-center gap-2">
                  คำแนะนำ
                  <HelpHint title="Recommendation">วิธีจัดการ เช่น "เปลี่ยนเป็น Paracetamol แทน"</HelpHint>
                </Label>
                <Textarea value={edit.recommendation ?? ''} onChange={(e) => setEdit({ ...edit, recommendation: e.target.value })} rows={2} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>ยกเลิก</Button>
            <Button onClick={handleSave} disabled={save.isPending}>บันทึก</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
