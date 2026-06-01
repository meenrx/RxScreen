import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FileJson, Loader2, Undo2, Trash2, AlertCircle, CheckCircle2, History } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import {
  parseSeedFiles,
  buildPreview,
  runImport,
  listBackups,
  restoreBackup,
  deleteBackup,
  type ParsedSeed,
  type ImportPreview,
  type ImportResult,
} from '@/features/import/jsonImporter'
import { listDrugs } from '@/features/catalog/api'

export function JsonImportAdmin() {
  const qc = useQueryClient()
  const [files, setFiles] = useState<{
    drugs?: File | null
    labs?: File | null
    ddi?: File | null
    clinical?: File | null
    counseling?: File | null
    had?: File | null
  }>({})
  const [parsed, setParsed] = useState<ParsedSeed | null>(null)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [parsing, setParsing] = useState(false)
  const [label, setLabel] = useState<string>('seed-rar-' + new Date().toISOString().slice(0, 10))
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<string[]>([])
  const [result, setResult] = useState<ImportResult | null>(null)
  const [restoringId, setRestoringId] = useState<string | null>(null)

  const { data: backups = [], refetch: refetchBackups } = useQuery({
    queryKey: ['import-backups'],
    queryFn: listBackups,
  })

  const fileCount = useMemo(
    () => [files.drugs, files.labs, files.ddi, files.clinical, files.counseling, files.had].filter(Boolean).length,
    [files],
  )

  async function handleParse() {
    if (fileCount === 0) { toast.error('กรุณาเลือกไฟล์อย่างน้อย 1 ตัว'); return }
    setParsing(true)
    setParsed(null)
    setPreview(null)
    setResult(null)
    try {
      const p = await parseSeedFiles(files)
      setParsed(p)
      if (p.errors.length) toast.error('Parse error: ' + p.errors.join(', '))
      const existing = await listDrugs()
      const pv = buildPreview(p, existing)
      setPreview(pv)
      toast.success('Parse + preview สำเร็จ')
    } catch (e) {
      toast.error('Parse ไม่สำเร็จ: ' + (e as Error).message)
    } finally {
      setParsing(false)
    }
  }

  async function handleRun() {
    if (!parsed) return
    if (!confirm(
      `กำลังจะนำเข้าข้อมูล + สร้าง backup\n\n`
      + `  - Drugs: ${parsed.drugs.length}\n`
      + `  - Lab: ${preview?.labs.matched ?? 0} (skip ${preview?.labs.unmatched.length ?? 0})\n`
      + `  - DDI: ${parsed.ddi.length} คู่\n`
      + `  - Clinical: ${preview?.clinical.matched ?? 0} (skip ${preview?.clinical.unmatched.length ?? 0})\n`
      + `  - Counseling: ${preview?.counseling.matched ?? 0} (skip ${preview?.counseling.unmatched.length ?? 0})\n`
      + `  - HAD: ${parsed.had.length}\n\n`
      + `Backup label: "${label}"\nหากผลไม่ถูกใจกด "ย้อนกลับ" ในตารางด้านล่างได้\n\nดำเนินการต่อ?`,
    )) return
    setRunning(true)
    setProgress([])
    setResult(null)
    try {
      const existing = await listDrugs()
      const r = await runImport({
        parsed,
        existingDrugs: existing,
        label,
        onProgress: (m) => setProgress((arr) => [...arr, m]),
      })
      setResult(r)
      toast.success(`Import สำเร็จ! Backup ID: ${r.backupId}`)
      refetchBackups()
      qc.invalidateQueries({ queryKey: ['drugs'] })
      qc.invalidateQueries({ queryKey: ['lab-rules'] })
      qc.invalidateQueries({ queryKey: ['ddi'] })
      qc.invalidateQueries({ queryKey: ['counseling'] })
      qc.invalidateQueries({ queryKey: ['had-rules'] })
    } catch (e) {
      toast.error('Import ล้มเหลว: ' + (e as Error).message)
    } finally {
      setRunning(false)
    }
  }

  async function handleRestore(backupId: string, lbl: string) {
    if (!confirm(`ย้อนกลับข้อมูลก่อนการ import "${lbl}"?\n\nระบบจะ:\n  - คืนค่า docs ที่เคยมีอยู่เดิม\n  - ลบ docs ที่ถูกสร้างใหม่ตอน import\n\nดำเนินการต่อ?`)) return
    setRestoringId(backupId)
    setProgress([])
    try {
      const r = await restoreBackup(backupId, (m) => setProgress((arr) => [...arr, m]))
      toast.success(`ย้อนกลับสำเร็จ — คืน ${r.restored}, ลบ ${r.deleted}`)
      refetchBackups()
      qc.invalidateQueries({ queryKey: ['drugs'] })
      qc.invalidateQueries({ queryKey: ['lab-rules'] })
      qc.invalidateQueries({ queryKey: ['ddi'] })
      qc.invalidateQueries({ queryKey: ['counseling'] })
      qc.invalidateQueries({ queryKey: ['had-rules'] })
    } catch (e) {
      toast.error('ย้อนกลับล้มเหลว: ' + (e as Error).message)
    } finally {
      setRestoringId(null)
    }
  }

  async function handleDeleteBackup(backupId: string) {
    if (!confirm(`ลบ backup "${backupId}" ถาวร? (กู้ไม่ได้แล้ว)`)) return
    try {
      await deleteBackup(backupId)
      toast.success('ลบ backup สำเร็จ')
      refetchBackups()
    } catch (e) {
      toast.error('ลบไม่สำเร็จ: ' + (e as Error).message)
    }
  }

  return (
    <div className="space-y-4">
      <Card className="soft-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileJson className="size-5" /> Import JSON Seed (drug-screen-db)
          </CardTitle>
          <CardDescription>
            นำเข้า 4 ไฟล์ JSON จาก seed package — drugs / lab_monitoring / drug_interactions / clinical_info
            พร้อมระบบ backup อัตโนมัติ ถ้าไม่ถูกใจกด "ย้อนกลับ" ได้
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid md:grid-cols-2 gap-3">
            <FilePick label="01_drugs.json" file={files.drugs} onPick={(f) => setFiles((s) => ({ ...s, drugs: f }))} />
            <FilePick label="02_lab_monitoring.json" file={files.labs} onPick={(f) => setFiles((s) => ({ ...s, labs: f }))} />
            <FilePick label="03_drug_interactions.json" file={files.ddi} onPick={(f) => setFiles((s) => ({ ...s, ddi: f }))} />
            <FilePick label="04_clinical_info.json" file={files.clinical} onPick={(f) => setFiles((s) => ({ ...s, clinical: f }))} />
            <FilePick label="counseling_seed.json" file={files.counseling} onPick={(f) => setFiles((s) => ({ ...s, counseling: f }))} />
            <FilePick label="had_drugs_seed.json" file={files.had} onPick={(f) => setFiles((s) => ({ ...s, had: f }))} />
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={handleParse} disabled={parsing || fileCount === 0}>
              {parsing && <Loader2 className="size-4 animate-spin" />}
              วิเคราะห์ไฟล์ (Preview)
            </Button>
            {parsed && (
              <span className="text-xs text-muted-foreground">
                ✓ Parse แล้ว — drugs={parsed.drugs.length} labs={parsed.labs.length} ddi={parsed.ddi.length} clinical={parsed.clinical.length} counseling={parsed.counseling.length} had={parsed.had.length}
              </span>
            )}
          </div>

          {preview && (
            <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
              <div className="text-sm font-semibold">📋 Preview การ map</div>
              <PreviewRow label="ยา (drugs)" total={preview.drugs.total} matched={preview.drugs.total} />
              <PreviewRow label="Lab monitoring" total={preview.labs.total} matched={preview.labs.matched} unmatched={preview.labs.unmatched} />
              <PreviewRow label="Drug interactions" total={preview.ddi.total} matched={preview.ddi.matched} unmatched={preview.ddi.unmatched} />
              <PreviewRow label="Clinical info" total={preview.clinical.total} matched={preview.clinical.matched} unmatched={preview.clinical.unmatched} />
              <PreviewRow label="Counseling" total={preview.counseling.total} matched={preview.counseling.matched} unmatched={preview.counseling.unmatched} />
              <PreviewRow label="HAD rules" total={preview.had.total} matched={preview.had.total} />
            </div>
          )}

          {parsed && (
            <div className="rounded-lg border p-3 space-y-2 bg-card">
              <Label className="text-xs">ชื่อ backup (เพื่อให้จำได้ว่าทำอะไรไป)</Label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="seed-rar-2026-06-01" className="h-9" />
              <Button onClick={handleRun} disabled={running} className="w-full bg-gradient-to-r from-emerald-500 to-teal-600">
                {running && <Loader2 className="size-4 animate-spin" />}
                🚀 Backup + Import เข้าระบบ
              </Button>
              <p className="text-xs text-muted-foreground">
                หมายเหตุ: ระบบจะ backup ของเดิม "ทุก doc ที่จะถูกแตะ" ก่อนเขียนทับ
                — ย้อนกลับได้ทุกเมื่อใน "ประวัติ backup" ด้านล่าง
              </p>
            </div>
          )}

          {progress.length > 0 && (
            <div className="rounded-lg border bg-slate-50 dark:bg-slate-950/40 p-2 max-h-48 overflow-y-auto text-xs font-mono">
              {progress.map((p, i) => <div key={i}>{p}</div>)}
            </div>
          )}

          {result && (
            <div className="rounded-lg border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 p-3 text-sm">
              <div className="font-semibold flex items-center gap-1.5"><CheckCircle2 className="size-4" /> Import เสร็จสมบูรณ์</div>
              <div className="text-xs mt-1 space-y-0.5">
                <div>• Drugs: <b>{result.drugsWritten}</b></div>
                <div>• Labs: <b>{result.labsWritten}</b> (skip {result.labsSkipped})</div>
                <div>• DDI: <b>{result.ddiWritten}</b> (skip {result.ddiSkipped})</div>
                <div>• Clinical: <b>{result.clinicalWritten}</b> (skip {result.clinicalSkipped})</div>
                <div>• Counseling: <b>{result.counselingWritten}</b> (skip {result.counselingSkipped})</div>
                <div>• HAD: <b>{result.hadWritten}</b></div>
                <div className="font-mono text-[11px] opacity-70 pt-1">Backup ID: {result.backupId}</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Backup history */}
      <Card className="soft-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="size-4" /> ประวัติ Backup
            <Badge variant="outline" className="ml-auto">{backups.length}</Badge>
          </CardTitle>
          <CardDescription className="text-xs">กด "ย้อนกลับ" เพื่อคืนข้อมูลก่อนการ import นั้น</CardDescription>
        </CardHeader>
        <CardContent>
          {backups.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">ยังไม่มี backup</p>
          ) : (
            <div className="space-y-2">
              {backups.map((b) => (
                <div key={b.id} className="rounded-lg border p-2.5 bg-card text-sm flex items-center gap-2 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium flex items-center gap-2">
                      {b.label}
                      {b.restoredAt && <Badge variant="outline" className="text-[10px]">ย้อนกลับแล้ว</Badge>}
                    </div>
                    <div className="text-[11px] text-muted-foreground font-mono">
                      {b.id} · {b.createdAt.toLocaleString('th-TH')}
                    </div>
                    <div className="text-[11px] mt-0.5 flex gap-2 flex-wrap">
                      <span>drugs: {b.summary?.drugs ?? 0}</span>
                      <span>labs: {b.summary?.labs ?? 0}</span>
                      <span>ddi: {b.summary?.ddi ?? 0}</span>
                      <span>clinical: {b.summary?.clinical ?? 0}</span>
                      <span>counseling: {b.summary?.counseling ?? 0}</span>
                      <span>had: {b.summary?.had ?? 0}</span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={restoringId === b.id || !!b.restoredAt}
                    onClick={() => handleRestore(b.id, b.label)}
                  >
                    {restoringId === b.id ? <Loader2 className="size-3.5 animate-spin" /> : <Undo2 className="size-3.5" />}
                    ย้อนกลับ
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDeleteBackup(b.id)} aria-label="ลบ backup">
                    <Trash2 className="size-3.5 text-red-500" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function FilePick({ label, file, onPick }: { label: string; file?: File | null; onPick: (f: File | null) => void }) {
  return (
    <div className="rounded-lg border p-2.5 bg-card">
      <Label className="text-xs">{label}</Label>
      <Input
        type="file"
        accept=".json,application/json"
        onChange={(e) => onPick(e.target.files?.[0] ?? null)}
        className="h-9 mt-1 file:mr-2 file:rounded-md file:border-0 file:bg-muted file:px-2 file:py-1 file:text-xs"
      />
      {file && <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-1">✓ {file.name} ({Math.round(file.size / 1024)} KB)</p>}
    </div>
  )
}

function PreviewRow({ label, total, matched, unmatched }: { label: string; total: number; matched: number; unmatched?: string[] }) {
  const ok = matched === total
  return (
    <div className="flex items-start gap-2 text-xs">
      <span className={ok ? 'text-emerald-700' : 'text-amber-700'}>{ok ? '✓' : <AlertCircle className="size-3 inline" />}</span>
      <div className="flex-1">
        <div><b>{label}:</b> {matched}/{total} matched</div>
        {unmatched && unmatched.length > 0 && (
          <details className="text-[11px] text-muted-foreground">
            <summary className="cursor-pointer">{unmatched.length} ที่ map icode ไม่ได้ (จะถูก skip)</summary>
            <div className="font-mono pl-2 pt-1 max-h-32 overflow-y-auto">{unmatched.join(', ')}</div>
          </details>
        )}
      </div>
    </div>
  )
}
