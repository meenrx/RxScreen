import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Header } from './Header'
import { Sidebar } from './Sidebar'
import { MobileBottomNav } from './MobileBottomNav'

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  return (
    <div className="flex h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-cyan-50/30 to-sky-50/40 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* desktop sidebar */}
      <aside className="hidden md:flex md:w-64 md:flex-col border-r bg-white/70 dark:bg-slate-900/70 backdrop-blur-md">
        <Sidebar />
      </aside>

      {/* mobile sidebar overlay */}
      {sidebarOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden no-print" onClick={() => setSidebarOpen(false)} />
          <aside className="fixed z-50 left-0 top-0 h-full w-72 bg-card border-r shadow-2xl md:hidden no-print fade-up">
            <Sidebar onNavigate={() => setSidebarOpen(false)} />
          </aside>
        </>
      )}

      <div className="flex flex-1 flex-col overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto nice-scroll p-4 md:p-6 pb-20 md:pb-6">
          <div className="fade-up">
            <Outlet />
          </div>
        </main>
        <MobileBottomNav />
      </div>
    </div>
  )
}
