import { RouterProvider } from 'react-router-dom'
import { router } from '@/lib/router'
import { useAuthListener } from '@/features/auth/useAuthListener'

export default function App() {
  useAuthListener()
  return <RouterProvider router={router} />
}
