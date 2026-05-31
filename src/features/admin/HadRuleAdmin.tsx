import { useState, useMemo } from 'react'
import { Plus, Pencil, Trash2, Search, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { useHadRules, useSaveHadRule, useDelete } from '@/features/catalog/hooks'
import type { HadRule } from '@/types/drug'

export function HadRuleAdmin() {
  const { data = [], isLoading } = useHadRules()
  const save = useSaveHadRule()
  const del = useDelete('had')
  const [search, setSearch] = useState('')
  const [edit, setEdit] = useState<HadRule | null>(null)
  const [open, setOpen] = useState(false)

  const filtered = useMemo(() => {
    const s = search.toLowerCase()
    if (!s) return data
    return data.filter((d) =>
      d.drug_name.toLowerCase().includes(s) || d.drug_key.toLowerCase().includes(s)
    )
  }, [data, search])

  function openNew() {
    setEdit({ drug_key: '', drug_name: '' })
    setOpen(true)
  }

  function openEdit(d: HadRule) {
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
        <div className="rounded-xl border bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900 p-3 text-sm flex items-start gap-2">
          <ShieldAlert className="size-5 text-red-600 mt-0.5 shrink-0" />
          <div>
            <b>High Alert Drugs</b> — ยาที่ก่อให้เกิดอันตรายรุนแรงหากใช้ผิด <br />
            <span className="text-xs">ระบบจะเตือนทันทีที่จ่ายยานี้ พร้อมแสดง max dose / rate / conc / dilution / route note / antidote ที่ตั้งไว้</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input placeholder="ค้นหาชื่อยา HAD" className="pl-8 h-10" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Button onClick={openNew}><Plus className="size-4" /> เพิ่ม HAD</Button>
        </div>
        <div className="text-xs text-muted-foreground">{filtered.length} รายการ {isLoading && '(กำลังโหลด...)'}</div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[140px]">ชื่อยา</TableHead>
              <TableHead className="w-[120px]">Max dose</TableHead>
              <TableHead className="w-[100px]">Max rate</TableHead>
              <TableHead className="w-[100px]">Max conc</TableHead>
              <TableHead>Dilution / Route / Note</TableHead>
              <TableHead className="w-[100px]">Antidote</TableHead>
              <TableHead className="text-right w-[80px]">จัดการ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((d) => (
              <TableRow key={d.id}>
                <TableCell className="font-medium text-sm">{d.drug_name}</TableCell>
                <TableCell className="text-xs">{d.max_dose ?? '-'}</TableCell>
                <TableCell className="text-xs">{d.max_rate ?? '-'}</TableCell>
                <TableCell className="text-xs">{d.max_conc ?? '-'}</TableCell>
                <TableCell className="text-xs">
                  <div className="line-clamp-2" title={[d.dilution, d.route_note, d.full_note].filter(Boolean).join(' · ')}>
                    {[d.dilution, d.route_note, d.full_note].filter(Boolean).join(' · ') || '-'}
                  </div>
                </TableCell>
                <TableCell className="text-xs">{d.antidote ?? '-'}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(d)}><Pencil className="size-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => { if (confirm('ลบ HAD rule นี้?')) del.mutate(d.id!) }}>
                    <Trash2 className="size-4 text-red-500" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{edit?.id ? `แก้ไข HAD: ${edit.drug_name}` : 'เพิ่ม HAD ใหม่'}</DialogTitle>
          </DialogHeader>
          {edit && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="mb-1.5">drug_key * (lowercase) </Label>
                  <Input
                    value={edit.drug_key}
                    onChange={(e) => setEdit({ ...edit, drug_key: e.target.value.toLowerCase() })}
                    placeholder="adrenaline / amiodarone / morphine"
                    className="font-mono"
                  />
                </div>
                <div>
                  <Label className="mb-1.5">ชื่อยาแสดงผล *</Label>
                  <Input
                    value={edit.drug_name}
                    onChange={(e) => setEdit({ ...edit, drug_name: e.target.value })}
                    placeholder="Adrenaline"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="mb-1.5">Max dose</Label>
                  <Input
                    value={edit.max_dose ?? ''}
                    onChange={(e) => setEdit({ ...edit, max_dose: e.target.value })}
                    placeholder="50 mcg/kg/min"
                  />
                </div>
                <div>
                  <Label className="mb-1.5">Max rate</Label>
                  <Input
                    value={edit.max_rate ?? ''}
                    onChange={(e) => setEdit({ ...edit, max_rate: e.target.value })}
                    placeholder="30 mg/min"
                  />
                </div>
                <div>
                  <Label className="mb-1.5">Max concentration</Label>
                  <Input
                    value={edit.max_conc ?? ''}
                    onChange={(e) => setEdit({ ...edit, max_conc: e.target.value })}
                    placeholder="5 mg/ml"
                  />
                </div>
              </div>

              <div>
                <Label className="mb-1.5">Dilution requirements</Label>
                <Input
                  value={edit.dilution ?? ''}
                  onChange={(e) => setEdit({ ...edit, dilution: e.target.value })}
                  placeholder="Dilute ใน D5W เท่านั้น · ห้ามใช้ NSS"
                />
              </div>

              <div>
                <Label className="mb-1.5">Route note (ห้าม IV push ฯลฯ)</Label>
                <Input
                  value={edit.route_note ?? ''}
                  onChange={(e) => setEdit({ ...edit, route_note: e.target.value })}
                  placeholder="ห้ามให้ IV push · ห้ามฉีด IM"
                />
              </div>

              <div>
                <Label className="mb-1.5">หมายเหตุเต็ม (full note)</Label>
                <Textarea
                  value={edit.full_note ?? ''}
                  onChange={(e) => setEdit({ ...edit, full_note: e.target.value })}
                  rows={3}
                  placeholder="ตัวอย่าง: Peripheral line rate ≤10 mEq/h · Central rate ≤20 mEq/h · ระวังในผู้ป่วยไตวาย/urine output <600 ml/d (hyper K) · rate >10 mEq/h ควรติดตาม EKG"
                />
              </div>

              <div>
                <Label className="mb-1.5">Antidote (ถ้ามี)</Label>
                <Input
                  value={edit.antidote ?? ''}
                  onChange={(e) => setEdit({ ...edit, antidote: e.target.value })}
                  placeholder="Naloxone (สำหรับ Morphine)"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>ยกเลิก</Button>
            <Button onClick={handleSave} disabled={save.isPending || !edit?.drug_key || !edit?.drug_name}>
              {save.isPending ? 'กำลังบันทึก...' : 'บันทึก'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
