import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { ThemeProvider } from 'next-themes'
import { registerSW } from 'virtual:pwa-register'
import { Toaster } from '@/components/ui/sonner'
import { queryClient } from '@/lib/queryClient'
import '@/lib/firebase'
import App from './App.tsx'
import './index.css'

// Auto-update (autoUpdate): เช็คเวอร์ชันใหม่ตอนเปิด/สลับกลับมาแอป + ทุก 15 นาที
// สำคัญกับ PWA หน้าโฮมที่มัก "resume" ไม่ cold-start → บังคับเช็คเมื่อกลับมาโฟกัส แล้วรีโหลดเอง
registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, r) {
    if (!r) return
    setInterval(() => { r.update().catch(() => {}) }, 15 * 60 * 1000)
    const checkNow = () => { if (document.visibilityState === 'visible') r.update().catch(() => {}) }
    document.addEventListener('visibilitychange', checkNow)
    window.addEventListener('focus', checkNow)
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <QueryClientProvider client={queryClient}>
        <App />
        <Toaster position="top-right" richColors />
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
)
