import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'Avanti Trip Invitation'
export const size = { width: 1200, height: 630 }

export default async function Image({ params }: { params: { code: string } }) {
  return new ImageResponse(
    (
      <div style={{ background: '#1a1a1a', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: '80px', letterSpacing: '0.3em', color: '#ffffff', fontWeight: 300, marginBottom: '24px' }}>AVANTI</div>
        <div style={{ fontSize: '32px', color: 'rgba(255,255,255,0.7)', letterSpacing: '0.1em' }}>You have been invited to join a trip</div>
      </div>
    ),
    { ...size }
  )
}
