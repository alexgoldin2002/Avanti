const SCRIPT_ID = 'google-maps-script'

type GoogleNS = {
  maps?: {
    places?: unknown
  }
}

export function isGooglePlacesReady(): boolean {
  if (typeof window === 'undefined') return false
  return Boolean((window as Window & { google?: GoogleNS }).google?.maps?.places)
}

/** Load Maps JS API once with Google's recommended async bootstrap. */
export function loadGoogleMapsScript(): void {
  if (typeof window === 'undefined') return
  if (isGooglePlacesReady()) return
  if (document.getElementById(SCRIPT_ID)) return

  const key = process.env.NEXT_PUBLIC_GOOGLE_PLACES_KEY?.trim()
  if (!key) return

  const script = document.createElement('script')
  script.id = SCRIPT_ID
  script.async = true
  script.defer = true
  script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places&loading=async`
  document.head.appendChild(script)
}

/** Resolve when the Places library is available (polls after script load). */
export function whenGooglePlacesReady(timeoutMs = 10_000): Promise<void> {
  if (isGooglePlacesReady()) return Promise.resolve()

  loadGoogleMapsScript()

  return new Promise(resolve => {
    const started = Date.now()
    const tick = () => {
      if (isGooglePlacesReady()) {
        resolve()
        return
      }
      if (Date.now() - started >= timeoutMs) {
        resolve()
        return
      }
      window.setTimeout(tick, 50)
    }
    tick()
  })
}
