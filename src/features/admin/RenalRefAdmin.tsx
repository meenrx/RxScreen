import { useMemo, useState } from 'react'
import { Search, Droplet, CheckCircle2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useDrugs } from '@/features/catalog/hooks'
import { RENAL_DOSE_REF, findRenalRef, type RenalDoseRef } from '@/features/screening/renalDoseRef'
import type { DrugMaster } from '@/types/drug'

/**
 * เกณฑ์ไต (Renal) — จับคู่ยา "ในบัญชี รพ." (DRUG_MASTER) กับคู่มือ Dose adjustment
 * แสดงว่ายา icode ไหนมีเกณฑ์ปรับขนาดตามไต (นำเข้าเฉพาะที่มีในบัญชีจริง)
 */
export function RenalRefAdmin() {
  const { data: drugs = [], isLoading } = useDrugs()
  const [q, setQ] = useState('')

  // จับคู่ยาในบัญชี รพ. → เกณฑ์ไตในคู่มือ (ผูกกับ icode)
  const matched = useMemo(() => {
    const rows: { drug: DrugMaster; ref: RenalDoseRef }[] = []
    for (const d of drugs) {
      const ref = findRenalRef(d.generic_name, d.drug_name)
      if (ref) rows.push({ drug: d, ref })
    }
    return rows.sort((a, b) => a.drug.drug_name.localeCompare(b.drug.drug_name))
  }, [drugs])

  // ยาในคู่มือที่ "ไม่มีในบัญชี รพ." (ไว้ให้รู้ว่าอะไรยังไม่ครอบคลุม)
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
            (Sanford 2010 / ACP 2007) — ผูกกับ icode ผ่าน generic_name · เกณฑ์นี้เด้งอัตโนมัติตอนคัดกรองเมื่อ CrCl ผู้ป่วยต่ำกว่าเกณฑ์
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 flex-wrap mb-3">
            <Badge variant="green" className="gap-1 text-sm">
              <CheckCircle2 className="size-3.5" /> มีเกณฑ์ไต {matched.length} ยา
            </Badge>
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground italic py-6">
                    {matched.length === 0 ? 'ยังไม่พบยาในบัญชีที่ตรงกับคู่มือ — ตรวจสอบว่ายามี generic_name' : 'ไม่พบตามคำค้น'}
                  </TableCell></TableRow>
                )}
                {filtered.map(({ drug, ref }) => (
                  <TableRow key={drug.icode}>
                    <TableCell className="font-mono text-xs">{drug.icode}</TableCell>
                    <TableCell>
                      <div className="font-medium text-sm">{drug.drug_name}</div>
                      <div className="text-[11px] text-muted-foreground">{drug.generic_name}</div>
                    </TableCell>
                    <TableCell><Badge variant="orange">{ref.threshold}</Badge></TableCell>
                    <TableCell className="text-xs max-w-[160px]">
                      {ref.normalDose || '—'}
                      {ref.weightBased && <Badge variant="secondary" className="ml-1 text-[10px]">ตามน้ำหนัก</Badge>}
                    </TableCell>
                    <TableCell className="text-xs max-w-[280px]">
                      {ref.bands.map((b, i) => (
                        <div key={i}><span className="text-muted-foreground">CrCl≤{b.max}:</span> {b.text}</div>
                      ))}
                      {ref.note && <div className="text-amber-700 dark:text-amber-400 mt-0.5">⚠ {ref.note}</div>}
                    </TableCell>
                    <TableCell className="text-[11px] text-muted-foreground whitespace-nowrap">{ref.source}</TableCell>
                  </TableRow>
                ))}
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
    </div>
  )
}
