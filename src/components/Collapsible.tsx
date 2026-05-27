import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  title: React.ReactNode
  subtitle?: React.ReactNode
  icon?: React.ReactNode
  defaultOpen?: boolean
  badge?: React.ReactNode
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
}

/** Section header + collapsible body — ให้ Screening page เรียบขึ้น */
export function CollapsibleSection({ title, subtitle, icon, defaultOpen = true, badge, actions, children, className }: Props) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className={cn('rounded-2xl border bg-card overflow-hidden', className)}>
      <header className="flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex-1 flex items-center gap-3 text-left"
        >
          {icon && <div className="shrink-0">{icon}</div>}
          <div className="flex-1 min-w-0">
            <div className="font-semibold flex items-center gap-2">
              <span>{title}</span>
              {badge}
            </div>
            {subtitle && <div className="text-xs text-muted-foreground mt-0.5">{subtitle}</div>}
          </div>
          <ChevronDown className={cn('size-4 transition-transform shrink-0', open && 'rotate-180')} />
        </button>
        {actions}
      </header>
      {open && <div className="px-4 pb-4 border-t pt-3">{children}</div>}
    </section>
  )
}
