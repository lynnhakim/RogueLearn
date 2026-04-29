import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../auth/AuthContext'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { state } = useAuth()
  const location = useLocation()

  if (state.status === 'loading') {
    return <div className="text-center text-[#2d2d2d]/60 italic mt-12">loading…</div>
  }
  if (state.status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location }} />
  }
  return <>{children}</>
}

export function RedirectIfAuthed({ children }: { children: ReactNode }) {
  const { state } = useAuth()
  if (state.status === 'authenticated') return <Navigate to="/" replace />
  return <>{children}</>
}
