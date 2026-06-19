/** Best-effort fetch of page title/description for articles and link previews. */
export async function fetchUrlMeta(url: string): Promise<{ title: string | null; description: string | null; text: string | null }> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AvantiBot/1.0)',
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    })
    clearTimeout(timeout)
    if (!res.ok) return { title: null, description: null, text: null }
    const html = (await res.text()).slice(0, 50000)

    const og = (prop: string) => {
      const m = html.match(new RegExp(`property=["']og:${prop}["'][^>]*content=["']([^"']+)`, 'i'))
        || html.match(new RegExp(`content=["']([^"']+)["'][^>]*property=["']og:${prop}`, 'i'))
      return m?.[1] || null
    }
    const title =
      og('title') ||
      html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ||
      null
    const description = og('description') || html.match(/name=["']description["'][^>]*content=["']([^"']+)/i)?.[1] || null

    const bodyText = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 4000)

    return { title, description, text: bodyText || null }
  } catch {
    return { title: null, description: null, text: null }
  }
}

export function detectPlatform(url: string): string {
  const u = url.toLowerCase()
  if (u.includes('tiktok.com')) return 'tiktok'
  if (u.includes('instagram.com')) return 'instagram'
  if (u.includes('pinterest.')) return 'pinterest'
  if (u.includes('youtube.com') || u.includes('youtu.be')) return 'youtube'
  return 'article'
}
