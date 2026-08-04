import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import './i18n'
import './index.css'
import { router } from './router'
import { useAuthStore } from './stores/authStore'

const unsubscribeAuth = useAuthStore.getState().init()
window.addEventListener('beforeunload', unsubscribeAuth)

const root = document.getElementById('root')
if (!root) throw new Error('No #root element found')

createRoot(root).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
