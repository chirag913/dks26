// app/reset-password/ResetPasswordClient.tsx


"use client"

import React, { useState, useEffect, useMemo } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

export default function ResetPasswordClient() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [showEmailInput, setShowEmailInput] = useState(false)
  const [tokenExchanged, setTokenExchanged] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClientComponentClient()

  const passwordStrength = useMemo(() => {
    let score = 0
    if (password.length >= 8) score++
    if (/[A-Z]/.test(password)) score++
    if (/[0-9]/.test(password)) score++
    if (/[^A-Za-z0-9]/.test(password)) score++
    return score
  }, [password])

  useEffect(() => {
    const processToken = async () => {
      try {
        const code = searchParams?.get('code')
        const type = searchParams?.get('type')
        const errorCode = searchParams?.get('error_code')
        const errorDescription = searchParams?.get('error_description')

        if (errorCode) {
          console.error('Reset link error:', errorCode, errorDescription)
          setError(errorDescription || 'The reset link is invalid or expired. Please request a new one.')
          setShowEmailInput(true)
          return
        }

        if (code && type === 'recovery' && !tokenExchanged) {
          setLoading(true)
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
          if (exchangeError) {
            console.error('Exchange error:', exchangeError)
            setError('Invalid or expired reset link. Please request a new password reset.')
            setShowEmailInput(true)
            return
          }
          setTokenExchanged(true)
          setShowEmailInput(false)
        } else if (!code) {
          setShowEmailInput(true)
        }
      } catch (err) {
        console.error('Exchange exception:', err)
        setError('An error occurred processing your reset link. Please try again.')
        setShowEmailInput(true)
      } finally {
        setLoading(false)
      }
    }

    processToken()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setMessage(null)

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long')
      return
    }
    if (!tokenExchanged) {
      setError('Invalid reset attempt. Please use the link from your email or request a new one.')
      setShowEmailInput(true)
      return
    }

    try {
      setLoading(true)
      const { error } = await supabase.auth.updateUser({ password })
      if (error) {
        console.error('Update password error:', error)
        setError(error.message)
        return
      }
      setMessage('Password successfully reset. Redirecting to sign in...')
      setTimeout(() => router.push('/login'), 1800)
    } catch (err) {
      console.error('Unexpected reset error:', err)
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setMessage(null)

    if (!email) {
      setError('Please enter your email address.')
      return
    }

    try {
      setLoading(true)
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${typeof window !== 'undefined' ? window.location.origin : ''}/reset-password`,
      })
      if (error) {
        console.error('Reset email error:', error)
        setError(error.message)
        return
      }
      setMessage('If an account exists, a reset link was sent. Check your inbox and spam folder.')
    } catch (err) {
      console.error('Forgot password exception:', err)
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const toggleEmailInput = () => {
    setShowEmailInput((s) => !s)
    setError(null)
    setMessage(null)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 rounded-lg p-2 shadow-md" aria-hidden>
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L15 8H9L12 2Z" fill="white" />
              <path d="M12 22L9 16H15L12 22Z" fill="white" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Reset your password</h1>
            <p className="text-sm text-gray-500">Securely reset your account password.</p>
          </div>
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
          {error && <div className="rounded-md bg-red-50 border border-red-100 p-3 text-sm text-red-700">{error}</div>}
          {message && <div className="rounded-md bg-green-50 border border-green-100 p-3 text-sm text-green-700">{message}</div>}

          {showEmailInput ? (
            <form onSubmit={handleForgotPassword} className="space-y-5 mt-4" noValidate>
              <div>
                <label className="block text-sm font-medium text-gray-700">Email address</label>
                <input
                  name="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  placeholder="you@company.com"
                  className="mt-1 block w-full px-3 py-2 border border-gray-200 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full inline-flex items-center justify-center px-4 py-2 rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? 'Sending...' : 'Send reset link'}
                </button>
              </div>

              <div className="text-center">
                <button type="button" onClick={toggleEmailInput} className="text-blue-600 hover:underline text-sm">
                  Back
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-5 mt-4" noValidate>
              <div>
                <label className="block text-sm font-medium text-gray-700">New password</label>
                <div className="relative">
                  <input
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    placeholder="Choose a strong password"
                    className="mt-1 block w-full px-3 py-2 border border-gray-200 rounded-lg shadow-sm pr-10 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute inset-y-0 right-2 flex items-center px-2 text-sm text-gray-500"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <div className="flex-1 h-2 bg-gray-100 rounded overflow-hidden">
                    <div
                      style={{ width: `${(passwordStrength / 4) * 100}%` }}
                      className={`h-full rounded transition-all duration-200 ${
                        passwordStrength <= 1 ? 'bg-red-400' : passwordStrength === 2 ? 'bg-yellow-400' : 'bg-green-400'
                      }`}
                    />
                  </div>
                  <div className="text-xs text-gray-500 w-24 text-right">
                    {passwordStrength <= 1 ? 'Weak' : passwordStrength === 2 ? 'Okay' : 'Strong'}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Confirm new password</label>
                <input
                  name="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={loading}
                  placeholder="Confirm password"
                  className="mt-1 block w-full px-3 py-2 border border-gray-200 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full inline-flex items-center justify-center px-4 py-2 rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? 'Resetting...' : 'Reset password'}
                </button>
              </div>

              <div className="text-center">
                <button type="button" onClick={toggleEmailInput} className="text-blue-600 hover:underline text-sm">
                  Need to request a new link?
                </button>
              </div>
            </form>
          )}

          <div className="mt-6">
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">
                Remembered your password?{' '}
                <Link href="/login" className="text-blue-600 hover:underline">
                  Sign in
                </Link>
              </span>
            </div>
          </div>
        </div>

        <p className="text-xs text-center text-gray-400">Made with care · KillSwitch Pro</p>
      </div>
    </div>
  )
}
