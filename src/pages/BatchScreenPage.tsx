import { useState, useMemo, useCallback, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Upload, FileSpreadsheet, Layers, Download, Loader2, CheckCircle2, AlertCircle, ChevronDown, FolderClock, BellOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { useScreeningData } from '@/features/screening/useScreeningData'
import { runScreening } from '@/features/screening/engine'
import { parseWorkbook, detectKind, buildBundles, KIND_LABEL, FILE_KINDS, type Bundle } from '@/features/batch/excelBundle'
import { saveBatch, loadBatch, clearBatch } from '@/features/batch/batchStore'
import { useMutes, addMute, muteKey, filterMuted } from '@/features/screening/alertMute'
import { useAuthStore } from '@/features/auth/authStore'
import { toast } from 'sonner'
import type { ScreeningAlert } from '@/types/screening'

type Loaded = Record<string, { name: string; rows: Record<string, unknown>[] }>
interface Result extends Bundle { alerts: ScreeningAlert[] }

const SEV = { red: '🔴', orange: '🟠', yellow: '🟡', blue: '🔵' } as const
const SEV_ORDER: (keyof typeof SEV)[] = ['red', 'orange', 'yellow', 'blue']

/** วิธีใช้ยา — ใช้ sig ที่หมอระบุ; ถ้าว่างสร้างจาก iperdose/iperday/frequency (ให้ทุกตัวมีวิธีใช้เสมอ) */
function usageText(d: Result['drugs'][number]): string {
  if (d.sig) return d.sig
  const p: string[] = []
  if (d.per_dose) p.push(`ครั้งละ ${d.per_dose}`)
  if (d.per_day) p.push(`วันละ ${d.per_day} ครั้ง`)
  if (d.frequency) p.push(d.frequency)
  if (d.prn) p.push('PRN')
  return p.length ? p.join(' ') : '(ไม่ระบุวิธีใช้)'
}

export default function BatchScreenPage() {
  const { drugMasters, labRules, ddiList, diseaseRules, isLoading } = useScreeningData()
  const user = useAuthStore((s) => s.user)
  const qc = useQueryClient()
  const { data: mutes } = useMutes()
  const mutedIds = useMemo(() => new Set((mutes ?? []).map((m) => m.id)), [mutes])
  const [muteTarget, setMuteTarget] = useState<ScreeningAlert | null>(null)
  const [muteNote, setMuteNote] = useState('')
  const [loaded, setLoaded] = useState<Loaded>({})
  const [results, setResults] = useState<Result[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [restored, setRestored] = useState(false)   // แสดงข้อมูลที่บันทึกไว้ (ยังไม่แนบใหม่)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  async function confirmMute() {
    if (!muteTarget) return
    try {
      await addMute({ id: muteKey(muteTarget), type: muteTarget.type, drugs: muteTarget.drugs ?? [], label: muteTarget.title, note: muteNote || undefined }, user?.uid)
      await qc.invalidateQueries({ queryKey: ['alert-mutes'] })
      toast.success('ปิดเตือนกรณีนี้แล้ว — จัดการได้ในเมนูจัดการฐานข้อมูล')
    } catch (e) { toast.error('ปิดเตือนไม่สำเร็จ: ' + (e as Error).message) }
    setMuteTarget(null); setMuteNote('')
  }

  // โหลด batch ล่าสุดที่บันทึกไว้ตอนเปิดหน้า
  useEffect(() => {
    loadBatch().then((b) => {
      if (b && Object.keys(b.files).length) { setLoaded(b.files); setSavedAt(b.savedAt); setRestored(true) }
    }).catch(() => {})
  }, [])

  const onFiles = useCallback(async (files: FileList | null) => {
    if (!files?.length) return
    setErr('')
    // แนบไฟล์ใหม่หลังดูข้อมูลเก่า → เริ่มใหม่ ยึดเฉพาะที่แนบรอบนี้ (ทับของเดิม)
    const next: Loaded = restored ? {} : { ...loaded }
    for (const f of Array.from(files)) {
      try {
        const rows = await parseWorkbook(await f.arrayBuffer())
        const kind = detectKind(rows, f.name)
        if (kind === 'unknown') { setErr(`ไม่ทราบชนิดไฟล์: ${f.name} (ตรวจหัวคอลัมน์ไม่ได้)`); continue }
        next[kind] = { name: f.name, rows }
      } catch (e) { setErr(`อ่าน ${f.name} ไม่สำเร็จ: ${(e as Error).message}`) }
    }
    const now = Date.now()
    setLoaded(next); setResults(null); setRestored(false); setSavedAt(now)
    saveBatch({ savedAt: now, files: next }).catch(() => {})  // บันทึกไว้ดูภายหลัง
  }, [loaded, restored])

  const runAll = useCallback(() => {
    setBusy(true); setErr('')
    try {
      const filesByKind = Object.fromEntries(FILE_KINDS.filter((k) => loaded[k]).map((k) => [k, loaded[k].rows]))
      const bundles = buildBundles(filesByKind, drugMasters, labRules)
      const out: Result[] = bundles.map((b) => ({
        ...b,
        alerts: runScreening({ drugs: b.drugs, patient: b.patient, ddiList, labRules, diseaseRules, drugMasters }),
      }))
      setResults(out)
    } catch (e) { setErr('คัดกรองไม่สำเร็จ: ' + (e as Error).message) }
    finally { setBusy(false) }
  }, [loaded, drugMasters, labRules, ddiList, diseaseRules])

  // แสดงผลของ batch ที่บันทึกไว้อัตโนมัติเมื่อฐานกฎพร้อม
  useEffect(() => {
    if (restored && !isLoading && !results && Object.keys(loaded).length) runAll()
  }, [restored, isLoading, results, loaded, runAll])

  function clearAll() { setLoaded({}); setResults(null); setRestored(false); setSavedAt(null); clearBatch().catch(() => {}) }

  // ตัด alert ที่ถูกปิดเตือนออก (reactive — ไม่ต้องคัดกรองใหม่)
  const view = useMemo(() => results?.map((r) => ({ ...r, alerts: filterMuted(r.alerts, mutedIds) })) ?? null, [results, mutedIds])

  const summary = useMemo(() => {
    if (!view) return null
    const c = { red: 0, orange: 0, yellow: 0, blue: 0 }
    let withRed = 0
    const byWard: Record<string, { n: number; red: number }> = {}
    for (const r of view) {
      const w = r.ward ?? '-'
      byWard[w] ??= { n: 0, red: 0 }
      byWard[w].n++
      let hasRed = false
      for (const a of r.alerts) { c[a.severity]++; if (a.severity === 'red') hasRed = true }
      if (hasRed) { withRed++; byWard[w].red++ }
    }
    return { total: view.length, withRed, ...c, byWard }
  }, [view])

  async function exportExcel() {
    if (!view) return
    const results = view
    const XLSX = await import('xlsx')
    const alertRows = results.flatMap((r) => r.alerts.map((a) => ({
      AN: r.an, HN: r.patient.hn ?? '', วอร์ด: r.ward ?? '', ระดับ: a.severity, ชนิด: a.type,
      หัวข้อ: a.title, คำแนะนำ: a.recommendation ?? '', รายละเอียด: a.detail,
    })))
    const patientRows = results.map((r) => ({
      AN: r.an, HN: r.patient.hn ?? '', วอร์ด: r.ward ?? '', อายุ: r.patient.age ?? '', เพศ: r.patient.sex ?? '',
      นน: r.patient.weight ?? '', CrCl_eGFR: r.patient.egfr ?? '',
      แดง: r.alerts.filter((a) => a.severity === 'red').length,
      ส้ม: r.alerts.filter((a) => a.severity === 'orange').length,
      เหลือง: r.alerts.filter((a) => a.severity === 'yellow').length,
    }))
    const drugRows = results.flatMap((r) => r.drugs.map((d) => ({
      AN: r.an, HN: r.patient.hn ?? '', วอร์ด: r.ward ?? '',
      ยา: d.master?.generic_name || d.drug_name, ความแรง: d.master?.strength ?? (d.strength_mg ?? ''),
      ต่อครั้ง: d.per_dose ?? '', ความถี่: d.frequency ?? '', mg_ต่อวัน: d.daily_mg ?? '', PRN: d.prn ? 'PRN' : '',
      วิธีใช้: usageText(d),
    })))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(patientRows), 'สรุปรายคน')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(drugRows), 'ยาที่สั่ง+วิธีใช้')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(alertRows), 'รายการ alert')
    XLSX.writeFile(wb, 'คัดกรองทั้งหมด.xlsx')
  }

  return (
    <div className="space-y-4 max-w-6xl mx-auto pb-20">
      <header className="flex items-center gap-2.5">
        <div className="size-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 grid place-items-center text-white shadow-sm">
          <Layers className="size-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight">คัดกรองทั้งหมด</h1>
          <p className="text-xs text-muted-foreground">อัปโหลด Excel 5 ไฟล์จาก HOSxP → คัดกรองทุกคนไข้พร้อมกัน · ทำงานในเครื่อง (offline)</p>
        </div>
      </header>

      {/* แจ้งว่ากำลังแสดงข้อมูลที่บันทึกไว้ */}
      {restored && savedAt && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 px-4 py-2.5 flex items-center gap-2 text-sm">
          <FolderClock className="size-4 text-amber-600 shrink-0" />
          <span>กำลังแสดง<b>ข้อมูลที่บันทึกไว้</b> · แนบเมื่อ {new Date(savedAt).toLocaleString('th-TH')}</span>
          <span className="text-muted-foreground">— อัปโหลดไฟล์ใหม่เพื่อคัดกรองรอบใหม่ (ทับของเดิม)</span>
        </div>
      )}

      {/* อัปโหลด */}
      <div className="rounded-2xl border-2 border-dashed p-5 bg-card">
        <label className="flex flex-col items-center justify-center gap-2 cursor-pointer py-4">
          <input type="file" multiple accept=".xls,.xlsx" className="hidden"
            onChange={(e) => { onFiles(e.target.files); e.currentTarget.value = '' }} />
          <Upload className="size-8 text-indigo-500" />
          <div className="font-medium">ลากไฟล์มาวาง หรือคลิกเลือก (เลือกได้หลายไฟล์พร้อมกัน)</div>
          <div className="text-xs text-muted-foreground">ระบบแยกชนิดไฟล์อัตโนมัติจากหัวคอลัมน์: admission · lab · drug · allergy · diagnosis</div>
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-3">
          {FILE_KINDS.map((k) => {
            const f = loaded[k]
            return (
              <div key={k} className={cn('rounded-xl border px-3 py-2 text-center', f ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30' : 'border-dashed text-muted-foreground')}>
                <div className="flex items-center justify-center gap-1 text-xs font-medium">
                  {f ? <CheckCircle2 className="size-3.5 text-emerald-600" /> : <FileSpreadsheet className="size-3.5" />}
                  {KIND_LABEL[k]}
                </div>
                <div className="text-[10px] truncate mt-0.5">{f ? `${f.rows.length} แถว` : 'ยังไม่มี'}</div>
              </div>
            )
          })}
        </div>
        {err && <div className="mt-2 text-sm text-red-600 flex items-center gap-1.5"><AlertCircle className="size-4" />{err}</div>}
        <div className="flex gap-2 mt-3">
          <Button onClick={runAll} disabled={busy || isLoading || !Object.keys(loaded).length}
            className="bg-gradient-to-r from-indigo-500 to-violet-600">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Layers className="size-4" />} คัดกรองทั้งหมด
          </Button>
          {Object.keys(loaded).length > 0 && <Button variant="outline" onClick={clearAll}>ล้าง</Button>}
          {results && <Button variant="outline" onClick={exportExcel}><Download className="size-4" /> Export Excel</Button>}
        </div>
        {isLoading && <div className="text-xs text-muted-foreground mt-2">กำลังโหลดฐานกฎ…</div>}
      </div>

      {/* สรุปวอร์ด */}
      {summary && (
        <div className="rounded-2xl border p-4 bg-card space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-bold">สรุป {summary.total} คนไข้</span>
            <Badge variant="red">{summary.withRed} คนมีปัญหาสำคัญ</Badge>
            <span className="text-muted-foreground">·</span>
            <span>🔴 {summary.red}</span><span>🟠 {summary.orange}</span><span>🟡 {summary.yellow}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(summary.byWard).sort().map(([w, v]) => (
              <span key={w} className="text-xs rounded-lg border px-2 py-1">
                {w}: {v.n} คน{v.red > 0 && <b className="text-red-600"> · 🔴 {v.red}</b>}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* การ์ดต่อคนไข้ */}
      {view && (
        <div className="space-y-2.5">
          {view.map((r) => <PatientCard key={r.an} r={r} onMute={setMuteTarget} />)}
          {view.length === 0 && <div className="text-center text-muted-foreground py-8">ไม่พบคนไข้ (ตรวจไฟล์ admission/drug)</div>}
        </div>
      )}

      {/* ยืนยันก่อนปิดเตือน */}
      <Dialog open={!!muteTarget} onOpenChange={(o) => { if (!o) { setMuteTarget(null); setMuteNote('') } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><BellOff className="size-5 text-amber-600" /> ไม่ต้องแสดงเตือนกรณีนี้อีก?</DialogTitle>
            <DialogDescription>
              ระบบจะ<b className="text-foreground"> ซ่อนเตือนนี้ทุกครั้ง</b> ที่คนไข้เข้าเกณฑ์เดียวกัน (ชนิด + ยาเดิม)
              และบันทึกไว้ใน “จัดการฐานข้อมูล → ปิดเตือน” (ยกเลิกได้ภายหลัง)
            </DialogDescription>
          </DialogHeader>
          {muteTarget && (
            <div className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">
              <div className="font-medium">{muteTarget.title}</div>
              <div className="text-xs text-muted-foreground">ชนิด: {muteTarget.type} · เกณฑ์นี้จะไม่แสดงกับทุกคนไข้ที่เข้าเงื่อนไข</div>
            </div>
          )}
          <Textarea rows={2} value={muteNote} onChange={(e) => setMuteNote(e.target.value)} placeholder="เหตุผล (เช่น ใช้เร่งคลอดตามข้อบ่งใช้) — ไม่บังคับ" className="text-sm" />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setMuteTarget(null); setMuteNote('') }}>ยกเลิก</Button>
            <Button className="bg-amber-600 hover:bg-amber-700" onClick={confirmMute}>ยืนยัน ปิดเตือน</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function PatientCard({ r, onMute }: { r: Result; onMute: (a: ScreeningAlert) => void }) {
  const counts = SEV_ORDER.map((s) => ({ s, n: r.alerts.filter((a) => a.severity === s).length })).filter((x) => x.n > 0)
  const worst = r.alerts.some((a) => a.severity === 'red') ? 'red' : r.alerts.some((a) => a.severity === 'orange') ? 'orange' : r.alerts.length ? 'yellow' : 'green'
  const [open, setOpen] = useState(worst === 'red')
  const sorted = [...r.alerts].sort((a, b) => SEV_ORDER.indexOf(a.severity) - SEV_ORDER.indexOf(b.severity))

  return (
    <div className={cn('rounded-xl border-2 bg-card overflow-hidden', worst === 'red' ? 'border-red-300 dark:border-red-800' : worst === 'orange' ? 'border-orange-200' : 'border-border')}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-accent/50">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="text-xs font-semibold text-muted-foreground shrink-0">AN</span>
          <span className="text-lg font-extrabold tabular-nums">{r.an}</span>
          {r.ward && <span className="text-xs text-muted-foreground shrink-0">· {r.ward}</span>}
          <span className="text-xs text-muted-foreground truncate">
            · {r.patient.age ?? '?'} ปี {r.patient.sex === 'M' ? 'ชาย' : r.patient.sex === 'F' ? 'หญิง' : ''}
            {r.patient.weight ? ` · ${r.patient.weight} kg` : ''}
            {r.patient.egfr !== undefined ? ` · CrCl ${r.patient.egfr}` : ''}
            {r.patient.is_pregnant ? ' · 🤰' : ''}
            {r.drugs.length ? ` · ยา ${r.drugs.length}` : ''}
          </span>
        </div>
        <div className="ml-auto flex items-center gap-1.5 shrink-0">
          {counts.length ? counts.map(({ s, n }) => <span key={s} className="text-sm">{SEV[s]} {n}</span>)
            : <Badge variant="green">ปกติ</Badge>}
          <ChevronDown className={cn('size-4 text-muted-foreground transition', open && 'rotate-180')} />
        </div>
      </button>
      {open && (
        <div className="px-4 pb-3 pt-1 space-y-2 border-t">
          {sorted.map((a) => (
            <div key={a.id} className="group flex items-start gap-2 text-sm">
              <span className="mt-0.5 shrink-0">{SEV[a.severity]}</span>
              <div className="min-w-0 flex-1">
                <div className="font-medium">{a.title}</div>
                {a.recommendation && <div className="text-xs text-emerald-700 dark:text-emerald-400">→ {a.recommendation}</div>}
                {a.detail && <div className="text-xs text-muted-foreground">{a.detail}</div>}
              </div>
              <button type="button" onClick={() => onMute(a)} title="ไม่ต้องแสดงกรณีนี้อีก"
                className="shrink-0 text-muted-foreground/50 hover:text-amber-600 opacity-0 group-hover:opacity-100 transition p-1">
                <BellOff className="size-3.5" />
              </button>
            </div>
          ))}
          {/* ยา + วิธีใช้ที่แพทย์สั่ง (จาก q3) — โชว์ sig เต็ม ให้เภสัชวิเคราะห์เอง */}
          {r.drugs.length > 0 && (
            <div className="pt-1">
              <div className="text-xs font-semibold text-muted-foreground mb-1">💊 ยาที่แพทย์สั่ง + วิธีใช้ ({r.drugs.length})</div>
              <div className="space-y-1 text-xs">
                {r.drugs.map((d, i) => (
                  <div key={d.icode + i} className="border-l-2 border-muted pl-2 py-0.5">
                    <div>
                      <b>{d.master?.generic_name || d.drug_name}</b>
                      {d.strength_mg ? ` ${d.strength_mg}mg` : d.master?.strength ? ` ${d.master.strength}` : ''}
                      {d.per_dose || d.frequency ? <span className="text-muted-foreground"> · ×{d.per_dose ?? '?'} {d.frequency ?? ''}</span> : ''}
                      {d.daily_mg ? <b className="text-foreground"> = {d.daily_mg} mg/วัน</b> : ''}
                      {d.prn ? <span className="text-amber-600"> · PRN</span> : ''}
                    </div>
                    <div className={cn('mt-0.5', d.sig ? 'text-muted-foreground' : 'text-muted-foreground/70 italic')}>📝 {usageText(d)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
