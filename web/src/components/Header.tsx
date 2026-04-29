import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { api } from '../api/client'

export function Header() {
  const { state, clearAuth } = useAuth()
  const location = useLocation()

  const onLogout = async () => {
    if (state.status !== 'authenticated') return
    try {
      await api('/api/auth/logout', { method: 'POST', csrfToken: state.csrfToken })
    } finally {
      clearAuth()
    }
  }

  return (
    <header className="border-b-2 border-dashed" style={{ borderColor: 'rgba(45,45,45,.3)' }}>
      <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between gap-3">
        <Link to="/" className="heading text-3xl md:text-4xl tracking-tight inline-flex items-baseline gap-1">
          rogue<span className="text-[#ff4d4d]">learn</span>
          <span className="inline-block text-[#ff4d4d]" style={{ transform: 'rotate(14deg)' }}>!</span>
        </Link>
        <div className="flex items-center gap-4">
          {state.status === 'authenticated' ? (
            <>
              <span
                className="hidden sm:inline-block text-base text-[#2d2d2d]/65 italic"
                title={state.user.email}
              >
                {state.user.email.split('@')[0]}
              </span>
              <button onClick={onLogout} className="btn btn-ghost text-sm">log out</button>
            </>
          ) : (
            <>
              {location.pathname !== '/login' && (
                <Link to="/login" className="btn btn-ghost text-base">log in</Link>
              )}
              {location.pathname !== '/signup' && (
                <Link to="/signup" className="btn text-base">sign up →</Link>
              )}
            </>
          )}
        </div>
      </div>
    </header>
  )
}
