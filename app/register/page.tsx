"use client"

import React, { useState, useMemo } from "react"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { useRouter } from "next/navigation"
import Link from "next/link"

export default function Register() {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    fullName: "",
    mobile: "",
    city: "",
    consent: false,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const router = useRouter()
  const supabase = createClientComponentClient()

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target
    setFormData((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }))
    setError(null)
    setSuccess(null)
  }

  // simple validators kept explicit and friendly
  const validateForm = () => {
    const { email, password, fullName, mobile, city, consent } = formData

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) return setErrorAndReturnFalse("Please enter a valid email address")

    if (password.length < 8) return setErrorAndReturnFalse("Password must be at least 8 characters")

    if (!fullName.trim()) return setErrorAndReturnFalse("Please enter your full name")

    if (!/^\d{10}$/.test(mobile)) return setErrorAndReturnFalse("Mobile number must be 10 digits")

    if (!city.trim()) return setErrorAndReturnFalse("City is required")

    if (!consent) return setErrorAndReturnFalse("You must accept the disclaimer to continue")

    return true
  }

  const setErrorAndReturnFalse = (msg: string) => {
    setError(msg)
    return false
  }

  const passwordStrength = useMemo(() => {
    const p = formData.password
    let score = 0
    if (p.length >= 8) score++
    if (/[A-Z]/.test(p)) score++
    if (/[0-9]/.test(p)) score++
    if (/[^A-Za-z0-9]/.test(p)) score++
    return score // 0..4
  }, [formData.password])

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)

    if (!validateForm()) {
      setLoading(false)
      return
    }

    const { email, password, fullName, mobile, city } = formData

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            mobile,
            city,
          },
        },
      })

      if (signUpError) {
        setError(signUpError.message || "Registration failed")
        setLoading(false)
        return
      }

      const user = data?.user
      if (!user) {
        setError("User creation failed — please try again")
        setLoading(false)
        return
      }

      // best-effort metadata update — not critical if it fails
      try {
        await supabase.auth.updateUser({
          data: { full_name: fullName, mobile, city },
        })
      } catch (metaErr) {
        // log silently; UI should not block on this
        console.warn("Metadata update failed", metaErr)
      }

      setSuccess("Registration successful — please check your email to confirm")
      // give a subtle delay for user to read success on the same page
      setTimeout(() => router.push("/login"), 1300)
    } catch (err) {
      setError("An unexpected error occurred — please try again")
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
            <h1 className="text-2xl font-semibold text-gray-900">Create your KillSwitch Pro account</h1>
            <p className="text-sm text-gray-500">Secure your trading risk with industry-grade tooling.</p>
          </div>
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
          <form className="space-y-5" onSubmit={handleRegister} noValidate>
            {error && (
              <div className="rounded-md bg-red-50 border border-red-100 p-3 text-sm text-red-700">
                {error}
              </div>
            )}
            {success && (
              <div className="rounded-md bg-green-50 border border-green-100 p-3 text-sm text-green-700">
                {success}
              </div>
            )}

            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Full name</label>
                <input
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  required
                  disabled={loading}
                  placeholder="Your full name"
                  className="mt-1 appearance-none block w-full px-3 py-2 border border-gray-200 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <input
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  disabled={loading}
                  placeholder="you@company.com"
                  className="mt-1 block w-full px-3 py-2 border border-gray-200 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Mobile</label>
                <input
                  name="mobile"
                  type="tel"
                  value={formData.mobile}
                  onChange={handleChange}
                  required
                  disabled={loading}
                  placeholder="10-digit mobile number"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className="mt-1 block w-full px-3 py-2 border border-gray-200 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">City</label>
                <input
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  required
                  disabled={loading}
                  placeholder="e.g. Mumbai"
                  className="mt-1 block w-full px-3 py-2 border border-gray-200 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="relative">
                <label className="block text-sm font-medium text-gray-700">Password</label>
                <div className="mt-1 relative">
                  <input
                    name="password"
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={handleChange}
                    required
                    disabled={loading}
                    placeholder="Choose a strong password"
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

                <div className="mt-2 flex items-center gap-3">
                  <div className="flex-1 h-2 bg-gray-100 rounded overflow-hidden">
                    <div
                      style={{ width: `${(passwordStrength / 4) * 100}%` }}
                      className={`h-full rounded transition-all duration-200 ${
                        passwordStrength <= 1
                          ? "bg-red-400"
                          : passwordStrength === 2
                          ? "bg-yellow-400"
                          : "bg-green-400"
                      }`}
                    />
                  </div>
                  <div className="text-xs text-gray-500 w-24 text-right">
                    {passwordStrength <= 1 ? "Weak" : passwordStrength === 2 ? "Okay" : "Strong"}
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <div className="bg-gray-50 p-4 rounded-lg text-sm text-gray-700">
                  <h4 className="font-medium">Important disclaimer</h4>
                  <p className="mt-2">By using KillSwitch Pro you acknowledge:</p>
                  <ul className="list-disc pl-5 mt-2 space-y-1">
                    <li>You are solely responsible for all trading decisions.</li>
                    <li>KillSwitch Pro provides risk management tools, not trading advice.</li>
                    <li>Past performance does not guarantee future results.</li>
                  </ul>
                </div>

                <label className="flex items-start gap-2 mt-3">
                  <input
                    name="consent"
                    type="checkbox"
                    checked={formData.consent}
                    onChange={handleChange}
                    disabled={loading}
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">
                    I have read and agree to the disclaimer and understand I am responsible for my trading decisions.
                  </span>
                </label>
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
                    <svg
                      className="animate-spin mr-2 h-4 w-4"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
                    </svg>
                    Creating account...
                  </>
                ) : (
                  "Create account"
                )}
              </button>
            </div>

            <div className="text-center text-sm text-gray-500">
              Already have an account?{' '}
              <Link className="text-blue-600 hover:underline" href="/login">
                Sign in
              </Link>
            </div>
          </form>
        </div>

        <p className="text-xs text-center text-gray-400">Made with care · KillSwitch Pro</p>
      </div>
    </div>
  )
}
