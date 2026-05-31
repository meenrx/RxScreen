import { useState, useMemo, useEffect } from 'react'
import { Plus, Pencil, Trash2, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { useDrugs, useSaveDrug, useDelete } from '@/features/catalog/hooks'
import type { DrugMaster } from '@/types/drug'

// ====== ตัวเลือก dropdown / datalist (ขยายได้เรื่อยๆ) ======
const DOSAGE_FORM_OPTIONS = [
  'TABLETS', 'CAPSULES', 'SYRUPS', 'SUSPENSIONS', 'POWDERS',
  'INJECTIONS', 'AMPOULE', 'VIAL', 'INTRAVENOUS SOLUTION', 'INTRAVENOUS SOLOTION',
  'SOLUTIONS', 'LOTION', 'CREAM', 'OINTMENT', 'GEL',
  'EYE DROPS', 'EAR DROPS', 'NASAL SPRAY', 'INHALER', 'NEBULIZER',
  'SUPPOSITORY', 'PATCH', 'LOZENGES', 'OTHER',
]

const PACK_UNIT_OPTIONS = [
  'เม็ด', 'แคปซูล', 'ซอง', 'ขวด', 'ขวด (60 ml.)', 'ขวด (240 ml.)',
  'หลอด', 'Amp.', 'Amp. (1 ml.)', 'Vial', 'ถุง', 'ถุง (500 ml.)', 'ถุง (1000 ml.)',
  'ครีม (15 g.)', 'ครีม (5 g.)', 'แผง', 'กล่อง', 'กระป๋อง',
]

const DOSE_UNIT_OPTIONS = [
  'tab', 'cap', 'ml', 'mg', 'g', 'mcg', 'unit', 'IU',
  'drop', 'puff', 'spray', 'patch', 'supp.',
]

const DRUG_CATEGORY_OPTIONS = [
  'ANTIHISTAMINES', 'ANTIBIOTICS', 'PENICILLINS', 'CEPHALOSPORINS', 'MACROLIDES',
  'ANALGESIC AND', 'ANTI-INFLAMMATORY', 'ANTIPYRETIC',
  'ANTIHYPERTENSIVE', 'ACEI', 'ARB', 'BETA-BLOCKER', 'CCB', 'DIURETICS',
  'ANTIDIABETIC', 'INSULIN', 'STATIN', 'ANTICOAGULANT', 'ANTIPLATELET',
  'PPI', 'H2-BLOCKER', 'ANTACID', 'ANTIEMETIC', 'LAXATIVE',
  'BRONCHODILATOR', 'CORTICOSTEROID', 'ANXIOLYTICS , SEDATIVE',
  'ANTIPSYCHOTIC', 'ANTIDEPRESSANT', 'ANTIEPILEPTIC',
  'CARDIAC STIMULANTS', 'ANTIDOTE', 'ANTITUSSIVE', 'EXPECTORANT',
  'ANTIMALARIALS', 'ANTHELMINTICS', 'ANTIVIRAL', 'ANTIFUNGAL',
  'GASTROINTESTINAL DRUG', 'ANTISPASMODICS AND', 'ANTISEPTIC',
  'mineral supplements', 'VITAMIN', 'ELECTROLYTE',
  'ANTI-GUOT PREPARATION', 'SYSTEMIC', 'sulfonamile',
  'INTRAVENOUS SOLUTION', 'HORMONE', 'CONTRACEPTIVE',
]

const ALLERGEN_OPTIONS = [
  'Penicillin', 'Beta-lactam', 'Cephalosporin', 'Carbapenem', 'Sulfa', 'Sulfonamide',
  'NSAID', 'Aspirin', 'Macrolide', 'Quinolone', 'Tetracycline',
  'Opioid', 'Codeine', 'Morphine', 'Latex', 'Iodine', 'Egg', 'Soy',
]

// Multi-select picker over DRUG_MASTER. Stores the selection as a list of
// icodes (stable across renames). Renders selected drugs as chips and a
// type-to-search input that adds the next pick on click.
function LasaPicker({
  drugs,
  value,
  onChange,
  excludeIcode,
  placeholder = 'ค้นชื่อยา/icode เพื่อเพิ่ม...',
}: {
  drugs: DrugMaster[]
  value: string[] | undefined
  onChange: (next: string[]) => void
  /** ห้ามเลือกตัวเองเป็น LASA ของตัวเอง */
  excludeIcode?: string
  placeholder?: string
}) {
  const [q, setQ] = useState('')
  const [show, setShow] = useState(false)

  const selected = useMemo(
    () =>
      (value ?? []).map(
        (icode) =>
          drugs.find((d) => d.icode === icode) ??
          // legacy: free-text name (จากสมัยก่อน) — โชว์ตัวอักษรไป
          ({ icode, drug_name: icode } as DrugMaster),
      ),
    [value, drugs],
  )

  const suggestions = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return []
    const taken = new Set(value ?? [])
    return drugs
      .filter((d) => d.icode !== excludeIcode && !taken.has(d.icode))
      .filter(
        (d) =>
          d.drug_name.toLowerCase().includes(term) ||
          d.generic_name?.toLowerCase().includes(term) ||
          d.icode.toLowerCase().includes(term),
      )
      .slice(0, 10)
  }, [q, drugs, value, excludeIcode])

  function add(d: DrugMaster) {
    onChange([...(value ?? []), d.icode])
    setQ('')
    setShow(false)
  }
  function remove(icode: string) {
    onChange((value ?? []).filter((x) => x !== icode))
  }

  return (
    <div className="space-y-1">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selected.map((d) => (
            <span
              key={d.icode}
              className="inline-flex items-center gap-1 rounded-md bg-amber-100 dark:bg-amber-900/40 border border-amber-300 dark:border-amber-700 px-2 py-0.5 text-xs"
            >
              <span className="font-medium">{d.drug_name}</span>
              <span className="font-mono text-[10px] opacity-60">
                [{d.icode}]
              </span>
              <button
                type="button"
                onClick={() => remove(d.icode)}
                className="ml-0.5 -mr-0.5 hover:text-red-600"
                aria-label="ลบ"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <Input
          className="h-9"
          value={q}
          placeholder={placeholder}
          onChange={(e) => {
            setQ(e.target.value)
            setShow(true)
          }}
          onFocus={() => setShow(true)}
          onBlur={() => setTimeout(() => setShow(false), 150)}
        />
        {show && suggestions.length > 0 && (
          <ul className="absolute z-30 left-0 right-0 mt-1 max-h-64 overflow-y-auto rounded-md border bg-popover shadow-lg">
            {suggestions.map((d) => (
              <li key={d.icode}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => add(d)}
                  className="w-full text-left px-3 py-1.5 hover:bg-accent text-sm flex items-center gap-2"
                >
                  <span className="font-mono text-[10px] opacity-60 w-16 shrink-0">
                    {d.icode}
                  </span>
                  <span className="flex-1 truncate">{d.drug_name}</span>
                  {d.generic_name && (
                    <span className="text-xs opacity-60 truncate max-w-[40%]">
                      {d.generic_name}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

// Comma-separated list input that owns its own raw text so the user can
// type a "," without it being immediately swallowed by split/trim/filter
// on every keystroke. We normalize (trim + drop blanks) only on blur.
function CsvListInput({
  value,
  onChange,
  placeholder,
  list,
  className,
}: {
  value: string[] | undefined
  onChange: (next: string[]) => void
  placeholder?: string
  list?: string
  className?: string
}) {
  const [text, setText] = useState<string>(value?.join(', ') ?? '')
  // Resync when the parent value changes from outside (e.g. selecting a
  // different drug in the table) — and only when it actually differs from
  // what the user has typed, so we don't fight their cursor on every keystroke.
  useEffect(() => {
    const next = value?.join(', ') ?? ''
    const normalized = text.split(',').map((s) => s.trim()).filter(Boolean).join(', ')
    if (next !== normalized) setText(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])
  return (
    <Input
      list={list}
      className={className ?? 'h-9'}
      value={text}
      placeholder={placeholder}
      onChange={(e) => setText(e.target.value)}
      onBlur={() =>
        onChange(text.split(',').map((s) => s.trim()).filter(Boolean))
      }
    />
  )
}

// ===== Resizable column widths (persisted in localStorage) =====
// "name" คอลัมน์ flex รับพื้นที่เหลือ → ชื่อยาเต็มสุดเสมอ
type ColKey = 'action' | 'icode' | 'account' | 'category' | 'price' | 'tags'

const DEFAULT_WIDTHS: Record<ColKey, number> = {
  action: 68, icode: 80, account: 52, category: 200, price: 90, tags: 120,
}
const STORAGE_KEY = 'drugMaster.colWidths.v5'
const MIN_WIDTH = 40

function useColWidths() {
  const [widths, setWidths] = useState<Record<ColKey, number>>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) return { ...DEFAULT_WIDTHS, ...JSON.parse(raw) }
    } catch { /* ignore */ }
    return DEFAULT_WIDTHS
  })

  function setWidth(key: ColKey, w: number) {
    setWidths((prev) => {
      const next = { ...prev, [key]: Math.max(MIN_WIDTH, Math.round(w)) }
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }

  function reset() {
    setWidths(DEFAULT_WIDTHS)
    try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
  }

  return { widths, setWidth, reset }
}

function ResizeHandle({ width, onResize }: { width: number; onResize: (w: number) => void }) {
  function onMouseDown(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startW = width
    function onMove(ev: MouseEvent) {
      onResize(startW + (ev.clientX - startX))
    }
    function onUp() {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }
  return (
    <span
      role="separator"
      aria-orientation="vertical"
      onMouseDown={onMouseDown}
      className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-cyan-400/60 active:bg-cyan-500/80 transition-colors z-10"
      title="ลากเพื่อปรับขนาด · จำค่าอัตโนมัติ"
    />
  )
}

export function DrugMasterAdmin() {
  const { data = [], isLoading } = useDrugs()
  const save = useSaveDrug()
  const del = useDelete('drug')
  const [search, setSearch] = useState('')
  const [edit, setEdit] = useState<DrugMaster | null>(null)
  const [open, setOpen] = useState(false)

  const filtered = useMemo(() => {
    const s = search.toLowerCase()
    return data.filter(
      (d) =>
        d.icode.toLowerCase().includes(s)
        || d.drug_name.toLowerCase().includes(s)
        || (d.generic_name?.toLowerCase().includes(s) ?? false)
        || (d.drug_class?.toLowerCase().includes(s) ?? false)
        || (d.drug_category?.toLowerCase().includes(s) ?? false)
        || (d.therapeutic?.toLowerCase().includes(s) ?? false),
    )
  }, [data, search])

  const { widths, setWidth, reset: resetWidths } = useColWidths()

  function openNew() {
    setEdit({ icode: '', drug_name: '', active: true })
    setOpen(true)
  }
  function openEdit(d: DrugMaster) {
    setEdit({ ...d })
    setOpen(true)
  }
  async function handleSave() {
    if (!edit) return
    await save.mutateAsync(edit)
    setOpen(false)
  }

  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input placeholder="ค้นหา icode/ชื่อยา/generic/หมวด/ข้อบ่งใช้" className="pl-8 h-10" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Button variant="outline" size="sm" onClick={resetWidths} title="คืนค่าความกว้างคอลัมน์เริ่มต้น">รีเซ็ตคอลัมน์</Button>
          <Button onClick={openNew}><Plus className="size-4" /> เพิ่มยา</Button>
        </div>
        <div className="text-xs text-muted-foreground">{filtered.length} รายการ {isLoading && '(กำลังโหลด...)'} · ลากเส้นแบ่งคอลัมน์เพื่อปรับขนาด</div>

        <div className="rounded-lg border">
          <Table style={{ tableLayout: 'fixed' }}>
            <TableHeader className="bg-muted/50 sticky top-0">
              <TableRow className="text-sm">
                <TableHead style={{ width: widths.icode }} className="relative">
                  icode
                  <ResizeHandle width={widths.icode} onResize={(w) => setWidth('icode', w)} />
                </TableHead>
                <TableHead className="relative">ยา</TableHead>
                <TableHead style={{ width: widths.account }} className="relative text-center">
                  บัญชี
                  <ResizeHandle width={widths.account} onResize={(w) => setWidth('account', w)} />
                </TableHead>
                <TableHead style={{ width: widths.category }} className="relative">
                  หมวด · ข้อบ่งใช้
                  <ResizeHandle width={widths.category} onResize={(w) => setWidth('category', w)} />
                </TableHead>
                <TableHead style={{ width: widths.price }} className="relative text-right">
                  ทุน / ขาย
                  <ResizeHandle width={widths.price} onResize={(w) => setWidth('price', w)} />
                </TableHead>
                <TableHead style={{ width: widths.tags }} className="relative">
                  Tags
                </TableHead>
                <TableHead style={{ width: widths.action }} className="relative text-center">
                  จัดการ
                  <ResizeHandle width={widths.action} onResize={(w) => setWidth('action', w)} />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((d) => (
                <TableRow key={d.id}>
                  <TableCell style={{ width: widths.icode }} className="font-mono text-sm py-2 truncate">{d.icode}</TableCell>
                  <TableCell className="py-2 overflow-hidden">
                    <div className="font-semibold text-base leading-tight truncate" title={d.drug_name}>{d.drug_name}</div>
                    {d.generic_name && <div className="text-xs text-muted-foreground leading-tight mt-0.5 truncate" title={d.generic_name}>{d.generic_name}</div>}
                    <div className="text-xs text-muted-foreground leading-tight mt-0.5 truncate">
                      {[d.strength, d.dosage_form ?? d.form, d.pack_unit ?? d.unit].filter(Boolean).join(' · ') || '-'}
                    </div>
                  </TableCell>
                  <TableCell style={{ width: widths.account }} className="text-center py-2 overflow-hidden">
                    {d.drug_account ? <Badge variant="outline" className="text-xs px-2">{d.drug_account}</Badge> : <span className="text-muted-foreground">-</span>}
                  </TableCell>
                  <TableCell style={{ width: widths.category }} className="py-2 overflow-hidden">
                    {(d.drug_category ?? d.drug_class) && <div className="text-sm font-medium leading-tight truncate" title={d.drug_category ?? d.drug_class}>{d.drug_category ?? d.drug_class}</div>}
                    {d.therapeutic && <div className="text-xs text-muted-foreground leading-snug line-clamp-2 mt-0.5" title={d.therapeutic}>{d.therapeutic}</div>}
                  </TableCell>
                  <TableCell style={{ width: widths.price }} className="text-right tabular-nums py-2 overflow-hidden">
                    {d.unit_cost != null && <div className="text-xs text-muted-foreground leading-tight">฿{d.unit_cost.toLocaleString()}</div>}
                    {d.unit_price != null && <div className="font-semibold text-sm leading-tight">฿{d.unit_price.toLocaleString()}</div>}
                    {d.unit_cost == null && d.unit_price == null && <span className="text-muted-foreground">-</span>}
                  </TableCell>
                  <TableCell style={{ width: widths.tags }} className="py-2 overflow-hidden">
                    <div className="flex flex-wrap gap-0.5">
                      {d.is_HAD && <span className="had-badge text-[10px] px-1.5">HAD</span>}
                      {d.lasa_with && d.lasa_with.length > 0 && <span className="lasa-badge text-[10px] px-1.5">LASA</span>}
                      {d.pregnancy_category && <Badge variant={d.pregnancy_category === 'X' ? 'red' : d.pregnancy_category === 'D' ? 'orange' : 'yellow'} className="text-[10px] px-1.5">P:{d.pregnancy_category}</Badge>}
                      {d.beers_avoid_elderly && <Badge variant="orange" className="text-[10px] px-1.5">Beers</Badge>}
                      {d.g6pd_unsafe && <Badge variant="red" className="text-[10px] px-1.5">G6PD</Badge>}
                    </div>
                  </TableCell>
                  <TableCell style={{ width: widths.action }} className="py-2 overflow-hidden">
                    <div className="flex gap-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => openEdit(d)}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => { if (confirm('ลบยานี้?')) del.mutate(d.id!) }}>
                        <Trash2 className="size-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{edit?.id ? 'แก้ไขยา' : 'เพิ่มยาใหม่'}</DialogTitle>
          </DialogHeader>
          {edit && (
            <div className="space-y-3 text-sm">
              {/* datalist สำหรับ autocomplete (allow free text) */}
              <datalist id="dl-pack-unit">
                {PACK_UNIT_OPTIONS.map((v) => <option key={v} value={v} />)}
              </datalist>
              <datalist id="dl-dose-unit">
                {DOSE_UNIT_OPTIONS.map((v) => <option key={v} value={v} />)}
              </datalist>
              <datalist id="dl-drug-category">
                {DRUG_CATEGORY_OPTIONS.map((v) => <option key={v} value={v} />)}
              </datalist>
              <datalist id="dl-allergens">
                {ALLERGEN_OPTIONS.map((v) => <option key={v} value={v} />)}
              </datalist>

              {/* Row 1: ข้อมูลหลัก */}
              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-2"><Label className="mb-1 text-xs">icode *</Label><Input className="h-9" value={edit.icode} onChange={(e) => setEdit({ ...edit, icode: e.target.value })} placeholder="1000002" /></div>
                <div className="col-span-4"><Label className="mb-1 text-xs">ชื่อยา *</Label><Input className="h-9" value={edit.drug_name} onChange={(e) => setEdit({ ...edit, drug_name: e.target.value })} placeholder="CPM tab. 4 mg." /></div>
                <div className="col-span-3"><Label className="mb-1 text-xs">Generic</Label><Input className="h-9" value={edit.generic_name ?? ''} onChange={(e) => setEdit({ ...edit, generic_name: e.target.value })} placeholder="chlorpheniramine" /></div>
                <div className="col-span-2"><Label className="mb-1 text-xs">Strength</Label><Input className="h-9" value={edit.strength ?? ''} onChange={(e) => setEdit({ ...edit, strength: e.target.value })} placeholder="4 mg." /></div>
                <div className="col-span-1">
                  <Label className="mb-1 text-xs">บัญชี</Label>
                  <Select value={edit.drug_account ?? '_'} onValueChange={(v) => setEdit({ ...edit, drug_account: v === '_' ? undefined : v })}>
                    <SelectTrigger className="w-full h-9 text-center"><SelectValue placeholder="-" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_">-</SelectItem>
                      <SelectItem value="ก">ก</SelectItem>
                      <SelectItem value="ข">ข</SelectItem>
                      <SelectItem value="ค">ค</SelectItem>
                      <SelectItem value="ง">ง</SelectItem>
                      <SelectItem value="จ">จ</SelectItem>
                      <SelectItem value="ฉ">ฉ</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Row 2: รูปแบบยา + ราคา + pregnancy */}
              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-2">
                  <Label className="mb-1 text-xs">Dosage form</Label>
                  <Select value={edit.dosage_form ?? edit.form ?? '_'} onValueChange={(v) => setEdit({ ...edit, dosage_form: v === '_' ? undefined : v, form: v === '_' ? undefined : v })}>
                    <SelectTrigger className="w-full h-9"><SelectValue placeholder="-" /></SelectTrigger>
                    <SelectContent className="max-h-72">
                      <SelectItem value="_">-</SelectItem>
                      {DOSAGE_FORM_OPTIONS.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2"><Label className="mb-1 text-xs">หน่วยจ่าย</Label><Input list="dl-pack-unit" className="h-9" value={edit.pack_unit ?? ''} onChange={(e) => setEdit({ ...edit, pack_unit: e.target.value })} placeholder="เช่น เม็ด, ขวด (60 ml.)" /></div>
                <div className="col-span-1"><Label className="mb-1 text-xs">Unit (dose)</Label><Input list="dl-dose-unit" className="h-9" value={edit.unit ?? ''} onChange={(e) => setEdit({ ...edit, unit: e.target.value })} placeholder="tab" /></div>
                <div className="col-span-3"><Label className="mb-1 text-xs">หมวดยา (drug_category)</Label><Input list="dl-drug-category" className="h-9" value={edit.drug_category ?? edit.drug_class ?? ''} onChange={(e) => setEdit({ ...edit, drug_category: e.target.value, drug_class: e.target.value })} placeholder="เช่น ANTIHISTAMINES" /></div>
                <div className="col-span-2 grid grid-cols-2 gap-1">
                  <div><Label className="mb-1 text-xs">ราคาทุน</Label><Input className="h-9 text-right tabular-nums" type="number" step="0.01" value={edit.unit_cost ?? ''} onChange={(e) => setEdit({ ...edit, unit_cost: e.target.value === '' ? undefined : Number(e.target.value) })} placeholder="0.05" /></div>
                  <div><Label className="mb-1 text-xs">ราคาขาย</Label><Input className="h-9 text-right tabular-nums" type="number" step="0.01" value={edit.unit_price ?? ''} onChange={(e) => setEdit({ ...edit, unit_price: e.target.value === '' ? undefined : Number(e.target.value) })} placeholder="0.5" /></div>
                </div>
                <div className="col-span-2">
                  <Label className="mb-1 text-xs">Pregnancy</Label>
                  <Select value={edit.pregnancy_category ?? '_'} onValueChange={(v) => setEdit({ ...edit, pregnancy_category: (v === '_' ? undefined : v) as DrugMaster['pregnancy_category'] })}>
                    <SelectTrigger className="w-full h-9"><SelectValue placeholder="-" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_">-</SelectItem>
                      <SelectItem value="A">A (ปลอดภัย)</SelectItem>
                      <SelectItem value="B">B (ค่อนข้างปลอดภัย)</SelectItem>
                      <SelectItem value="C">C (ระวัง)</SelectItem>
                      <SelectItem value="D">D (เสี่ยง)</SelectItem>
                      <SelectItem value="X">X (ห้ามใช้)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Row 3: ข้อบ่งใช้ */}
              <div>
                <Label className="mb-1 text-xs">ข้อบ่งใช้ (Therapeutic)</Label>
                <Textarea rows={2} value={edit.therapeutic ?? ''} onChange={(e) => setEdit({ ...edit, therapeutic: e.target.value })} placeholder="ตัวอย่าง: ยาแก้แพ้ ลดน้ำมูก แก้คัน ลมพิษ" />
              </div>

              {/* Row 4: Safety chips */}
              <div className="flex flex-wrap gap-1.5 items-center">
                <span className="text-xs text-muted-foreground mr-1">Safety:</span>
                <ToggleChip on={edit.is_HAD} onChange={(v) => setEdit({ ...edit, is_HAD: v })}>🔴 HAD</ToggleChip>
                <ToggleChip on={edit.beers_avoid_elderly} onChange={(v) => setEdit({ ...edit, beers_avoid_elderly: v })}>👴 Beers</ToggleChip>
                <ToggleChip on={edit.g6pd_unsafe} onChange={(v) => setEdit({ ...edit, g6pd_unsafe: v })}>🩸 G6PD</ToggleChip>
                <ToggleChip on={edit.lactation_safe === false} onChange={(v) => setEdit({ ...edit, lactation_safe: v ? false : undefined })}>🤱 ห้ามนมบุตร</ToggleChip>
                <ToggleChip on={edit.requires_ibw} onChange={(v) => setEdit({ ...edit, requires_ibw: v })}>💪 IBW</ToggleChip>
                <ToggleChip on={edit.active !== false} onChange={(v) => setEdit({ ...edit, active: v })}>✅ Active</ToggleChip>
              </div>

              {/* Row 5: LASA + Allergens + Cross-reactivity */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="mb-1 text-xs">⚠️ LASA pairs (เลือกจากรายการยา)</Label>
                  <LasaPicker
                    drugs={data}
                    value={edit.lasa_with}
                    excludeIcode={edit.icode}
                    onChange={(v) => setEdit({ ...edit, lasa_with: v })}
                  />
                </div>
                <div>
                  <Label className="mb-1 text-xs">
                    🥚 สารกระตุ้นแพ้ในยานี้ (คั่นด้วย ,)
                  </Label>
                  <CsvListInput
                    list="dl-allergens"
                    value={edit.allergens}
                    onChange={(v) => setEdit({ ...edit, allergens: v })}
                    placeholder="เช่น egg, peanut, sulfa — ถ้าผู้ป่วยแพ้สิ่งเหล่านี้ ห้ามจ่ายยานี้"
                  />
                </div>
                <div>
                  <Label className="mb-1 text-xs">
                    🔁 ระวังแพ้ข้าม (กลุ่ม/class คั่นด้วย ,)
                  </Label>
                  <CsvListInput
                    list="dl-allergens"
                    value={edit.cross_react}
                    onChange={(v) => setEdit({ ...edit, cross_react: v })}
                    placeholder="เช่น Penicillin, Sulfa — กลุ่มยาที่ผู้แพ้กลุ่มนี้อาจกระตุ้นได้"
                  />
                </div>
              </div>

              {/* Row 5.5: คำค้น / ชื่อเรียกอื่น (trade names) */}
              <div>
                <Label className="mb-1 text-xs">🔎 คำค้น / ชื่อเรียกอื่น (คั่นด้วย ,)</Label>
                <CsvListInput
                  value={edit.search_keywords}
                  onChange={(v) => setEdit({ ...edit, search_keywords: v })}
                  placeholder="ตัวอย่าง: Atarax, ยาแก้คัน — พิมพ์คำเหล่านี้แล้วจะเจอยาตัวนี้ตอนคัดกรอง"
                />
              </div>

              {/* Row 6: Interactions — placeholder บอกรูปแบบที่ควรกรอก */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="mb-1 text-xs">🍽 Food interaction (เตือนทุกครั้งที่จ่าย)</Label>
                  <Input className="h-9" value={edit.food_interaction ?? ''} onChange={(e) => setEdit({ ...edit, food_interaction: e.target.value })} placeholder="ตัวอย่าง: เลี่ยง grapefruit · กินผักใบเขียวสม่ำเสมอ" />
                </div>
                <div>
                  <Label className="mb-1 text-xs">🧪 Lab interference</Label>
                  <Input className="h-9" value={edit.lab_interference ?? ''} onChange={(e) => setEdit({ ...edit, lab_interference: e.target.value })} placeholder="ตัวอย่าง: Phenytoin → false ↓ Free T4" />
                </div>
                <div>
                  <Label className="mb-1 text-xs">🚬 Smoking interaction (ระบบบังคับถามผู้ป่วยอัตโนมัติ)</Label>
                  <Input className="h-9" value={edit.smoking_interaction ?? ''} onChange={(e) => setEdit({ ...edit, smoking_interaction: e.target.value })} placeholder="ตัวอย่าง: ผู้สูบบุหรี่ต้องเพิ่ม dose 50% (CYP1A2 induction)" />
                </div>
                <div>
                  <Label className="mb-1 text-xs">🍺 Alcohol interaction (ระบบบังคับถามผู้ป่วยอัตโนมัติ)</Label>
                  <Input className="h-9" value={edit.alcohol_interaction ?? ''} onChange={(e) => setEdit({ ...edit, alcohol_interaction: e.target.value })} placeholder="ตัวอย่าง: เสี่ยง hypoglycemia · disulfiram-like reaction" />
                </div>
              </div>

              {/* Row 7: Note */}
              <div>
                <Label className="mb-1 text-xs">Note (โน้ตภายใน)</Label>
                <Input className="h-9" value={edit.note ?? ''} onChange={(e) => setEdit({ ...edit, note: e.target.value })} placeholder="ตัวอย่าง: หมดสต๊อก รพ. ตั้งแต่ 1 ม.ค. 68" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>ยกเลิก</Button>
            <Button onClick={handleSave} disabled={save.isPending || !edit?.icode || !edit?.drug_name}>{save.isPending ? 'กำลังบันทึก...' : 'บันทึก'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

function ToggleChip({ on, onChange, children }: { on?: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className={`px-2.5 py-1 rounded-full border text-xs transition ${on ? 'bg-red-50 border-red-300 text-red-900 font-medium' : 'hover:bg-accent'}`}
    >
      {on && '✓ '}{children}
    </button>
  )
}
