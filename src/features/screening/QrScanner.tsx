import { useState, useEffect } from 'react'
import { Scanner, type IDetectedBarcode } from '@yudiel/react-qr-scanner'
import { ScanLine, X, Type, CheckCircle2, Upload } from 'lucide-react'
import { BarcodeDetector } from 'barcode-detector/ponyfill'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { mapAllergen } from './allergenMap'
import { fixThaiLayout, hasThai } from '@/lib/thaiKeyboard'

export interface ScannedData {
  hn?: string
  /** เลข admission (IPD) */
  an?: string
  patient_name?: string
  age?: number
  sex?: 'M' | 'F'
  /** น้ำหนัก (kg) */
  weight?: number
  /** CrCl (mL/min) — Cockcroft-Gault ฝั่ง รพ. */
  crcl?: number
  /** GFR ที่ lab รายงาน (mL/min/1.73m²) */
  gfr?: number
  /** CKD stage จาก GFR เช่น "5", "3a" */
  ckd_stage?: string
  /** serum creatinine (mg/dL) */
  scr?: number
  /** จำนวน allergen จริง (อาจมากกว่าที่ QR โชว์) */
  allergy_count?: number
  /** true = แพ้มากกว่าที่โชว์ใน QR → ต้องดู record เพิ่ม */
  allergy_truncated?: boolean
  /** INR */
  inr?: number
  /** ค่าแล็บอื่น ๆ keyed lowercase: k, ast, alt, fbs, bun, mg, albumin, plt, anc, aec, ... */
  labs?: Record<string, number>
  /** วันที่ของค่าแล็บ (YYMMDD) keyed เหมือน labs — ไว้แสดงว่าเป็นค่าล่าสุดแค่ไหน */
  labDates?: Record<string, string>
  /** true=พร่อง, false=ปกติ, undefined=ยังไม่เจาะ */
  g6pd?: boolean
  g6pd_tested?: boolean
  /** ชื่อยาที่แพ้ (list) */
  allergies?: string[]
  /** ICD10 ทั้งหมดของ admission */
  diseases?: string[]
  is_pregnant?: boolean
  is_lactating?: boolean
  drugs: { icode: string; sig?: string; drug_name?: string }[]
}

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  onScan: (data: ScannedData) => void
}

// มือถือ = กล้องหลัง · PC = webcam (ใช้ ideal ไม่บังคับ เพื่อไม่ให้ getUserMedia ล้มบนเครื่องที่ไม่มีกล้องหลัง)
const SCAN_CONSTRAINTS: MediaTrackConstraints = {
  facingMode: { ideal: 'environment' },
  width: { ideal: 1920 },
  height: { ideal: 1080 },
  advanced: [{ focusMode: 'continuous' }] as unknown as MediaTrackConstraintSet[],
}

export function QrScannerModal({ open, onOpenChange, onScan }: Props) {
  const [manualText, setManualText] = useState('')
  const [error, setError] = useState<string | null>(null)
  // โหมดสแกนต่อเนื่อง — สแกนหลายสติ๊กเกอร์สะสมเป็นรายการเดียว
  const [seen, setSeen] = useState<Set<string>>(new Set())
  const [addedCount, setAddedCount] = useState(0)
  const [lastAdded, setLastAdded] = useState<string | null>(null)

  // reset ทุกครั้งที่เปิด modal ใหม่
  useEffect(() => {
    if (open) { setSeen(new Set()); setAddedCount(0); setLastAdded(null); setError(null) }
  }, [open])

  /** เพิ่มผลสแกน 1 รายการ (ไม่ปิด modal) — dedupe ด้วย rawValue */
  function addPayload(raw: string): boolean {
    if (seen.has(raw)) return false // สแกนซ้ำสติ๊กเกอร์เดิม → ข้าม
    const data = parseQrPayload(raw)
    // อ่าน QR ได้ แต่ parse ไม่เจอยา → อย่าเงียบ: โชว์ข้อความดิบให้เห็นว่ารูปแบบ QR เป็นยังไง
    if (data.drugs.length === 0) {
      setSeen((p) => new Set(p).add(raw))
      setError(`อ่าน QR ได้ แต่ไม่พบรายการยาในรูปแบบที่รองรับ — ข้อความที่อ่านได้: ${raw.slice(0, 160)}`)
      return false
    }
    onScan(data)
    setSeen((p) => new Set(p).add(raw))
    const n = data.drugs.length
    setAddedCount((c) => c + n)
    setLastAdded(data.drugs.map((d) => d.drug_name ?? d.icode).join(', ') || `${n} รายการ`)
    return true
  }

  function handleScan(codes: IDetectedBarcode[]) {
    if (!codes || codes.length === 0) return
    try {
      const added = addPayload(codes[0].rawValue)
      setError(null)
      // สแกนติด + ได้ยาแล้ว → ปิด modal ทันที เด้งไปหน้าผลคัดกรอง (ฉลาก 1 ดวง = ทั้งใบสั่ง)
      if (added) onOpenChange(false)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  function handleManual() {
    if (!manualText.trim()) return
    try {
      const added = addPayload(manualText.trim())
      setManualText('')
      setError(null)
      if (added) onOpenChange(false)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  /** อ่าน QR จากไฟล์รูป (decode ในเครื่อง ผ่าน barcode-detector — ไม่ต้องมีเครื่องสแกน) */
  async function handleImageFile(file: File | undefined) {
    if (!file) return
    try {
      const detector = new BarcodeDetector({ formats: ['qr_code'] })
      const bitmap = await createImageBitmap(file)
      const codes = await detector.detect(bitmap)
      bitmap.close?.()
      if (!codes.length) { setError('ไม่พบ QR code ในรูป — ลองใช้รูปที่ชัด/ครอบเฉพาะ QR'); return }
      const added = addPayload(codes[0].rawValue)
      setError(null)
      if (added) onOpenChange(false)
    } catch (e) {
      setError('อ่านรูปไม่สำเร็จ: ' + (e as Error).message)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="size-5 text-emerald-600" />
            สแกน QR Code สติ๊กเกอร์ยา
          </DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="camera">
          <TabsList className="mx-4 mb-2">
            <TabsTrigger value="camera"><ScanLine className="size-4" /> กล้อง</TabsTrigger>
            <TabsTrigger value="image"><Upload className="size-4" /> รูป QR</TabsTrigger>
            <TabsTrigger value="manual"><Type className="size-4" /> วาง/พิมพ์</TabsTrigger>
          </TabsList>

          <TabsContent value="camera" className="m-0">
            <div className="relative aspect-square bg-black">
              <Scanner
                onScan={handleScan}
                onError={(e) => setError(e?.message ? String(e.message) : String(e))}
                formats={['qr_code']}
                constraints={SCAN_CONSTRAINTS}
                scanDelay={100}
                retryDelay={80}
                sound={false}
                components={{ zoom: true, torch: true, finder: false }}
                styles={{ container: { width: '100%', height: '100%' } }}
              />
              <div className="absolute inset-8 border-4 border-emerald-400/80 rounded-2xl pointer-events-none animate-pulse" />
            </div>
            <p className="text-xs text-center text-muted-foreground p-3">เล็ง QR ให้อยู่ในกรอบสีเขียว · ใช้แถบซูม 🔍 / ไฟฉาย 🔦 ช่วยได้ — สแกนได้หลายสติ๊กเกอร์ต่อเนื่อง</p>
          </TabsContent>

          <TabsContent value="image" className="px-4 pb-4 space-y-3">
            <p className="text-sm text-muted-foreground">เลือกไฟล์รูป QR (ถ่ายภาพ/แคปหน้าจอ) — decode ในเครื่อง ไม่ต้องมีเครื่องสแกน</p>
            <label className="flex flex-col items-center gap-2 border-2 border-dashed rounded-xl p-6 cursor-pointer hover:bg-accent transition">
              <Upload className="size-8 text-muted-foreground" />
              <span className="text-sm font-medium">เลือกรูป QR</span>
              <span className="text-xs text-muted-foreground">.jpg .png — ครอบเฉพาะ QR จะแม่นสุด</span>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => { handleImageFile(e.target.files?.[0]); e.currentTarget.value = '' }} />
            </label>
          </TabsContent>

          <TabsContent value="manual" className="px-4 pb-4 space-y-2">
            <p className="text-sm text-muted-foreground">วางข้อมูลจาก QR (JSON / pipe-delimited) หรือพิมพ์มือ</p>
            <Textarea
              rows={6}
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              placeholder={`รูปแบบที่รองรับ:\n1) JSON: {"hn":"123","name":"...","drugs":[{"icode":"CEFTRX","sig":"1g IV q12h"}]}\n2) Pipe: RXS|HN|Name|age|sex|icode1:sig1|icode2:sig2`}
              className="font-mono text-xs"
            />
            <Button onClick={handleManual} className="w-full" disabled={!manualText.trim()}>
              ประมวลผลข้อมูล
            </Button>
          </TabsContent>
        </Tabs>

        {error && (
          <div className="mx-4 mb-2 p-2 rounded bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
            <X className="size-3.5" />{error}
          </div>
        )}

        {/* สรุปยาที่สแกนสะสม + ปุ่มเสร็จสิ้น */}
        <div className="mx-4 mb-4 flex items-center gap-2">
          <div className="flex-1 min-w-0 text-sm">
            {addedCount > 0 ? (
              <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="size-4 shrink-0" />
                เพิ่มแล้ว <b>{addedCount}</b> รายการ
                {lastAdded && <span className="text-muted-foreground truncate">· ล่าสุด: {lastAdded}</span>}
              </span>
            ) : (
              <span className="text-muted-foreground">ยังไม่ได้สแกน</span>
            )}
          </div>
          <Button
            variant={addedCount > 0 ? 'default' : 'outline'}
            onClick={() => onOpenChange(false)}
            className={addedCount > 0 ? 'bg-gradient-to-r from-emerald-500 to-teal-600' : ''}
          >
            {addedCount > 0 ? `เสร็จสิ้น (${addedCount})` : 'ปิด'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Parse QR payload — รองรับหลายรูปแบบ:
 *
 * รูปแบบ 1 — JSON:
 *   { "hn": "123", "name": "...", "age": 60, "sex": "M",
 *     "drugs": [{"icode": "CEFTRX", "sig": "1g IV q12h"}] }
 *
 * รูปแบบ 2 — Pipe-delimited:
 *   RXS|HN|ชื่อ|อายุ|เพศ|icode1:sig1|icode2:sig2|...
 *
 * รูปแบบ 2.5 — IPD 14-field (key-prefixed, คั่นด้วย "|", list ภายในคั่นด้วย ","):
 *   AN690002061|RX:1000131,1000135|A77|SM|BW60|CrCl51|SCr1.03|K3.72|AST306|ALT125|G6PD-|Alg:SULFA|Dx:D649,K922|PgN
 *   "-" = ไม่มีข้อมูล field นั้น (แยกจากค่าปกติ)
 *
 * รูปแบบ 3 — บรรทัด/comma (icodes อย่างเดียว):
 *   CEFTRX, AMOX, PARA
 */
function num(v: string | undefined): number | undefined {
  if (v === undefined || v === '') return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

/** parse IPD 14-field แบบ key-based (ทนต่อลำดับ + จับ key ยาวสุดก่อนกัน A ชน AST) */
function parseIpdFields(text: string): ScannedData {
  // เรียง key ยาว→สั้น/เฉพาะเจาะจงก่อน เพื่อไม่ให้ A ไปจับ AST/ALT/AN, S ไปจับ SCr ฯลฯ
  const KEYS = ['CrCl', 'G6PD', 'SCr', 'AST', 'ALT', 'Alg:', 'Dx:', 'RX:', 'AN', 'BW', 'Pg', 'A', 'S', 'K']
  const out: ScannedData = { drugs: [], labs: {} }
  for (const seg of text.split('|')) {
    const s = seg.trim()
    if (!s) continue
    const key = KEYS.find((k) => s.startsWith(k))
    if (!key) continue
    const bare = key.replace(':', '')
    let val: string | undefined = s.slice(bare.length).replace(/^:/, '').trim()
    if (val === '-' || val === '') val = undefined // "-" = ไม่มีข้อมูล
    switch (bare) {
      case 'AN': out.an = val; out.hn = val; break
      case 'RX': out.drugs = (val ?? '').split(',').map((x) => x.trim()).filter(Boolean).map((icode) => ({ icode })); break
      case 'A': out.age = num(val); break
      case 'S': out.sex = val === 'M' || val === 'F' ? val : undefined; break
      case 'BW': out.weight = num(val); break
      case 'CrCl': out.crcl = num(val); break
      case 'SCr': out.scr = num(val); break
      case 'K': if (num(val) !== undefined) out.labs!.k = num(val)!; break
      case 'AST': if (num(val) !== undefined) out.labs!.ast = num(val)!; break
      case 'ALT': if (num(val) !== undefined) out.labs!.alt = num(val)!; break
      case 'G6PD':
        // val undefined ("-") = ยังไม่เจาะ · มีคำว่า defic = พร่อง · อื่น ๆ = ปกติ
        if (val === undefined) { out.g6pd_tested = false }
        else { out.g6pd_tested = true; out.g6pd = /defic/i.test(val) }
        break
      case 'Alg': out.allergies = val ? val.split(',').map((x) => x.trim()).filter(Boolean) : undefined; break
      case 'Dx': out.diseases = val ? val.split(',').map((x) => x.trim()).filter(Boolean) : undefined; break
      case 'Pg': out.is_pregnant = val ? /^y/i.test(val) : undefined; break
    }
  }
  if (out.labs && Object.keys(out.labs).length === 0) delete out.labs
  return out
}

/** แยกค่าแล็บที่อาจมี @วันที่ เช่น "4.35@260413" → { n:4.35, date:"260413" } */
function labVal(v: string): { n?: number; date?: string } {
  const [valPart, datePart] = v.split('@')
  return { n: num(valPart), date: datePart || undefined }
}

/**
 * parse QR แบบ key-based (v2/v3) — ตัด field ว่าง, lab = ค่า@YYMMDD, จับด้วย prefix ไม่ใช่ตำแหน่ง
 * N=AN R:=ยา A=อายุ S=เพศ W=นน. C=CrCl Gf=GFR[stage] I=INR A1=HbA1c G=FBS O=AST L=ALT
 * Ab=Albumin Hb=Hb Nc=ANC Ec=AEC T=Plt K=K 6=G6PD D:=ICD10 P=ตั้งครรภ์
 * Y<count>:ตัวย่อ6ตัว = แพ้ยา (map เป็นกลุ่ม) · (v2 เดิม: Cr=SCr B=BUN M=Mg รองรับด้วย)
 */
function parseKeyedFields(text: string): ScannedData {
  // เรียง key ยาว/เฉพาะเจาะจงก่อน กัน Gf↔G, A1/Ab↔A, Cr↔C, Nc↔N ชนกัน
  // NB: A1 (HbA1c) จัดการแยกก่อน keys.find — เฉพาะเมื่อมีทศนิยม (กันชนอายุ 10-19 ที่เป็นจำนวนเต็ม)
  const KEYS = ['Gf', 'Ab', 'Cr', 'Nc', 'Ec', 'Hb', 'R:', 'D:', 'N', 'C', 'A', 'S', 'W', 'I', 'G', 'O', 'L', 'T', 'K', 'M', 'B', '6', 'P']
  // QR รายงานสถานะตั้งครรภ์เสมอ: มี P = ตั้งครรภ์/ให้นม · ไม่มี P = ไม่ตั้งครรภ์ (false ชัดเจน ไม่ต้องถามซ้ำ)
  const out: ScannedData = { drugs: [], labs: {}, labDates: {}, is_pregnant: false, is_lactating: false }
  const setLab = (key: string, raw: string) => {
    const { n, date } = labVal(raw)
    if (n !== undefined) { out.labs![key] = n; if (date) out.labDates![key] = date }
  }
  for (const seg of text.split('|')) {
    const s = seg.trim()
    if (!s) continue

    // แพ้ยา Y<count>:ABBR,ABBR,... (v3) หรือ Y:... (v2) — จัดการก่อน keys.find
    const ym = s.match(/^Y(\d*):(.*)$/)
    if (ym) {
      const items = ym[2].split(',').map((x) => x.trim().replace(/\*/g, '')).filter(Boolean)
      const count = ym[1] ? Number(ym[1]) : items.length
      out.allergy_count = count
      out.allergy_truncated = count > items.length
      // แต่ละตัวย่อ: ใส่ทั้งชื่อดิบ (match generic ตรง) + ชื่อกลุ่ม (match cross-react)
      const set = new Set<string>()
      for (const ab of items) {
        set.add(ab.toLowerCase())
        const m = mapAllergen(ab)
        if (m) set.add(m.name)
      }
      out.allergies = set.size ? [...set] : undefined
      continue
    }

    // HbA1c 'A1<เลขทศนิยม>' เช่น A18.2 = 8.2% — ต้องมีจุดทศนิยม (กันชนอายุ A16)
    const a1m = s.match(/^A1(\d*\.\d+)(?:@(\d{6}))?/)
    if (a1m) {
      out.labs!.hba1c = Number(a1m[1])
      if (a1m[2]) out.labDates!.hba1c = a1m[2]
      continue
    }

    const key = KEYS.find((k) => s.startsWith(k))
    if (!key) continue
    const bare = key.replace(':', '')
    const val = s.slice(bare.length).replace(/^:/, '').trim()
    switch (bare) {
      case 'N': out.an = val || undefined; out.hn = val || undefined; break
      case 'R': out.drugs = val.split(',').map((x) => x.trim()).filter(Boolean).map((icode) => ({ icode })); break
      case 'A': out.age = num(val); break
      case 'S': out.sex = val === 'M' || val === 'F' ? val : undefined; break
      case 'W': out.weight = num(val); break
      case 'C': { const { n, date } = labVal(val); out.crcl = n; if (date) out.labDates!.crcl = date; break }
      case 'Gf': {
        // "5[5]@260701" → gfr 5, stage 5, date · หรือ "27[3a]"
        const [raw, date] = val.split('@')
        const gm = raw.match(/^(\d+(?:\.\d+)?)(?:\[([0-9ab]+)\])?/i)
        if (gm) {
          out.gfr = Number(gm[1]); out.ckd_stage = gm[2]
          out.labs!.gfr = Number(gm[1]); if (date) out.labDates!.gfr = date
        }
        break
      }
      case 'Cr': { const { n, date } = labVal(val); out.scr = n; if (date) out.labDates!.scr = date; break }
      case 'I': { const { n, date } = labVal(val); out.inr = n; if (date) out.labDates!.inr = date; break }
      case 'G': setLab('fbs', val); break
      case 'O': setLab('ast', val); break
      case 'L': setLab('alt', val); break
      case 'Ab': setLab('albumin', val); break
      case 'Hb': setLab('hb', val); break
      case 'T': setLab('plt', val); break
      case 'K': setLab('k', val); break
      case 'Nc': setLab('anc', val); break
      case 'Ec': setLab('aec', val); break
      case 'M': setLab('mg', val); break
      case 'B': setLab('bun', val); break
      case '6': out.g6pd_tested = true; out.g6pd = /def|พร่อง|deficien/i.test(val); break
      case 'D': out.diseases = val ? val.split(',').map((x) => x.trim()).filter(Boolean) : undefined; break
      case 'P': out.is_pregnant = true; out.is_lactating = true; break // มี key = ตั้งครรภ์/ให้นม
    }
  }
  if (out.labs && Object.keys(out.labs).length === 0) delete out.labs
  if (out.labDates && Object.keys(out.labDates).length === 0) delete out.labDates
  return out
}

export function parseQrPayload(raw: string): ScannedData {
  let text = raw.trim()
  if (!text) throw new Error('ข้อมูล QR ว่าง')

  // ลืมสลับ layout เป็น EN → อักษรเป็นไทย: แปลงกลับถ้าผลลัพธ์เป็นรูปแบบ QR ที่รู้จัก
  if (hasThai(text)) {
    const fixed = fixThaiLayout(text)
    if (/(^|\|)(R:|RX:|Dx:|D:)/.test(fixed) || /^N\d/.test(fixed) || fixed.startsWith('{')) text = fixed
  }

  // v2/v3 (key สั้น) — ตรวจก่อน: มี segment ขึ้นต้น "R:" (รายการยา)
  if (/(^|\|)R:/.test(text)) {
    return parseKeyedFields(text)
  }

  // IPD 14-field เดิม (RX:/CrCl/Dx:/AN)
  if (/(^|\|)(RX:|CrCl|SCr|Dx:|Alg:|G6PD|AN[0-9])/i.test(text)) {
    return parseIpdFields(text)
  }

  // JSON
  if (text.startsWith('{')) {
    const obj = JSON.parse(text)
    return {
      hn: obj.hn,
      patient_name: obj.name ?? obj.patient_name,
      age: obj.age !== undefined ? Number(obj.age) : undefined,
      sex: obj.sex as 'M' | 'F' | undefined,
      weight: num(String(obj.wt ?? obj.weight ?? '')),
      crcl: num(String(obj.cr ?? obj.crcl ?? '')),
      scr: num(String(obj.scr ?? '')),
      allergies: Array.isArray(obj.allergies) ? obj.allergies : undefined,
      diseases: Array.isArray(obj.dx ?? obj.diseases) ? (obj.dx ?? obj.diseases) : undefined,
      is_pregnant: obj.is_pregnant ?? (obj.pg !== undefined ? /^y|^1|^t/i.test(String(obj.pg)) : undefined),
      is_lactating: obj.is_lactating,
      drugs: Array.isArray(obj.drugs)
        ? obj.drugs.map((d: { icode?: string; drug?: string; sig?: string; name?: string; drug_name?: string }) => ({
            icode: (d.icode ?? d.drug ?? '').toString(),
            sig: d.sig,
            drug_name: d.drug_name ?? d.name,
          })).filter((d: { icode: string }) => d.icode)
        : [],
    }
  }

  // Pipe-delimited (legacy positional: RXS|HN|Name|age|sex|icode:sig|...)
  // หมายเหตุ: ฉลาก รพ. แบบ prefix (RX:/CrCl/...) ถูกดักด้วย parseIpdFields ด้านบนแล้ว
  if (text.includes('|')) {
    const parts = text.split('|')
    const head = parts[0].toUpperCase().trim()
    let i = 0
    if (head === 'RXS') i = 1
    const hn = parts[i++]
    const name = parts[i++]
    const ageRaw = parts[i++]
    const sex = parts[i++]
    const drugs = parts.slice(i).filter(Boolean).map((s) => {
      const [icode, ...sigParts] = s.split(':')
      return { icode: icode.trim(), sig: sigParts.join(':').trim() || undefined }
    })
    return {
      hn: hn || undefined,
      patient_name: name || undefined,
      age: ageRaw ? Number(ageRaw) || undefined : undefined,
      sex: (sex === 'M' || sex === 'F') ? sex : undefined,
      drugs,
    }
  }

  // Comma/newline-separated icodes
  const drugs = text.split(/[,\n;]/).map((s) => s.trim()).filter(Boolean).map((s) => {
    const [icode, ...sigParts] = s.split(/\s+(.+)/)
    return { icode: icode.trim(), sig: sigParts.join(' ').trim() || undefined }
  })
  if (drugs.length === 0) throw new Error('ไม่พบรายการยาในข้อมูล')
  return { drugs }
}
