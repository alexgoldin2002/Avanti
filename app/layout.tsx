import { Cormorant_Garamond } from 'next/font/google'
import './globals.css'
const cormorant = Cormorant_Garamond({ subsets: ['latin'], weight: ['300', '400', '500', '600'], variable: '--font-cormorant' })
export const metadata = {
  title: 'Avanti',
  description: 'The best trips start here.',
}
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css" />
      </head>
      <body className={`${cormorant.variable} antialiased`} style={{ fontFamily: 'var(--font-cormorant), Georgia, serif', background: '#fafaf8', color: '#1a1a1a' }}>{children}</body>
    </html>
  )
}
