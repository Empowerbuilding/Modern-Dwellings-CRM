'use client'

import { AuthProvider } from './auth-provider'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import type { User } from '@/lib/types'

interface AppProvidersProps {
  children: React.ReactNode
  initialUser: SupabaseUser | null
  initialCrmUser: User | null
}

export function AppProviders({ children, initialUser, initialCrmUser }: AppProvidersProps) {
  return (
    <AuthProvider initialUser={initialUser} initialCrmUser={initialCrmUser}>
      {children}
    </AuthProvider>
  )
}
