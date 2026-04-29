import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ApiError, api } from '../api/client'
import type { AuthOut } from '../api/types'
import { useAuth } from '../auth/AuthContext'

export function SignupPage() {
  const { setAuth } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const auth = await api<AuthOut>('/api/auth/signup', {
        body: { email, password, password_confirm: passwordConfirm },
      })
      setAuth(auth)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="paper-card p-8 mb-6" style={{ transform: 'rotate(1deg)' }}>
        <h1 className="heading text-4xl md:text-5xl mb-1">new run</h1>
        <p className="text-base text-[#2d2d2d]/65 italic mb-6">make an account — your decks live here.</p>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm uppercase tracking-wider text-[#2d2d2d]/65 mb-1">email</label>
            <input
              type="email"
              autoFocus
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="block text-sm uppercase tracking-wider text-[#2d2d2d]/65 mb-1">
              password <span className="lowercase italic">(≥ 8 chars)</span>
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="block text-sm uppercase tracking-wider text-[#2d2d2d]/65 mb-1">confirm</label>
            <input
              type="password"
              required
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              className="input"
            />
          </div>

          {error && (
            <div className="paper-card postit-pink p-3 text-base shake" style={{ transform: 'rotate(-1deg)' }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={submitting} className="btn btn-stamp w-full">
            {submitting ? 'creating…' : 'sign up →'}
          </button>
        </form>
      </div>

      <p className="text-center text-base text-[#2d2d2d]/70">
        already have one? <Link to="/login" className="wavy">log in</Link>
      </p>
    </div>
  )
}
