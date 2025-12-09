'use client'

import { useState, useEffect } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter } from 'next/navigation'

export default function EmailVerification() {
  const [verificationStatus, setVerificationStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClientComponentClient()

  useEffect(() => {
    const verifyEmail = async () => {
      try {
        // Get the current URL parameters
        const searchParams = new URLSearchParams(window.location.search)
        const token = searchParams.get('token')
        const type = searchParams.get('type')

        if (!token || !type) {
          throw new Error('Invalid verification link')
        }

        // Verify the email
        const { error } = await supabase.auth.exchangeCodeForSession(token)

        if (error) {
          throw error
        }

        // Successful verification
        setVerificationStatus('success')

        // Redirect to dashboard after a short delay
        setTimeout(() => {
          router.push('/dashboard')
        }, 3000)

      } catch (err: any) {
        console.error('Email verification error:', err)
        setVerificationStatus('error')
        setErrorMessage(err.message || 'Email verification failed')
      }
    }

    verifyEmail()
  }, [router, supabase])

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {verificationStatus === 'loading' && (
            <div className="text-center">
              <div className="animate-spin inline-block w-8 h-8 border-[3px] border-current border-t-transparent text-blue-600 rounded-full" role="status" aria-label="loading">
                <span className="sr-only">Loading...</span>
              </div>
              <p className="mt-4 text-gray-600">Verifying your email...</p>
            </div>
          )}

          {verificationStatus === 'success' && (
            <div className="text-center">
              <svg className="mx-auto mb-4 w-16 h-16 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
              </svg>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Email Verified!</h2>
              <p className="text-gray-600">You will be redirected to the dashboard shortly.</p>
            </div>
          )}

          {verificationStatus === 'error' && (
            <div className="text-center">
              <svg className="mx-auto mb-4 w-16 h-16 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Verification Failed</h2>
              <p className="text-red-600 mb-4">{errorMessage || 'Unable to verify email'}</p>
              <button 
                onClick={() => router.push('/login')}
                className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Return to Login
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}