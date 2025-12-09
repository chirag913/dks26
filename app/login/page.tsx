"use client"

import React, { useState } from "react"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { useRouter } from "next/navigation"
import Link from "next/link"

export default function Login() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [, setEmailSent] = useState(false)
  const router = useRouter()
  const supabase = createClientComponentClient()

  const clearAlerts = () => {
    setError(null)
    setMessage(null)
    setEmailSent(false)
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    clearAlerts()
    setLoading(true)

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        // Provide friendly, actionable messages
        if (signInError.message.toLowerCase().includes("email")) {
          setError("Please verify your email first. Check your inbox (or spam) for the confirmation link.")
        } else {
          setError(signInError.message)
        }
      } else {
        // Success — take user to dashboard
        router.push("/dashboard")
        router.refresh()
      }
    } catch (err) {
      setError("An unexpected error occurred. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    clearAlerts()
    setLoading(true)

    if (!email) {
      setError("Please enter the email address associated with your account.")
      setLoading(false)
      return
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })

      if (error) setError(error.message)
      else {
        setMessage("Password reset instructions have been sent to your email.")
        setEmailSent(true)
        setShowForgotPassword(false)
      }
    } catch {
      setError("An unexpected error occurred. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleResendVerification = async () => {
    clearAlerts()
    setLoading(true)

    try {
      const { error } = await supabase.auth.resend({ type: "signup", email })
      if (error) setError(error.message)
      else setMessage("Verification email resent. Check your inbox.")
    } catch {
      setError("An unexpected error occurred. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 rounded-lg p-2 shadow-md">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
              <path d="M12 2L15 8H9L12 2Z" fill="white" />
              <path d="M12 22L9 16H15L12 22Z" fill="white" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Welcome back</h1>
            <p className="text-sm text-gray-500">Sign in to access your KillSwitch Pro dashboard.</p>
          </div>
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
          {showForgotPassword ? (
            <form onSubmit={handleForgotPassword} className="space-y-5" noValidate>
              {error && <div className="rounded-md bg-red-50 border border-red-100 p-3 text-sm text-red-700">{error}</div>}
              {message && <div className="rounded-md bg-green-50 border border-green-100 p-3 text-sm text-green-700">{message}</div>}

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
                  {loading ? (
                    <>
                      <svg className="animate-spin mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
                      </svg>
                      Sending...
                    </>
                  ) : (
                    "Send Reset Instructions"
                  )}
                </button>
              </div>

              <div className="text-sm text-center">
                <button type="button" onClick={() => setShowForgotPassword(false)} className="text-blue-600 hover:underline">
                  Back to Sign in
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-5" noValidate>
              {error && <div className="rounded-md bg-red-50 border border-red-100 p-3 text-sm text-red-700">{error}</div>}
              {message && <div className="rounded-md bg-green-50 border border-green-100 p-3 text-sm text-green-700">{message}</div>}

              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
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

              <div className="relative">
                <label className="block text-sm font-medium text-gray-700">Password</label>
                <div className="mt-1 relative">
                  <input
                    name="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    placeholder="Your password"
                    className="block w-full px-3 py-2 border border-gray-200 rounded-lg shadow-sm pr-10 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute inset-y-0 right-2 flex items-center px-2 text-sm text-gray-500"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full inline-flex items-center justify-center px-4 py-2 rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
                      </svg>
                      Signing in...
                    </>
                  ) : (
                    "Sign in"
                  )}
                </button>
              </div>

              <div className="flex items-center justify-between text-sm">
                <button type="button" onClick={() => { clearAlerts(); setShowForgotPassword(true); }} className="text-blue-600 hover:underline">
                  Forgot password?
                </button>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleResendVerification}
                    className="text-sm text-gray-500 hover:underline"
                    aria-label="Resend verification email"
                  >
                    Resend verification
                  </button>
                </div>
              </div>
            </form>
          )}

          <div className="mt-6">
            <div className="relative">
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">
                  Don't have an account?{' '}
                  <Link href="/register" className="text-blue-600 hover:underline">
                    Create account
                  </Link>
                </span>
              </div>
            </div>
          </div>
        </div>

        <p className="text-xs text-center text-gray-400">Made with care · KillSwitch Pro</p>
      </div>
    </div>
  )
}
