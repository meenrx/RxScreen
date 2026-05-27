import { useState, useMemo } from 'react'
import { Plus, Pencil, Trash2, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { DrugCombobox } from '@/components/DrugCombobox'
import { HelpHint } from '@/components/HelpHint'
import { useCounseling, useSaveCounseling, useDelete, useDrugs } from '@/features/catalog/hooks'
import type { DrugCounseling } from '@/types/drug'

export function CounselingAdmin() {
  const { data = [] } = useCounseling()
  const { data: drugs = [] } = useDrugs()
  const save = useSaveCounseling()
  const del = useDelete('counseling')
  const [search, setSearch] = useState('')
  const [edit, setEdit] = useState<DrugCounseling | null>(null)
  const [open, setOpen] = useState(false)

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
      return d.icode.toLowerCase().includes(s) || name.toLowerCase().includes(s)
    })
  }, [data, search, drugMap])

  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input placeholder="ค้นหาด้วยชื่อยา / icode" className="pl-8 h-10" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Button onClick={() => { setEdit({ icode: '' }); setOpen(true) }}><Plus className="size-4" /> เพิ่ม</Button>
        </div>
        <div className="text-xs text-muted-foreground">{filtered.length} รายการ</div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ยา</TableHead>
              <TableHead>Sticker label</TableHead>
              <TableHead>Counseling เต็ม</TableHead>
              <TableHead>คำเตือน</TableHead>
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
                <TableCell className="max-w-[200px] truncate">{d.short_label ?? '-'}</TableCell>
                <TableCell className="max-w-[250px] truncate text-xs">{d.counseling_th ?? d.full_counseling ?? '-'}</TableCell>
                <TableCell className="max-w-[150px] truncate text-xs">{d.warning ?? d.when_to_er ?? '-'}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => { setEdit({ ...d }); setOpen(true) }}><Pencil className="size-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => { if (confirm('ลบ?')) del.mutate(d.id!) }}><Trash2 className="size-4 text-red-500" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{edit?.id ? 'แก้ไข Counseling' : 'เพิ่ม Counseling'}</DialogTitle></DialogHeader>
          {edit && (
            <div className="space-y-4">
              <div>
                <Label className="mb-1.5 flex items-center gap-2">
                  ยา <span className="text-red-500">*</span>
                  <HelpHint title="ยา">พิมพ์ชื่อยา → ระบบเลือก icode ให้อัตโนมัติ</HelpHint>
                </Label>
                <DrugCombobox
                  drugs={drugs}
                  value={edit.icode}
                  onChange={(icode, d) => setEdit({ ...edit, icode, drug_name: d?.drug_name })}
                  placeholder="พิมพ์ชื่อยา…"
                  autoFocus
                />
              </div>

              <div>
                <Label className="mb-1.5 flex items-center gap-2">
                  Sticker label
                  <HelpHint title="Sticker label">ข้อความสั้นที่จะอยู่บน sticker คำแนะนำ 5×7 cm — เช่น "กินก่อนอาหาร 30 นาที"</HelpHint>
                </Label>
                <Input value={edit.short_label ?? ''} onChange={(e) => setEdit({ ...edit, short_label: e.target.value })} placeholder="กินก่อนอาหาร / กินพร้อมอาหาร / ห้ามดื่มแอลกอฮอล์" />
              </div>

              <div>
                <Label className="mb-1.5 flex items-center gap-2">
                  Counseling เต็ม (ภาษาไทย)
                  <HelpHint title="Counseling เต็ม">คำแนะนำเต็ม สำหรับ AI Summary และหน้าค้นข้อมูลยา — ใส่ได้หลายบรรทัด</HelpHint>
                </Label>
                <Textarea value={edit.counseling_th ?? edit.full_counseling ?? ''} onChange={(e) => setEdit({ ...edit, counseling_th: e.target.value, full_counseling: e.target.value })} rows={3} placeholder="• กินเวลาเดิมทุกวัน&#10;• ตรวจระดับยาในเลือดตามนัด&#10;• แปรงฟันอย่างถูกวิธี" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="mb-1.5 flex items-center gap-2">
                    🍽 อาหารที่ต้องระวัง
                    <HelpHint title="Food interaction">เช่น Warfarin → ผักใบเขียวกินสม่ำเสมอ, MAOI → เลี่ยง tyramine</HelpHint>
                  </Label>
                  <Textarea value={edit.food_interaction ?? ''} onChange={(e) => setEdit({ ...edit, food_interaction: e.target.value })} rows={2} />
                </div>
                <div>
                  <Label className="mb-1.5 flex items-center gap-2">
                    🤰 ผู้ป่วยพิเศษ
                    <HelpHint title="Special population">หญิงตั้งครรภ์ ให้นม ผู้สูงอายุ — ข้อควรระวัง</HelpHint>
                  </Label>
                  <Textarea value={edit.special_pop ?? ''} onChange={(e) => setEdit({ ...edit, special_pop: e.target.value })} rows={2} />
                </div>
              </div>

              <div>
                <Label className="mb-1.5 flex items-center gap-2">
                  ⚠ อาการที่ต้องไปพบแพทย์ทันที (ER)
                  <HelpHint title="When to ER">อาการรุนแรงที่ต้องหยุดยา + ไป รพ. ทันที</HelpHint>
                </Label>
                <Textarea value={edit.when_to_er ?? edit.warning ?? ''} onChange={(e) => setEdit({ ...edit, when_to_er: e.target.value, warning: e.target.value })} rows={2} placeholder="• เลือดออกหยุดไม่ได้&#10;• หายใจลำบาก หน้าบวม" />
              </div>

              <div>
                <Label className="mb-1.5">การเก็บรักษา</Label>
                <Input value={edit.storage ?? ''} onChange={(e) => setEdit({ ...edit, storage: e.target.value })} placeholder="เก็บในตู้เย็น 2-8°C / พ้นแสง" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>ยกเลิก</Button>
            <Button onClick={async () => { if (edit?.icode) { await save.mutateAsync(edit); setOpen(false) } }} disabled={save.isPending || !edit?.icode}>บันทึก</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
