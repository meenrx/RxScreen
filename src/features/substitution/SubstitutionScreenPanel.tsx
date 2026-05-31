import { useMemo } from 'react'
import { Repeat } from 'lucide-react'
import { useActiveSubstitutions } from './hooks'
import { toDisplayImageUrl } from './api'
import type { DrugEntry } from '@/types/screening'

/** แสดงรูปก่อน/หลัง ของยาที่เปลี่ยนบริษัท สำหรับยาในใบสั่งรอบนี้ */
export function SubstitutionScreenPanel({ drugs }: { drugs: DrugEntry[] }) {
  const { data: subs = [] } = useActiveSubstitutions()

  const matched = useMemo(() => {
    const byIcode = new Map(subs.map((s) => [s.icode, s]))
    return drugs.map((d) => byIcode.get(d.icode)).filter((s): s is NonNullable<typeof s> => !!s)
  }, [subs, drugs])

  if (matched.length === 0) return null

  return (
    <div className="rounded-2xl border border-amber-200 dark:border-amber-900 bg-amber-50/40 dark:bg-amber-950/20 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-amber-200 dark:border-amber-900 font-semibold text-sm text-amber-900 dark:text-amber-200">
        <Repeat className="size-4" /> ยาเปลี่ยนบริษัท/รูปลักษณ์ ({matched.length})
      </div>
      <div className="p-3 space-y-3">
        {matched.map((s) => (
          <div key={s.id} className="rounded-xl border bg-card p-3">
            <div className="font-medium text-sm">{s.drug_name}</div>
            {(s.old_brand || s.new_brand) && (
              <div className="text-xs text-muted-foreground mb-2">
                {[s.old_brand, s.new_brand].filter(Boolean).join('  →  ')}
              </div>
            )}
            {s.note && <div className="text-xs mb-2">{s.note}</div>}
            {(s.before_image || s.after_image) && (
              <div className="grid grid-cols-2 gap-2">
                <ImgBox label="ก่อน (เดิม)" url={s.before_image} />
                <ImgBox label="หลัง (ใหม่)" url={s.after_image} />
              </div>
            )}
            <div className="text-[11px] text-emerald-700 dark:text-emerald-300 mt-2">
              💡 แจ้งผู้ป่วยว่ายาเปลี่ยนหน้าตา แต่เป็นยาเดิม
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ImgBox({ label, url }: { label: string; url?: string }) {
  const display = toDisplayImageUrl(url)
  return (
    <div className="space-y-1">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</div>
      {display ? (
        <a href={display} target="_blank" rel="noreferrer">
          <img src={display} alt={label} className="w-full h-32 object-contain rounded-lg border bg-white" />
        </a>
      ) : (
        <div className="w-full h-32 rounded-lg border border-dashed grid place-items-center text-xs text-muted-foreground">ไม่มีรูป</div>
      )}
    </div>
  )
}
