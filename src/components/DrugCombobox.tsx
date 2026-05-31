import { useState, useMemo, useRef, useEffect } from 'react'
import { Search, Check } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { DrugMaster } from '@/types/drug'

interface Props {
  drugs: DrugMaster[]
  value: string                       // icode ที่เลือก
  onChange: (icode: string, drug: DrugMaster | undefined) => void
  placeholder?: string
  className?: string
  autoFocus?: boolean
}

const MAX = 12

/** Reusable: ค้นหายาจาก DRUG_MASTER ด้วยชื่อ → ส่ง icode + DrugMaster กลับ */
export function DrugCombobox({ drugs, value, onChange, placeholder = 'พิมพ์ชื่อยา…', className, autoFocus }: Props) {
  const [query, setQuery] = useState('')
  const [show, setShow] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)
  const ref = useRef<HTMLInputElement>(null)

  // sync query กับ value (เริ่มต้น/แก้ไข)
  useEffect(() => {
    if (value && !query) {
      const d = drugs.find((x) => x.icode === value)
      if (d) setQuery(`${d.drug_name} [${d.icode}]`)
    }
  }, [value, drugs]) // eslint-disable-line react-hooks/exhaustive-deps

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    const list = drugs.filter((d) =>
      d.drug_name.toLowerCase().includes(q)
      || d.generic_name?.toLowerCase().includes(q)
      || d.icode.toLowerCase().includes(q)
      || d.drug_class?.toLowerCase().includes(q)
      || d.search_keywords?.some((k) => k.toLowerCase().includes(q)),
    )
    list.sort((a, b) => {
      const an = a.drug_name.toLowerCase().startsWith(q) ? 0 : 1
      const bn = b.drug_name.toLowerCase().startsWith(q) ? 0 : 1
      return an - bn
    })
    return list.slice(0, MAX)
  }, [query, drugs])

  function pick(d: DrugMaster) {
    onChange(d.icode, d)
    setQuery(`${d.drug_name} [${d.icode}]`)
    setShow(false)
  }

  return (
    <div className={cn('relative', className)}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
      <Input
        ref={ref}
        value={query}
        onChange={(e) => { setQuery(e.target.value); setShow(true); onChange('', undefined) }}
        onFocus={() => setShow(true)}
        onBlur={() => setTimeout(() => setShow(false), 150)}
        onKeyDown={(e) => {
          if (!show || suggestions.length === 0) return
          if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => Math.min(suggestions.length - 1, i + 1)) }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx((i) => Math.max(0, i - 1)) }
          else if (e.key === 'Enter') { e.preventDefault(); if (suggestions[activeIdx]) pick(suggestions[activeIdx]) }
          else if (e.key === 'Escape') { setShow(false) }
        }}
        placeholder={placeholder}
        className="pl-10 h-11"
        autoComplete="off"
        autoFocus={autoFocus}
      />
      {show && suggestions.length > 0 && (
        <div className="absolute z-30 left-0 right-0 mt-1 max-h-72 overflow-y-auto rounded-xl border bg-popover shadow-xl">
          {suggestions.map((d, idx) => (
            <button
              key={d.id ?? d.icode}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); pick(d) }}
              onMouseEnter={() => setActiveIdx(idx)}
              className={cn(
                'w-full text-left px-3 py-2 flex items-start gap-2 border-b last:border-0 transition-colors',
                activeIdx === idx ? 'bg-accent' : 'hover:bg-accent/50',
              )}
            >
              <span className={cn('size-6 shrink-0 rounded grid place-items-center font-mono text-[10px]',
                activeIdx === idx ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
              )}>
                {activeIdx === idx ? <Check className="size-3.5" /> : d.icode.slice(-2)}
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm leading-tight">
                  {d.drug_name}
                  {d.strength && <span className="text-muted-foreground font-normal"> · {d.strength}</span>}
                  {(d.dosage_form || d.pack_unit) && <span className="text-[10px] text-muted-foreground font-normal"> ({d.dosage_form ?? d.pack_unit})</span>}
                </div>
                <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                  <span>{[d.generic_name, d.drug_category ?? d.drug_class].filter(Boolean).join(' · ')}</span>
                  {d.unit_price != null && (
                    <span className="ml-auto font-medium text-emerald-700 dark:text-emerald-400 tabular-nums">
                      ฿{d.unit_price.toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
              <span className="font-mono text-[10px] text-muted-foreground self-center">{d.icode}</span>
            </button>
          ))}
        </div>
      )}
      {show && query.trim() && suggestions.length === 0 && (
        <div className="absolute z-30 left-0 right-0 mt-1 rounded-xl border bg-popover shadow-xl p-3 text-sm text-muted-foreground">
          ไม่พบยา "{query}"
        </div>
      )}
    </div>
  )
}
