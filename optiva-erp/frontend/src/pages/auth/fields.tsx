import { useState, type InputHTMLAttributes, type ReactNode } from 'react'

const ICONS = {
  mail: (
    <svg className="ic" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M3.5 7.5 12 13l8.5-5.5" /></svg>
  ),
  lock: (
    <svg className="ic" viewBox="0 0 24 24"><rect x="4.5" y="10.5" width="15" height="10" rx="3" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /></svg>
  ),
  user: (
    <svg className="ic" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" /><path d="M4.5 20.5c.6-4 3.5-6 7.5-6s6.9 2 7.5 6" /></svg>
  ),
  building: (
    <svg className="ic" viewBox="0 0 24 24"><rect x="5" y="3.5" width="14" height="17" rx="2" /><path d="M9 8h2M13 8h2M9 12h2M13 12h2M10 20.5v-4h4v4" /></svg>
  ),
}

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label: string
  icon: keyof typeof ICONS
  value: string
  error?: string
  onChange: (value: string) => void
  children?: ReactNode
}

export function Field({ label, icon, value, error, onChange, children, type = 'text', id, ...rest }: FieldProps) {
  const [shown, setShown] = useState(false)
  const isPassword = type === 'password'
  return (
    <div className={`field${error ? ' err' : ''}`}>
      <label htmlFor={id}>{label}</label>
      <div className="input">
        {ICONS[icon]}
        <input id={id} type={isPassword && shown ? 'text' : type} value={value} onChange={e => onChange(e.target.value)} aria-invalid={Boolean(error)} {...rest} />
        {isPassword && (
          <button type="button" className="eye" aria-label={shown ? 'Hide password' : 'Show password'} onClick={() => setShown(s => !s)}>
            <svg viewBox="0 0 24 24">
              {shown ? (
                <path d="M3 3l18 18M10.6 6.2A9.8 9.8 0 0 1 12 6c6 0 9.5 6 9.5 6a16 16 0 0 1-3.2 3.8M6.5 7.6C4 9.2 2.5 12 2.5 12S6 18 12 18c1.6 0 3-.4 4.2-1M9.9 9.9a3 3 0 0 0 4.2 4.2" />
              ) : (
                <>
                  <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
                  <circle cx="12" cy="12" r="3" />
                </>
              )}
            </svg>
          </button>
        )}
      </div>
      {children}
      {error && <p className="msg" role="alert">{error}</p>}
    </div>
  )
}

export function SocialButtons({ onClick }: { onClick: () => void }) {
  return (
    <>
      <div className="divider">or continue with</div>
      <div className="socials">
        <button type="button" className="social" onClick={onClick}>
          <svg viewBox="0 0 24 24"><path fill="#4285F4" d="M21.6 12.23c0-.68-.06-1.33-.17-1.96H12v3.71h5.39a4.6 4.6 0 0 1-2 3.02v2.5h3.23c1.89-1.74 2.98-4.3 2.98-7.27z" /><path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.42l-3.23-2.5c-.9.6-2.04.96-3.39.96-2.6 0-4.8-1.76-5.59-4.12H3.07v2.58A9.99 9.99 0 0 0 12 22z" /><path fill="#FBBC05" d="M6.41 13.92A6 6 0 0 1 6.1 12c0-.67.11-1.31.31-1.92V7.5H3.07a10 10 0 0 0 0 9z" /><path fill="#EA4335" d="M12 5.96c1.47 0 2.79.5 3.83 1.5l2.87-2.87C16.95 2.99 14.7 2 12 2 8.1 2 4.73 4.24 3.07 7.5l3.34 2.58C7.2 7.72 9.4 5.96 12 5.96z" /></svg>
          Google
        </button>
        <button type="button" className="social" onClick={onClick}>
          <svg viewBox="0 0 24 24"><path fill="#F25022" d="M3 3h8.5v8.5H3z" /><path fill="#7FBA00" d="M12.5 3H21v8.5h-8.5z" /><path fill="#00A4EF" d="M3 12.5h8.5V21H3z" /><path fill="#FFB900" d="M12.5 12.5H21V21h-8.5z" /></svg>
          Microsoft
        </button>
      </div>
    </>
  )
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function strength(pw: string): number {
  let s = 0
  if (pw.length >= 8) s++
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++
  if (/\d/.test(pw)) s++
  if (/[^A-Za-z0-9]/.test(pw) || pw.length >= 14) s++
  return pw ? Math.max(1, s) : 0
}
