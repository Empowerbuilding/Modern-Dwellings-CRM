'use client'

import { QuickAddDealProvider } from './context'
import { QuickAddDeal } from './quick-add-deal'
import { FloatingAddButton } from './floating-button'

export { useQuickAddDeal } from './context'

export function QuickAddDealWrapper({ children }: { children: React.ReactNode }) {
  return (
    <QuickAddDealProvider>
      {children}
      <QuickAddDeal />
      <FloatingAddButton />
    </QuickAddDealProvider>
  )
}
