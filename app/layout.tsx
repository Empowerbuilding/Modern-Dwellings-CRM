import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { QuickAddDealWrapper } from '@/components/quick-add-deal'
import { Sidebar } from '@/components/sidebar'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'CRM Dashboard',
  description: 'Design and Construction CRM',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <QuickAddDealWrapper>
          <Sidebar />
          <div className="ml-16 lg:ml-56 min-h-screen transition-all">
            {children}
          </div>
        </QuickAddDealWrapper>
      </body>
    </html>
  )
}
