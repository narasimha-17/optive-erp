import { useState, type CSSProperties, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { ApiError } from '../../api/client'
import { useAuth } from '../../auth/AuthContext'
import { AuthShell } from './AuthShell'
import { EMAIL_RE, Field, SocialButtons, strength } from './fields'

const LEVELS: Array<[string, string]> = [
  ['', '#ececf4'],
  ['Weak', '#ff5a5f'],
  ['Fair', '#ff9a2f'],
  ['Good', '#ffd23f'],
  ['Strong', '#2fd0c0'],
]

type FieldName = 'name' | 'email' | 'company' | 'password' | 'terms'

export default function Signup() {
  const { user, signup } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', company: '', password: '' })
  const [terms, setTerms] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({})
  const [formError, setFormError] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)

  if (user) return <Navigate to="/app" replace />

  const set = (key: keyof typeof form) => (value: string) => {
    setForm(f => ({ ...f, [key]: value }))
    if (errors[key]) setErrors(e => ({ ...e, [key]: undefined }))
  }
  const level = strength(form.password)

  const validate = () => {
    const next: typeof errors = {}
    if (form.name.trim().length < 2) next.name = 'Please enter your full name.'
    if (!EMAIL_RE.test(form.email.trim())) next.email = 'Enter a valid work email address.'
    if (form.company.trim().length < 2) next.company = 'Please enter your company name.'
    if (form.password.length < 8 || level < 2) next.password = 'Use at least 8 characters with a mix of letters and numbers.'
    if (!terms) next.terms = 'Please accept the terms to continue.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setFormError('')
    if (!validate()) return
    setLoading(true)
    try {
      await signup({ name: form.name.trim(), email: form.email.trim(), company: form.company.trim(), password: form.password })
      navigate('/app', { replace: true })
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) setErrors(x => ({ ...x, email: err.message }))
        else if (Object.keys(err.fields).length) setErrors(x => ({ ...x, ...err.fields }))
        else setFormError(err.message)
      } else setFormError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      kicker="Get started"
      headline="Bring your whole business together."
      points={[
        { title: 'Set up in minutes', text: 'Start with the modules your team needs today.' },
        { title: 'Grows with you', text: 'Add finance, procurement and HR as you scale.' },
        { title: 'Secure by design', text: 'Role-based access and approval workflows built in.' },
      ]}
    >
      <div className="auth-card">
        <span className="hexb badge" style={{ '--g1': '#ff5a5f', '--g2': '#ffc93c' } as CSSProperties}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#3b3b44" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'relative' }}>
            <circle cx="10" cy="8" r="3.6" />
            <path d="M3.5 20c.5-3.6 3-5.5 6.5-5.5M18 14v6M15 17h6" />
          </svg>
        </span>
        <div className="head">
          <h2>Create your <em>account</em></h2>
          <p className="sub">Start running your business in one place.</p>
        </div>

        <form onSubmit={submit} noValidate>
          <Field id="name" label="Full name" icon="user" placeholder="Alex Morgan" autoComplete="name" value={form.name} onChange={set('name')} error={errors.name} />
          <Field id="email" label="Work email" icon="mail" type="email" placeholder="you@company.com" autoComplete="email" value={form.email} onChange={set('email')} error={errors.email} />
          <Field id="company" label="Company" icon="building" placeholder="Your company name" autoComplete="organization" value={form.company} onChange={set('company')} error={errors.company} />
          <Field id="password" label="Password" icon="lock" type="password" placeholder="Create a password" autoComplete="new-password" value={form.password} onChange={set('password')} error={errors.password}>
            <div className="meter" aria-hidden="true">
              {[0, 1, 2, 3].map(i => (
                <i key={i} style={{ background: i < level ? LEVELS[level][1] : LEVELS[0][1] }} />
              ))}
            </div>
            <div className="meter-label">{level ? `Password strength: ${LEVELS[level][0]}` : 'Use 8+ characters with letters, numbers and a symbol.'}</div>
          </Field>

          <div className={`field${errors.terms ? ' err' : ''}`}>
            <label className="chk">
              <input type="checkbox" checked={terms} onChange={e => { setTerms(e.target.checked); setErrors(x => ({ ...x, terms: undefined })) }} />
              <span>I agree to the <a href="#">Terms</a> and <a href="#">Privacy Policy</a>.</span>
            </label>
            {errors.terms && <p className="msg" role="alert">{errors.terms}</p>}
          </div>

          {formError && <p className="msg" role="alert" style={{ display: 'block' }}>{formError}</p>}

          <button className={`submit${loading ? ' loading' : ''}`} type="submit">Create account</button>

          <SocialButtons onClick={() => setNote('Single sign-on is a placeholder in this demo. Connect your identity provider to enable it.')} />
          <p className="note">{note}</p>
        </form>
      </div>
      <p className="alt">Already have an account? <Link to="/login">Log in</Link></p>
    </AuthShell>
  )
}
