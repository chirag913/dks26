// app/reset-password/page.tsx
import React from 'react'
import ResetPasswordClient from './ResetPasswordClient'

export const metadata = {
  title: 'Reset password',
}

export default function Page() {
  // This is a Server Component that directly renders the client component.
  // ResetPasswordClient is a client component (it has "use client"), so
  // Next will ship it to the browser and hydrate it there.
  return (
    <main>
      <ResetPasswordClient />
    </main>
  )
}
