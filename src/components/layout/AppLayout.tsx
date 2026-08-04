import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopNav } from './TopNav'
import { useAuthStore } from '@/stores/authStore'
import { useNotificationStore } from '@/stores/notificationStore'

export function AppLayout() {
  const user = useAuthStore(s => s.user)
  const subscribe = useNotificationStore(s => s.subscribe)

  useEffect(() => {
    if (!user?.id) return
    const unsubscribe = subscribe(user.id)
    return unsubscribe
  }, [user?.id, subscribe])

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <Sidebar />

      {/* Content area — offset for fixed sidebar + topnav */}
      <main className="ml-64 pt-16 min-h-screen">
        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
