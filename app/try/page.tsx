'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/** Legacy URL — opens the home page try-it panel. */
export default function TryPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/#try-it')
  }, [router])

  return null
}
