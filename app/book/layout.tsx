import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Book a Meeting',
  description: 'Schedule a meeting',
}

/**
 * Layout for booking pages - no sidebar, no CRM navigation
 * These pages are public and should not show the authenticated user's dashboard
 */
export default function BookingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      {children}
    </div>
  )
}
