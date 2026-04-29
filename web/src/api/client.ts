// Thin fetch wrapper: same-origin in dev (proxied by Vite), absolute in prod.
const BASE = import.meta.env.VITE_API_BASE_URL ?? ''

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

type Opts = {
  method?: string
  body?: unknown
  csrfToken?: string
  // For multipart uploads — pass FormData as body and set raw=true to skip JSON encoding.
  raw?: boolean
}

export async function api<T>(path: string, opts: Opts = {}): Promise<T> {
  const headers: Record<string, string> = {}
  if (opts.csrfToken) headers['X-CSRF-Token'] = opts.csrfToken

  let body: BodyInit | undefined
  if (opts.body !== undefined) {
    if (opts.raw) {
      body = opts.body as BodyInit
    } else {
      headers['Content-Type'] = 'application/json'
      body = JSON.stringify(opts.body)
    }
  }

  const res = await fetch(`${BASE}${path}`, {
    method: opts.method ?? (opts.body !== undefined ? 'POST' : 'GET'),
    credentials: 'include',
    headers,
    body,
  })

  if (res.status === 204) return undefined as T
  const text = await res.text()
  const data = text ? JSON.parse(text) : null
  if (!res.ok) {
    const detail = (data && typeof data === 'object' && 'detail' in data) ? String(data.detail) : res.statusText
    throw new ApiError(res.status, detail)
  }
  return data as T
}
