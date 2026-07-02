import { useState, useEffect } from 'react'
import { Scanner, type IDetectedBarcode } from '@yudiel/react-qr-scanner'
import { ScanLine, X, Type, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export interface ScannedData {
  hn?: string
  patient_name?: string
  age?: number
  sex?: 'M' | 'F'
  weight?: number
  /** CrCl/eGFR (mL/min) กรอกตรงจากฉลาก */
  egfr?: number
  scr?: number
  g6pd?: boolean
  is_pregnant?: boolean
  allergies?: string[]
  /** วินิจฉัย ICD-10 ดิบจากฉลาก (เช่น A090) — แสดงให้เภสัชกรเห็น ยังไม่ auto-map เป็น disease */
  dx?: string
  /** ค่าแลบอื่น ๆ ที่ติดมากับฉลาก (key = param เช่น k/ast/alt) */
  labs?: Record<string, number>
  drugs: { icode: string; sig?: string; drug_name?: string }[]
}

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  onScan: (data: ScannedData) => void
}

// กล้องหลัง + ความละเอียดสูง + โฟกัสต่อเนื่อง → อ่าน QR แน่น ๆ (147 ตัว) บนมือถือได้ไวและแม่นขึ้น
const SCAN_CONSTRAINTS: MediaTrackConstraints = {
  facingMode: 'environment',
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
                sound
                styles={{ container: { width: '100%', height: '100%' } }}
              />
              <div className="absolute inset-8 border-4 border-emerald-400/80 rounded-2xl pointer-events-none animate-pulse" />
            </div>
            <p className="text-xs text-center text-muted-foreground p-3">เล็ง QR ให้อยู่ในกรอบสีเขียว — สแกนได้หลายสติ๊กเกอร์ต่อเนื่อง</p>
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
 * รูปแบบ 3 — บรรทัด/comma (icodes อย่างเดียว):
 *   CEFTRX, AMOX, PARA
 */
export function parseQrPayload(raw: string): ScannedData {
  const text = raw.trim()
  if (!text) throw new Error('ข้อมูล QR ว่าง')

  // JSON
  if (text.startsWith('{')) {
    const obj = JSON.parse(text)
    return {
      hn: obj.hn,
      patient_name: obj.name ?? obj.patient_name,
      age: obj.age !== undefined ? Number(obj.age) : undefined,
      sex: obj.sex as 'M' | 'F' | undefined,
      drugs: Array.isArray(obj.drugs)
        ? obj.drugs.map((d: { icode?: string; drug?: string; sig?: string; name?: string; drug_name?: string }) => ({
            icode: (d.icode ?? d.drug ?? '').toString(),
            sig: d.sig,
            drug_name: d.drug_name ?? d.name,
          })).filter((d: { icode: string }) => d.icode)
        : [],
    }
  }

  // Pipe-delimited
  if (text.includes('|')) {
    const parts = text.split('|')

    // รูปแบบฉลาก รพ. (prefix-tagged) — ตรวจจากการมี segment ขึ้นต้น "RX:"
    //   AN580007583|RX:1000011,1000054|A59|SF|BW61|CrCl80|SCr0.73|K4.59|AST42|ALT67|G6PD-|Alg:-|Dx:A090|PgN
    if (parts.some((p) => /^\s*RX:/i.test(p))) {
      return parseHospitalSticker(parts)
    }

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

/**
 * Parse ฉลากยา รพ. — pipe-delimited แบบติด prefix (อ่านตาม tag ไม่ยึดตำแหน่ง):
 *   AN580007583 | RX:icode,icode | A59 | SF | BW61 | CrCl80 | SCr0.73 |
 *   K4.59 | AST42 | ALT67 | G6PD- | Alg:- | Dx:A090 | PgN
 *
 * - RX:   → รายการ icode ยา (คั่นด้วย comma)
 * - AN../HN.. → เลขผู้ป่วย   A59 → อายุ   SF/SM → เพศ   BW61 → น้ำหนัก
 * - CrCl → eGFR   SCr → serum Cr   G6PD-/+ → G6PD   Alg: → แพ้ยา ("-" = ไม่มี)
 * - Dx:  → ICD-10   Pg N/Y → ตั้งครรภ์   token อื่น เช่น K/AST/ALT → เก็บเป็น lab
 */
function parseHospitalSticker(parts: string[]): ScannedData {
  const out: ScannedData = { drugs: [], labs: {} }
  const num = (s: string) => {
    const n = Number(s.replace(/[^\d.]/g, ''))
    return Number.isFinite(n) ? n : undefined
  }

  for (const raw of parts) {
    const seg = raw.trim()
    if (!seg) continue
    const up = seg.toUpperCase()

    if (up.startsWith('RX:')) {
      out.drugs = seg.slice(3).split(/[,\s]+/).map((s) => s.trim()).filter(Boolean).map((icode) => ({ icode }))
    } else if (up.startsWith('ALG:')) {
      const rest = seg.slice(4).trim()
      out.allergies = rest && rest !== '-' ? rest.split(/[,;]+/).map((s) => s.trim()).filter(Boolean) : []
    } else if (up.startsWith('DX:')) {
      out.dx = seg.slice(3).trim() || undefined
    } else if (/^(AN|HN)[\w-]+$/i.test(seg)) {
      out.hn = seg
    } else if (/^A\d+$/i.test(seg)) {
      out.age = num(seg)
    } else if (/^S[MF]$/i.test(seg)) {
      out.sex = up[1] as 'M' | 'F'
    } else if (/^BW[\d.]+$/i.test(seg)) {
      out.weight = num(seg)
    } else if (up.startsWith('CRCL')) {
      out.egfr = num(seg)
    } else if (up.startsWith('SCR')) {
      out.scr = num(seg)
      if (out.scr !== undefined) out.labs!.scr = out.scr
    } else if (up.startsWith('G6PD')) {
      const v = seg.slice(4).trim().toLowerCase()
      if (['+', 'def', 'pos', 'positive', 'y', 'yes'].includes(v)) out.g6pd = true
      else if (['-', 'neg', 'normal', 'n', 'no'].includes(v)) out.g6pd = false
    } else if (up.startsWith('PG')) {
      const v = seg.slice(2).trim().toLowerCase()
      if (['y', 'yes', '+'].includes(v)) out.is_pregnant = true
      else if (['n', 'no', '-'].includes(v)) out.is_pregnant = false
    } else {
      // lab ทั่วไป เช่น K4.59, AST42, ALT67, NA140
      const m = seg.match(/^([A-Za-z][A-Za-z0-9]*?)([\d.]+)$/)
      if (m) out.labs![m[1].toLowerCase()] = Number(m[2])
    }
  }
  return out
}
