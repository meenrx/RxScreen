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
import { HAD_REF, type HadRef } from '@/features/screening/hadRef'
import { Badge } from '@/components/ui/badge'
import { ChevronDown, BookOpen } from 'lucide-react'
import type { HadRule } from '@/types/drug'

/** แปลงฐานอ้างอิง built-in → HAD rule (สำหรับดึงมาปรับ/บันทึกในแท็บ HAD) */
function refToRule(r: HadRef): HadRule {
  return {
    drug_key: r.generic,
    drug_name: r.generic.charAt(0).toUpperCase() + r.generic.slice(1),
    max_dose: r.dose,
    max_rate: r.maxRate,
    max_conc: r.maxConc,
    dilution: r.prep,
    route_note: [r.compatible && `ผสมได้: ${r.compatible}`, r.incompatible && `ห้ามผสม: ${r.incompatible}`].filter(Boolean).join(' · ') || undefined,
    antidote: r.antidote,
    full_note: r.note,
  }
}

export function HadRuleAdmin() {
  const { data = [], isLoading } = useHadRules()
  const save = useSaveHadRule()
  const del = useDelete('had')
  const [search, setSearch] = useState('')
  const [edit, setEdit] = useState<HadRule | null>(null)
  const [open, setOpen] = useState(false)
  const [showRef, setShowRef] = useState(false)

  // generic ที่มีกฎ HAD ตั้งไว้แล้ว (drug_key ตรงกับ built-in)
  const configuredKeys = useMemo(() => new Set(data.map((d) => d.drug_key.trim().toLowerCase())), [data])
  const refFiltered = useMemo(() => {
    const s = search.trim().toLowerCase()
    if (!s) return HAD_REF
    return HAD_REF.filter((r) => r.generic.includes(s) || (r.aliases ?? []).some((a) => a.includes(s)))
  }, [search])

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

        {/* ฐานอ้างอิง built-in (hadRef) — ใช้เมื่อไม่ได้ตั้งกฎเอง · กดดึงมาปรับได้ */}
        <div className="rounded-xl border bg-muted/20">
          <button type="button" onClick={() => setShowRef((v) => !v)} className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-semibold">
            <BookOpen className="size-4 text-cyan-600" />
            ฐานอ้างอิง built-in (HAD) — {HAD_REF.length} ยา (Trissel/ISMP/AIDH)
            <span className="text-xs font-normal text-muted-foreground ml-1">ระบบใช้ค่าเหล่านี้เมื่อยังไม่ได้ตั้งกฎเอง</span>
            <ChevronDown className={`size-4 ml-auto transition-transform ${showRef ? 'rotate-180' : ''}`} />
          </button>
          {showRef && (
            <div className="overflow-x-auto border-t">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>generic</TableHead>
                    <TableHead>Dose</TableHead>
                    <TableHead>วิธีเตรียม</TableHead>
                    <TableHead className="w-[100px]">Max conc/rate</TableHead>
                    <TableHead>Antidote / Note</TableHead>
                    <TableHead className="text-right w-[110px]">ปรับในกฎ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {refFiltered.map((r) => {
                    const has = configuredKeys.has(r.generic.toLowerCase())
                    return (
                      <TableRow key={r.generic}>
                        <TableCell className="text-sm font-medium">
                          {r.generic}
                          {r.aliases?.length ? <div className="text-[10px] text-muted-foreground">{r.aliases.join(', ')}</div> : null}
                          {has && <Badge variant="green" className="text-[9px] px-1 mt-0.5">ตั้งกฎแล้ว</Badge>}
                        </TableCell>
                        <TableCell className="text-xs max-w-[200px]">{r.dose ?? '-'}</TableCell>
                        <TableCell className="text-xs max-w-[200px]">{r.prep ?? '-'}</TableCell>
                        <TableCell className="text-[11px]">{[r.maxConc, r.maxRate].filter(Boolean).join(' · ') || '-'}</TableCell>
                        <TableCell className="text-[11px] max-w-[220px]">{[r.antidote && `💊 ${r.antidote}`, r.note].filter(Boolean).join(' · ') || '-'}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => { setEdit(refToRule(r)); setOpen(true) }}>
                            <Pencil className="size-3" /> ปรับ
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
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
