import { useState, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Header } from './Header'
import { Sidebar } from './Sidebar'
import { MobileBottomNav } from './MobileBottomNav'

function initNavOpen(): boolean {
  if (typeof window === 'undefined') return false
  if (!window.matchMedia('(min-width: 768px)').matches) return false  // มือถือ: เริ่มซ่อน (drawer)
  const saved = localStorage.getItem('rxs-nav-open')
  return saved === null ? true : saved === '1'
}

export function AppLayout() {
  const [navOpen, setNavOpen] = useState(initNavOpen)

  // จำสถานะ (เฉพาะ desktop)
  useEffect(() => {
    if (window.matchMedia('(min-width: 768px)').matches) localStorage.setItem('rxs-nav-open', navOpen ? '1' : '0')
  }, [navOpen])

  return (
    <div className="flex h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-cyan-50/30 to-sky-50/40 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* desktop sidebar — ยุบได้ */}
      <aside className={cn(
        'hidden md:flex md:flex-col bg-white/70 dark:bg-slate-900/70 backdrop-blur-md transition-[width] duration-200 shrink-0',
        navOpen ? 'md:w-64 border-r' : 'md:w-0 md:overflow-hidden',
      )}>
        <Sidebar />
      </aside>

      {/* mobile sidebar overlay */}
      {navOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden no-print" onClick={() => setNavOpen(false)} />
          <aside className="fixed z-50 left-0 top-0 h-full w-72 bg-card border-r shadow-2xl md:hidden no-print fade-up">
            <Sidebar onNavigate={() => setNavOpen(false)} />
          </aside>
        </>
      )}

      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <Header onMenuClick={() => setNavOpen((o) => !o)} />
        <main className="flex-1 overflow-y-auto nice-scroll p-3 md:p-5 pb-20 md:pb-6">
          <div className="fade-up">
            <Outlet />
          </div>
        </main>
        <MobileBottomNav />
      </div>
    </div>
  )
}
