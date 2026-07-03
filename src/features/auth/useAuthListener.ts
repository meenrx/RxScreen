import { useEffect } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { useAuthStore } from './authStore'
import { ensureUserDoc, fetchUserDoc } from './api'
import { findInitialUser } from '@/lib/initialUsers'
import type { AppUser } from '@/types/user'

/** reject ถ้า promise ไม่ settle ภายใน ms — กัน getDoc ค้าง (Firestore เชื่อมต่อสะดุด) */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ])
}

export function useAuthListener() {
  const setUser = useAuthStore((s) => s.setUser)
  const setLoading = useAuthStore((s) => s.setLoading)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      setLoading(true)
      if (!fbUser) {
        setUser(null)
        setLoading(false)
        return
      }
      // fallback จากรายชื่อที่ฝังไว้ (ใช้เมื่อ Firestore อ่านไม่ได้/ช้า)
      const pin = fbUser.email?.split('@')[0] ?? ''
      const bundled = findInitialUser(pin)
      const bundledUser: AppUser | null = bundled
        ? { uid: fbUser.uid, email: fbUser.email ?? '', displayName: bundled.name, licNumber: pin, role: bundled.role, active: true }
        : null
      try {
        let userDoc = await withTimeout(fetchUserDoc(fbUser.uid), 8000)
        if (!userDoc && fbUser.email) {
          const displayName = bundled?.name ?? fbUser.displayName ?? fbUser.email
          userDoc = await withTimeout(
            ensureUserDoc(fbUser.uid, fbUser.email, displayName, pin, bundled?.role, bundled?.id),
            8000,
          )
        }
        setUser(userDoc ?? bundledUser)
      } catch (e) {
        // Firestore ช้า/ล่ม → ถ้าเป็น PIN ที่รู้จัก ให้เข้าระบบต่อด้วยข้อมูลที่ฝังไว้ (ไม่ค้าง)
        console.error('โหลด user doc ไม่สำเร็จ (ใช้ข้อมูลสำรอง):', e)
        setUser(bundledUser)
      } finally {
        setLoading(false)
      }
    })
    return () => unsub()
  }, [setUser, setLoading])
}
