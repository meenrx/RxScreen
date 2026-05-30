import { useState, useMemo } from 'react'
import { Plus, Pencil, Trash2, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { HelpHint } from '@/components/HelpHint'
import { useDiseaseRules, useSaveDiseaseRule, useDelete } from '@/features/catalog/hooks'
import type { DiseaseRule } from '@/types/drug'

export function DiseaseAdmin() {
  const { data = [] } = useDiseaseRules()
  const save = useSaveDiseaseRule()
  const del = useDelete('disease')
  const [search, setSearch] = useState('')
  const [edit, setEdit] = useState<DiseaseRule | null>(null)
  const [open, setOpen] = useState(false)

  const filtered = useMemo(() => {
    const s = search.toLowerCase()
    if (!s) return data
    return data.filter((d) =>
      d.disease_key?.toLowerCase().includes(s)
      || d.disease?.toLowerCase().includes(s)
      || d.display_name?.toLowerCase().includes(s)
      || d.required_labs?.toLowerCase().includes(s),
    )
  }, [data, search])

  function openNew() {
    setEdit({ disease: '', disease_key: '' })
    setOpen(true)
  }
  function openEdit(d: DiseaseRule) {
    setEdit({ ...d })
    setOpen(true)
  }
  async function handleSave() {
    if (!edit?.disease_key && !edit?.disease) return
    const key = edit.disease_key || edit.disease
    await save.mutateAsync({ ...edit, disease_key: key, disease: key })
    setOpen(false)
  }

  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input placeholder="ค้นหาโรค / ค่า lab" className="pl-8 h-10" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Button onClick={openNew}><Plus className="size-4" /> เพิ่มโรค</Button>
        </div>
        <div className="text-xs text-muted-foreground">{filtered.length} โรค</div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>โรค</TableHead>
              <TableHead>ชื่อแสดง</TableHead>
              <TableHead>ค่า lab ที่ต้องการ</TableHead>
              <TableHead>ค่า lab เสริม</TableHead>
              <TableHead>หมายเหตุคัดกรอง</TableHead>
              <TableHead className="text-right">จัดการ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((d) => (
              <TableRow key={d.id}>
                <TableCell><span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{d.disease_key ?? d.disease}</span></TableCell>
                <TableCell className="font-medium">{d.display_name ?? '-'}</TableCell>
                <TableCell>
                  {d.required_labs?.split(',').filter(Boolean).map((l) => (
                    <Badge key={l} variant="red" className="mr-1 mb-1">{l.trim()}</Badge>
                  ))}
                </TableCell>
                <TableCell>
                  {d.optional_labs?.split(',').filter(Boolean).map((l) => (
                    <Badge key={l} variant="yellow" className="mr-1 mb-1">{l.trim()}</Badge>
                  ))}
                </TableCell>
                <TableCell className="max-w-xs truncate text-xs">{d.screening_notes ?? '-'}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(d)}><Pencil className="size-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => { if (confirm('ลบ?')) del.mutate(d.id!) }}><Trash2 className="size-4 text-red-500" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{edit?.id ? 'แก้ไขโรค' : 'เพิ่มโรคใหม่'}</DialogTitle></DialogHeader>
          {edit && (
            <div className="space-y-4">
              <datalist id="dl-disease-key">
                {['CKD', 'DM', 'HT', 'HF', 'CAD', 'AF', 'CVA', 'COPD', 'ASTHMA', 'G6PD', 'CIRRHOSIS', 'HEPATITIS', 'EPILEPSY', 'DEPRESSION', 'PREGNANCY', 'LACTATION', 'ELDERLY', 'PEDIATRIC', 'HIV', 'TB', 'GOUT', 'BPH', 'GLAUCOMA'].map((v) => <option key={v} value={v} />)}
              </datalist>
              <datalist id="dl-disease-labs">
                {['SCr', 'eGFR', 'CrCl', 'BUN', 'K+', 'Na+', 'FBS', 'HbA1c', 'BW', 'Albumin', 'AST', 'ALT', 'INR', 'Hb', 'Hct', 'WBC', 'Plt'].map((v) => <option key={v} value={v} />)}
              </datalist>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="mb-1.5 flex items-center gap-2">
                    Key (รหัสโรค) <span className="text-red-500">*</span>
                    <HelpHint title="Disease key">
                      ตัวย่อโรคใช้ใน system เช่น <code>CKD</code>, <code>DM</code>, <code>HT</code>, <code>G6PD</code>, <code>HF</code><br />
                      ตัวพิมพ์ใหญ่ ไม่มีเว้นวรรค
                    </HelpHint>
                  </Label>
                  <Input
                    list="dl-disease-key"
                    value={edit.disease_key ?? edit.disease ?? ''}
                    onChange={(e) => setEdit({ ...edit, disease_key: e.target.value.toUpperCase(), disease: e.target.value.toUpperCase() })}
                    placeholder="ตัวอย่าง: CKD"
                    className="font-mono uppercase"
                  />
                </div>
                <div>
                  <Label className="mb-1.5 flex items-center gap-2">
                    ชื่อแสดงผล
                    <HelpHint title="Display name">ชื่อโรคเต็มภาษาไทย เช่น "ไตเสื่อมเรื้อรัง (CKD)"</HelpHint>
                  </Label>
                  <Input
                    value={edit.display_name ?? ''}
                    onChange={(e) => setEdit({ ...edit, display_name: e.target.value })}
                    placeholder="ไตเสื่อมเรื้อรัง (CKD)"
                  />
                </div>
              </div>

              <div className="rounded-xl border p-3 space-y-3 bg-muted/20">
                <div className="text-sm font-semibold flex items-center gap-2">
                  🧪 ค่า lab / ข้อมูลที่ต้องดู
                  <HelpHint title="ค่า lab ที่ต้องการ">
                    กรอกค่า lab หรือข้อมูลที่ต้องดูเมื่อพบโรคนี้ คั่นด้วย <code>,</code> (comma)<br /><br />
                    <b>ตัวอย่าง:</b><br />
                    • CKD → <code>SCr, eGFR</code><br />
                    • DM → <code>FBS, HbA1c</code><br />
                    • HF → <code>K, BUN, BW</code><br /><br />
                    ระบบจะแสดงให้เภสัชกรกรอกเมื่อคัดกรองผู้ป่วยที่มีโรคนี้
                  </HelpHint>
                </div>
                <div>
                  <Label className="mb-1.5">ค่าที่ต้องการ (required) — คั่นด้วย ,</Label>
                  <Input
                    list="dl-disease-labs"
                    value={edit.required_labs ?? ''}
                    onChange={(e) => setEdit({ ...edit, required_labs: e.target.value })}
                    placeholder="ตัวอย่าง: SCr, eGFR"
                  />
                </div>
                <div>
                  <Label className="mb-1.5">ค่าเสริม (optional)</Label>
                  <Input
                    list="dl-disease-labs"
                    value={edit.optional_labs ?? ''}
                    onChange={(e) => setEdit({ ...edit, optional_labs: e.target.value })}
                    placeholder="ตัวอย่าง: BUN, Albumin"
                  />
                </div>
              </div>

              <div className="rounded-xl border p-3 space-y-2 bg-muted/20">
                <div className="text-sm font-semibold flex items-center gap-2">
                  ⚠ ข้อควรระวัง / หมายเหตุการคัดกรอง
                  <HelpHint title="Screening notes">
                    คำเตือน + ข้อสังเกตเมื่อพบโรคนี้ — คั่นแต่ละข้อด้วย <code>|</code><br /><br />
                    <b>ตัวอย่าง:</b><br />
                    <code className="text-[10px] block bg-muted p-1 rounded">eGFR&lt;30=ห้าม Metformin | SCr&gt;1.5=ปรับ Aminoglycoside</code>
                  </HelpHint>
                </div>
                <Textarea
                  value={edit.screening_notes ?? ''}
                  onChange={(e) => setEdit({ ...edit, screening_notes: e.target.value })}
                  placeholder="eGFR>60=ปกติ | eGFR30-60=ลด Metformin | eGFR<30=ห้าม Metformin ระวัง NSAID"
                  rows={4}
                />
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
