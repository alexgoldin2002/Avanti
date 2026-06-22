const API_VERSION = '1'

export function isGetYourGuideConfigured(): boolean {
  return Boolean(process.env.GETYOURGUIDE_ACCESS_TOKEN?.trim())
}

function apiBase(): string {
  return process.env.GETYOURGUIDE_API_BASE?.trim() || 'https://api.getyourguide.com'
}

function accessToken(): string | null {
  return process.env.GETYOURGUIDE_ACCESS_TOKEN?.trim() || null
}

export async function gygFetch<T>(
  path: string,
  query: Record<string, string | number | undefined> = {}
): Promise<T> {
  const token = accessToken()
  if (!token) throw new Error('GetYourGuide not configured')

  const url = new URL(`${apiBase()}/${API_VERSION}${path}`)
  for (const [key, value] of Object.entries(query)) {
    if (value != null && value !== '') url.searchParams.set(key, String(value))
  }

  const res = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
      'X-ACCESS-TOKEN': token,
    },
    next: { revalidate: 0 },
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = (data as { error?: { message?: string }; message?: string }).error?.message
      || (data as { message?: string }).message
      || `GetYourGuide request failed (${res.status})`
    throw new Error(err)
  }
  return data as T
}
