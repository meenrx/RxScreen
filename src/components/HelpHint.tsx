import { useState } from 'react'
import { HelpCircle, X } from 'lucide-react'

interface Props {
  title?: string
  children: React.ReactNode
}

/** Inline help — กดไอคอน ? เพื่อแสดงคำอธิบายการกรอก field */
export function HelpHint({ title, children }: Props) {
  const [open, setOpen] = useState(false)
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="size-4 rounded-full bg-muted hover:bg-accent grid place-items-center text-muted-foreground"
        aria-label="ช่วยเหลือ"
      >
        <HelpCircle className="size-3.5" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 left-6 top-0 w-72 rounded-xl border bg-popover shadow-xl p-3 text-sm">
            <div className="flex items-start gap-2 mb-1">
              {title && <div className="font-semibold flex-1">{title}</div>}
              <button onClick={() => setOpen(false)}><X className="size-3.5" /></button>
            </div>
            <div className="text-xs leading-relaxed">{children}</div>
          </div>
        </>
      )}
    </span>
  )
}
