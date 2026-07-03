import { useState, useMemo, useRef, useEffect } from 'react'
import { Plus, Trash2, Search, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { listLabRulesForDrug } from '@/features/catalog/api'
import { cn } from '@/lib/utils'
import { fixThaiLayout, hasThai } from '@/lib/thaiKeyboard'
import type { DrugMaster, LabRule } from '@/types/drug'
import type { DrugEntry } from '@/types/screening'

interface Props {
  drugs: DrugEntry[]
  onChange: (drugs: DrugEntry[]) => void
  drugMasters?: DrugMaster[]
  /** เมื่อสแกน QR ด้วยเครื่องสแกน (คีย์บอร์ด) แล้ว payload เข้ามาในช่องนี้ — ส่ง raw string ไปประมวลผลเป็น QR */
  onQrPayload?: (raw: string) => void
}

const MAX_SUGGESTIONS = 12

/** ข้อความนี้เป็น payload QR (RXS) ไม่ใช่ชื่อยา? — จับจาก marker ของทุก format */
function looksLikeQr(s: string): boolean {
  const t = s.trim()
  if (t.length < 8) return false
  return (
    /(^|\|)R:/.test(t)                       // v2/v3 drug list
    || /(^|\|)RX:/.test(t)                    // IPD เดิม
    || (/^N\d{5,}/.test(t) && t.includes('|'))  // ขึ้นต้น N+AN แล้วมี pipe
    || (t.includes('|') && /(Gf|CrCl|SCr|Dx:|D:|@\d{6})/.test(t))
    || (t.startsWith('{') && t.includes('drug'))
  )
}

/** คืน payload QR (แปลงจากไทยให้แล้วถ้าลืมสลับ layout) หรือ null ถ้าไม่ใช่ QR */
function toQr(v: string): string | null {
  const t = v.trim()
  if (looksLikeQr(t)) return t
  if (hasThai(t)) { const f = fixThaiLayout(t); if (looksLikeQr(f)) return f }  // ลืมสลับเป็น EN
  return null
}

export function DrugInput({ drugs, onChange, drugMasters = [], onQrPayload }: Props) {
  const [query, setQuery] = useState('')
  const [activeIdx, setActiveIdx] = useState(0)
  const [showList, setShowList] = useState(false)
  const [adding, setAdding] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const qrTimer = useRef<number | null>(null)

  // โฟกัสช่องนี้เสมอ (บนคอม เครื่องสแกน = คีย์บอร์ด → ข้อมูลจะเข้าช่องนี้)
  useEffect(() => { inputRef.current?.focus() }, [])
  useEffect(() => () => { if (qrTimer.current) clearTimeout(qrTimer.current) }, [])

  /** ตรวจ + ประมวลผล payload QR ถ้าใช่ (แปลงจากไทยให้ด้วย) — คืน true = จัดการแล้ว */
  function maybeHandleQr(value: string): boolean {
    const qr = onQrPayload ? toQr(value) : null
    if (onQrPayload && qr) {
      if (qrTimer.current) { clearTimeout(qrTimer.current); qrTimer.current = null }
      onQrPayload(qr)
      setQuery(''); setShowList(false)
      setTimeout(() => inputRef.current?.focus(), 0)
      return true
    }
    return false
  }

  /** เครื่องสแกนพิมพ์ทีละตัวอักษรเร็วมาก — รอ 150ms ให้พิมพ์จบก่อนค่อยประมวลผล (กันตัดกลางคัน) */
  function scheduleQrCheck(value: string) {
    if (qrTimer.current) clearTimeout(qrTimer.current)
    if (!onQrPayload || !toQr(value)) return
    qrTimer.current = window.setTimeout(() => { maybeHandleQr(value) }, 150)
  }

  // กำลังสแกน QR (มี | หรือ ฅ=|ภาษาไทย ซึ่งชื่อยาไม่มี) → ข้าม suggestion ทั้งหมด กัน re-render หน่วงตอนสแกน
  const scanning = query.includes('|') || query.includes('ฅ')

  const suggestions = useMemo(() => {
    if (scanning) return []   // ระหว่างสแกน QR ไม่ต้อง filter ยา 500+ ตัวทุกตัวอักษร
    const q = query.trim().toLowerCase()
    if (q.length === 0) return []
    const filtered = drugMasters.filter((d) =>
      d.drug_name.toLowerCase().includes(q)
      || d.generic_name?.toLowerCase().includes(q)
      || d.icode.toLowerCase().includes(q)
      || d.drug_class?.toLowerCase().includes(q)
      || d.search_keywords?.some((k) => k.toLowerCase().includes(q)),
    )
    filtered.sort((a, b) => {
      const an = a.drug_name.toLowerCase().startsWith(q) ? 0 : 1
      const bn = b.drug_name.toLowerCase().startsWith(q) ? 0 : 1
      return an - bn
    })
    return filtered.slice(0, MAX_SUGGESTIONS)
  }, [query, drugMasters, scanning])

  useEffect(() => { setActiveIdx(0) }, [query])

  async function selectDrug(master: DrugMaster) {
    setAdding(true)
    try {
      const labRules: LabRule[] = await listLabRulesForDrug(master).catch(() => [])
      onChange([
        ...drugs,
        { icode: master.icode, drug_name: master.drug_name, master, labRules },
      ])
      setQuery('')
      setShowList(false)
      inputRef.current?.focus()
    } catch (e) {
      toast.error('เพิ่มยาไม่สำเร็จ: ' + (e as Error).message)
    } finally {
      setAdding(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    // เครื่องสแกนส่ง Enter ท้าย payload → ประมวลผลทันที (ใช้ค่าล่าสุดจาก input จริง กัน state ตามไม่ทัน)
    const live = e.currentTarget.value
    if (e.key === 'Enter' && toQr(live)) {
      e.preventDefault()
      maybeHandleQr(live)
      return
    }
    if (!showList || suggestions.length === 0) {
      if (e.key === 'Enter' && query.trim()) {
        e.preventDefault()
        const q = query.trim().toLowerCase()
        const exact = drugMasters.find((d) =>
          d.drug_name.toLowerCase() === q
          || d.generic_name?.toLowerCase() === q
          || d.icode.toLowerCase() === q
          || d.search_keywords?.some((k) => k.toLowerCase() === q),
        )
        if (exact) selectDrug(exact)
        else toast.error(`ไม่พบยา "${query}" ในระบบ`)
      }
      return
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => Math.min(suggestions.length - 1, i + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx((i) => Math.max(0, i - 1)) }
    else if (e.key === 'Enter') { e.preventDefault(); if (suggestions[activeIdx]) selectDrug(suggestions[activeIdx]) }
    else if (e.key === 'Escape') { setShowList(false) }
  }

  function remove(i: number) {
    onChange(drugs.filter((_, idx) => idx !== i))
  }

  return (
    <Card className="soft-card">
      <CardContent className="pt-3 pb-3 space-y-2">
        {/* แถวค้นหา + เพิ่ม (compact) */}
        <div className="flex gap-2 items-stretch">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                const v = e.target.value
                setQuery(v)
                // มี | หรือ ฅ = กำลังสแกน QR → ปิด dropdown ทันที (กัน filter หน่วง) + รอพิมพ์จบค่อยประมวลผล
                if (v.includes('|') || v.includes('ฅ')) { setShowList(false); scheduleQrCheck(v) }
                else setShowList(true)
              }}
              onPaste={(e) => { const t = e.clipboardData.getData('text'); if (toQr(t)) { e.preventDefault(); maybeHandleQr(t) } }}
              onFocus={() => setShowList(true)}
              onBlur={() => setTimeout(() => setShowList(false), 150)}
              onKeyDown={handleKeyDown}
              placeholder="พิมพ์ชื่อยา / icode เพื่อเพิ่ม..."
              className="pl-9 h-10"
              autoComplete="off"
            />

            {showList && suggestions.length > 0 && (
              <div className="absolute z-30 left-0 right-0 mt-1 max-h-80 overflow-y-auto rounded-xl border bg-popover shadow-xl">
                {suggestions.map((d, idx) => (
                  <button
                    key={d.id ?? d.icode}
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); selectDrug(d) }}
                    onMouseEnter={() => setActiveIdx(idx)}
                    className={cn(
                      'w-full text-left px-3 py-2 flex items-start gap-3 border-b last:border-0 transition-colors',
                      activeIdx === idx ? 'bg-accent' : 'hover:bg-accent/50',
                    )}
                  >
                    <span className={cn('size-6 shrink-0 rounded-md grid place-items-center font-mono text-[10px]',
                      activeIdx === idx ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                    )}>
                      {activeIdx === idx ? <Check className="size-3.5" /> : d.icode.slice(-3)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm leading-tight truncate">{d.drug_name}</div>
                      <div className="text-[11px] text-muted-foreground flex gap-x-2 flex-wrap leading-tight mt-0.5">
                        {d.generic_name && <span>{d.generic_name}</span>}
                        {d.drug_class && <span className="px-1 rounded bg-muted text-foreground/70">{d.drug_class}</span>}
                        {d.strength && <span>{d.strength}</span>}
                      </div>
                    </div>
                    <span className="font-mono text-[10px] text-muted-foreground self-center">{d.icode}</span>
                  </button>
                ))}
              </div>
            )}

            {showList && query.trim() && suggestions.length === 0 && (
              <div className="absolute z-30 left-0 right-0 mt-1 rounded-xl border bg-popover shadow-xl p-3 text-sm text-muted-foreground">
                ไม่พบยา "{query}"
              </div>
            )}
          </div>

          <Button
            onClick={() => {
              if (suggestions[activeIdx]) selectDrug(suggestions[activeIdx])
              else if (query.trim()) toast.error('กรุณาเลือกยาจากรายการ')
            }}
            disabled={adding || !query.trim()}
            className="h-10 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shrink-0"
          >
            <Plus className="size-4" /> เพิ่ม
          </Button>
        </div>

        {/* รายการยาแบบ chips — หลายตัวอยู่ในแถบเดียว */}
        {drugs.length === 0 ? (
          <p className="text-xs text-muted-foreground italic text-center py-2">ยังไม่มียา — พิมพ์ชื่อยาด้านบน หรือสแกน QR</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {drugs.map((d, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 pl-1 pr-1.5 py-1 rounded-lg border bg-card hover:shadow-sm transition text-sm max-w-full"
                title={`${d.drug_name}${d.master?.drug_class ? ' · ' + d.master.drug_class : ''}`}
              >
                <span className="size-5 shrink-0 rounded-md bg-gradient-to-br from-emerald-500 to-teal-600 text-white grid place-items-center text-[10px] font-bold">
                  {i + 1}
                </span>
                <span className="font-semibold truncate max-w-[20ch]">{d.drug_name}</span>
                {d.master?.is_HAD && <span className="had-badge text-[9px]">HAD</span>}
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="size-5 grid place-items-center rounded-md text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 transition"
                  aria-label={`ลบ ${d.drug_name}`}
                >
                  <Trash2 className="size-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
