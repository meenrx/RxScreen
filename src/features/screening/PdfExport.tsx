import { useState } from 'react'
import { FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatBEDateTime, formatBE } from '@/lib/format'
import { useAuthStore } from '@/features/auth/authStore'
import { printHtml, escapeHtml as esc } from './printService'
import type { PatientInput, ScreeningAlert, DrugEntry } from '@/types/screening'

interface Props {
  patient: PatientInput
  drugs: DrugEntry[]
  alerts: ScreeningAlert[]
  aiSummary?: string
  hospitalName?: string
}

export function PdfExportButton({ patient, drugs, alerts, aiSummary, hospitalName = 'โรงพยาบาลรือเสาะ' }: Props) {
  const user = useAuthStore((s) => s.user)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [hn, setHn] = useState(patient.hn ?? '')
  const [name, setName] = useState(patient.patient_name ?? '')

  async function doPrint() {
    setBusy(true)
    try {
      const merged: PatientInput = { ...patient, hn: hn || patient.hn, patient_name: name || patient.patient_name }
      const html = renderScreeningHtml({ patient: merged, drugs, alerts, aiSummary, user, hospitalName })
      await printHtml(html, screeningCss())
      setOpen(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Button onClick={() => { setHn(patient.hn ?? ''); setName(patient.patient_name ?? ''); setOpen(true) }} variant="outline">
        <FileText className="size-4" /> ออก PDF ใบคัดกรอง
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ออก PDF ใบคัดกรอง</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">กรอก HN และชื่อผู้ป่วยก่อนพิมพ์ (ไม่จำเป็น แต่ขอแนะนำเพื่อความสมบูรณ์ของใบ)</p>
            <div>
              <Label className="mb-1.5">HN</Label>
              <Input value={hn} onChange={(e) => setHn(e.target.value)} className="h-11" autoFocus />
            </div>
            <div>
              <Label className="mb-1.5">ชื่อ-นามสกุล</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="h-11" />
            </div>
            <p className="text-xs text-muted-foreground">ระบบจะเปิด print dialog → เลือก "Save as PDF" ในปลายทาง</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>ยกเลิก</Button>
            <Button onClick={doPrint} disabled={busy}>{busy ? 'กำลังเตรียม...' : 'พิมพ์ / Save PDF'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function screeningCss(): string {
  return `
    @page { size: A4 portrait; margin: 12mm; }
    body { font-size: 11pt; line-height: 1.5; }
    h1, h2, h3 { margin: 0; }
    .hd { display: flex; justify-content: space-between; align-items: end; border-bottom: 2px solid #0891b2; padding-bottom: 6px; margin-bottom: 12px; }
    .hd h1 { font-size: 16pt; color: #0e7490; }
    .meta { font-size: 9pt; color: #555; }
    .patient { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px 16px; padding: 8px; background: #f0f9ff; border-radius: 6px; margin-bottom: 12px; font-size: 10pt; }
    .patient b { color: #0e7490; }
    h2 { font-size: 12pt; margin: 16px 0 6px; color: #0e7490; border-bottom: 1px solid #ddd; padding-bottom: 2px; }
    table { width: 100%; border-collapse: collapse; font-size: 10pt; }
    th, td { border: 1px solid #cbd5e1; padding: 4px 6px; vertical-align: top; }
    th { background: #e0f2fe; text-align: left; }
    .sev-red    { background: #fee2e2; }
    .sev-orange { background: #ffedd5; }
    .sev-yellow { background: #fef9c3; }
    .sev-blue   { background: #e0f2fe; }
    .ai { white-space: pre-wrap; border: 1px solid #ddd; padding: 8px; background: #faf5ff; border-radius: 6px; font-size: 10pt; }
    .sign { margin-top: 32px; display: flex; justify-content: space-between; align-items: end; font-size: 10pt; }
    .sign .line { border-top: 1px solid #333; padding-top: 4px; min-width: 200px; text-align: center; }
    .footer { margin-top: 14px; text-align: center; font-size: 8pt; color: #888; }
  `
}

function renderScreeningHtml({ patient, drugs, alerts, aiSummary, user, hospitalName }: Props & { user: ReturnType<typeof useAuthStore.getState>['user']; hospitalName: string }): string {
  const drugRows = drugs.map((d, i) =>
    `<tr><td>${i + 1}</td><td>${esc(d.icode)}</td><td>${esc(d.master?.drug_name ?? d.drug_name)}</td><td>${esc(d.master?.drug_class)}</td></tr>`,
  ).join('') || `<tr><td colspan="4" style="text-align:center;color:#888">— ไม่มียา —</td></tr>`

  const alertRows = alerts.map((a) =>
    `<tr class="sev-${a.severity}"><td>${esc(a.type)}</td><td><b>${esc(a.title)}</b><br/><span style="font-size:9pt">${esc(a.detail)}${a.recommendation ? `<br/>💡 ${esc(a.recommendation)}` : ''}</span></td></tr>`,
  ).join('') || `<tr><td colspan="2" style="text-align:center;color:#888">— ไม่พบ alert —</td></tr>`

  return `
    <div class="hd">
      <div>
        <h1>${esc(hospitalName)} · ใบคัดกรองใบสั่งยา</h1>
        <div class="meta">วันที่ ${esc(formatBEDateTime(new Date()))}</div>
      </div>
      <div class="meta">RxScreen v0.3</div>
    </div>

    <div class="patient">
      <div><b>HN:</b> ${esc(patient.hn || '-')}</div>
      <div><b>ชื่อ:</b> ${esc(patient.patient_name || '-')}</div>
      <div><b>อายุ:</b> ${esc(patient.age) || '-'} ปี</div>
      <div><b>เพศ:</b> ${patient.sex === 'M' ? 'ชาย' : patient.sex === 'F' ? 'หญิง' : '-'}</div>
      <div><b>นน:</b> ${esc(patient.weight) || '-'} kg</div>
      <div><b>สส:</b> ${esc(patient.height) || '-'} cm</div>
      <div><b>SCr:</b> ${esc(patient.scr) || '-'}</div>
      <div><b>INR:</b> ${esc(patient.inr) || '-'}</div>
      ${patient.diseases?.length ? `<div style="grid-column: span 4"><b>โรค:</b> ${esc(patient.diseases.join(', '))}</div>` : ''}
      ${patient.is_pregnant ? `<div style="grid-column: span 4;color:#d97706"><b>🤰 ตั้งครรภ์</b>${patient.pregnancy_weeks ? ` · ${patient.pregnancy_weeks} สัปดาห์` : ''}</div>` : ''}
    </div>

    <h2>รายการยา (${drugs.length})</h2>
    <table>
      <thead><tr><th style="width:8%">#</th><th style="width:14%">icode</th><th>ชื่อยา</th><th style="width:22%">Class</th></tr></thead>
      <tbody>${drugRows}</tbody>
    </table>

    <h2>ผลคัดกรอง (${alerts.length})</h2>
    <table>
      <thead><tr><th style="width:12%">หมวด</th><th>รายละเอียด</th></tr></thead>
      <tbody>${alertRows}</tbody>
    </table>

    ${aiSummary ? `<h2>สรุปโดย AI</h2><div class="ai">${esc(aiSummary)}</div>` : ''}

    <div class="sign">
      <div class="line">
        เภสัชกร: <b>${esc(user?.displayName ?? '')}</b><br/>
        <span style="font-size:9pt">เลขใบประกอบฯ ${esc(user?.licNumber ?? '-')}</span>
      </div>
      <div class="line">
        วันที่ ${esc(formatBE(new Date()))}
      </div>
    </div>
    <div class="footer">เอกสารสร้างโดยระบบ RxScreen · ${esc(hospitalName)}</div>
  `
}
