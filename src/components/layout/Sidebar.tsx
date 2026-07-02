import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, ClipboardCheck, History,
  Settings, Database, BookOpen, UserSearch, HelpCircle, Pill, Wrench,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/features/auth/authStore'

const nav = [
  { to: '/', label: 'คัดกรองใบสั่งยา', icon: ClipboardCheck, color: 'text-emerald-600' },
  { to: '/tools', label: 'เครื่องมือ', icon: Wrench, color: 'text-violet-600' },
  { to: '/dashboard', label: 'ภาพรวม', icon: LayoutDashboard, color: 'text-cyan-600' },
  { to: '/druginfo', label: 'ค้นข้อมูลยา', icon: BookOpen, color: 'text-sky-600' },
  { to: '/patient-history', label: 'ค้นประวัติผู้ป่วย', icon: UserSearch, color: 'text-pink-600' },
  { to: '/history', label: 'ประวัติคัดกรอง', icon: History, color: 'text-slate-600' },
  { to: '/guide', label: 'คู่มือใช้งาน', icon: HelpCircle, color: 'text-violet-600' },
]

const adminNav = [
  { to: '/admin', label: 'จัดการฐานข้อมูล', icon: Database },
  { to: '/settings', label: 'ตั้งค่า', icon: Settings },
]

interface Props {
  onNavigate?: () => void
}

export function Sidebar({ onNavigate }: Props) {
  const user = useAuthStore((s) => s.user)
  const isAdmin = user?.role === 'admin' || user?.role === 'pharmacist'

  return (
    <div className="flex h-full flex-col py-4">
      <div className="px-4 pb-4 border-b flex items-center gap-3">
        <div className="size-11 rounded-xl bg-gradient-to-br from-cyan-500 to-sky-600 grid place-items-center text-white shadow-md shadow-cyan-200">
          <Pill className="size-5" />
        </div>
        <div className="flex-1">
          <div className="font-bold text-lg leading-tight">RxScreen</div>
          <div className="text-xs text-muted-foreground -mt-0.5">โรงพยาบาลรือเสาะ</div>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto nice-scroll px-2 py-3 space-y-0.5">
        {nav.map((item) => <NavItem key={item.to} {...item} onNavigate={onNavigate} />)}
        {isAdmin && (
          <>
            <div className="pt-4 pb-1 px-3 text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">ผู้ดูแลระบบ</div>
            {adminNav.map((item) => (
              <NavItem key={item.to} to={item.to} label={item.label} icon={item.icon} color="text-slate-600" onNavigate={onNavigate} />
            ))}
          </>
        )}
      </nav>
      <div className="px-4 pt-3 text-[10px] text-muted-foreground">v0.3.0 · RxScreen</div>
    </div>
  )
}

function NavItem({ to, label, icon: Icon, color = 'text-muted-foreground', onNavigate }: { to: string; label: string; icon: React.ComponentType<{ className?: string }>; color?: string; onNavigate?: () => void }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition-all',
          isActive
            ? 'bg-gradient-to-r from-cyan-500 to-sky-600 text-white shadow-md shadow-cyan-200/50'
            : 'text-foreground/80 hover:bg-accent hover:text-foreground',
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon className={cn('size-5 shrink-0', isActive ? 'text-white' : color)} />
          <span>{label}</span>
        </>
      )}
    </NavLink>
  )
}
