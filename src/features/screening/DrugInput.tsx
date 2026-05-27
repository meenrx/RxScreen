import { useState, useMemo, useRef, useEffect } from 'react'
import { Plus, Trash2, Search, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { listLabRulesByIcode } from '@/features/catalog/api'
import { cn } from '@/lib/utils'
import type { DrugMaster, LabRule } from '@/types/drug'
import type { DrugEntry } from '@/types/screening'

interface Props {
  drugs: DrugEntry[]
  onChange: (drugs: DrugEntry[]) => void
  drugMasters?: DrugMaster[]
}

const MAX_SUGGESTIONS = 12

export function DrugInput({ drugs, onChange, drugMasters = [] }: Props) {
  const [query, setQuery] = useState('')
  const [activeIdx, setActiveIdx] = useState(0)
  const [showList, setShowList] = useState(false)
  const [adding, setAdding] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length === 0) return []
    const filtered = drugMasters.filter((d) =>
      d.drug_name.toLowerCase().includes(q)
      || d.generic_name?.toLowerCase().includes(q)
      || d.icode.toLowerCase().includes(q)
      || d.drug_class?.toLowerCase().includes(q),
    )
    filtered.sort((a, b) => {
      const an = a.drug_name.toLowerCase().startsWith(q) ? 0 : 1
      const bn = b.drug_name.toLowerCase().startsWith(q) ? 0 : 1
      return an - bn
    })
    return filtered.slice(0, MAX_SUGGESTIONS)
  }, [query, drugMasters])

  useEffect(() => { setActiveIdx(0) }, [query])

  async function selectDrug(master: DrugMaster) {
    setAdding(true)
    try {
      const labRules: LabRule[] = await listLabRulesByIcode(master.icode).catch(() => [])
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
    if (!showList || suggestions.length === 0) {
      if (e.key === 'Enter' && query.trim()) {
        e.preventDefault()
        const q = query.trim().toLowerCase()
        const exact = drugMasters.find((d) =>
          d.drug_name.toLowerCase() === q
          || d.generic_name?.toLowerCase() === q
          || d.icode.toLowerCase() === q,
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
      <CardContent className="pt-6 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-lg">รายการยา</h3>
          <span className="text-xs text-muted-foreground">{drugs.length} รายการ</span>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1 relative">
            <Label className="mb-1.5">ชื่อยา</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-muted-foreground" />
              <Input
                ref={inputRef}
                value={query}
                onChange={(e) => { setQuery(e.target.value); setShowList(true) }}
                onFocus={() => setShowList(true)}
                onBlur={() => setTimeout(() => setShowList(false), 150)}
                onKeyDown={handleKeyDown}
                placeholder="พิมพ์ชื่อยา เช่น Amoxycillin / Warfarin / Metformin"
                className="pl-10 h-12 text-base"
                autoComplete="off"
              />
            </div>

            {showList && suggestions.length > 0 && (
              <div className="absolute z-30 left-0 right-0 mt-1 max-h-80 overflow-y-auto rounded-xl border bg-popover shadow-xl">
                {suggestions.map((d, idx) => (
                  <button
                    key={d.id ?? d.icode}
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); selectDrug(d) }}
                    onMouseEnter={() => setActiveIdx(idx)}
                    className={cn(
                      'w-full text-left px-3 py-2.5 flex items-start gap-3 border-b last:border-0 transition-colors',
                      activeIdx === idx ? 'bg-accent' : 'hover:bg-accent/50',
                    )}
                  >
                    <span className={cn('size-7 shrink-0 rounded-lg grid place-items-center font-mono text-[10px]',
                      activeIdx === idx ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                    )}>
                      {activeIdx === idx ? <Check className="size-4" /> : d.icode.slice(-3)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm leading-tight">{d.drug_name}</div>
                      <div className="text-xs text-muted-foreground flex gap-x-3 gap-y-0.5 flex-wrap mt-0.5">
                        {d.generic_name && <span>{d.generic_name}</span>}
                        {d.drug_class && <span className="px-1.5 rounded bg-muted text-foreground/70">{d.drug_class}</span>}
                        {d.form && <span>{d.form}</span>}
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
                ไม่พบยา "{query}" — ลองคำอื่นหรือเพิ่มในจัดการฐานข้อมูล
              </div>
            )}
          </div>

          <div className="sm:self-end">
            <Button
              onClick={() => {
                if (suggestions[activeIdx]) selectDrug(suggestions[activeIdx])
                else if (query.trim()) toast.error('กรุณาเลือกยาจากรายการ')
              }}
              disabled={adding || !query.trim()}
              className="w-full sm:w-auto h-12 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700"
              size="lg"
            >
              <Plus className="size-5" /> เพิ่ม
            </Button>
          </div>
        </div>

        {drugs.length === 0 ? (
          <p className="text-sm text-muted-foreground italic text-center py-4">ยังไม่มียา — พิมพ์ชื่อยาด้านบนแล้วเลือก หรือสแกน QR</p>
        ) : (
          <ul className="space-y-2">
            {drugs.map((d, i) => (
              <li key={i} className="flex items-center gap-2 border rounded-xl p-3 bg-card hover:shadow-sm transition">
                <span className="size-8 shrink-0 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white grid place-items-center text-sm font-bold">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{d.drug_name}</span>
                    <span className="font-mono text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded">{d.icode}</span>
                    {d.master?.drug_class && <span className="text-xs text-muted-foreground">· {d.master.drug_class}</span>}
                    {d.master?.is_HAD && <span className="had-badge">HAD</span>}
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => remove(i)}>
                  <Trash2 className="size-4 text-red-500" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
