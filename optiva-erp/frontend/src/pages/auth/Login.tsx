import { useState, type CSSProperties, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ApiError } from '../../api/client'
import { useAuth } from '../../auth/AuthContext'
import { AuthShell } from './AuthShell'
import { EMAIL_RE, Field, SocialButtons } from './fields'

export default function Login() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})
  const [formError, setFormError] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)

  const destination = (location.state as { from?: string } | null)?.from ?? '/app'
  if (user) return <Navigate to="/app" replace />

  const validate = () => {
    const next: typeof errors = {}
    if (!EMAIL_RE.test(email.trim())) next.email = 'Enter a valid work email address.'
    if (!password) next.password = 'Enter your password.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setFormError('')
    if (!validate()) return
    setLoading(true)
    try {
      await login(email.trim(), password, remember)
      navigate(destination, { replace: true })
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      kicker="Welcome back"
      headline="Pick up where your business left off."
      points={[
        { title: 'One workspace', text: 'Finance, sales, inventory and people together.' },
        { title: 'Live insight', text: 'KPIs and reports that update as work happens.' },
        { title: 'Controlled access', text: 'Roles and approvals keep every action governed.' },
      ]}
    >
      <div className="auth-card">
        <span className="hexb badge" style={{ '--g1': '#8a3fd1', '--g2': '#1fc8c0' } as CSSProperties}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#3b3b44" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'relative' }}>
            <rect x="5" y="10.5" width="14" height="9.5" rx="3" />
            <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
          </svg>
        </span>
        <div className="head">
          <h2>Welcome <em>back</em></h2>
          <p className="sub">Log in to your Optiva workspace.</p>
        </div>

        <form onSubmit={submit} noValidate>
          <Field id="email" label="Work email" icon="mail" type="email" placeholder="you@company.com" autoComplete="email" value={email} onChange={setEmail} error={errors.email} />
          <Field id="password" label="Password" icon="lock" type="password" placeholder="Enter your password" autoComplete="current-password" value={password} onChange={setPassword} error={errors.password} />

          <div className="row">
            <label className="chk">
              <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} /> Keep me signed in
            </label>
            <a href="#" onClick={e => { e.preventDefault(); setNote('Password reset by email is not enabled in this demo.') }}>Forgot password?</a>
          </div>

          {formError && <p className="msg" role="alert" style={{ display: 'block', marginTop: 14 }}>{formError}</p>}

          <button className={`submit${loading ? ' loading' : ''}`} type="submit">Log in</button>

          <button
            type="button"
            className="social"
            style={{ width: '100%', marginTop: 12 }}
            onClick={() => { setEmail('demo@optiva.com'); setPassword('Optiva@123'); setErrors({}); setFormError('') }}
          >
            Fill demo account
          </button>

          <SocialButtons onClick={() => setNote('Single sign-on is a placeholder in this demo. Connect your identity provider to enable it.')} />
          <p className="note">{note}</p>
        </form>
      </div>
      <p className="alt">New to Optiva? <Link to="/signup">Create an account</Link></p>
    </AuthShell>
  )
}
