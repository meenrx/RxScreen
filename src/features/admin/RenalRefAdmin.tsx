import { useMemo, useState } from 'react'
import { Search, Droplet, CheckCircle2, Pencil, Trash2, RotateCcw } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useDrugs, useLabRules, useSaveLabRule, useDelete } from '@/features/catalog/hooks'
import { DoseMetaBuilder } from '@/features/admin/LabRuleAdmin'
import { RENAL_DOSE_REF, findRenalRef, refToDoseMeta, type RenalDoseRef } from '@/features/screening/renalDoseRef'
import type { DrugMaster, LabRule } from '@/types/drug'
import { toast } from 'sonner'

/**
 * เกณฑ์ไต (Renal) — จับคู่ยา "ในบัญชี รพ." (DRUG_MASTER) กับคู่มือ Dose adjustment
 * แสดงว่ายา icode ไหนมีเกณฑ์ปรับขนาดตามไต + แก้ไข/บันทึกเกณฑ์เอง (เป็น LAB_RULE ผูก icode)
 */
export function RenalRefAdmin() {
  const { data: drugs = [], isLoading } = useDrugs()
  const { data: labRules = [] } = useLabRules()
  const saveRule = useSaveLabRule()
  const del = useDelete('lab')
  const [q, setQ] = useState('')
  const [edit, setEdit] = useState<{ drug: DrugMaster; ref?: RenalDoseRef; rule: Partial<LabRule> } | null>(null)

  // icode → LAB_RULE ที่มี dose_meta (= override เกณฑ์ไตที่แก้เอง)
  const overrideMap = useMemo(() => {
    const m = new Map<string, LabRule>()
    for (const r of labRules) if (r.dose_meta && !m.has(r.icode)) m.set(r.icode, r)
    return m
  }, [labRules])

  // icode → LAB_RULE ที่ยกเว้นเกณฑ์ไต (ไม่ต้องปรับตามไต)
  const exemptMap = useMemo(() => {
    const m = new Map<string, LabRule>()
    for (const r of labRules) if (r.renal_exempt && !m.has(r.icode)) m.set(r.icode, r)
    return m
  }, [labRules])

  // ยกเว้นเกณฑ์ไต (ยาไม่ต้องปรับตามไต) — สร้าง LAB_RULE renal_exempt
  async function exempt(drug: DrugMaster) {
    try {
      await saveRule.mutateAsync({ icode: drug.icode, drug_name: drug.drug_name, param: 'CrCl', renal_exempt: true, reason: 'ไม่ต้องปรับขนาดตามไต' } as LabRule)
      toast.success(`ลบเกณฑ์ไตของ ${drug.drug_name} แล้ว — จะไม่เตือนปรับตามไต`)
    } catch (e) { toast.error('ไม่สำเร็จ: ' + (e as Error).message) }
  }
  // คืนค่า (ลบ rule ยกเว้น → กลับมาใช้เกณฑ์คู่มือ)
  async function unexempt(rule: LabRule) {
    try { await del.mutateAsync(rule.id!); toast.success('คืนเกณฑ์ไตจากคู่มือแล้ว') }
    catch (e) { toast.error('ไม่สำเร็จ: ' + (e as Error).message) }
  }

  // จับคู่ยาในบัญชี รพ. → เกณฑ์ไตในคู่มือ (ผูกกับ icode)
  const matched = useMemo(() => {
    const rows: { drug: DrugMaster; ref: RenalDoseRef }[] = []
    for (const d of drugs) {
      const ref = findRenalRef(d.generic_name, d.drug_name)
      if (ref) rows.push({ drug: d, ref })
    }
    return rows.sort((a, b) => a.drug.drug_name.localeCompare(b.drug.drug_name))
  }, [drugs])

  const notInStock = useMemo(() => {
    const covered = new Set(matched.map((m) => m.ref.generic))
    return RENAL_DOSE_REF.filter((r) => !covered.has(r.generic))
  }, [matched])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return matched
    return matched.filter(({ drug, ref }) =>
      [drug.icode, drug.drug_name, drug.generic_name, ref.generic].filter(Boolean).some((x) => (x as string).toLowerCase().includes(s)),
    )
  }, [matched, q])

  function openEdit(drug: DrugMaster, ref: RenalDoseRef) {
    const existing = overrideMap.get(drug.icode)
    setEdit({
      drug, ref,
      rule: existing
        ? { ...existing }
        : {
            icode: drug.icode,
            drug_name: drug.drug_name,
            param: 'CrCl',
            renal_basis: 'crcl',
            priority: 'high',
            dose_meta: refToDoseMeta(ref),         // prefill จากคู่มือ
            reason: ref.normalDose ? `ขนาดปกติ: ${ref.normalDose}${ref.note ? ' · ' + ref.note : ''}` : ref.note,
          },
    })
  }

  async function handleSave() {
    if (!edit) return
    if (!edit.rule.dose_meta?.trim()) { toast.error('กรุณาใส่เกณฑ์ปรับขนาด'); return }
    try {
      await saveRule.mutateAsync({ icode: edit.drug.icode, param: 'CrCl', renal_basis: 'crcl', ...edit.rule } as LabRule)
      toast.success('บันทึกเกณฑ์ไตเรียบร้อย — จะแทนที่ค่าจากคู่มือตอนคัดกรอง')
      setEdit(null)
    } catch (e) {
      toast.error('บันทึกไม่สำเร็จ: ' + (e as Error).message)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="size-7 rounded-lg bg-cyan-100 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300 grid place-items-center">
              <Droplet className="size-4" />
            </span>
            เกณฑ์ปรับขนาดยาตามไต (Renal)
          </CardTitle>
          <CardDescription>
            จับคู่ยา <b>ในบัญชี รพ.</b> ({drugs.length} รายการ) กับคู่มือ Dose adjustment in renal impairment
            (Sanford 2010 / ACP 2007) — ผูกกับ icode ผ่าน generic_name · กด <b>แก้ไข</b> เพื่อปรับเกณฑ์เอง (บันทึกเป็น LAB_RULE เหมือน Lab/Dose)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 flex-wrap mb-3">
            <Badge variant="green" className="gap-1 text-sm">
              <CheckCircle2 className="size-3.5" /> มีเกณฑ์ไต {matched.length} ยา
            </Badge>
            <Badge variant="secondary" className="text-sm">แก้ไขเอง (override) {overrideMap.size} ยา</Badge>
            <Badge variant="secondary" className="text-sm">ในคู่มือแต่ไม่มีในบัญชี {notInStock.length} ตัว</Badge>
            {isLoading && <span className="text-xs text-muted-foreground">กำลังโหลด...</span>}
          </div>
          <div className="relative mb-3 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหา icode / ชื่อยา / generic" className="pl-8" />
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>icode</TableHead>
                  <TableHead>ชื่อยา (บัญชี รพ.)</TableHead>
                  <TableHead>ปรับเมื่อ CrCl &lt;</TableHead>
                  <TableHead>ขนาดปกติ</TableHead>
                  <TableHead>แนวทางปรับตามไต</TableHead>
                  <TableHead>อ้างอิง</TableHead>
                  <TableHead className="text-right">แก้ไข</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground italic py-6">
                    {matched.length === 0 ? 'ยังไม่พบยาในบัญชีที่ตรงกับคู่มือ — ตรวจสอบว่ายามี generic_name' : 'ไม่พบตามคำค้น'}
                  </TableCell></TableRow>
                )}
                {filtered.map(({ drug, ref }) => {
                  const ov = overrideMap.get(drug.icode)
                  const ex = exemptMap.get(drug.icode)
                  return (
                    <TableRow key={drug.icode} className={ex ? 'opacity-60' : ''}>
                      <TableCell className="font-mono text-xs">{drug.icode}</TableCell>
                      <TableCell>
                        <div className="font-medium text-sm flex items-center gap-1.5">
                          {drug.drug_name}
                          {ex && <Badge variant="secondary" className="text-[9px] px-1">ยกเว้น</Badge>}
                          {ov && !ex && <Badge variant="orange" className="text-[9px] px-1">แก้ไขแล้ว</Badge>}
                        </div>
                        <div className="text-[11px] text-muted-foreground">{drug.generic_name}{[drug.strength, drug.dosage_form ?? drug.form].filter(Boolean).length ? ' · ' + [drug.strength, drug.dosage_form ?? drug.form].filter(Boolean).join(' · ') : ''}</div>
                      </TableCell>
                      <TableCell><Badge variant="orange">{ref.threshold}</Badge></TableCell>
                      <TableCell className="text-xs max-w-[150px]">
                        {ref.normalDose || '—'}
                        {ref.weightBased && <Badge variant="secondary" className="ml-1 text-[10px]">ตามน้ำหนัก</Badge>}
                      </TableCell>
                      <TableCell className="text-xs max-w-[280px]">
                        {ex
                          ? <div className="text-muted-foreground italic">ไม่ต้องปรับตามไต (ยกเว้นแล้ว)</div>
                          : ov?.dose_meta
                            ? <div className="text-emerald-700 dark:text-emerald-300">✎ {ov.dose_meta}</div>
                            : ref.bands.map((b, i) => (
                                <div key={i}><span className="text-muted-foreground">CrCl≤{b.max}:</span> {b.text}</div>
                              ))}
                        {ref.note && !ov && !ex && <div className="text-amber-700 dark:text-amber-400 mt-0.5">⚠ {ref.note}</div>}
                      </TableCell>
                      <TableCell className="text-[11px] text-muted-foreground whitespace-nowrap">{ex ? 'ยกเว้น' : ov ? 'แก้ไขเอง' : ref.source}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {ex ? (
                          <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs" onClick={() => unexempt(ex)} aria-label="คืนเกณฑ์ไต">
                            <RotateCcw className="size-3.5" /> คืนค่า
                          </Button>
                        ) : (
                          <>
                            <Button variant="ghost" size="icon" className="size-8" onClick={() => openEdit(drug, ref)} aria-label="แก้ไขเกณฑ์">
                              <Pencil className="size-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="size-8 text-red-500" onClick={() => { if (confirm(`ลบเกณฑ์ไตของ ${drug.drug_name}? (ยานี้จะไม่เตือนปรับตามไต)`)) exempt(drug) }} aria-label="ลบเกณฑ์ไต">
                              <Trash2 className="size-4" />
                            </Button>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {notInStock.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">ยาในคู่มือที่ไม่มีในบัญชี รพ.</CardTitle>
            <CardDescription>ไม่ได้นำเข้าเป็นเกณฑ์ (ถ้า รพ. เพิ่มยาเหล่านี้ในอนาคต ระบบจะจับให้อัตโนมัติ)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {notInStock.map((r) => (
                <Badge key={r.generic} variant="outline" className="text-[11px] font-normal">{r.generic}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dialog แก้ไขเกณฑ์ไต — บันทึกเป็น LAB_RULE (override) */}
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>แก้ไขเกณฑ์ไต — {edit?.drug.drug_name}</DialogTitle>
          </DialogHeader>
          {edit && (
            <div className="space-y-3">
              <div className="text-xs text-muted-foreground">
                icode {edit.drug.icode} · {edit.drug.generic_name}
                {edit.ref && <> · ค่าจากคู่มือ: <b>{edit.ref.source}</b> (ปรับเมื่อ CrCl &lt; {edit.ref.threshold})</>}
              </div>
              <div>
                <Label className="mb-1.5">เกณฑ์ปรับขนาดตาม CrCl</Label>
                <DoseMetaBuilder
                  value={edit.rule.dose_meta}
                  onChange={(v) => setEdit((e) => e && ({ ...e, rule: { ...e.rule, dose_meta: v } }))}
                  basisLabel="CrCl"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="mb-1.5">ความสำคัญ (priority)</Label>
                  <Select value={edit.rule.priority ?? 'high'} onValueChange={(v) => setEdit((e) => e && ({ ...e, rule: { ...e.rule, priority: v } }))}>
                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">สูง (แดง)</SelectItem>
                      <SelectItem value="medium">กลาง (ส้ม)</SelectItem>
                      <SelectItem value="low">ต่ำ (เหลือง)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="mb-1.5">หมายเหตุ / ขนาดปกติ</Label>
                  <Input
                    value={edit.rule.reason ?? ''}
                    onChange={(e) => setEdit((s) => s && ({ ...s, rule: { ...s.rule, reason: e.target.value } }))}
                    placeholder="เช่น ขนาดปกติ 1 g q8h"
                  />
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                เมื่อบันทึก เกณฑ์นี้จะ <b>แทนที่ค่าจากคู่มือ</b> ตอนคัดกรอง (ผูกกับ icode นี้) — เหมือนการตั้งกฎใน Lab/Dose
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)}>ยกเลิก</Button>
            <Button onClick={handleSave} disabled={saveRule.isPending}>{saveRule.isPending ? 'กำลังบันทึก...' : 'บันทึก'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
