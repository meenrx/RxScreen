import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowRightLeft, MessageSquarePlus, ClipboardList, Trash2, Plus, FileText, Save } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DrugCombobox } from '@/components/DrugCombobox'
import { useDrugs } from '@/features/catalog/hooks'
import { useAuthStore } from '@/features/auth/authStore'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { formatBEDateTime, formatBE } from '@/lib/format'
import { printHtml, escapeHtml as esc } from '@/features/screening/printService'
import { toast } from 'sonner'

// ─────────────────────────── Discharge Med Reconciliation ───────────────────────────
type MedStatus = 'continue' | 'change' | 'new' | 'discontinue'
interface MedRow {
  id: string
  drug_name: string
  home?: string       // dose/sig ที่บ้านก่อนเข้า
  ward?: string       // dose/sig ในโรงพยาบาล
  discharge?: string  // dose/sig ที่ให้กลับบ้าน
  status: MedStatus
  note?: string
}

const STATUS_LABEL: Record<MedStatus, { label: string; color: 'green' | 'orange' | 'blue' | 'red'; emoji: string }> = {
  continue: { label: 'รับต่อเดิม', color: 'green', emoji: '➡' },
  change: { label: 'เปลี่ยนยา/dose', color: 'orange', emoji: '🔄' },
  new: { label: 'ยาใหม่', color: 'blue', emoji: '✨' },
  discontinue: { label: 'หยุดยา', color: 'red', emoji: '⛔' },
}

export function DischargeTab() {
  const { data: drugs = [] } = useDrugs()
  const user = useAuthStore((s) => s.user)

  const [hn, setHn] = useState('')
  const [name, setName] = useState('')
  const [admitDate, setAdmitDate] = useState('')
  const [dischargeDate, setDischargeDate] = useState('')
  const [meds, setMeds] = useState<MedRow[]>([])

  function addMed() {
    setMeds((p) => [...p, { id: Date.now().toString(), drug_name: '', status: 'continue' }])
  }
  function updateMed(id: string, patch: Partial<MedRow>) {
    setMeds((p) => p.map((m) => (m.id === id ? { ...m, ...patch } : m)))
  }
  function removeMed(id: string) {
    setMeds((p) => p.filter((m) => m.id !== id))
  }

  async function save() {
    if (!user || !name) { toast.error('กรุณาใส่ชื่อผู้ป่วย'); return }
    try {
      await addDoc(collection(db, 'DISCHARGE_MED_REC'), {
        hn: hn || null,
        patient_name: name,
        admit_date: admitDate || null,
        discharge_date: dischargeDate || null,
        meds,
        pharmacist_uid: user.uid,
        pharmacist_name: user.displayName,
        pharmacist_lic: user.licNumber,
        createdAt: serverTimestamp(),
      })
      toast.success('บันทึก Discharge Med Rec เรียบร้อย')
    } catch (e) {
      toast.error('บันทึกไม่สำเร็จ: ' + (e as Error).message)
    }
  }

  async function printSheet() {
    const html = renderDischargeHtml({ hn, name, admitDate, dischargeDate, meds, user })
    await printHtml(html, dischargeCss())
  }

  const summary = {
    continue: meds.filter((m) => m.status === 'continue').length,
    change: meds.filter((m) => m.status === 'change').length,
    new: meds.filter((m) => m.status === 'new').length,
    discontinue: meds.filter((m) => m.status === 'discontinue').length,
  }

  return (
    <Card className="soft-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><ArrowRightLeft className="size-5 text-emerald-600" />Discharge Medication Reconciliation</CardTitle>
        <CardDescription>เทียบยา home / ward / discharge เพื่อ counseling ตอนกลับบ้าน — ลดความผิดพลาด</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div><Label className="mb-1.5">HN</Label><Input value={hn} onChange={(e) => setHn(e.target.value)} className="h-11" /></div>
          <div><Label className="mb-1.5">ชื่อ-สกุล <span className="text-red-500">*</span></Label><Input value={name} onChange={(e) => setName(e.target.value)} className="h-11" /></div>
          <div><Label className="mb-1.5">วันรับเข้า (admit)</Label><Input type="date" value={admitDate} onChange={(e) => setAdmitDate(e.target.value)} className="h-11" /></div>
          <div><Label className="mb-1.5">วันจำหน่าย (discharge)</Label><Input type="date" value={dischargeDate} onChange={(e) => setDischargeDate(e.target.value)} className="h-11" /></div>
        </div>

        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex gap-1.5 flex-wrap">
            {meds.length > 0 && (
              <>
                <Badge variant="green">{summary.continue} ต่อ</Badge>
                <Badge variant="orange">{summary.change} เปลี่ยน</Badge>
                <Badge variant="blue">{summary.new} ใหม่</Badge>
                <Badge variant="red">{summary.discontinue} หยุด</Badge>
              </>
            )}
          </div>
          <Button onClick={addMed} variant="outline"><Plus className="size-4" /> เพิ่มยา</Button>
        </div>

        {meds.length === 0 ? (
          <p className="text-sm text-muted-foreground italic text-center py-6">ยังไม่มียา — กดเพิ่มยาด้านบน</p>
        ) : (
          <div className="space-y-2">
            {meds.map((m) => {
              const sLabel = STATUS_LABEL[m.status]
              return (
                <div key={m.id} className="rounded-xl border p-3 space-y-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div>
                      <Label className="mb-1 text-xs">ยา</Label>
                      <DrugCombobox drugs={drugs} value="" onChange={(_, d) => updateMed(m.id, { drug_name: d?.drug_name ?? m.drug_name })} placeholder={m.drug_name || 'พิมพ์ชื่อยา…'} />
                      {m.drug_name && <div className="text-xs text-muted-foreground mt-1">เลือก: <b>{m.drug_name}</b></div>}
                    </div>
                    <div>
                      <Label className="mb-1 text-xs">สถานะ</Label>
                      <Select value={m.status} onValueChange={(v) => updateMed(m.id, { status: v as MedStatus })}>
                        <SelectTrigger className="w-full h-10"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="continue">{STATUS_LABEL.continue.emoji} {STATUS_LABEL.continue.label}</SelectItem>
                          <SelectItem value="change">{STATUS_LABEL.change.emoji} {STATUS_LABEL.change.label}</SelectItem>
                          <SelectItem value="new">{STATUS_LABEL.new.emoji} {STATUS_LABEL.new.label}</SelectItem>
                          <SelectItem value="discontinue">{STATUS_LABEL.discontinue.emoji} {STATUS_LABEL.discontinue.label}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <div><Label className="mb-1 text-xs">Home (เดิม)</Label><Input value={m.home ?? ''} onChange={(e) => updateMed(m.id, { home: e.target.value })} className="h-10" placeholder="1 tab po bid" /></div>
                    <div><Label className="mb-1 text-xs">Ward (ใน รพ.)</Label><Input value={m.ward ?? ''} onChange={(e) => updateMed(m.id, { ward: e.target.value })} className="h-10" placeholder="1 tab po qd" /></div>
                    <div><Label className="mb-1 text-xs">Discharge (กลับบ้าน)</Label><Input value={m.discharge ?? ''} onChange={(e) => updateMed(m.id, { discharge: e.target.value })} className="h-10" placeholder="1 tab po bid" /></div>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1"><Input value={m.note ?? ''} onChange={(e) => updateMed(m.id, { note: e.target.value })} placeholder="หมายเหตุ / เหตุผล" className="h-10" /></div>
                    <Badge variant={sLabel.color}>{sLabel.emoji} {sLabel.label}</Badge>
                    <Button variant="ghost" size="icon" onClick={() => removeMed(m.id)}><Trash2 className="size-4 text-red-500" /></Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {meds.length > 0 && (
          <div className="flex flex-wrap gap-2 justify-end">
            <Button variant="outline" onClick={printSheet}><FileText className="size-4" /> ออกใบ Med Rec</Button>
            <Button onClick={save} disabled={!name}><Save className="size-4" /> บันทึก</Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function dischargeCss(): string {
  return `
    @page { size: A4 portrait; margin: 12mm; }
    body { font-size: 11pt; line-height: 1.4; }
    h1 { color: #0e7490; font-size: 16pt; margin: 0; }
    h2 { font-size: 12pt; margin: 14px 0 6px; color: #0e7490; border-bottom: 1px solid #ddd; padding-bottom: 2px; }
    .hd { display: flex; justify-content: space-between; align-items: end; border-bottom: 2px solid #0891b2; padding-bottom: 6px; margin-bottom: 12px; }
    table { width: 100%; border-collapse: collapse; font-size: 10pt; }
    th, td { border: 1px solid #cbd5e1; padding: 4px 6px; vertical-align: top; }
    th { background: #e0f2fe; text-align: left; }
    .s-continue { background: #d1fae5; }
    .s-change   { background: #ffedd5; }
    .s-new      { background: #dbeafe; }
    .s-discontinue { background: #fee2e2; }
    .sign { margin-top: 24px; display: flex; justify-content: space-between; font-size: 10pt; }
    .sign .line { border-top: 1px solid #333; padding-top: 4px; min-width: 240px; text-align: center; }
  `
}

function renderDischargeHtml({ hn, name, admitDate, dischargeDate, meds, user }: { hn: string; name: string; admitDate: string; dischargeDate: string; meds: MedRow[]; user: ReturnType<typeof useAuthStore.getState>['user'] }): string {
  const rows = meds.map((m) => {
    const s = STATUS_LABEL[m.status]
    return `<tr class="s-${m.status}"><td><b>${esc(m.drug_name)}</b>${m.note ? `<br/><span style="font-size:9pt">${esc(m.note)}</span>` : ''}</td><td>${esc(m.home || '-')}</td><td>${esc(m.ward || '-')}</td><td>${esc(m.discharge || '-')}</td><td>${s.emoji} ${esc(s.label)}</td></tr>`
  }).join('') || `<tr><td colspan="5" style="text-align:center;color:#888">— ไม่มียา —</td></tr>`

  return `
    <div class="hd">
      <div>
        <h1>ใบ Discharge Medication Reconciliation</h1>
        <div style="font-size:9pt;color:#555">โรงพยาบาลรือเสาะ · ${esc(formatBEDateTime(new Date()))}</div>
      </div>
    </div>
    <table>
      <tr><th style="width:18%">HN</th><td>${esc(hn || '-')}</td><th style="width:18%">วันรับเข้า</th><td>${admitDate ? esc(formatBE(new Date(admitDate))) : '-'}</td></tr>
      <tr><th>ชื่อ-สกุล</th><td>${esc(name)}</td><th>วันจำหน่าย</th><td>${dischargeDate ? esc(formatBE(new Date(dischargeDate))) : '-'}</td></tr>
    </table>
    <h2>รายการยาเทียบ ({meds.length} รายการ)</h2>
    <table>
      <thead><tr><th>ยา</th><th>Home (เดิม)</th><th>Ward (ใน รพ.)</th><th>Discharge (กลับบ้าน)</th><th>สถานะ</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="sign">
      <div class="line">เภสัชกร: ${esc(user?.displayName ?? '-')}<br/><span style="font-size:9pt">เลขใบประกอบฯ ${esc(user?.licNumber ?? '-')}</span></div>
      <div class="line">ผู้ป่วย / ผู้รับยา</div>
    </div>
  `
}

// ─────────────────────────── Handoff Note ───────────────────────────
export function HandoffTab() {
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const [hn, setHn] = useState('')
  const [topic, setTopic] = useState('')
  const [note, setNote] = useState('')
  const [priority, setPriority] = useState<'normal' | 'urgent'>('normal')

  async function save() {
    if (!user || !topic) { toast.error('กรุณาใส่หัวเรื่อง'); return }
    try {
      await addDoc(collection(db, 'PHARMACIST_HANDOFF'), {
        hn: hn || null,
        topic,
        note,
        priority,
        pharmacist_uid: user.uid,
        pharmacist_name: user.displayName,
        active: true,
        createdAt: serverTimestamp(),
      })
      qc.invalidateQueries({ queryKey: ['handoff'] })
      toast.success('บันทึก handoff note เรียบร้อย')
      setTopic(''); setNote(''); setHn('')
    } catch (e) {
      toast.error('บันทึกไม่สำเร็จ: ' + (e as Error).message)
    }
  }

  return (
    <Card className="soft-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><MessageSquarePlus className="size-5 text-blue-600" />Pharmacist Handoff Note</CardTitle>
        <CardDescription>โน้ตส่งต่อกะถัดไป — แสดงในประวัติผู้ป่วยถ้ามี HN</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div><Label className="mb-1.5">HN (ไม่บังคับ)</Label><Input value={hn} onChange={(e) => setHn(e.target.value)} className="h-11" placeholder="ผูกกับผู้ป่วยถ้ามี" /></div>
          <div>
            <Label className="mb-1.5">ความสำคัญ</Label>
            <Select value={priority} onValueChange={(v) => setPriority(v as 'normal' | 'urgent')}>
              <SelectTrigger className="w-full h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">ปกติ</SelectItem>
                <SelectItem value="urgent">เร่งด่วน</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label className="mb-1.5">หัวเรื่อง <span className="text-red-500">*</span></Label>
          <Input value={topic} onChange={(e) => setTopic(e.target.value)} className="h-11" placeholder="เช่น 'รอผล INR คุณสมชาย เย็นนี้'" />
        </div>
        <div>
          <Label className="mb-1.5">เนื้อหา</Label>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={5} placeholder="รายละเอียดที่ต้องส่งต่อกะถัดไป..." />
        </div>
        <div className="flex justify-end">
          <Button onClick={save} disabled={!topic}><Save className="size-4" /> บันทึก Handoff</Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ─────────────────────────── Brand/Generic Substitution Log ───────────────────────────
export function SubstitutionTab() {
  const { data: drugs = [] } = useDrugs()
  const user = useAuthStore((s) => s.user)

  const [hn, setHn] = useState('')
  const [originalIcode, setOriginalIcode] = useState('')
  const [originalName, setOriginalName] = useState('')
  const [substituteIcode, setSubstituteIcode] = useState('')
  const [substituteName, setSubstituteName] = useState('')
  const [reason, setReason] = useState('out_of_stock')
  const [note, setNote] = useState('')

  async function save() {
    if (!user || !originalName || !substituteName) { toast.error('กรุณาใส่ยา original และ ยาที่เปลี่ยน'); return }
    try {
      await addDoc(collection(db, 'SUBSTITUTION_LOG'), {
        hn: hn || null,
        original_icode: originalIcode,
        original_name: originalName,
        substitute_icode: substituteIcode,
        substitute_name: substituteName,
        reason,
        note,
        pharmacist_uid: user.uid,
        pharmacist_name: user.displayName,
        createdAt: serverTimestamp(),
      })
      toast.success('บันทึกการเปลี่ยนยาเรียบร้อย')
      setHn(''); setOriginalIcode(''); setOriginalName(''); setSubstituteIcode(''); setSubstituteName(''); setNote('')
    } catch (e) {
      toast.error('บันทึกไม่สำเร็จ: ' + (e as Error).message)
    }
  }

  return (
    <Card className="soft-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><ClipboardList className="size-5 text-amber-600" />Brand ↔ Generic Substitution Log</CardTitle>
        <CardDescription>บันทึกการเปลี่ยน trade/generic เมื่อยาไม่มี / ใช้แทน</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div><Label className="mb-1.5">HN (ไม่บังคับ)</Label><Input value={hn} onChange={(e) => setHn(e.target.value)} className="h-11" /></div>

        <div>
          <Label className="mb-1.5">ยาเดิม (ที่สั่ง) <span className="text-red-500">*</span></Label>
          <DrugCombobox drugs={drugs} value={originalIcode} onChange={(icode, d) => { setOriginalIcode(icode); setOriginalName(d?.drug_name ?? '') }} placeholder="พิมพ์ชื่อยาเดิม…" />
          {originalName && <div className="text-xs text-muted-foreground mt-1">เลือก: <b>{originalName}</b></div>}
        </div>

        <div>
          <Label className="mb-1.5">ยาที่ใช้แทน <span className="text-red-500">*</span></Label>
          <DrugCombobox drugs={drugs} value={substituteIcode} onChange={(icode, d) => { setSubstituteIcode(icode); setSubstituteName(d?.drug_name ?? '') }} placeholder="พิมพ์ชื่อยาแทน…" />
          {substituteName && <div className="text-xs text-muted-foreground mt-1">เลือก: <b>{substituteName}</b></div>}
        </div>

        <div>
          <Label className="mb-1.5">เหตุผล</Label>
          <Select value={reason} onValueChange={setReason}>
            <SelectTrigger className="w-full h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="out_of_stock">ยาขาด</SelectItem>
              <SelectItem value="cost">ราคา / สิทธิ์เบิก</SelectItem>
              <SelectItem value="allergy">แพ้ยาเดิม</SelectItem>
              <SelectItem value="formulary">นอก formulary รพ.</SelectItem>
              <SelectItem value="patient_request">ผู้ป่วยขอเปลี่ยน</SelectItem>
              <SelectItem value="other">อื่นๆ</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div><Label className="mb-1.5">หมายเหตุ</Label><Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} /></div>

        <div className="flex justify-end">
          <Button onClick={save} disabled={!originalName || !substituteName}><Save className="size-4" /> บันทึก</Button>
        </div>
      </CardContent>
    </Card>
  )
}
