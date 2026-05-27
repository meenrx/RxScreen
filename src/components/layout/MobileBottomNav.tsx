import { NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, ClipboardCheck, BookOpen, History, MoreHorizontal } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

const items = [
  { to: '/', label: 'คัดกรอง', icon: ClipboardCheck },
  { to: '/druginfo', label: 'ค้นยา', icon: BookOpen },
  { to: '/dashboard', label: 'ภาพรวม', icon: LayoutDashboard },
  { to: '/history', label: 'ประวัติ', icon: History },
]

const moreItems = [
  { to: '/patient-history', label: 'ค้นประวัติผู้ป่วย' },
  { to: '/admin', label: 'จัดการฐานข้อมูล' },
  { to: '/settings', label: 'ตั้งค่า' },
  { to: '/guide', label: 'คู่มือใช้งาน' },
]

export function MobileBottomNav() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  return (
    <>
      <nav className="md:hidden no-print fixed bottom-0 inset-x-0 z-30 border-t bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-[0_-2px_8px_rgba(0,0,0,0.04)]">
        <div className="grid grid-cols-5 h-16">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => cn(
                'flex flex-col items-center justify-center gap-0.5 text-[11px] transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              <item.icon className="size-5" />
              <span>{item.label}</span>
            </NavLink>
          ))}
          <button
            onClick={() => setOpen(true)}
            className="flex flex-col items-center justify-center gap-0.5 text-[11px] text-muted-foreground"
          >
            <MoreHorizontal className="size-5" />
            <span>เพิ่มเติม</span>
          </button>
        </div>
      </nav>
      {open && (
        <>
          <div className="md:hidden no-print fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="md:hidden no-print fixed left-0 right-0 bottom-0 z-50 bg-card border-t rounded-t-2xl p-4 max-h-[60vh] overflow-y-auto fade-up">
            <div className="size-1 w-12 bg-muted rounded-full mx-auto mb-3" />
            <div className="font-semibold mb-2">เมนูเพิ่มเติม</div>
            <div className="grid grid-cols-2 gap-2">
              {moreItems.map((m) => (
                <button
                  key={m.to}
                  onClick={() => { navigate(m.to); setOpen(false) }}
                  className="text-left px-4 py-3 rounded-xl border hover:bg-accent text-sm"
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  )
}
