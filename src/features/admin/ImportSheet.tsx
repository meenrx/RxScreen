import { useState } from 'react'
import { Download, Loader2, CheckCircle2, XCircle, FileSpreadsheet, ExternalLink, Pill, Layers, ShieldAlert } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useQueryClient } from '@tanstack/react-query'
import { importFromGoogleSheet, importDrugAccountSheet, dedupeDrugMaster, seedSukhothaiClinical, unifyLabParamToCrCl, type ImportProgress, type DrugAccountImportProgress, type DedupeResult, type ClinicalSeedResult, type UnifyLabResult } from '@/features/import/importer'
import { toast } from 'sonner'

const DEFAULT_SHEET_ID = '1fs5Sjvfui_FL3i4trHG6UIdf2WD0d2dVkGbwgk-H6hM'
const DRUG_ACCOUNT_SHEET_ID = '15R8YEHtTelgxARzuic5-txYpP70_LyhNRZ9CRdi7hD0'
const DRUG_ACCOUNT_SHEET_NAME = 'บัญชียา'

export function ImportSheet() {
  const qc = useQueryClient()
  const [sheetId, setSheetId] = useState(DEFAULT_SHEET_ID)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<ImportProgress[]>([])

  // Drug Account (บัญชียา) sheet state
  const [daSheetId, setDaSheetId] = useState(DRUG_ACCOUNT_SHEET_ID)
  const [daSheetName, setDaSheetName] = useState(DRUG_ACCOUNT_SHEET_NAME)
  const [daRunning, setDaRunning] = useState(false)
  const [daProgress, setDaProgress] = useState<DrugAccountImportProgress | null>(null)

  // Dedupe state
  const [dedupeRunning, setDedupeRunning] = useState(false)
  const [dedupeMsg, setDedupeMsg] = useState<string>('')
  const [dedupeResult, setDedupeResult] = useState<DedupeResult | null>(null)

  // Clinical seed state
  const [clinicalRunning, setClinicalRunning] = useState(false)
  const [clinicalMsg, setClinicalMsg] = useState<string>('')
  const [clinicalResult, setClinicalResult] = useState<ClinicalSeedResult | null>(null)

  // Unify lab param state
  const [unifyRunning, setUnifyRunning] = useState(false)
  const [unifyMsg, setUnifyMsg] = useState<string>('')
  const [unifyResult, setUnifyResult] = useState<UnifyLabResult | null>(null)

  async function handleUnifyLab() {
    if (!confirm('เปลี่ยน LAB_RULES ที่ param = SCr/Creatinine ให้เป็น CrCl ทั้งหมด\n\n(เพราะ renal dose ใช้ CrCl ที่คำนวณจาก SCr อยู่แล้ว ระบบจะคำนวณอัตโนมัติเมื่อมีค่า SCr+อายุ+น้ำหนัก)\n\nดำเนินการต่อ?')) return
    setUnifyRunning(true)
    setUnifyResult(null)
    setUnifyMsg('')
    try {
      const r = await unifyLabParamToCrCl(setUnifyMsg)
      setUnifyResult(r)
      toast.success(`อัปเดตเรียบร้อย — แปลง ${r.updated} rule เป็น CrCl`)
      qc.invalidateQueries({ queryKey: ['lab-rules'] })
    } catch (e) {
      toast.error('อัปเดตไม่สำเร็จ: ' + (e as Error).message)
    } finally {
      setUnifyRunning(false)
    }
  }

  async function handleSeedClinical() {
    if (!confirm('นำเข้าข้อมูลคลินิกจากแนวทาง รพ.สุโขทัย + พระจอมเกล้า 2560\n\n• คู่ DDI ~40 คู่ (Warfarin, Ergot, Sildenafil ฯลฯ)\n• HAD 19 ยา (Adrenaline, KCl, RI, ฯลฯ)\n• Renal dose 35 ยา\n• Disease rules (CKD/HF/Pregnancy/Lithium/HLA)\n• Duplicate class (ACEI/ARB/BB/Statin/NSAID)\n• Drug timing (Levothyroxine, Madopar)\n• DUE flag 15 ยา (ATB ควบคุม)\n• SR no-crush 4 ยา (tube feeding)\n\nจะ overwrite ของเดิม — ดำเนินการต่อ?')) return
    setClinicalRunning(true)
    setClinicalResult(null)
    setClinicalMsg('')
    try {
      const r = await seedSukhothaiClinical(setClinicalMsg)
      setClinicalResult(r)
      toast.success(`Seed สำเร็จ — DDI ${r.ddi_pairs}, HAD ${r.had_rules}, Renal ${r.renal_rules}`)
      qc.invalidateQueries({ queryKey: ['drugs'] })
      qc.invalidateQueries({ queryKey: ['ddi'] })
      qc.invalidateQueries({ queryKey: ['lab-rules'] })
      qc.invalidateQueries({ queryKey: ['disease'] })
    } catch (e) {
      toast.error('Seed ไม่สำเร็จ: ' + (e as Error).message)
    } finally {
      setClinicalRunning(false)
    }
  }

  async function handleDedupe() {
    if (!confirm('จะลบยาที่ icode ซ้ำกัน เหลือ 1 ตัวต่อ icode (เลือกตัวที่มี generic_name และอัปเดตล่าสุด)\n\nยืนยันลบ?')) return
    setDedupeRunning(true)
    setDedupeResult(null)
    setDedupeMsg('')
    try {
      const result = await dedupeDrugMaster(setDedupeMsg)
      setDedupeResult(result)
      toast.success(`ลบยาซ้ำเรียบร้อย — เก็บ ${result.kept} icode (ลบ ${result.deleted} ซ้ำ)`)
      qc.invalidateQueries({ queryKey: ['drugs'] })
    } catch (e) {
      toast.error('ลบยาซ้ำไม่สำเร็จ: ' + (e as Error).message)
    } finally {
      setDedupeRunning(false)
    }
  }

  async function handleDrugAccountImport() {
    setDaRunning(true)
    setDaProgress(null)
    try {
      const result = await importDrugAccountSheet(daSheetId, daSheetName, setDaProgress)
      if (result.status === 'done') {
        toast.success(`นำเข้าบัญชียาเรียบร้อย ${result.written} รายการ`)
        qc.invalidateQueries({ queryKey: ['drugs'] })
      } else if (result.status === 'error') {
        toast.error('นำเข้าบัญชียาไม่สำเร็จ: ' + (result.error || ''))
      }
    } catch (e) {
      toast.error('นำเข้าบัญชียาไม่สำเร็จ: ' + (e as Error).message)
    } finally {
      setDaRunning(false)
    }
  }

  async function handleImport() {
    setRunning(true)
    setProgress([])
    try {
      await importFromGoogleSheet(sheetId, setProgress)
      toast.success('นำเข้าข้อมูลเรียบร้อย')
      // refresh ทุก query ที่เกี่ยวข้อง
      qc.invalidateQueries({ queryKey: ['drugs'] })
      qc.invalidateQueries({ queryKey: ['lab-rules'] })
      qc.invalidateQueries({ queryKey: ['ddi'] })
      qc.invalidateQueries({ queryKey: ['counseling'] })
      qc.invalidateQueries({ queryKey: ['disease'] })
    } catch (e) {
      toast.error('นำเข้าไม่สำเร็จ: ' + (e as Error).message)
    } finally {
      setRunning(false)
    }
  }

  const totalDone = progress.filter((p) => p.status === 'done').reduce((s, p) => s + p.count, 0)
  const hasError = progress.some((p) => p.status === 'error')
  const allDone = progress.length > 0 && progress.every((p) => p.status === 'done' || p.status === 'error')

  return (
    <div className="space-y-4">
    <Card className="soft-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="size-5 text-emerald-600" />
          นำเข้าจาก Google Sheet
        </CardTitle>
        <CardDescription>
          ดึงข้อมูลทั้งหมดจาก Google Spreadsheet เข้า Firestore (DRUG_MASTER, LAB_RULES, DDI, Counseling, Disease, Warfarin tables ฯลฯ)
          — ใช้ได้ทั้งครั้งแรก และ re-sync เมื่อมีการแก้ Sheet
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label className="mb-1.5">Spreadsheet ID</Label>
          <div className="flex gap-2">
            <Input value={sheetId} onChange={(e) => setSheetId(e.target.value)} className="font-mono text-xs" />
            <a
              href={`https://docs.google.com/spreadsheets/d/${sheetId}/edit`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 px-3 rounded-md border hover:bg-accent text-sm"
            >
              <ExternalLink className="size-4" /> เปิด
            </a>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Sheet ต้องตั้ง <b>"Anyone with the link can view"</b> ใน Share settings
          </p>
        </div>

        <div className="rounded-xl border bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 p-3 text-sm">
          <b>⚠ การนำเข้าจะ overwrite ข้อมูลเดิมใน Firestore</b><br />
          ก่อนกด "นำเข้า" ตรวจสอบว่า Sheet มีข้อมูลถูกต้อง — แต่ข้อมูลเดิมจะถูกแทนที่ตาม icode (DRUG_MASTER) เพื่อความสอดคล้อง
        </div>

        <Button
          onClick={handleImport}
          disabled={running || !sheetId.trim()}
          size="lg"
          className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700"
        >
          {running ? <><Loader2 className="size-5 animate-spin" /> กำลังนำเข้า...</> : <><Download className="size-5" /> นำเข้าข้อมูล</>}
        </Button>

        {progress.length > 0 && (
          <div className="space-y-1.5 mt-3">
            <div className="text-sm font-semibold flex items-center justify-between">
              <span>สถานะ</span>
              {allDone && <Badge variant={hasError ? 'orange' : 'green'}>
                รวม {totalDone} รายการ {hasError && '(มี error บางส่วน)'}
              </Badge>}
            </div>
            {progress.map((p) => (
              <div key={p.sheet} className="flex items-center gap-3 p-2.5 rounded-lg border bg-card">
                <StatusIcon status={p.status} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{p.sheet}</div>
                  {p.error && <div className="text-xs text-red-600 dark:text-red-400 truncate">{p.error}</div>}
                </div>
                <div className="text-sm text-muted-foreground">
                  {p.status === 'done' ? `✓ ${p.count}` :
                   p.status === 'fetching' ? 'กำลังโหลด...' :
                   p.status === 'writing' ? `กำลังบันทึก ${p.count}...` :
                   p.status === 'error' ? 'error' : 'รอ'}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>

      {/* ============= บัญชียาโรงพยาบาล ============= */}
      <Card className="soft-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Pill className="size-5 text-cyan-600" />
            นำเข้าบัญชียาโรงพยาบาล (Drug Account)
          </CardTitle>
          <CardDescription>
            ดึงรายการยา + ราคา (ทุน/ขาย) + หมวด + ข้อบ่งใช้ + Pregnancy category จาก Sheet "บัญชียา" เข้า DRUG_MASTER
            <br />
            <span className="text-[11px]">
              คอลัมน์ที่รองรับ: <b>icode</b>, name, strength, units, dosageform, drugaccount, drugcategory, therapeutic, unitcost, unitprice, pregnancy, generic_name
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="sm:col-span-2">
              <Label className="mb-1.5">Spreadsheet ID</Label>
              <div className="flex gap-2">
                <Input value={daSheetId} onChange={(e) => setDaSheetId(e.target.value)} className="font-mono text-xs" />
                <a
                  href={`https://docs.google.com/spreadsheets/d/${daSheetId}/edit`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 px-3 rounded-md border hover:bg-accent text-sm"
                >
                  <ExternalLink className="size-4" />
                </a>
              </div>
            </div>
            <div>
              <Label className="mb-1.5">ชื่อ Sheet (tab)</Label>
              <Input value={daSheetName} onChange={(e) => setDaSheetName(e.target.value)} />
            </div>
          </div>

          <div className="rounded-xl border bg-cyan-50 dark:bg-cyan-950/30 border-cyan-200 dark:border-cyan-800 p-3 text-xs">
            ⚠ Sheet ต้องตั้ง <b>"Anyone with the link can view"</b> และ <b>icode ซ้ำได้</b> (1 icode = หลาย strength/รูปแบบ) ระบบใช้ <code>icode + ชื่อ</code> เป็น unique key
            <br />
            ฟิลด์ safety ที่ผู้ใช้แก้ใน UI (HAD, LASA, allergens) จะ <b>คงไว้</b> หลัง re-import
          </div>

          <Button
            onClick={handleDrugAccountImport}
            disabled={daRunning || !daSheetId.trim() || !daSheetName.trim()}
            size="lg"
            className="w-full bg-gradient-to-r from-cyan-500 to-sky-600 hover:from-cyan-600 hover:to-sky-700"
          >
            {daRunning ? <><Loader2 className="size-5 animate-spin" /> กำลังนำเข้า...</> : <><Download className="size-5" /> นำเข้าบัญชียา</>}
          </Button>

          {daProgress && (
            <div className="flex items-center gap-3 p-2.5 rounded-lg border bg-card">
              <StatusIcon status={daProgress.status === 'pending' ? 'pending' : daProgress.status} />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">บัญชียา ({daSheetName})</div>
                {daProgress.error && <div className="text-xs text-red-600 dark:text-red-400 truncate">{daProgress.error}</div>}
              </div>
              <div className="text-sm text-muted-foreground">
                {daProgress.status === 'done' ? `✓ บันทึก ${daProgress.written}/${daProgress.total}` :
                 daProgress.status === 'fetching' ? 'กำลังโหลด...' :
                 daProgress.status === 'writing' ? `กำลังบันทึก ${daProgress.total} รายการ...` :
                 daProgress.status === 'error' ? 'error' : 'รอ'}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      {/* ============= Seed Clinical Data (สุโขทัย + พระจอมเกล้า) ============= */}
      <Card className="soft-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="size-5 text-purple-600" />
            นำเข้าข้อมูลคลินิก (Sukhothai + พระจอมเกล้า)
          </CardTitle>
          <CardDescription>
            seed กฎคลินิกพื้นฐานทั้งหมดในครั้งเดียว — DDI, HAD, Renal dose, Disease rules, Duplicate therapy, Drug timing, DUE flags, no-crush
            <br />
            <span className="text-[11px]">⚠ ทำหลัง import บัญชียา + ลบยาซ้ำเรียบร้อยแล้ว · จะอัปเดต DRUG_MASTER (เพิ่ม tag) + เขียน collection อื่น</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            onClick={handleSeedClinical}
            disabled={clinicalRunning}
            size="lg"
            className="w-full bg-gradient-to-r from-purple-500 to-fuchsia-600 hover:from-purple-600 hover:to-fuchsia-700"
          >
            {clinicalRunning ? <><Loader2 className="size-5 animate-spin" /> กำลัง seed...</> : <><ShieldAlert className="size-5" /> นำเข้าข้อมูลคลินิกทั้งหมด</>}
          </Button>

          {clinicalMsg && (
            <div className="text-xs text-muted-foreground bg-muted/30 rounded-md p-2 font-mono">
              {clinicalMsg}
            </div>
          )}

          {clinicalResult && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center">
                <SeedStat label="DDI คู่" value={clinicalResult.ddi_pairs} color="red" />
                <SeedStat label="HAD ยา" value={clinicalResult.had_rules} color="red" />
                <SeedStat label="Renal rules" value={clinicalResult.renal_rules} color="cyan" />
                <SeedStat label="Disease rules" value={clinicalResult.disease_rules} color="orange" />
                <SeedStat label="dup class tag" value={clinicalResult.drugs_tagged_dup} color="purple" />
                <SeedStat label="timing tag" value={clinicalResult.drugs_tagged_timing} color="blue" />
                <SeedStat label="DUE flag" value={clinicalResult.drugs_tagged_due} color="orange" />
                <SeedStat label="no-crush" value={clinicalResult.drugs_tagged_no_crush} color="red" />
              </div>
              {clinicalResult.errors.length > 0 && (
                <div className="text-xs text-red-600 bg-red-50 dark:bg-red-950/30 rounded-md p-2 space-y-0.5">
                  <div className="font-semibold">⚠ Errors:</div>
                  {clinicalResult.errors.map((e, i) => <div key={i}>{e}</div>)}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* ============= Unify LAB param SCr → CrCl ============= */}
      <Card className="soft-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="size-5 text-sky-600" />
            ทำให้ LAB param เป็น CrCl ทั้งหมด
          </CardTitle>
          <CardDescription>
            แปลง LAB_RULES ที่ใช้ <code>SCr / Creatinine</code> ให้เป็น <code>CrCl</code> ทุก rule
            <br />
            <span className="text-[11px]">⚙ engine จะคำนวณ CrCl อัตโนมัติจาก SCr + อายุ + น้ำหนัก (Cockcroft-Gault) เมื่อ rule ขอ CrCl — ผู้ป่วยกรอกแค่ SCr ก็พอ</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            onClick={handleUnifyLab}
            disabled={unifyRunning}
            size="lg"
            variant="outline"
            className="w-full border-sky-300 hover:bg-sky-50 dark:hover:bg-sky-950/30"
          >
            {unifyRunning ? <><Loader2 className="size-5 animate-spin" /> กำลังแปลง...</> : <><Layers className="size-5" /> ทำให้ param = CrCl ทั้งหมด</>}
          </Button>

          {unifyMsg && (
            <div className="text-xs text-muted-foreground bg-muted/30 rounded-md p-2 font-mono">{unifyMsg}</div>
          )}

          {unifyResult && (
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg border p-2"><div className="text-[10px] text-muted-foreground">สแกน</div><div className="font-bold">{unifyResult.scanned}</div></div>
              <div className="rounded-lg border p-2 bg-sky-50 dark:bg-sky-950/30"><div className="text-[10px] text-sky-700 dark:text-sky-400">แปลงเป็น CrCl</div><div className="font-bold text-sky-700 dark:text-sky-400">{unifyResult.updated}</div></div>
              <div className="rounded-lg border p-2"><div className="text-[10px] text-muted-foreground">ข้าม (ไม่ใช่ SCr)</div><div className="font-bold">{unifyResult.skipped}</div></div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ============= ลบยาซ้ำ ============= */}
      <Card className="soft-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="size-5 text-orange-600" />
            ลบยาซ้ำใน DRUG_MASTER (Dedupe)
          </CardTitle>
          <CardDescription>
            รวมยาที่ icode ซ้ำกัน เหลือ 1 ตัวต่อ icode — เก็บตัวที่ <b>มี generic_name</b> และ <b>อัปเดตล่าสุด</b>
            <br />
            <span className="text-[11px]">⚠ การลบเป็นถาวร แนะนำให้ดูข้อมูลในตารางก่อน เพื่อยืนยันว่าตัวที่ซ้ำคือ data entry duplicate จริง ไม่ใช่ยาต่างขนาด/รูปแบบ</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            onClick={handleDedupe}
            disabled={dedupeRunning}
            size="lg"
            variant="outline"
            className="w-full border-orange-300 hover:bg-orange-50 dark:hover:bg-orange-950/30"
          >
            {dedupeRunning ? <><Loader2 className="size-5 animate-spin" /> กำลังลบยาซ้ำ...</> : <><Layers className="size-5" /> ลบยาซ้ำ (เหลือ 1 ตัวต่อ icode)</>}
          </Button>

          {dedupeMsg && (
            <div className="text-xs text-muted-foreground bg-muted/30 rounded-md p-2 font-mono">
              {dedupeMsg}
            </div>
          )}

          {dedupeResult && (
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="rounded-lg border p-2"><div className="text-[10px] text-muted-foreground">สแกน</div><div className="font-bold">{dedupeResult.scanned}</div></div>
              <div className="rounded-lg border p-2"><div className="text-[10px] text-muted-foreground">กลุ่ม icode</div><div className="font-bold">{dedupeResult.groups}</div></div>
              <div className="rounded-lg border p-2 bg-emerald-50 dark:bg-emerald-950/30"><div className="text-[10px] text-emerald-700 dark:text-emerald-400">เก็บ</div><div className="font-bold text-emerald-700 dark:text-emerald-400">{dedupeResult.kept}</div></div>
              <div className="rounded-lg border p-2 bg-red-50 dark:bg-red-950/30"><div className="text-[10px] text-red-700 dark:text-red-400">ลบ</div><div className="font-bold text-red-700 dark:text-red-400">{dedupeResult.deleted}</div></div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function SeedStat({ label, value, color }: { label: string; value: number; color: 'red' | 'orange' | 'cyan' | 'purple' | 'blue' }) {
  const bg: Record<string, string> = {
    red: 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400',
    orange: 'bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400',
    cyan: 'bg-cyan-50 dark:bg-cyan-950/30 text-cyan-700 dark:text-cyan-400',
    purple: 'bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-400',
    blue: 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400',
  }
  return (
    <div className={`rounded-lg border p-2 ${bg[color]}`}>
      <div className="text-[10px] opacity-80">{label}</div>
      <div className="font-bold text-lg">{value}</div>
    </div>
  )
}

function StatusIcon({ status }: { status: ImportProgress['status'] }) {
  if (status === 'done') return <CheckCircle2 className="size-5 text-emerald-600" />
  if (status === 'error') return <XCircle className="size-5 text-red-600" />
  if (status === 'fetching' || status === 'writing') return <Loader2 className="size-5 animate-spin text-cyan-600" />
  return <div className="size-5 rounded-full border-2 border-muted-foreground/30" />
}
