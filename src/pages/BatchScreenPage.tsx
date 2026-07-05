import { useState, useMemo, useCallback } from 'react'
import { Upload, FileSpreadsheet, Layers, Download, Loader2, CheckCircle2, AlertCircle, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useScreeningData } from '@/features/screening/useScreeningData'
import { runScreening } from '@/features/screening/engine'
import { parseWorkbook, detectKind, buildBundles, KIND_LABEL, FILE_KINDS, type Bundle } from '@/features/batch/excelBundle'
import type { ScreeningAlert } from '@/types/screening'

type Loaded = Record<string, { name: string; rows: Record<string, unknown>[] }>
interface Result extends Bundle { alerts: ScreeningAlert[] }

const SEV = { red: '🔴', orange: '🟠', yellow: '🟡', blue: '🔵' } as const
const SEV_ORDER: (keyof typeof SEV)[] = ['red', 'orange', 'yellow', 'blue']

export default function BatchScreenPage() {
  const { drugMasters, labRules, ddiList, diseaseRules, isLoading } = useScreeningData()
  const [loaded, setLoaded] = useState<Loaded>({})
  const [results, setResults] = useState<Result[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const onFiles = useCallback(async (files: FileList | null) => {
    if (!files?.length) return
    setErr('')
    const next: Loaded = { ...loaded }
    for (const f of Array.from(files)) {
      try {
        const rows = await parseWorkbook(await f.arrayBuffer())
        const kind = detectKind(rows, f.name)
        if (kind === 'unknown') { setErr(`ไม่ทราบชนิดไฟล์: ${f.name} (ตรวจหัวคอลัมน์ไม่ได้)`) ; continue }
        next[kind] = { name: f.name, rows }
      } catch (e) { setErr(`อ่าน ${f.name} ไม่สำเร็จ: ${(e as Error).message}`) }
    }
    setLoaded(next)
    setResults(null)
  }, [loaded])

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

  const summary = useMemo(() => {
    if (!results) return null
    const c = { red: 0, orange: 0, yellow: 0, blue: 0 }
    let withRed = 0
    const byWard: Record<string, { n: number; red: number }> = {}
    for (const r of results) {
      const w = r.ward ?? '-'
      byWard[w] ??= { n: 0, red: 0 }
      byWard[w].n++
      let hasRed = false
      for (const a of r.alerts) { c[a.severity]++; if (a.severity === 'red') hasRed = true }
      if (hasRed) { withRed++; byWard[w].red++ }
    }
    return { total: results.length, withRed, ...c, byWard }
  }, [results])

  async function exportExcel() {
    if (!results) return
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
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(patientRows), 'สรุปรายคน')
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
          {Object.keys(loaded).length > 0 && <Button variant="outline" onClick={() => { setLoaded({}); setResults(null) }}>ล้าง</Button>}
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
      {results && (
        <div className="space-y-2.5">
          {results.map((r) => <PatientCard key={r.an} r={r} />)}
          {results.length === 0 && <div className="text-center text-muted-foreground py-8">ไม่พบคนไข้ (ตรวจไฟล์ admission/drug)</div>}
        </div>
      )}
    </div>
  )
}

function PatientCard({ r }: { r: Result }) {
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
            <div key={a.id} className="flex items-start gap-2 text-sm">
              <span className="mt-0.5 shrink-0">{SEV[a.severity]}</span>
              <div className="min-w-0">
                <div className="font-medium">{a.title}</div>
                {a.recommendation && <div className="text-xs text-emerald-700 dark:text-emerald-400">→ {a.recommendation}</div>}
                {a.detail && <div className="text-xs text-muted-foreground">{a.detail}</div>}
              </div>
            </div>
          ))}
          {/* วิธีใช้ยาที่แพทย์สั่ง (จาก q3) */}
          {r.drugs.length > 0 && (
            <div className="pt-1">
              <div className="text-xs font-semibold text-muted-foreground mb-1">💊 ยาที่แพทย์สั่ง ({r.drugs.length})</div>
              <div className="grid sm:grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
                {r.drugs.map((d, i) => (
                  <div key={d.icode + i} className="truncate">
                    • {d.master?.generic_name || d.drug_name}
                    {d.strength_mg ? ` ${d.strength_mg}mg` : d.master?.strength ? ` ${d.master.strength}` : ''}
                    {d.per_dose || d.frequency ? <span className="text-muted-foreground"> ×{d.per_dose ?? '?'} {d.frequency ?? ''}</span> : ''}
                    {d.daily_mg ? <b className="text-foreground"> = {d.daily_mg} mg/วัน</b> : ''}
                    {d.prn ? ' (PRN)' : ''}
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
