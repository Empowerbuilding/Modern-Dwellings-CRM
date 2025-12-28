'use client'

import { useRouter } from 'next/navigation'

export function BackButton() {
  const router = useRouter()

  return (
    <button
      onClick={() => router.push('/pipeline')}
      className="text-sm text-gray-500 hover:text-gray-700"
    >
      ← Back to Pipeline
    </button>
  )
}
