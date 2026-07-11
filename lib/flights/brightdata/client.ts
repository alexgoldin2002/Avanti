const DATASET_ID = 'gd_mhng7wen1rw0a3gvpf'

export function isBrightDataConfigured(): boolean {
  return Boolean(process.env.BRIGHT_DATA_API_KEY?.trim())
}

export function getBrightDataApiKey(): string | null {
  return process.env.BRIGHT_DATA_API_KEY?.trim() || null
}

export const BRIGHT_DATA_FLIGHTS_DATASET_ID = DATASET_ID

export async function brightDataScrape<T>(
  params: Record<string, string>,
  body: unknown[]
): Promise<{ ok: boolean; data: T | null; error?: string }> {
  const apiKey = getBrightDataApiKey()
  if (!apiKey) return { ok: false, data: null }

  const query = new URLSearchParams({ format: 'json', ...params })
  const url = `https://api.brightdata.com/datasets/v3/scrape?${query}`

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(55_000),
    })

    const text = await response.text()
    if (!response.ok) {
      return { ok: false, data: null, error: text.slice(0, 300) || `HTTP ${response.status}` }
    }

    const parsed = JSON.parse(text) as T
    return { ok: true, data: parsed }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Bright Data request failed'
    return { ok: false, data: null, error: msg }
  }
}
