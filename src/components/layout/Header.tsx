import { LogOut, Menu, Pill, Sparkles, Moon, Sun, HelpCircle } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuthStore } from '@/features/auth/authStore'
import { signOut } from '@/features/auth/api'
import { toast } from 'sonner'
import { useTheme } from 'next-themes'

interface Props {
  onMenuClick?: () => void
}

export function Header({ onMenuClick }: Props) {
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const { theme, setTheme } = useTheme()
  const isDark = theme === 'dark'

  async function handleSignOut() {
    try {
      await signOut()
      toast.success('ออกจากระบบเรียบร้อย')
      navigate('/login')
    } catch (e) {
      toast.error('เกิดข้อผิดพลาด: ' + (e as Error).message)
    }
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-4 no-print">
      <Button variant="ghost" size="icon" className="md:hidden" onClick={onMenuClick}>
        <Menu className="size-5" />
      </Button>
      <div className="flex items-center gap-2 md:hidden">
        <div className="size-8 rounded-lg bg-gradient-to-br from-cyan-500 to-sky-600 grid place-items-center text-white">
          <Pill className="size-4" />
        </div>
        <span className="font-semibold">RxScreen</span>
      </div>

      <div className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground ml-2">
        <span className="pulse-dot" />
        <span>เชื่อมต่อระบบ</span>
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <Sparkles className="size-4 text-violet-500 hidden lg:inline" />
        <span className="text-xs text-muted-foreground hidden lg:inline">AI พร้อมใช้งาน</span>

        <Link to="/guide" className="hidden sm:inline">
          <Button variant="ghost" size="icon" title="คู่มือใช้งาน">
            <HelpCircle className="size-5" />
          </Button>
        </Link>

        <Button
          variant="ghost"
          size="icon"
          title={isDark ? 'โหมดสว่าง' : 'โหมดมืด'}
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
        >
          {isDark ? <Sun className="size-5" /> : <Moon className="size-5" />}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="ml-1">
              <div className="size-9 rounded-full bg-gradient-to-br from-cyan-400 to-sky-600 grid place-items-center text-white font-semibold">
                {(user?.displayName ?? '?').charAt(0)}
              </div>
              <div className="flex flex-col items-start text-left hidden sm:flex">
                <span className="text-sm font-medium leading-tight">{user?.displayName}</span>
                <span className="text-[10px] text-muted-foreground leading-tight">{roleLabel(user?.role)}</span>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel className="flex flex-col">
              <span>{user?.displayName}</span>
              <span className="text-xs text-muted-foreground font-normal">PIN: {user?.licNumber}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={handleSignOut} className="text-red-600 focus:text-red-700">
              <LogOut className="mr-2 size-4" />
              ออกจากระบบ
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}

function roleLabel(role?: string) {
  switch (role) {
    case 'admin': return 'ผู้ดูแลระบบ'
    case 'pharmacist': return 'เภสัชกร'
    case 'viewer': return 'ผู้ใช้งานทั่วไป'
    default: return ''
  }
}
