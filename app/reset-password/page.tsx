// app/reset-password/page.tsx
import dynamic from 'next/dynamic'
import React from 'react'

export const metadata = {
  title: 'Reset password',
}

// dynamic import of client component with SSR disabled to avoid prerender/runtime errors
const ResetPasswordClient = dynamic(() => import('./ResetPasswordClient'), { ssr: false })
export default function Page() {
  return (
    <main>
      <ResetPasswordClient />
    </main>
  )
}
