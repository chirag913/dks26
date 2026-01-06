'use client'

import React, { useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { X } from 'lucide-react'

type Props = {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => Promise<void>
}

export default function SubscriptionModal({
  isOpen,
  onClose,
  onSuccess,
}: Props) {
  const supabase = createClientComponentClient()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [authToken, setAuthToken] = useState<string | null>(null)

  /* ================= GET SESSION SAFELY ================= */
  useEffect(() => {
    const loadSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      setAuthToken(session?.access_token ?? null)
    }

    loadSession()
  }, [supabase])

  /* ================= START TRIAL ================= */
  const startTrial = async () => {
    if (!authToken) {
      setError('User not authenticated')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/subscription/start-trial', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
      })

      if (!res.ok) {
        const j = await res.json()
        throw new Error(j.error || 'Failed to start trial')
      }

      await onSuccess()
    } catch (e: any) {
      setError(e.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl p-6 relative">
        {/* CLOSE */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-700"
        >
          <X className="h-5 w-5" />
        </button>

        {/* HEADER */}
        <h2 className="text-xl font-semibold text-gray-900">
          Start Free Trial
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Enable risk protection instantly. No card required.
        </p>

        {/* ERROR */}
        {error && (
          <div className="mt-4 rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* ACTION */}
        <button
          disabled={loading}
          onClick={startTrial}
          className={`mt-6 w-full rounded-xl py-3 text-sm font-semibold transition ${
            loading
              ? 'bg-gray-200 text-gray-500'
              : 'bg-gray-900 text-white hover:bg-gray-800'
          }`}
        >
          {loading ? 'Starting…' : 'Start 7-Day Free Trial'}
        </button>

        <p className="mt-3 text-xs text-gray-500 text-center">
          Trial auto-expires. No auto-billing.
        </p>
      </div>
    </div>
  )
}
