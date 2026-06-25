'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import SuitcaseLoader from '../components/SuitcaseLoader'

/** Legacy preview create flow — new trips are created from the dashboard. */
export default function CreateTripRedirect() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/dashboard')
  }, [router])

  return <SuitcaseLoader message="Opening dashboard" />
}
