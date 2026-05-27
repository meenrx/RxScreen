import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/features/auth/authStore'
import type { UserRole } from '@/types/user'

interface Props {
  allowedRoles?: UserRole[]
}

export function ProtectedRoute({ allowedRoles }: Props) {
  const { user, loading } = useAuthStore()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-muted-foreground">กำลังโหลด...</div>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  if (!user.active) {
    return (
      <div className="flex h-screen items-center justify-center p-6">
        <div className="max-w-md text-center space-y-2">
          <h2 className="text-xl font-semibold">บัญชียังไม่ได้รับการอนุมัติ</h2>
          <p className="text-muted-foreground">กรุณาติดต่อผู้ดูแลระบบเพื่อเปิดใช้งานบัญชีของคุณ</p>
        </div>
      </div>
    )
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
