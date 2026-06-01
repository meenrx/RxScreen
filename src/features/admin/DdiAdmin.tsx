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

const SEV_SHORT: Record<DdiOverride['severity'], string> = {
  contraindicated: 'X',
  major: 'M',
  moderate: 'Mo',
  minor: 'Mi',
}

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

  // map icode + generic_name → drug_name สำหรับแสดงในตาราง
  const drugLabel = useMemo(() => {
    const byIcode = new Map<string, string>()
    const byGen = new Map<string, string>()
    for (const d of drugs) {
      byIcode.set(d.icode, d.drug_name)
      if (d.generic_name) byGen.set(d.generic_name.toLowerCase(), d.drug_name)
    }
    return (key: string): string | null => {
      if (!key) return null
      return byIcode.get(key) ?? byGen.get(key.toLowerCase()) ?? null
    }
  }, [drugs])

  const filtered = useMemo(() => {
    const s = search.toLowerCase()
    if (!s) return data
    return data.filter((d) =>
      d.drug_a.toLowerCase().includes(s)
      || d.drug_b.toLowerCase().includes(s)
      || (drugLabel(d.drug_a) ?? '').toLowerCase().includes(s)
      || (drugLabel(d.drug_b) ?? '').toLowerCase().includes(s),
    )
  }, [data, search, drugLabel])

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
              <TableHead className="w-[110px]">Severity</TableHead>
              <TableHead className="w-[80px] text-center">Onset</TableHead>
              <TableHead className="w-[70px] text-center">Doc</TableHead>
              <TableHead className="w-[200px]">Local note</TableHead>
              <TableHead className="w-[260px]">
                <span className="text-emerald-700 dark:text-emerald-400">Action / คำแนะนำ</span>
              </TableHead>
              <TableHead className="text-right w-[80px]">จัดการ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((d) => {
              const nameA = drugLabel(d.drug_a)
              const nameB = drugLabel(d.drug_b)
              return (
              <TableRow key={d.id}>
                <TableCell className="font-medium">
                  {nameA ? (
                    <>
                      <div className="leading-tight">{nameA}</div>
                      <div className="font-mono text-[10px] text-muted-foreground">{d.drug_a}</div>
                    </>
                  ) : (
                    <span title="ไม่พบใน DRUG_MASTER">{d.drug_a}</span>
                  )}
                </TableCell>
                <TableCell className="font-medium">
                  {nameB ? (
                    <>
                      <div className="leading-tight">{nameB}</div>
                      <div className="font-mono text-[10px] text-muted-foreground">{d.drug_b}</div>
                    </>
                  ) : (
                    <span title="ไม่พบใน DRUG_MASTER">{d.drug_b}</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={d.severity === 'contraindicated' || d.severity === 'major' ? 'red' : d.severity === 'moderate' ? 'orange' : 'yellow'}>
                    {SEV_SHORT[d.severity]}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  {d.onset
                    ? <Badge variant={d.onset === 'R' ? 'orange' : 'blue'} className="text-[10px]">{d.onset}</Badge>
                    : <span className="text-xs text-muted-foreground">-</span>}
                </TableCell>
                <TableCell className="text-center">
                  {d.documentation
                    ? <Badge variant="outline" className="text-[10px] font-mono">{d.documentation}</Badge>
                    : <span className="text-xs text-muted-foreground">-</span>}
                </TableCell>
                <TableCell className="text-xs max-w-[200px]"><div className="line-clamp-2" title={d.local_note}>{d.local_note ?? '-'}</div></TableCell>
                <TableCell className="text-xs max-w-[260px]">
                  {d.recommendation
                    ? <div className="line-clamp-2 text-emerald-800 dark:text-emerald-300" title={d.recommendation}>{d.recommendation}</div>
                    : <span className="text-muted-foreground italic">- ยังไม่กรอก —</span>}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(d)}><Pencil className="size-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => { if (confirm('ลบ DDI นี้?')) del.mutate(d.id!) }}><Trash2 className="size-4 text-red-500" /></Button>
                </TableCell>
              </TableRow>
              )
            })}
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
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="mb-1.5 flex items-center gap-2">
                    Severity
                    <HelpHint title="Severity">
                      <b>M</b> = Major (รุนแรง)<br />
                      <b>Mo</b> = Moderate (ปานกลาง)<br />
                      <b>Mi</b> = Minor (เล็กน้อย)<br />
                      <b>X</b> = Contraindicated (ห้ามใช้)
                    </HelpHint>
                  </Label>
                  <Select value={edit.severity} onValueChange={(v) => setEdit({ ...edit, severity: v as DdiOverride['severity'] })}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="contraindicated">X — Contraindicated (ห้ามใช้)</SelectItem>
                      <SelectItem value="major">M — Major (รุนแรง)</SelectItem>
                      <SelectItem value="moderate">Mo — Moderate (ปานกลาง)</SelectItem>
                      <SelectItem value="minor">Mi — Minor (เล็กน้อย)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="mb-1.5 flex items-center gap-2">
                    Onset
                    <HelpHint title="Onset (เวลาที่เกิดผล)">
                      <b>R</b> = Rapid — เกิดเร็วภายใน 24 ชม.<br />
                      <b>D</b> = Delayed — ใช้เวลาหลายวันจนถึงหลายสัปดาห์
                    </HelpHint>
                  </Label>
                  <Select value={edit.onset ?? '_'} onValueChange={(v) => setEdit({ ...edit, onset: (v === '_' ? undefined : v) as DdiOverride['onset'] })}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="-" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_">-</SelectItem>
                      <SelectItem value="R">R — Rapid (&lt;24 ชม.)</SelectItem>
                      <SelectItem value="D">D — Delayed (วัน–สัปดาห์)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="mb-1.5 flex items-center gap-2">
                    Documentation
                    <HelpHint title="Documentation (หลักฐานทางวิชาการ)">
                      <b>1</b> = Established — มีการวิจัยยืนยัน<br />
                      <b>2</b> = Probable — เป็นไปได้สูง มีข้อมูลรายงาน แต่ยังไม่พิสูจน์ทางคลินิก<br />
                      <b>3</b> = Suspected — มีรายงาน ยังต้องการข้อมูลเพิ่มเติม
                    </HelpHint>
                  </Label>
                  <Select value={edit.documentation ?? '_'} onValueChange={(v) => setEdit({ ...edit, documentation: (v === '_' ? undefined : v) as DdiOverride['documentation'] })}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="-" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_">-</SelectItem>
                      <SelectItem value="1">1 — Established</SelectItem>
                      <SelectItem value="2">2 — Probable</SelectItem>
                      <SelectItem value="3">3 — Suspected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="mb-1.5 flex items-center gap-2">
                  Mechanism (ไม่บังคับ)
                  <HelpHint title="Mechanism">กลไกทางเภสัชวิทยา</HelpHint>
                </Label>
                <Input value={edit.mechanism ?? ''} onChange={(e) => setEdit({ ...edit, mechanism: e.target.value })} placeholder="ตัวอย่าง: CYP3A4 inhibition · Additive QT prolongation · P-gp induction" />
              </div>
              <div>
                <Label className="mb-1.5 flex items-center gap-2">
                  Local note (โน้ตของ รพ.รือเสาะ)
                  <HelpHint title="Local note">หมายเหตุของโรงพยาบาล — จะแสดงใน alert ตอนคัดกรอง</HelpHint>
                </Label>
                <Textarea value={edit.local_note ?? ''} onChange={(e) => setEdit({ ...edit, local_note: e.target.value })} rows={2} placeholder="ตัวอย่าง: เสี่ยงเลือดออก GI สูง · ถ้าจำเป็นต้องใช้ร่วม ติดตาม INR สัปดาห์ละครั้ง 2-4 สัปดาห์" />
              </div>
              <div>
                <Label className="mb-1.5 flex items-center gap-2">
                  คำแนะนำ
                  <HelpHint title="Recommendation">วิธีจัดการ — จะแสดงใน alert</HelpHint>
                </Label>
                <Textarea value={edit.recommendation ?? ''} onChange={(e) => setEdit({ ...edit, recommendation: e.target.value })} rows={2} placeholder="ตัวอย่าง: เปลี่ยนเป็น Paracetamol · ลด Warfarin 25-50% · เว้น 2 ชม. ก่อน/หลังกิน" />
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
