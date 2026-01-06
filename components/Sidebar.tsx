'use client'

import React, { useState, useCallback, useEffect } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter } from 'next/navigation'
import {
  X,
  Home,
  Key,
  CreditCard,
  LogOut,
  Menu,
  HelpCircle,
  AlertCircle,
  User,
  Clock
} from 'lucide-react'
import { validateApiKey } from '@/utils/api'
import SubscriptionModal from './SubscriptionModal'

interface SidebarProps {
  isMobile?: boolean
}

interface SubscriptionRow {
  id: string
  status: string
  start_date: string
  end_date: string
  total_amount: number
  is_trial?: boolean
}

const Sidebar: React.FC<SidebarProps> = ({ isMobile = false }) => {
  const supabase = createClientComponentClient()
  const router = useRouter()

  /* ===================== STATE ===================== */

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false)

  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [isApproved, setIsApproved] = useState(false)
  const [subscription, setSubscription] = useState<SubscriptionRow | null>(null)

  const [apiKey, setApiKey] = useState('')
  const [savedApiKey, setSavedApiKey] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const [canEditApi, setCanEditApi] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)
  const [endDateIso, setEndDateIso] = useState<string | null>(null)
  const [checkingStatus, setCheckingStatus] = useState(false)

  /* ===================== LOAD USER ===================== */

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? null)
    })
  }, [supabase])

  /* ===================== LOAD SAVED API KEY ===================== */

  const loadSavedApiKey = useCallback(async () => {
    const { data } = await supabase.auth.getUser()
    if (!data.user) return

    const { data: cfg } = await supabase
      .from('trading_configs')
      .select('api_key')
      .eq('user_id', data.user.id)
      .maybeSingle()

    setSavedApiKey(cfg?.api_key ?? null)
  }, [supabase])

  useEffect(() => {
    loadSavedApiKey()
  }, [loadSavedApiKey])

  /* ===================== APPROVED USERS ===================== */

  useEffect(() => {
    const run = async () => {
      const { data } = await supabase.auth.getUser()
      const email = data.user?.email?.toLowerCase()
      if (!email) return

      const { data: rows } = await supabase
        .from('approved_users')
        .select('email')
        .eq('email', email)
        .limit(1)

      if (rows?.length) setIsApproved(true)
    }
    run()
  }, [supabase])

  /* ===================== SUBSCRIPTION CHECK (SERVER) ===================== */

  const fetchCheckStatus = useCallback(async () => {
    setCheckingStatus(true)
    try {
      const res = await fetch('/api/subscription/check-status', {
        method: 'GET',
        credentials: 'include'
      })

      const json = await res.json()
      if (!res.ok) {
        setCanEditApi(false)
        setStatus(null)
        setSecondsLeft(null)
        setEndDateIso(null)
        return
      }

      setStatus(json.status ?? null)
      setCanEditApi(Boolean(json.can_edit_api))
      setSecondsLeft(typeof json.seconds_left === 'number' ? json.seconds_left : null)
      setEndDateIso(json.end_date ?? null)
      setSubscription(json.subscription ?? null)

      if (json.can_edit_api) {
        loadSavedApiKey()
      }
    } finally {
      setCheckingStatus(false)
    }
  }, [loadSavedApiKey])

  useEffect(() => {
    fetchCheckStatus()
    const id = setInterval(fetchCheckStatus, 60_000)
    return () => clearInterval(id)
  }, [fetchCheckStatus])

  /* ===================== API KEY SAVE ===================== */

  const handleSaveApiKey = async (e?: React.FormEvent) => {
    e?.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const trimmed = apiKey.trim()
      if (!trimmed) throw new Error('API key cannot be empty')

      let valid = await validateApiKey(trimmed)
      if (!valid) throw new Error('Invalid API key')

      const res = await fetch('/api/trading-config/save', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: trimmed })
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? 'Save failed')

      setSavedApiKey(trimmed)
      setApiKey('')
      setMessage('API key saved')
      await fetchCheckStatus()
      setTimeout(() => setIsModalOpen(false), 1200)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }

  /* ===================== API KEY REMOVE ===================== */

  const handleRemoveApiKey = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/trading-config/save', {
        method: 'DELETE',
        credentials: 'include'
      })

      if (!res.ok) throw new Error('Failed')

      setSavedApiKey(null)
      await fetchCheckStatus()
    } catch (e) {
      setError('Failed to remove API key')
    } finally {
      setLoading(false)
    }
  }

  /* ===================== LOGOUT ===================== */

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  /* ===================== UI ===================== */

  const canEdit = isApproved || canEditApi

  return (
    <>
      <aside className="hidden lg:block w-72 bg-white border-r border-gray-100 fixed inset-y-0 left-0 p-4">
        <div className="flex flex-col h-full">
          <div className="mb-4">
            <div className="font-bold text-lg">KillSwitch</div>
            <div className="text-xs text-gray-500">{userEmail}</div>
          </div>

          <a href="/dashboard" className="flex items-center gap-3 px-3 py-2 rounded hover:bg-gray-50">
            <Home className="w-4 h-4" /> Dashboard
          </a>

          <div className="mt-4 p-3 border rounded bg-gray-50">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Key className="w-4 h-4" /> API Key
            </div>

            {savedApiKey ? (
              <>
                <div className="mt-2 text-xs font-mono truncate">
                  {savedApiKey.slice(0, 12)}…{savedApiKey.slice(-6)}
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={handleRemoveApiKey}
                    disabled={!canEdit}
                    className="flex-1 bg-red-500 text-white py-1 rounded disabled:opacity-40"
                  >
                    Remove
                  </button>
                  <button
                    onClick={() => canEdit ? setIsModalOpen(true) : setIsSubscriptionModalOpen(true)}
                    className="flex-1 border py-1 rounded"
                  >
                    Update
                  </button>
                </div>
              </>
            ) : (
              <button
                onClick={() => canEdit ? setIsModalOpen(true) : setIsSubscriptionModalOpen(true)}
                className="w-full mt-3 bg-black text-white py-2 rounded"
              >
                Enter API Key
              </button>
            )}
          </div>

          <div className="mt-auto pt-4 border-t">
            <button
              onClick={handleLogout}
              className="w-full bg-red-500 text-white py-2 rounded"
            >
              Logout
            </button>
          </div>
        </div>
      </aside>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
          <form onSubmit={handleSaveApiKey} className="bg-white p-6 rounded w-full max-w-md">
            <h3 className="font-semibold mb-3">Enter API Key</h3>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <input
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              className="w-full border p-2 mb-3 text-black"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setIsModalOpen(false)}>Cancel</button>
              <button type="submit" disabled={loading} className="bg-black text-white px-4 py-2 rounded">
                Save
              </button>
            </div>
          </form>
        </div>
      )}

      <SubscriptionModal
        isOpen={isSubscriptionModalOpen}
        onClose={() => setIsSubscriptionModalOpen(false)}
        onSuccess={fetchCheckStatus}
      />
    </>
  )
}

export default Sidebar
