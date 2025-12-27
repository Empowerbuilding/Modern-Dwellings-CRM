'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

interface QuickAddDealContextType {
  isOpen: boolean
  open: () => void
  close: () => void
  toggle: () => void
}

const QuickAddDealContext = createContext<QuickAddDealContextType | null>(null)

export function QuickAddDealProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)

  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])
  const toggle = useCallback(() => setIsOpen((prev) => !prev), [])

  return (
    <QuickAddDealContext.Provider value={{ isOpen, open, close, toggle }}>
      {children}
    </QuickAddDealContext.Provider>
  )
}

export function useQuickAddDeal() {
  const context = useContext(QuickAddDealContext)
  if (!context) {
    throw new Error('useQuickAddDeal must be used within QuickAddDealProvider')
  }
  return context
}
