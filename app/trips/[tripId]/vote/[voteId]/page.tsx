'use client'
import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import SuitcaseLoader from '../../../../components/SuitcaseLoader'

/** Legacy group vote route — redirects to unified Choose destination flow. */
export default function GroupVoteRedirectPage() {
  const { tripId } = useParams() as { tripId: string }
  const router = useRouter()

  useEffect(() => {
    router.replace(`/trips/${tripId}/choose`)
  }, [tripId, router])

  return <SuitcaseLoader message="Opening destination decision" />
}
