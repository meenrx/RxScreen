import { useEffect, useState } from 'react'
import { Ban, Repeat, Coins, PiggyBank, Plus, User } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useAuthStore } from '@/features/auth/authStore'
import { useScreeningStore } from '@/features/screening/screeningStore'
import type { DrugEntry, PatientInput } from '@/types/screening'
import { useInterventionsByHn, useSaveIntervention } from './hooks'

interface Props {
  drugs: DrugEntry[]
  patient: PatientInput
}

export function InterventionSection({ drugs, patient }: Props) {
  const hn = patient.hn?.trim()
  const user = useAuthStore((s) => s.user)
  const setPatient = useScreeningStore((s) => s.setPatient)
  const { data: existing = [] } = useInterventionsByHn(hn)
  const saveMut = useSaveIntervention()

  // ---- บันทึก intervention ใหม่ (off/เปลี่ยนยา) ----
  const [recordDrug, setRecordDrug] = useState<DrugEntry | null>(null)

  // ช่อง HN + ชื่อ — กรอกตรงนี้เลย (ระบบบันทึกประวัติ/intervention ใช้ HN เป็น key)
  const patientFields = (
    <div className="flex flex-wrap gap-1.5 items-center rounded-lg border bg-card p-2">
      <User className="size-4 text-muted-foreground ml-1 shrink-0" />
      <Input
        value={patient.hn ?? ''}
        onChange={(e) => setPatient({ ...patient, hn: e.target.value || undefined })}
        placeholder="HN *"
        className="h-9 w-[120px]"
      />
      <Input
        value={patient.patient_name ?? ''}
        onChange={(e) => setPatient({ ...patient, patient_name: e.target.value || undefined })}
        placeholder="ชื่อผู้ป่วย"
        className="h-9 flex-1 min-w-[180px]"
      />
    </div>
  )

  if (!hn) {
    return (
      <div className="space-y-2">
        {patientFields}
        <p className="text-xs text-muted-foreground italic">
          กรอก HN ด้านบนเพื่อบันทึก intervention และคำนวณมูลค่าประหยัด
        </p>
      </div>
    )
  }

  const totalSaved = existing.reduce((s, i) => s + (i.total_saved ?? 0), 0)

  return (
    <div className="space-y-3">
      {patientFields}
      {/* สรุปยอดประหยัดของผู้ป่วยรายนี้ */}
      {existing.length > 0 && (
        <div className="rounded-xl border bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 p-3 flex items-center gap-3">
          <PiggyBank className="size-7 text-emerald-600" />
          <div className="flex-1">
            <div className="text-xs text-muted-foreground">มูลค่าประหยัดสะสมของ HN {hn}</div>
            <div className="text-xl font-bold text-emerald-700 dark:text-emerald-300">
              {totalSaved.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท
            </div>
          </div>
          <Badge variant="secondary">{existing.length} รายการ</Badge>
        </div>
      )}

      {/* รายการ intervention เดิมของผู้ป่วย */}
      {existing.length > 0 && (
        <div className="space-y-1.5">
          {existing.map((i) => (
            <div key={i.id} className="flex items-center gap-2 rounded-lg border bg-card p-2.5 text-sm">
              <Badge variant={i.status === 'off' ? 'red' : 'orange'} className="shrink-0">
                {i.status === 'off' ? 'off' : 'เปลี่ยน'}
              </Badge>
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">{i.drug_name}</div>
                <div className="text-[11px] text-muted-foreground">
                  สั่งซ้ำ {i.reorder_count} ครั้ง · {i.total_qty} หน่วย
                  {i.reason ? ` · ${i.reason}` : ''}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-xs text-muted-foreground">ประหยัด</div>
                <div className="font-semibold text-emerald-700 dark:text-emerald-300">
                  {(i.total_saved ?? 0).toLocaleString()} ฿
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ปุ่มบันทึก intervention ต่อยาในใบสั่งรอบนี้ */}
      <div>
        <Label className="text-xs text-muted-foreground">บันทึก intervention ให้ยาในใบสั่งรอบนี้</Label>
        <div className="mt-1.5 grid gap-1.5">
          {drugs.map((d) => {
            const has = existing.some((i) => i.icode === d.icode)
            return (
              <div key={d.icode} className="flex items-center gap-2 rounded-lg border bg-card p-2 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{d.master?.drug_name ?? d.drug_name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {d.master?.drug_account ? `บัญชี ${d.master.drug_account} · ` : ''}
                    ทุน {(d.master?.unit_cost ?? 0).toLocaleString()} ฿ · ขาย {(d.master?.unit_price ?? 0).toLocaleString()} ฿
                  </div>
                </div>
                {has ? (
                  <Badge variant="green" className="shrink-0">บันทึกแล้ว</Badge>
                ) : (
                  <Button size="sm" variant="outline" className="shrink-0" onClick={() => setRecordDrug(d)}>
                    <Plus className="size-3.5" /> บันทึก
                  </Button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Dialog: บันทึก intervention */}
      <RecordInterventionDialog
        drug={recordDrug}
        patient={patient}
        saving={saveMut.isPending}
        onClose={() => setRecordDrug(null)}
        onSave={async (payload) => {
          if (!recordDrug || !hn || !user) return
          await saveMut.mutateAsync({
            hn,
            patient_name: patient.patient_name,
            icode: recordDrug.icode,
            drug_name: recordDrug.master?.drug_name ?? recordDrug.drug_name,
            generic_name: recordDrug.master?.generic_name,
            status: payload.status,
            reason: payload.reason,
            alternative_name: payload.alternative_name,
            unit_cost: recordDrug.master?.unit_cost,
            unit_price: recordDrug.master?.unit_price,
            pharmacist_uid: user.uid,
            pharmacist_name: user.displayName,
          })
          setRecordDrug(null)
        }}
      />
    </div>
  )
}

// ===== Record dialog =====
interface RecordPayload {
  status: 'off' | 'switched'
  reason?: string
  alternative_name?: string
}

function RecordInterventionDialog({
  drug, patient, saving, onClose, onSave,
}: {
  drug: DrugEntry | null
  patient: PatientInput
  saving: boolean
  onClose: () => void
  onSave: (p: RecordPayload) => void
}) {
  const [status, setStatus] = useState<'off' | 'switched'>('off')
  const [reason, setReason] = useState('')
  const [alt, setAlt] = useState('')

  // reset ทุกครั้งที่เปิดยาตัวใหม่
  useEffect(() => {
    if (drug) { setStatus('off'); setReason(''); setAlt('') }
  }, [drug])

  return (
    <Dialog open={!!drug} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coins className="size-5 text-amber-500" /> บันทึก Intervention
          </DialogTitle>
          <DialogDescription>
            {drug?.master?.drug_name ?? drug?.drug_name} — HN {patient.hn ?? '-'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="mb-1.5">ประเภท</Label>
            <div className="flex gap-2">
              <Button
                type="button" variant={status === 'off' ? 'default' : 'outline'} size="sm"
                className={status === 'off' ? 'flex-1' : 'flex-1'} onClick={() => setStatus('off')}
              >
                <Ban className="size-4" /> หยุดยา (off)
              </Button>
              <Button
                type="button" variant={status === 'switched' ? 'default' : 'outline'} size="sm"
                className="flex-1" onClick={() => setStatus('switched')}
              >
                <Repeat className="size-4" /> เปลี่ยนยา
              </Button>
            </div>
          </div>

          <div>
            <Label className="mb-1.5">เหตุผล</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="เช่น ยาแพง / ยาซ้ำซ้อน / ไม่จำเป็น" />
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {['ยาแพง', 'ยาซ้ำซ้อน', 'ไม่จำเป็น', 'มียาทางเลือกที่คุ้มกว่า'].map((r) => (
                <button key={r} type="button" onClick={() => setReason(r)}
                  className="text-xs px-2 py-0.5 rounded-full border hover:bg-accent">
                  {r}
                </button>
              ))}
            </div>
          </div>

          {status === 'switched' && (
            <div>
              <Label className="mb-1.5">เปลี่ยนเป็นยา</Label>
              <Input value={alt} onChange={(e) => setAlt(e.target.value)} placeholder="ชื่อยาทางเลือก" />
            </div>
          )}

          <div className="rounded-lg bg-muted/50 p-2.5 text-xs text-muted-foreground">
            💡 หลังบันทึก ครั้งต่อไปที่หมอสั่งยานี้ให้ HN {patient.hn ?? '-'} ระบบจะเด้ง popup ถามจำนวน
            เพื่อคำนวณมูลค่าประหยัดอัตโนมัติ (จำนวน × ราคาทุน {(drug?.master?.unit_cost ?? 0).toLocaleString()} ฿)
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={onClose}>ยกเลิก</Button>
          <Button
            disabled={saving}
            onClick={() => onSave({ status, reason: reason.trim() || undefined, alternative_name: status === 'switched' ? (alt.trim() || undefined) : undefined })}
          >
            {saving ? 'กำลังบันทึก...' : 'บันทึก'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
