import { useEffect } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { useAuthStore } from './authStore'
import { ensureUserDoc, fetchUserDoc } from './api'
import { findInitialUser } from '@/lib/initialUsers'

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
      try {
        let userDoc = await fetchUserDoc(fbUser.uid)
        if (!userDoc && fbUser.email) {
          // self-heal: ดึง pin จาก email (format: ${pin}@rxscreen.local)
          const pin = fbUser.email.split('@')[0]
          const bundled = findInitialUser(pin)
          const displayName = bundled?.name ?? fbUser.displayName ?? fbUser.email
          userDoc = await ensureUserDoc(
            fbUser.uid,
            fbUser.email,
            displayName,
            pin,
            bundled?.role,
            bundled?.id,
          )
        }
        setUser(userDoc)
      } catch (e) {
        console.error('Failed to load user doc:', e)
        setUser(null)
      } finally {
        setLoading(false)
      }
    })
    return () => unsub()
  }, [setUser, setLoading])
}
