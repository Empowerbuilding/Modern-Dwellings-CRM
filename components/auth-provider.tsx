'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import type { User } from '@/lib/types'

interface AuthContextType {
  supabaseUser: SupabaseUser | null
  crmUser: User | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  supabaseUser: null,
  crmUser: null,
  loading: true,
  signOut: async () => {},
})

export function useAuth() {
  return useContext(AuthContext)
}

interface AuthProviderProps {
  children: React.ReactNode
  initialUser: SupabaseUser | null
  initialCrmUser: User | null
}

export function AuthProvider({ children, initialUser, initialCrmUser }: AuthProviderProps) {
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(initialUser)
  const [crmUser, setCrmUser] = useState<User | null>(initialCrmUser)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      const user = session?.user ?? null
      setSupabaseUser(user)

      if (user?.email) {
        // Fetch CRM user data
        const { data } = await supabase
          .from('users')
          .select('*')
          .eq('email', user.email)
          .single()
        setCrmUser(data as User | null)
      } else {
        setCrmUser(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [supabase])

  const signOut = async () => {
    console.log('signOut function started')

    // Clear state immediately
    setSupabaseUser(null)
    setCrmUser(null)

    // Clear localStorage
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i)
        if (key && key.startsWith('sb-')) {
          localStorage.removeItem(key)
        }
      }
    } catch (err) {
      console.error('Error clearing localStorage:', err)
    }

    // Call server-side signout to clear cookies
    try {
      await fetch('/api/auth/signout', { method: 'POST' })
    } catch (err) {
      console.error('Server signout error:', err)
    }

    // Force redirect
    console.log('Redirecting to login...')
    window.location.href = '/login'
  }

  return (
    <AuthContext.Provider value={{ supabaseUser, crmUser, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}
