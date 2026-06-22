import getLiteApi from 'liteapi-node-sdk'

let client: ReturnType<typeof getLiteApi> | null | undefined

export function isLiteApiConfigured(): boolean {
  return Boolean(process.env.LITEAPI_API_KEY?.trim())
}

export function getLiteApiClient() {
  if (client !== undefined) return client
  const key = process.env.LITEAPI_API_KEY?.trim()
  if (!key) {
    client = null
    return null
  }
  client = getLiteApi(key)
  return client
}
