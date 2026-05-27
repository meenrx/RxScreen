import { useState, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { AlertOctagon, FileText, Save } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DrugCombobox } from '@/components/DrugCombobox'
import { useDrugs } from '@/features/catalog/hooks'
import { useAuthStore } from '@/features/auth/authStore'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { formatBEDateTime } from '@/lib/format'
import { printHtml, escapeHtml as esc } from '@/features/screening/printService'
import {
  WHO_QUESTIONS, WHO_CATEGORIES, suggestWhoCategory, getCategoryInfo,
  type WhoAnswers, type WhoCategory,
} from './adr'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

export function AdrTab() {
  const { data: drugs = [] } = useDrugs()
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)

  const [hn, setHn] = useState('')
  const [name, setName] = useState('')
  const [age, setAge] = useState<number | ''>('')
  const [sex, setSex] = useState<'M' | 'F' | ''>('')
  const [drugIcode, setDrugIcode] = useState('')
  const [drugName, setDrugName] = useState('')
  const [symptom, setSymptom] = useState('')
  const [onset, setOnset] = useState('')
  const [answers, setAnswers] = useState<WhoAnswers>({})
  const [finalCategory, setFinalCategory] = useState<WhoCategory | null>(null)
  const [saving, setSaving] = useState(false)

  const suggested = useMemo(() => suggestWhoCategory(answers), [answers])
  const selected = finalCategory ?? suggested
  const selectedInfo = getCategoryInfo(selected)
  const answeredCount = Object.values(answers).filter(Boolean).length

  function setAnswer(q: string, v: string | undefined) {
    setAnswers((p) => ({ ...p, [q]: p[q] === v ? undefined : v }))
  }

  async function save() {
    if (!user || !symptom || !drugName) { toast.error('กรอกข้อมูลขั้นต่ำ — ยา + อาการ'); return }
    setSaving(true)
    try {
      await addDoc(collection(db, 'ADR_REPORTS'), {
        hn: hn || null,
        patient_name: name || null,
        age: age || null,
        sex: sex || null,
        drug_icode: drugIcode || null,
        drug_name: drugName,
        symptom,
        onset: onset || null,
        who_answers: answers,
        who_suggested: suggested,
        who_final: selected,
        pharmacist_uid: user.uid,
        pharmacist_name: user.displayName,
        pharmacist_lic: user.licNumber,
        createdAt: serverTimestamp(),
      })
      qc.invalidateQueries({ queryKey: ['adr-reports'] })
      toast.success('บันทึก ADR report เรียบร้อย')
    } catch (e) {
      toast.error('บันทึกไม่สำเร็จ: ' + (e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function printReport() {
    const html = renderAdrPdf({ hn, name, age: age || undefined, sex: sex || undefined, drugName, symptom, onset, answers, finalKey: selected, user })
    await printHtml(html, adrCss())
  }

  return (
    <Card className="soft-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><AlertOctagon className="size-5 text-red-600" />ADR Report — WHO-UMC Criteria</CardTitle>
        <CardDescription>ใช้เกณฑ์ WHO-UMC Causality Assessment ในการประเมินความสัมพันธ์ระหว่างยา ↔ ADR</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div><Label className="mb-1.5">HN (ไม่บังคับ)</Label><Input value={hn} onChange={(e) => setHn(e.target.value)} className="h-11" /></div>
          <div><Label className="mb-1.5">ชื่อ-สกุล</Label><Input value={name} onChange={(e) => setName(e.target.value)} className="h-11" /></div>
          <div><Label className="mb-1.5">อายุ (ปี)</Label><Input type="number" value={age} onChange={(e) => setAge(e.target.value ? +e.target.value : '')} className="h-11" /></div>
          <div>
            <Label className="mb-1.5">เพศ</Label>
            <select value={sex} onChange={(e) => setSex(e.target.value as 'M' | 'F' | '')} className="w-full h-11 rounded-md border bg-transparent px-3">
              <option value="">-</option>
              <option value="M">ชาย</option>
              <option value="F">หญิง</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <Label className="mb-1.5">ยาที่สงสัย <span className="text-red-500">*</span></Label>
            <DrugCombobox drugs={drugs} value={drugIcode} onChange={(icode, d) => { setDrugIcode(icode); setDrugName(d?.drug_name ?? '') }} placeholder="พิมพ์ชื่อยา…" />
          </div>
          <div className="md:col-span-2">
            <Label className="mb-1.5">อาการ ADR ที่พบ <span className="text-red-500">*</span></Label>
            <Textarea value={symptom} onChange={(e) => setSymptom(e.target.value)} rows={2} placeholder="เช่น ผื่นลามทั่วตัว, ตับอักเสบ..." />
          </div>
          <div className="md:col-span-2"><Label className="mb-1.5">วันที่/ระยะเวลาเริ่มเกิดอาการ</Label><Input value={onset} onChange={(e) => setOnset(e.target.value)} className="h-11" placeholder="เช่น 3 วันหลังเริ่มยา" /></div>
        </div>

        <div className={`rounded-2xl border p-4 alert-${selectedInfo.color}`}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <div className="text-xs uppercase tracking-wider opacity-70">WHO-UMC Causality ({answeredCount}/5 ตอบ)</div>
              <div className="text-2xl font-bold mt-1">{selectedInfo.label}</div>
              {finalCategory && finalCategory !== suggested && (
                <div className="text-xs mt-1">⚠ เภสัชกร override จากระบบแนะนำ ({getCategoryInfo(suggested).label})</div>
              )}
            </div>
          </div>
          <ul className="mt-3 text-sm space-y-0.5 opacity-80">
            {selectedInfo.criteria.map((c, i) => <li key={i}>• {c}</li>)}
          </ul>
        </div>

        <div className="space-y-3">
          <Label className="text-sm uppercase tracking-wider text-muted-foreground">เกณฑ์ประเมิน WHO (5 ข้อ)</Label>
          {WHO_QUESTIONS.map((q) => (
            <div key={q.id} className="rounded-xl border p-3">
              <div className="font-medium text-sm mb-2">{q.text}</div>
              <div className="flex flex-wrap gap-1.5">
                {q.options.map((opt) => {
                  const active = answers[q.id] === opt.value
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setAnswer(q.id, opt.value)}
                      className={cn(
                        'px-3 py-1.5 rounded-lg border text-sm transition font-medium',
                        active ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-input hover:bg-accent',
                      )}
                    >
                      {active && '✓ '}{opt.label}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-xl border p-3">
          <Label className="text-sm uppercase tracking-wider text-muted-foreground mb-2">เภสัชกรเลือก Category สุดท้าย (override ได้)</Label>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {WHO_CATEGORIES.map((c) => {
              const active = selected === c.key
              const isSuggested = suggested === c.key && finalCategory === null
              return (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setFinalCategory(active ? null : c.key)}
                  className={cn(
                    'px-3 py-2 rounded-lg border text-sm transition font-medium relative',
                    active
                      ? c.color === 'red' ? 'bg-red-500 text-white border-red-500'
                        : c.color === 'orange' ? 'bg-orange-500 text-white border-orange-500'
                        : c.color === 'yellow' ? 'bg-yellow-500 text-white border-yellow-500'
                        : c.color === 'blue' ? 'bg-blue-500 text-white border-blue-500'
                        : 'bg-emerald-500 text-white border-emerald-500'
                      : 'bg-card border-input hover:bg-accent',
                  )}
                >
                  {active && '✓ '}{c.label}
                  {isSuggested && <Badge variant="outline" className="absolute -top-2 -right-2 text-[9px] bg-card">แนะนำ</Badge>}
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 justify-end pt-2">
          <Button variant="outline" onClick={printReport} disabled={!symptom || !drugName}>
            <FileText className="size-4" /> ออกใบรายงาน
          </Button>
          <Button onClick={save} disabled={saving || !symptom || !drugName}>
            <Save className="size-4" /> {saving ? 'กำลังบันทึก...' : 'บันทึก ADR'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function adrCss(): string {
  return `
    @page { size: A4 portrait; margin: 15mm; }
    body { font-size: 11pt; line-height: 1.5; }
    h1 { font-size: 16pt; color: #b91c1c; margin: 0; }
    h2 { font-size: 12pt; margin: 14px 0 6px; color: #0f766e; border-bottom: 1px solid #ddd; padding-bottom: 2px; }
    .hd { display: flex; justify-content: space-between; align-items: end; border-bottom: 2px solid #b91c1c; padding-bottom: 6px; margin-bottom: 12px; }
    .meta { font-size: 9pt; color: #555; }
    table { width: 100%; border-collapse: collapse; font-size: 10pt; }
    th, td { border: 1px solid #cbd5e1; padding: 4px 6px; vertical-align: top; }
    th { background: #fee2e2; text-align: left; }
    .verdict { padding: 12px; background: #fef3c7; border: 2px solid #f59e0b; border-radius: 6px; margin: 12px 0; }
    .sign { margin-top: 32px; display: flex; justify-content: space-between; font-size: 10pt; }
    .sign .line { border-top: 1px solid #333; padding-top: 4px; min-width: 240px; text-align: center; }
  `
}

interface PdfArgs {
  hn: string
  name: string
  age?: number
  sex?: string
  drugName: string
  symptom: string
  onset?: string
  answers: WhoAnswers
  finalKey: WhoCategory
  user: ReturnType<typeof useAuthStore.getState>['user']
}

function renderAdrPdf({ hn, name, age, sex, drugName, symptom, onset, answers, finalKey, user }: PdfArgs): string {
  const info = getCategoryInfo(finalKey)
  const rows = WHO_QUESTIONS.map((q) => {
    const v = answers[q.id]
    const opt = q.options.find((o) => o.value === v)
    return `<tr><td>${esc(q.text)}</td><td>${esc(opt?.label ?? '— ไม่ได้ตอบ —')}</td></tr>`
  }).join('')
  const criteria = info.criteria.map((c) => `<li>${esc(c)}</li>`).join('')

  return `
    <div class="hd">
      <div>
        <h1>ใบรายงาน ADR (WHO-UMC Causality)</h1>
        <div class="meta">โรงพยาบาลรือเสาะ · ${esc(formatBEDateTime(new Date()))}</div>
      </div>
    </div>
    <h2>ข้อมูลผู้ป่วย</h2>
    <table>
      <tr><th style="width:20%">HN</th><td>${esc(hn || '-')}</td><th style="width:15%">เพศ</th><td>${sex === 'M' ? 'ชาย' : sex === 'F' ? 'หญิง' : '-'}</td></tr>
      <tr><th>ชื่อ-สกุล</th><td colspan="3">${esc(name || '-')}</td></tr>
      <tr><th>อายุ</th><td>${esc(age) || '-'} ปี</td><th>วันที่เริ่มอาการ</th><td>${esc(onset || '-')}</td></tr>
    </table>
    <h2>ยาที่สงสัย</h2>
    <p><b>${esc(drugName)}</b></p>
    <h2>อาการ ADR</h2>
    <p style="white-space: pre-wrap">${esc(symptom)}</p>
    <h2>เกณฑ์ WHO-UMC Causality Assessment</h2>
    <table>
      <thead><tr><th>เกณฑ์</th><th>คำตอบ</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="verdict">
      <div style="font-size:9pt;text-transform:uppercase;color:#666">สรุประดับความสัมพันธ์</div>
      <div style="font-size:18pt;font-weight:bold;margin-top:4px">${esc(info.label)}</div>
      <ul style="margin-top:8px;font-size:10pt">${criteria}</ul>
    </div>
    <div class="sign">
      <div class="line">เภสัชกรผู้รายงาน: ${esc(user?.displayName ?? '-')}<br/><span style="font-size:9pt">เลขใบประกอบฯ ${esc(user?.licNumber ?? '-')}</span></div>
      <div class="line">วันที่ ${esc(formatBEDateTime(new Date()))}</div>
    </div>
  `
}
