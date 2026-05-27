import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

interface Props {
  icon?: LucideIcon
  title: string
  description?: string
  actions?: ReactNode
  iconColor?: string
}

export function PageHeader({ icon: Icon, title, description, actions, iconColor = 'from-cyan-500 to-sky-600' }: Props) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 pb-2">
      <div className="flex items-start gap-3 min-w-0">
        {Icon && (
          <div className={`size-11 shrink-0 rounded-xl bg-gradient-to-br ${iconColor} grid place-items-center text-white shadow-md`}>
            <Icon className="size-5" />
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">{title}</h1>
          {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap gap-2 sm:justify-end shrink-0">{actions}</div>}
    </div>
  )
}
