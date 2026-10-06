const TOKEN_KEY = 'optiva_token'

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY),
  set: (token: string, remember: boolean) => {
    tokenStore.clear()
    ;(remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, token)
  },
  clear: () => {
    localStorage.removeItem(TOKEN_KEY)
    sessionStorage.removeItem(TOKEN_KEY)
  },
}

export class ApiError extends Error {
  status: number
  /** field name -> message, filled for validation errors (HTTP 422) */
  fields: Record<string, string>

  constructor(status: number, message: string, fields: Record<string, string> = {}) {
    super(message)
    this.status = status
    this.fields = fields
  }
}

interface Options {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
}

export async function api<T>(path: string, { method = 'GET', body }: Options = {}): Promise<T> {
  const headers: Record<string, string> = {}
  const token = tokenStore.get()
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  let res: Response
  try {
    res = await fetch(`/api${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  } catch {
    throw new ApiError(0, 'Cannot reach the Optiva server. Check that the backend is running.')
  }

  if (res.ok) return (await res.json()) as T

  let message = 'Something went wrong. Please try again.'
  const fields: Record<string, string> = {}
  try {
    const data = await res.json()
    if (typeof data.detail === 'string') message = data.detail
    else if (Array.isArray(data.detail)) {
      for (const item of data.detail as Array<{ loc: string[]; msg: string }>) {
        const field = item.loc[item.loc.length - 1]
        const text = item.msg.replace(/^Value error, /, '')
        fields[field] = text.charAt(0).toUpperCase() + text.slice(1) + (text.endsWith('.') ? '' : '.')
      }
      message = Object.values(fields)[0] ?? message
    }
  } catch {
    /* non-JSON error body */
  }
  throw new ApiError(res.status, message, fields)
}
