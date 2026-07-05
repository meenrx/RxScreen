import { createBrowserRouter, Navigate } from 'react-router-dom'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { AppLayout } from '@/components/layout/AppLayout'
import LoginPage from '@/pages/LoginPage'
import DashboardPage from '@/pages/DashboardPage'
import ScreeningPage from '@/pages/ScreeningPage'
import BatchScreenPage from '@/pages/BatchScreenPage'
import HistoryPage from '@/pages/HistoryPage'
import DrugInfoPage from '@/pages/DrugInfoPage'
import PatientHistoryPage from '@/pages/PatientHistoryPage'
import AdminPage from '@/pages/AdminPage'
import SettingsPage from '@/pages/SettingsPage'
import GuidePage from '@/pages/GuidePage'
import ToolsPage from '@/pages/ToolsPage'

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/', element: <ScreeningPage /> },
          { path: '/screening', element: <ScreeningPage /> },
          { path: '/batch', element: <BatchScreenPage /> },
          { path: '/dashboard', element: <DashboardPage /> },
          { path: '/druginfo', element: <DrugInfoPage /> },
          { path: '/patient-history', element: <PatientHistoryPage /> },
          { path: '/history', element: <HistoryPage /> },
          { path: '/guide', element: <GuidePage /> },
          { path: '/tools', element: <ToolsPage /> },
          {
            element: <ProtectedRoute allowedRoles={['admin', 'pharmacist']} />,
            children: [
              { path: '/admin/*', element: <AdminPage /> },
              { path: '/settings', element: <SettingsPage /> },
            ],
          },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
