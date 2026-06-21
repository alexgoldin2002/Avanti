import { Duffel } from '@duffel/api'

let client: Duffel | null | undefined

export function isDuffelConfigured(): boolean {
  return Boolean(process.env.DUFFEL_ACCESS_TOKEN?.trim())
}

export function getDuffelClient(): Duffel | null {
  if (client !== undefined) return client
  const token = process.env.DUFFEL_ACCESS_TOKEN?.trim()
  if (!token) {
    client = null
    return null
  }
  client = new Duffel({ token })
  return client
}
