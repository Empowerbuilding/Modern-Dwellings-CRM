import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { createClient } from '@/lib/supabase-server'
import { supabase } from '@/lib/supabase'
import { AppProviders } from '@/components/app-providers'
import { QuickAddDealWrapper } from '@/components/quick-add-deal'
import { Sidebar } from '@/components/sidebar'
import type { User } from '@/lib/types'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'CRM Dashboard',
  description: 'Design and Construction CRM',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const serverSupabase = await createClient()
  const { data: { user: supabaseUser } } = await serverSupabase.auth.getUser()

  // Fetch CRM user if authenticated
  let crmUser: User | null = null
  if (supabaseUser?.email) {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('email', supabaseUser.email)
      .single()
    crmUser = data as User | null
  }

  const isLoginPage = false // This will be handled by login page's own layout

  return (
    <html lang="en">
      <body className={inter.className}>
        <AppProviders initialUser={supabaseUser} initialCrmUser={crmUser}>
          {supabaseUser ? (
            <QuickAddDealWrapper>
              <Sidebar />
              <div className="md:ml-16 lg:ml-56 min-h-screen">
                {children}
              </div>
            </QuickAddDealWrapper>
          ) : (
            children
          )}
        </AppProviders>
      </body>
    </html>
  )
}
