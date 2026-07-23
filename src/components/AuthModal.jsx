import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function AuthModal({ onClose, onAuth }) {
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) { setError(error.message); setLoading(false); return }
      setDone(true)
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) { setError(error.message); setLoading(false); return }
      onAuth(data.user)
      onClose()
    }
    setLoading(false)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 400 }}>
        <div className="modal-header">
          <span className="modal-title">
            {mode === 'login' ? 'Войти' : 'Создать аккаунт'}
          </span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {done ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📬</div>
            <p style={{ fontSize: 15, lineHeight: 1.5 }}>
              Письмо с подтверждением отправлено на <strong>{email}</strong>.
              <br />Перейди по ссылке в письме, затем войди.
            </p>
            <button
              className="btn-primary"
              style={{ marginTop: 20, width: '100%' }}
              onClick={() => { setMode('login'); setDone(false) }}
            >
              Войти
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                className="form-input"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Пароль</label>
              <input
                className="form-input"
                type="password"
                placeholder="Минимум 6 символов"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>

            {error && (
              <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 10 }}>
                {error}
              </div>
            )}

            <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%' }}>
              {loading ? 'Загружаю…' : mode === 'login' ? 'Войти' : 'Зарегистрироваться'}
            </button>

            <div style={{ textAlign: 'center', marginTop: 14, fontSize: 13, color: 'var(--text-muted)' }}>
              {mode === 'login' ? (
                <>Нет аккаунта?{' '}
                  <button type="button" onClick={() => { setMode('signup'); setError('') }}
                    style={{ color: 'var(--accent)', fontWeight: 600 }}>
                    Зарегистрироваться
                  </button>
                </>
              ) : (
                <>Уже есть аккаунт?{' '}
                  <button type="button" onClick={() => { setMode('login'); setError('') }}
                    style={{ color: 'var(--accent)', fontWeight: 600 }}>
                    Войти
                  </button>
                </>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
