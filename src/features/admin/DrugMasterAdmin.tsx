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
import { useDrugs, useSaveDrug, useDelete } from '@/features/catalog/hooks'
import type { DrugMaster } from '@/types/drug'

export function DrugMasterAdmin() {
  const { data = [], isLoading } = useDrugs()
  const save = useSaveDrug()
  const del = useDelete('drug')
  const [search, setSearch] = useState('')
  const [edit, setEdit] = useState<DrugMaster | null>(null)
  const [open, setOpen] = useState(false)

  const filtered = useMemo(() => {
    const s = search.toLowerCase()
    return data.filter(
      (d) =>
        d.icode.toLowerCase().includes(s)
        || d.drug_name.toLowerCase().includes(s)
        || (d.generic_name?.toLowerCase().includes(s) ?? false)
        || (d.drug_class?.toLowerCase().includes(s) ?? false),
    )
  }, [data, search])

  function openNew() {
    setEdit({ icode: '', drug_name: '', active: true })
    setOpen(true)
  }
  function openEdit(d: DrugMaster) {
    setEdit({ ...d })
    setOpen(true)
  }
  async function handleSave() {
    if (!edit) return
    await save.mutateAsync(edit)
    setOpen(false)
  }

  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input placeholder="ค้นหา icode/ชื่อยา/generic/class" className="pl-8 h-10" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Button onClick={openNew}><Plus className="size-4" /> เพิ่มยา</Button>
        </div>
        <div className="text-xs text-muted-foreground">{filtered.length} รายการ {isLoading && '(กำลังโหลด...)'}</div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>icode</TableHead>
              <TableHead>ชื่อยา</TableHead>
              <TableHead>Generic</TableHead>
              <TableHead>Class</TableHead>
              <TableHead>Tags</TableHead>
              <TableHead className="text-right">จัดการ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((d) => (
              <TableRow key={d.id}>
                <TableCell className="font-mono text-xs">{d.icode}</TableCell>
                <TableCell className="font-medium">{d.drug_name}</TableCell>
                <TableCell className="text-sm">{d.generic_name ?? '-'}</TableCell>
                <TableCell className="text-sm">{d.drug_class ?? '-'}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {d.is_HAD && <span className="had-badge">HAD</span>}
                    {d.lasa_with && d.lasa_with.length > 0 && <span className="lasa-badge">LASA</span>}
                    {d.pregnancy_category && <Badge variant={d.pregnancy_category === 'X' ? 'red' : d.pregnancy_category === 'D' ? 'orange' : 'yellow'} className="text-[10px]">P:{d.pregnancy_category}</Badge>}
                    {d.beers_avoid_elderly && <Badge variant="orange" className="text-[10px]">Beers</Badge>}
                    {d.g6pd_unsafe && <Badge variant="red" className="text-[10px]">G6PD</Badge>}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(d)}><Pencil className="size-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => { if (confirm('ลบยานี้?')) del.mutate(d.id!) }}><Trash2 className="size-4 text-red-500" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{edit?.id ? 'แก้ไขยา' : 'เพิ่มยาใหม่'}</DialogTitle>
          </DialogHeader>
          {edit && (
            <div className="space-y-4">
              {/* Basic */}
              <section className="grid grid-cols-2 gap-3">
                <div><Label className="mb-1.5">icode *</Label><Input value={edit.icode} onChange={(e) => setEdit({ ...edit, icode: e.target.value })} /></div>
                <div><Label className="mb-1.5">หน่วย</Label><Input value={edit.unit ?? ''} onChange={(e) => setEdit({ ...edit, unit: e.target.value })} placeholder="tab, cap, ml" /></div>
                <div className="col-span-2"><Label className="mb-1.5">ชื่อยา + strength *</Label><Input value={edit.drug_name} onChange={(e) => setEdit({ ...edit, drug_name: e.target.value })} placeholder="Amlodipine 5 mg tab" /></div>
                <div><Label className="mb-1.5">Generic name</Label><Input value={edit.generic_name ?? ''} onChange={(e) => setEdit({ ...edit, generic_name: e.target.value })} /></div>
                <div><Label className="mb-1.5">Drug class</Label><Input value={edit.drug_class ?? ''} onChange={(e) => setEdit({ ...edit, drug_class: e.target.value })} placeholder="ACEI, BB, CCB" /></div>
              </section>

              {/* Safety flags */}
              <section className="space-y-2">
                <Label className="text-base">Safety flags</Label>
                <div className="flex flex-wrap gap-2">
                  <ToggleChip on={edit.is_HAD} onChange={(v) => setEdit({ ...edit, is_HAD: v })}>🔴 HAD (High Alert)</ToggleChip>
                  <ToggleChip on={edit.beers_avoid_elderly} onChange={(v) => setEdit({ ...edit, beers_avoid_elderly: v })}>👴 Beers (≥65)</ToggleChip>
                  <ToggleChip on={edit.g6pd_unsafe} onChange={(v) => setEdit({ ...edit, g6pd_unsafe: v })}>🩸 G6PD unsafe</ToggleChip>
                  <ToggleChip on={edit.lactation_safe === false} onChange={(v) => setEdit({ ...edit, lactation_safe: v ? false : undefined })}>🤱 ห้ามให้นมบุตร</ToggleChip>
                  <ToggleChip on={edit.requires_ibw} onChange={(v) => setEdit({ ...edit, requires_ibw: v })}>💪 ใช้ IBW คำนวณ dose</ToggleChip>
                </div>
              </section>

              <section className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="mb-1.5">Pregnancy category</Label>
                  <Select value={edit.pregnancy_category ?? ''} onValueChange={(v) => setEdit({ ...edit, pregnancy_category: (v || undefined) as DrugMaster['pregnancy_category'] })}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="-" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A">A (ปลอดภัย)</SelectItem>
                      <SelectItem value="B">B (ค่อนข้างปลอดภัย)</SelectItem>
                      <SelectItem value="C">C (ระวัง)</SelectItem>
                      <SelectItem value="D">D (เสี่ยง)</SelectItem>
                      <SelectItem value="X">X (ห้ามใช้)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label className="mb-1.5">LASA pairs (icode คั่นด้วย ,)</Label><Input value={edit.lasa_with?.join(', ') ?? ''} onChange={(e) => setEdit({ ...edit, lasa_with: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} placeholder="HYDROX, HYDROCH" /></div>
              </section>

              <section className="grid grid-cols-2 gap-3">
                <div><Label className="mb-1.5">Allergens (สำหรับเช็คแพ้ยา, คั่นด้วย ,)</Label><Input value={edit.allergens?.join(', ') ?? ''} onChange={(e) => setEdit({ ...edit, allergens: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} placeholder="Penicillin, Beta-lactam" /></div>
                <div><Label className="mb-1.5">Cross-reactivity (คั่นด้วย ,)</Label><Input value={edit.cross_react?.join(', ') ?? ''} onChange={(e) => setEdit({ ...edit, cross_react: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} placeholder="Cephalosporin, Carbapenem" /></div>
              </section>

              <section className="grid grid-cols-1 gap-2">
                <div><Label className="mb-1.5">🍽 Food interaction</Label><Textarea value={edit.food_interaction ?? ''} onChange={(e) => setEdit({ ...edit, food_interaction: e.target.value })} rows={2} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="mb-1.5">🚬 Smoking</Label><Input value={edit.smoking_interaction ?? ''} onChange={(e) => setEdit({ ...edit, smoking_interaction: e.target.value })} /></div>
                  <div><Label className="mb-1.5">🍺 Alcohol</Label><Input value={edit.alcohol_interaction ?? ''} onChange={(e) => setEdit({ ...edit, alcohol_interaction: e.target.value })} /></div>
                </div>
                <div><Label className="mb-1.5">🧪 Lab Test Interference</Label><Input value={edit.lab_interference ?? ''} onChange={(e) => setEdit({ ...edit, lab_interference: e.target.value })} placeholder="เช่น false ↑ glucose, false ↓ Free T4" /></div>
                <div><Label className="mb-1.5">Note</Label><Input value={edit.note ?? ''} onChange={(e) => setEdit({ ...edit, note: e.target.value })} /></div>
              </section>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>ยกเลิก</Button>
            <Button onClick={handleSave} disabled={save.isPending || !edit?.icode || !edit?.drug_name}>{save.isPending ? 'กำลังบันทึก...' : 'บันทึก'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

function ToggleChip({ on, onChange, children }: { on?: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className={`px-3 py-1.5 rounded-full border text-sm transition ${on ? 'bg-red-50 border-red-300 text-red-900 font-medium' : 'hover:bg-accent'}`}
    >
      {on && '✓ '}{children}
    </button>
  )
}
