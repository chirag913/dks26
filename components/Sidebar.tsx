// components/Sidebar.tsx
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

  // UI state
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false)

  // User / app data
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [isApproved, setIsApproved] = useState(false)
  const [subscription, setSubscription] = useState<SubscriptionRow | null>(null)

  // API key state
  const [apiKey, setApiKey] = useState('')
  const [savedApiKey, setSavedApiKey] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  // server-derived state
  const [canEditApi, setCanEditApi] = useState<boolean>(false)
  const [status, setStatus] = useState<string | null>(null)
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)
  const [endDateIso, setEndDateIso] = useState<string | null>(null)
  const [checkingStatus, setCheckingStatus] = useState<boolean>(false)

  /* ---------- Helpers: load user, saved api, approved ---------- */

  const loadUser = useCallback(async () => {
    try {
      const { data, error } = await supabase.auth.getUser()
      if (error) {
        console.error('Error getting user:', error)
        return
      }
      setUserEmail(data.user?.email ?? null)
    } catch (err) {
      console.error('loadUser error:', err)
    }
  }, [supabase])

  useEffect(() => {
    loadUser()
  }, [loadUser])

  const loadSavedApiKey = useCallback(async () => {
    try {
      const { data, error: userErr } = await supabase.auth.getUser()
      if (userErr) {
        console.error('Error getting user for API key load:', userErr)
        return
      }
      if (!data.user) return

      const { data: tcfg, error } = await supabase
        .from('trading_configs')
        .select('api_key')
        .eq('user_id', data.user.id)
        .maybeSingle()

      if (error) {
        console.error('Error loading API key (supabase):', (error as any)?.message ?? error)
        return
      }

      if (tcfg?.api_key) setSavedApiKey(tcfg.api_key)
      else setSavedApiKey(null)
    } catch (err) {
      console.error('Unexpected error loading saved API key:', err)
    }
  }, [supabase])

  useEffect(() => {
    loadSavedApiKey()
  }, [loadSavedApiKey])

  // approved_users check (keeps your existing behavior)
  useEffect(() => {
    const checkUserStatus = async () => {
      try {
        const { data, error: userError } = await supabase.auth.getUser()
        if (userError) {
          console.error('Auth error while getting user:', userError)
          return
        }
        const email = data.user?.email
        if (!email) return
        const normalized = email.toLowerCase()
        const { data: rows, error } = await supabase
          .from('approved_users')
          .select('email')
          .eq('email', normalized)
          .limit(1)

        if (error) {
          console.error('Error querying approved_users:', (error as any)?.message ?? error)
          return
        }

        if (Array.isArray(rows) && rows.length > 0) {
          setIsApproved(true)
        }
      } catch (err) {
        console.error('Error checking approval:', err)
      }
    }
    checkUserStatus()
  }, [supabase])

  /* ---------- Check-status (server authoritative) ---------- */

  const fetchCheckStatus = useCallback(async () => {
    setCheckingStatus(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      if (!token) {
        // not authenticated
        setCanEditApi(false)
        setStatus(null)
        setSecondsLeft(null)
        setEndDateIso(null)
        return
      }

      const res = await fetch('/api/subscription/check-status', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
      const json = await res.json()
      if (!res.ok) {
        console.warn('check-status error', json)
        setCanEditApi(false)
        setStatus(null)
        setSecondsLeft(null)
        setEndDateIso(null)
        return
      }

      // expected: { status, subscription, trading_config, can_edit_api, seconds_left, end_date, now }
      setStatus(json.status ?? null)
      setCanEditApi(Boolean(json.can_edit_api))
      setSecondsLeft(typeof json.seconds_left === 'number' ? json.seconds_left : null)
      setEndDateIso(json.end_date ?? null)

      // server returned subscription row; update subscription displayed in the subscription panel
      if (json.subscription) {
        setSubscription(json.subscription as SubscriptionRow)
      } else {
        setSubscription(null)
      }

      // If server allows editing, reload saved API key to make UI consistent
      if (json.can_edit_api) {
        loadSavedApiKey()
      }
    } catch (err) {
      console.error('fetchCheckStatus error', err)
    } finally {
      setCheckingStatus(false)
    }
  }, [supabase, loadSavedApiKey])

  useEffect(() => {
    // initial load
    fetchCheckStatus()
    // refresh every 60s to update countdown & status
    const id = setInterval(() => fetchCheckStatus(), 60_000)
    return () => clearInterval(id)
  }, [fetchCheckStatus])

  /* ---------- API key handlers (server-backed) ---------- */

  const handleApiKeyChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setApiKey(e.target.value)
    setError(null)
  }, [])

  // Fallback verification: try server proxy endpoint with x-dhan-token header.
  // This is pragmatic: many broker validate endpoints are flaky; this mirrors actual usage.
  async function fallbackVerifyWithPositions(token: string) {
    try {
      const res = await fetch('/api/dhan/positions', {
        method: 'GET',
        headers: {
          'x-dhan-token': token
        }
      })
      if (res.ok) return true

      // if status 401 or 498 -> invalid
      if (res.status === 401 || res.status === 498) return false

      // try to parse body for clues
      const j = await res.json().catch(() => null)
      const txt = JSON.stringify(j ?? '')
      if (txt.includes('Invalid_Authentication') || txt.includes('DH-901') || txt.toLowerCase().includes('invalid')) {
        return false
      }

      // otherwise treat as invalid (safer)
      return false
    } catch (e) {
      // network or CORS — treat as failed verification
      console.warn('fallbackVerifyWithPositions failed:', e)
      return false
    }
  }

  const handleSaveApiKey = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    setLoading(true)
    setError(null)
    setMessage(null)

    try {
      const trimmed = apiKey.trim()
      if (!trimmed) throw new Error('API key cannot be empty')

      // quick local validation (calls your utils/api.validateApiKey)
      let isValid = await validateApiKey(trimmed)

      // If initial validation returned false, attempt pragmatic fallback test
      if (!isValid) {
        const fallbackOk = await fallbackVerifyWithPositions(trimmed)
        if (fallbackOk) {
          isValid = true
        } else {
          // final: invalid token
          throw new Error(
            'Invalid API key — the broker rejected the token. If you are sure this token is correct, try regenerating it or contact Dhan support.'
          )
        }
      }

      // get user token
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      if (!token) throw new Error('Not authenticated')

      // POST to server route that enforces subscription rules
      const res = await fetch('/api/trading-config/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ api_key: trimmed })
      })
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json?.error ?? json?.message ?? 'Failed to save API key')
      }

      // succeeded
      setSavedApiKey(trimmed)
      setApiKey('')
      setMessage('API key saved successfully')
      // ensure UI shows latest status
      await fetchCheckStatus()
      setTimeout(() => {
        setIsModalOpen(false)
        setMessage(null)
      }, 1200)
    } catch (err) {
      console.error('API Key Save Error:', err)
      // Friendly messages for known shapes
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Failed to save API key')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveApiKey = async () => {
    try {
      setLoading(true)
      setError(null)
      setMessage(null)

      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      if (!token) throw new Error('Not authenticated')

      const res = await fetch('/api/trading-config/save', {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json?.error ?? json?.message ?? 'Failed to remove API key')
      }

      setSavedApiKey(null)
      setMessage('API key removed')
      setTimeout(() => setMessage(null), 1400)
      // refresh status
      await fetchCheckStatus()
    } catch (err) {
      console.error('Remove API key error:', err)
      setError(err instanceof Error ? err.message : 'Failed to remove API key')
    } finally {
      setLoading(false)
    }
  }

  /* ---------- Other handlers ---------- */

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut()
      router.push('/login')
    } catch (err) {
      console.error('Error logging out:', err)
    }
  }

  const handleApiKeyClick = () => {
    // Approved users always allowed
    if (isApproved) {
      setIsModalOpen(true)
      return
    }

    // If server tells us editing is allowed, open modal; otherwise show subscription modal
    if (canEditApi) {
      setIsModalOpen(true)
      return
    }

    setIsSubscriptionModalOpen(true)
  }

  /* ---------- UI helpers ---------- */

  // Convert secondsLeft to "X days Y hrs" friendly text
  const humanRemaining = (secs: number | null) => {
    if (secs == null) return ''
    if (secs <= 0) return 'Expired'
    const days = Math.floor(secs / 86400)
    const hours = Math.floor((secs % 86400) / 3600)
    const mins = Math.floor((secs % 3600) / 60)
    if (days > 0) return `${days}d ${hours}h`
    if (hours > 0) return `${hours}h ${mins}m`
    return `${mins}m`
  }

  /* ---------- UI pieces ---------- */

  const BrandHeader = () => (
    <div className="flex items-center gap-3 mb-4">
      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-md">
        <span className="text-white font-bold">DK</span>
      </div>
      <div>
        <div className="text-lg font-bold text-gray-900">KillSwitch</div>
        <div className="text-xs text-gray-500">Real-time risk controls</div>
      </div>
    </div>
  )

  const UserPanel = () => (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-white shadow-sm border border-gray-100 mb-4">
      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
        <User className="w-5 h-5 text-gray-600" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-gray-900 truncate">{userEmail ?? 'Guest'}</div>
        <div className="text-xs text-gray-500">Account</div>
      </div>
    </div>
  )

  const NavItem: React.FC<{ href: string; icon: React.ReactNode; label: string }> = ({ href, icon, label }) => (
    <a
      href={href}
      className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-gray-700 hover:bg-gray-50 transition-colors"
    >
      <span className="w-5 h-5 text-gray-600">{icon}</span>
      <span className="truncate">{label}</span>
    </a>
  )

  const renderApiSection = () => (
    <div className="bg-white p-4 rounded-lg mb-4 border border-gray-100 shadow-sm">
      <div className="flex items-center mb-3">
        <Key className="w-4 h-4 mr-2 text-gray-700" />
        <h3 className="text-sm font-semibold text-gray-900">API Configuration</h3>
      </div>

      {/* status badge */}
      <div className="mb-3">
        {checkingStatus ? (
          <div className="inline-flex items-center gap-2 px-2 py-1 rounded bg-gray-50 text-gray-600 text-xs font-medium">
            <svg className="h-3 w-3 animate-spin text-gray-500" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
            </svg>
            <span>Checking subscription…</span>
          </div>
        ) : status === 'trial-active' ? (
          <div className="inline-flex items-center gap-2 px-2 py-1 rounded bg-emerald-50 text-emerald-700 text-xs font-medium">
            <Clock className="w-3 h-3" />
            <div>
              <div>Trial</div>
              <div className="text-xs text-gray-500">{endDateIso ? new Date(endDateIso).toLocaleString() : humanRemaining(secondsLeft)}</div>
            </div>
          </div>
        ) : status === 'active' ? (
          <div className="inline-flex items-center gap-2 px-2 py-1 rounded bg-blue-50 text-blue-700 text-xs font-medium">
            <div>Premium active</div>
            {endDateIso && <div className="ml-2 text-xs text-gray-500">• {new Date(endDateIso).toLocaleDateString()}</div>}
          </div>
        ) : status === 'trial-expired' ? (
          <div className="inline-flex items-center gap-2 px-2 py-1 rounded bg-rose-50 text-rose-700 text-xs font-medium">
            <AlertCircle className="w-3 h-3" />
            <span>Trial expired</span>
          </div>
        ) : (
          <div className="inline-flex items-center gap-2 px-2 py-1 rounded bg-gray-50 text-gray-600 text-xs">No subscription</div>
        )}
      </div>

      {/* API UI */}
      {savedApiKey ? (
        <>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-600">Status</span>
            <span className={`text-xs font-medium ${(!subscription && !isApproved) || status === 'trial-expired' ? 'text-red-600' : 'text-green-600'}`}>
              {((!subscription && !isApproved) || status === 'trial-expired') ? 'Locked' : 'Connected'}
            </span>
          </div>

          <div className="mb-3 p-2 bg-gray-50 rounded text-sm overflow-hidden">
            <p className="truncate text-gray-900 font-mono" title={savedApiKey}>
              {savedApiKey.substring(0, 16)}...{savedApiKey.slice(-6)}
            </p>
          </div>

          <div className="flex gap-2">
            {/* Remove is disabled only if user is neither approved nor allowed */}
            <button
              onClick={handleRemoveApiKey}
              disabled={!(isApproved || canEditApi)}
              className={`flex-1 py-2 rounded-md text-sm transition-colors
                ${!(isApproved || canEditApi)
                  ? 'bg-red-300 text-white cursor-not-allowed'
                  : 'bg-red-500 text-white hover:bg-red-600'}
              `}
            >
              Remove
            </button>

            {/* Update button: ALWAYS visible. Enabled when approved or canEditApi. Otherwise, opens subscription modal */}
            <button
              onClick={() => {
                if (!(isApproved || canEditApi)) {
                  setIsSubscriptionModalOpen(true)
                } else {
                  setIsModalOpen(true)
                  setApiKey('')
                }
              }}
              className={`flex-1 py-2 rounded-md text-sm transition-colors border
                ${!(isApproved || canEditApi)
                  ? 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}
              `}
              aria-disabled={!(isApproved || canEditApi)}
            >
              Update
            </button>
          </div>

          {!(isApproved || canEditApi) && (
            <p className="text-xs text-red-600 mt-2 text-center">
              Subscription required to update API key — <button onClick={() => setIsSubscriptionModalOpen(true)} className="underline">Subscribe</button>
            </p>
          )}
        </>
      ) : (
        <div>
          {!(isApproved || canEditApi) ? (
  <div className="text-center">
    <div className="flex items-center justify-center gap-2 mb-3">
      <AlertCircle className="w-4 h-4 text-amber-500" />
      <p className="text-xs text-gray-600">Premium access required</p>
    </div>
    <button
      onClick={() => setIsSubscriptionModalOpen(true)}
      className="w-full bg-black text-white py-2 rounded-md text-sm hover:bg-gray-800 transition-colors"
    >
      Subscribe / Start Trial
    </button>
  </div>
) : (
  <button
    onClick={handleApiKeyClick}
    className="w-full bg-black text-white hover:bg-gray-800 py-2 rounded-md text-sm transition-colors"
  >
    Enter API Key
  </button>
)}

        </div>
      )}
    </div>
  )

  const renderSubscriptionSection = () => (
    <div className="bg-white p-4 rounded-lg mb-4 border border-gray-100 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded bg-indigo-50 text-indigo-600">
            <CreditCard className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Subscription</h3>
            <p className="text-xs text-gray-500">Manage plan & billing</p>
          </div>
        </div>

        {/* Action button (Manage or Subscribe) */}
        <div>
          {isApproved ? (
  <div className="inline-flex items-center gap-2 px-2 py-1 rounded bg-emerald-50 text-emerald-700 text-xs font-medium">
    Approved User
  </div>
) : status === 'active' || status === 'trial-active' ? (
  <button
    onClick={() => setIsSubscriptionModalOpen(true)}
    className="inline-flex items-center gap-2 px-3 py-1 rounded bg-black text-white text-xs font-medium hover:bg-gray-800"
  >
    Manage
  </button>
) : (
  <button
    onClick={() => setIsSubscriptionModalOpen(true)}
    className="inline-flex items-center gap-2 px-3 py-1 rounded bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700"
  >
    Subscribe / Start Trial
  </button>
)}

        </div>
      </div>

      <div className="pt-2">
        {isApproved ? (
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="text-xs text-gray-600">Access</div>
              <div className="text-xs font-semibold text-emerald-700">Full access</div>
            </div>
            <div className="text-xs text-gray-500">You have been approved for premium features.</div>
          </div>
        ) : subscription ? (
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="text-xs text-gray-600">Plan</div>
              <div className="text-xs font-semibold text-green-600">Premium</div>
            </div>
            <div className="flex items-center justify-between">
              <div className="text-xs text-gray-600">Started</div>
              <div className="text-xs text-gray-700">{new Date(subscription.start_date).toLocaleDateString()}</div>
            </div>
            <div className="flex items-center justify-between">
              <div className="text-xs text-gray-600">Renews</div>
              <div className="text-xs text-gray-700">{new Date(subscription.end_date).toLocaleDateString()}</div>
            </div>
            <div className="flex items-center justify-between">
              <div className="text-xs text-gray-600">Amount</div>
              <div className="text-xs text-gray-700">₹{(subscription.total_amount / 100).toFixed(2)}</div>
            </div>
          </div>
        ) : (
          <div className="text-xs text-gray-600">
            No active subscription. Start a free 7-day trial or subscribe to unlock all features.
          </div>
        )}
      </div>
    </div>
  )

  const renderSidebarContent = () => (
    <>
      <BrandHeader />
      <UserPanel />

      <nav className="mb-4">
        <ul className="space-y-1">
          <li>
            <NavItem href="/dashboard" icon={<Home />} label="Dashboard" />
          </li>
        </ul>
      </nav>

      {renderApiSection()}
      {renderSubscriptionSection()}

      <nav className="mb-4">
        <ul className="space-y-1">
          <li>
            <a
              href="/contact"
              className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <HelpCircle className="w-5 h-5 text-gray-600" />
              <span>Support</span>
            </a>
          </li>
        </ul>
      </nav>

      <div className="mt-6 border-t border-gray-100 pt-4">
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 bg-red-500 text-white py-2 rounded-md hover:bg-red-600 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span className="text-sm font-medium">Logout</span>
        </button>
      </div>
    </>
  )

  /* ---------- Modal: enter API key ---------- */

  const renderApiKeyModal = () => (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={() => setIsModalOpen(false)}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-md bg-white rounded-lg shadow-lg p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Enter API Key</h3>
          <button
            onClick={() => setIsModalOpen(false)}
            className="p-1 text-black rounded-full hover:bg-gray-100 transition"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && <div className="mb-3 text-sm text-red-700 bg-red-50 p-2 rounded">{error}</div>}
        {message && <div className="mb-3 text-sm text-green-700 bg-green-50 p-2 rounded">{message}</div>}

        <form onSubmit={handleSaveApiKey}>
          <label className="block text-xs font-medium text-gray-600 mb-2">Dhan Access Token</label>
          <input
            type="text"
            value={apiKey}
            onChange={handleApiKeyChange}
            className="w-full border border-gray-200 rounded-md p-2 mb-4 text-sm text-black placeholder-gray-400"
            placeholder="Paste your Dhan access token"
            autoFocus
            autoComplete="off"
          />

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => { setIsModalOpen(false); setApiKey(''); setError(null); setMessage(null) }}
              className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md text-sm hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-black text-white rounded-md text-sm hover:bg-gray-800 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )

  /* ---------- Render (mobile vs desktop) ---------- */

  if (isMobile) {
    return (
      <>
        <button
          onClick={() => setMobileSidebarOpen(true)}
          className="fixed top-4 left-4 z-50 bg-black p-2 rounded-lg shadow-lg"
          aria-label="Open menu"
        >
          <Menu className="h-6 w-6 text-white" />
        </button>

        {mobileSidebarOpen && (
          <div className="fixed inset-0 z-40">
            <div className="absolute inset-0 bg-black/50" onClick={() => setMobileSidebarOpen(false)} />

            <aside
              className="absolute left-0 top-0 h-full w-80 bg-white shadow-2xl overflow-y-auto p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <BrandHeader />
                <button
                  onClick={() => setMobileSidebarOpen(false)}
                  className="p-2 text-black rounded-full hover:bg-gray-100 transition"
                  aria-label="Close menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div>{renderSidebarContent()}</div>
            </aside>
          </div>
        )}

        {isModalOpen && renderApiKeyModal()}
        <SubscriptionModal
          isOpen={isSubscriptionModalOpen}
          onClose={() => setIsSubscriptionModalOpen(false)}
          onSuccess={async () => { await fetchCheckStatus(); setIsSubscriptionModalOpen(false) }}
        />
      </>
    )
  }

  return (
    <>
      <aside className="hidden lg:block w-72 bg-white border-r border-gray-100 fixed left-0 top-0 bottom-0 overflow-y-auto p-4">
        <div className="flex flex-col h-full">
          <div className="mb-2">{renderSidebarContent()}</div>
        </div>
      </aside>

      {isModalOpen && renderApiKeyModal()}
      <SubscriptionModal
        isOpen={isSubscriptionModalOpen}
        onClose={() => setIsSubscriptionModalOpen(false)}
        onSuccess={async () => { await fetchCheckStatus(); setIsSubscriptionModalOpen(false) }}
      />
    </>
  )
}

export default Sidebar
