import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { ApiError, api } from '../api/client'
import type { AuthOut, User } from '../api/types'

type AuthState =
  | { status: 'loading' }
  | { status: 'authenticated'; user: User; csrfToken: string }
  | { status: 'anonymous' }

type AuthContextValue = {
  state: AuthState
  setAuth: (a: AuthOut) => void
  clearAuth: () => void
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' })

  const refresh = async () => {
    try {
      const data = await api<AuthOut>('/api/auth/me')
      setState({ status: 'authenticated', user: data.user, csrfToken: data.csrf_token })
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setState({ status: 'anonymous' })
      } else {
        // Unexpected — treat as anonymous, but log.
        console.error('Auth refresh failed:', e)
        setState({ status: 'anonymous' })
      }
    }
  }

  useEffect(() => { void refresh() }, [])

  const setAuth = (a: AuthOut) => {
    setState({ status: 'authenticated', user: a.user, csrfToken: a.csrf_token })
  }

  const clearAuth = () => {
    setState({ status: 'anonymous' })
  }

  return (
    <AuthContext.Provider value={{ state, setAuth, clearAuth, refresh }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

/**
 * Returns the CSRF token if authenticated, throws otherwise.
 * Use this from mutation hooks where the user is known to be logged in.
 */
export function useCsrfToken(): string {
  const { state } = useAuth()
  if (state.status !== 'authenticated') {
    throw new Error('CSRF token requested outside an authenticated context')
  }
  return state.csrfToken
}
