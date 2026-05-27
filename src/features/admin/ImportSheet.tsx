import { useState } from 'react'
import { Download, Loader2, CheckCircle2, XCircle, FileSpreadsheet, ExternalLink } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useQueryClient } from '@tanstack/react-query'
import { importFromGoogleSheet, type ImportProgress } from '@/features/import/importer'
import { toast } from 'sonner'

const DEFAULT_SHEET_ID = '1fs5Sjvfui_FL3i4trHG6UIdf2WD0d2dVkGbwgk-H6hM'

export function ImportSheet() {
  const qc = useQueryClient()
  const [sheetId, setSheetId] = useState(DEFAULT_SHEET_ID)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<ImportProgress[]>([])

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
  )
}

function StatusIcon({ status }: { status: ImportProgress['status'] }) {
  if (status === 'done') return <CheckCircle2 className="size-5 text-emerald-600" />
  if (status === 'error') return <XCircle className="size-5 text-red-600" />
  if (status === 'fetching' || status === 'writing') return <Loader2 className="size-5 animate-spin text-cyan-600" />
  return <div className="size-5 rounded-full border-2 border-muted-foreground/30" />
}
