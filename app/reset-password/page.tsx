// app/reset-password/page.tsx
import React, { Suspense } from 'react'
import ResetPasswordClient from './ResetPasswordClient'

export const metadata = {
  title: 'Reset password',
}

export default function Page() {
  return (
    <main>
      {/* Suspense ensures the server can prerender a fallback while the client hook (useSearchParams) waits */}
      <Suspense fallback={<div className="min-h-[200px] flex items-center justify-center">Loading…</div>}>
        <ResetPasswordClient />
      </Suspense>
    </main>
  )
}
