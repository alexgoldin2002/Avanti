import type { Metadata } from 'next'
import { Cormorant_Garamond } from 'next/font/google'
import './globals.css'
const cormorant = Cormorant_Garamond({ subsets: ['latin'], weight: ['300', '400', '500', '600'], variable: '--font-cormorant' })
export const metadata: Metadata = { title: 'Avanti', description: 'Avanti handles it. You just show up.' }
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${cormorant.variable} antialiased`} style={{ fontFamily: 'var(--font-cormorant), Georgia, serif', background: '#fafaf8', color: '#1a1a1a' }}>{children}</body>
    </html>
  )
}
