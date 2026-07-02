import { useEffect, useState } from 'react'
import { Printer } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getCounselingByIcode } from '@/features/catalog/api'
import { formatBE } from '@/lib/format'
import { useAuthStore } from '@/features/auth/authStore'
import { printHtml, escapeHtml as esc } from './printService'
import type { DrugCounseling, DrugMaster } from '@/types/drug'
import type { DrugEntry, PatientInput } from '@/types/screening'

interface Props {
  drugs: DrugEntry[]
  patient: PatientInput
  hospitalName?: string
}

/** เก็บรักษาอัตโนมัติจากรูปแบบยา — ใช้เมื่อไม่ได้ตั้งค่า counseling.storage */
function autoStorage(m?: DrugMaster, generic?: string): string | undefined {
  const f = (m?.dosage_form ?? m?.form ?? '').toLowerCase()
  const g = (generic ?? m?.generic_name ?? '').toLowerCase()
  if (g.includes('insulin')) return 'แช่ตู้เย็น · ขวดที่ใช้แล้วเก็บอุณหภูมิห้องได้ 28 วัน'
  if (/syrup|suspension|ยาน้ำ/.test(f)) return 'เก็บพ้นแสง · บางชนิดแช่เย็น · ทิ้งหลังเปิด 1 เดือน'
  if (/drop/.test(f)) return 'เก็บพ้นแสง · ทิ้งหลังเปิด 1 เดือน'
  if (/suppository|supp/.test(f)) return 'เก็บในตู้เย็น'
  return undefined
}

/** คำเตือนอัตโนมัติจาก safety flag — ใช้เมื่อไม่ได้ตั้งค่า counseling.warning */
function autoWarning(m?: DrugMaster): string | undefined {
  const w: string[] = []
  if (m?.no_crush) w.push('ห้ามบด/เคี้ยว/หักเม็ด')
  if (m?.is_HAD) w.push('ยาความเสี่ยงสูง')
  if (m?.g6pd_unsafe) w.push('ระวังผู้ป่วย G6PD')
  if (m?.pregnancy_category === 'X') w.push('ห้ามใช้ขณะตั้งครรภ์')
  if (m?.lactation_safe === false) w.push('ห้ามให้นมบุตร')
  return w.length ? w.join(' · ') : undefined
}

/** สติ๊กเกอร์คำแนะนำ 5×7 cm (แนวนอน → page 7×5 cm) */
export function Sticker57Panel({ drugs, patient, hospitalName = 'รพ.รือเสาะ' }: Props) {
  const user = useAuthStore((s) => s.user)
  const [counselingMap, setCounselingMap] = useState<Record<string, DrugCounseling | null>>({})
  const [open, setOpen] = useState(false)
  const [hn, setHn] = useState(patient.hn ?? '')
  const [name, setName] = useState(patient.patient_name ?? '')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    (async () => {
      const map: Record<string, DrugCounseling | null> = {}
      for (const d of drugs) {
        if (!map[d.icode]) map[d.icode] = await getCounselingByIcode(d.icode)
      }
      setCounselingMap(map)
    })()
  }, [drugs])

  async function doPrint() {
    setBusy(true)
    try {
      const mergedPatient: PatientInput = { ...patient, hn: hn || patient.hn, patient_name: name || patient.patient_name }
      const html = renderStickersHtml({ drugs, counselingMap, patient: mergedPatient, user, hospitalName })
      await printHtml(html, stickerCss())
      setOpen(false)
    } finally {
      setBusy(false)
    }
  }

  if (drugs.length === 0) return null

  return (
    <>
      <Card className="soft-card">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle>🏷 สติ๊กเกอร์คำแนะนำผู้ป่วย</CardTitle>
              <CardDescription>ขนาด 5×7 cm แนวนอน · 1 ใบต่อยา 1 ตัว · ตั้งกระดาษ landscape</CardDescription>
            </div>
            <Button onClick={() => { setHn(patient.hn ?? ''); setName(patient.patient_name ?? ''); setOpen(true) }}>
              <Printer className="size-4" /> พิมพ์
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Preview ตัวอย่างทั้งหน้า */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {drugs.map((d, i) => {
              const c = counselingMap[d.icode]
              return (
                <PreviewSticker key={i} drug={d} counseling={c} patient={{ ...patient, hn: hn || patient.hn, patient_name: name || patient.patient_name }} user={user} hospitalName={hospitalName} />
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>พิมพ์สติ๊กเกอร์ 5×7 cm</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">กรอก HN และชื่อผู้ป่วยก่อนพิมพ์ — จะปรากฏบนทุกสติ๊กเกอร์</p>
            <div>
              <Label className="mb-1.5">HN</Label>
              <Input value={hn} onChange={(e) => setHn(e.target.value)} className="h-11" autoFocus />
            </div>
            <div>
              <Label className="mb-1.5">ชื่อ-นามสกุล</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="h-11" />
            </div>
            <p className="text-xs text-muted-foreground">ในหน้า print dialog: ตั้ง paper size เป็น <b>"กำหนดเอง 70mm × 50mm"</b> (หรือ A4 ถ้าจะแบ่งซอย)</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>ยกเลิก</Button>
            <Button onClick={doPrint} disabled={busy}>{busy ? 'กำลังเตรียม...' : 'พิมพ์'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function PreviewSticker({ drug, counseling, patient, user, hospitalName }: { drug: DrugEntry; counseling: DrugCounseling | null; patient: PatientInput; user: ReturnType<typeof useAuthStore.getState>['user']; hospitalName: string }) {
  // 7cm × 5cm ratio = 1.4 : 1
  return (
    <div className="rounded-lg border-2 border-dashed bg-white text-black p-2" style={{ width: '100%', aspectRatio: '7/5', fontFamily: 'Prompt, sans-serif', fontSize: '8pt', lineHeight: 1.3 }}>
      <div className="flex justify-between border-b border-slate-400 pb-0.5 mb-1" style={{ fontSize: '7pt' }}>
        <b>{hospitalName}</b>
        <span>{formatBE(new Date(), 'D MMM BB')}</span>
      </div>
      <div className="flex justify-between" style={{ fontSize: '7pt' }}>
        <span><b>HN</b> {patient.hn || '____'}</span>
        <span className="truncate">{patient.patient_name || '____'}</span>
      </div>
      <div className="font-bold leading-tight mt-1" style={{ fontSize: '11pt' }}>{drug.master?.drug_name ?? drug.drug_name}</div>
      {drug.master?.generic_name && <div className="text-slate-600 leading-tight" style={{ fontSize: '7pt' }}>({drug.master.generic_name})</div>}
      {drug.sig && <div className="font-semibold mt-1 leading-tight">💊 วิธีใช้: {drug.sig}</div>}
      {counseling?.short_label && <div className="leading-tight" style={{ fontSize: '7.5pt' }}>📝 {counseling.short_label}</div>}
      {(() => { const warn = counseling?.warning ?? autoWarning(drug.master); return warn && <div className="font-bold text-red-700 leading-tight" style={{ fontSize: '7pt' }}>⚠ {warn}</div> })()}
      {(() => { const store = counseling?.storage ?? autoStorage(drug.master); return store && <div className="text-slate-700 leading-tight" style={{ fontSize: '7pt' }}>📦 {store}</div> })()}
      <div className="flex justify-between border-t border-slate-400 mt-1 pt-0.5" style={{ fontSize: '7pt' }}>
        <span className="truncate">ภก. {user?.displayName ?? ''}</span>
        <span>ลข. {user?.licNumber ?? ''}</span>
      </div>
    </div>
  )
}

function stickerCss(): string {
  return `
    @page { size: 70mm 50mm landscape; margin: 1.5mm; }
    body { font-size: 8pt; }
    .sticker {
      width: 67mm; height: 47mm;
      padding: 1.5mm;
      page-break-after: always;
      page-break-inside: avoid;
      display: flex; flex-direction: column;
      border: 0;
      overflow: hidden;
    }
    .sticker:last-child { page-break-after: auto; }
    .hd { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 0.4mm solid #555; padding-bottom: 0.5mm; font-size: 7pt; }
    .hd b { font-size: 8pt; }
    .pt { display: flex; justify-content: space-between; font-size: 7.5pt; margin-top: 0.5mm; }
    .drug { font-weight: 700; font-size: 11pt; line-height: 1.15; margin-top: 1mm; }
    .gen { color: #555; font-size: 7pt; line-height: 1.1; }
    .label { font-weight: 600; font-size: 9pt; margin-top: 1mm; line-height: 1.2; }
    .warn { color: #b91c1c; font-weight: 700; font-size: 7.5pt; margin-top: 0.8mm; line-height: 1.15; }
    .store { color: #444; font-size: 7pt; margin-top: 0.5mm; line-height: 1.15; }
    .ft { display: flex; justify-content: space-between; border-top: 0.4mm solid #555; padding-top: 0.5mm; margin-top: auto; font-size: 7pt; }
    .ft b { font-weight: 600; }
  `
}

function renderStickersHtml({ drugs, counselingMap, patient, user, hospitalName }: { drugs: DrugEntry[]; counselingMap: Record<string, DrugCounseling | null>; patient: PatientInput; user: ReturnType<typeof useAuthStore.getState>['user']; hospitalName: string }): string {
  return drugs.map((d) => {
    const c = counselingMap[d.icode]
    return `
    <div class="sticker">
      <div class="hd">
        <b>${esc(hospitalName)}</b>
        <span>${esc(formatBE(new Date(), 'D MMM BB'))}</span>
      </div>
      <div class="pt">
        <span><b>HN</b> ${esc(patient.hn || '____')}</span>
        <span>${esc(patient.patient_name || '____')}</span>
      </div>
      <div class="drug">${esc(d.master?.drug_name ?? d.drug_name)}</div>
      ${d.master?.generic_name ? `<div class="gen">(${esc(d.master.generic_name)})</div>` : ''}
      ${d.sig ? `<div class="label">💊 วิธีใช้: ${esc(d.sig)}</div>` : ''}
      ${c?.short_label ? `<div class="store">📝 ${esc(c.short_label)}</div>` : ''}
      ${(() => { const warn = c?.warning ?? autoWarning(d.master); return warn ? `<div class="warn">⚠ ${esc(warn)}</div>` : '' })()}
      ${(() => { const store = c?.storage ?? autoStorage(d.master); return store ? `<div class="store">📦 ${esc(store)}</div>` : '' })()}
      <div class="ft">
        <span>ภก. ${esc(user?.displayName ?? '')}</span>
        <span>ลข. ${esc(user?.licNumber ?? '')}</span>
      </div>
    </div>`
  }).join('')
}
