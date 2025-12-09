// app/dashboard/page.tsx
/* eslint-disable react-hooks/exhaustive-deps */
'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter } from 'next/navigation'
import {
  LineChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts'
import { AlertCircle, Activity, Clock, AlertTriangle, ChevronDown, ShieldCheck, Bell, TrendingUp, Settings } from 'lucide-react'
import { getPositions, getOrders, triggerKill } from '@/utils/api'
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'], weight: ['300','400','600','700'] })

/* ---------- Types ---------- */

type TradingConfig = {
  api_key: string
  max_loss: string // store as string while user edits
  max_orders: string
  auto_trading_enabled: boolean
  user_id?: string
  id?: string
  created_at?: string
  updated_at?: string
}

type AuditLog = {
  id: string
  action_type: string
  action_details?: any
  created_at?: string
  timestamps?: string
  pnl?: number
  orders_count?: number
  kill_switch_status?: boolean
}

/* ---------- Small UI primitives ---------- */

function StatCard({ title, value, icon }: { title: string; value: React.ReactNode; icon: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-2xl p-5 h-full bg-white/90 backdrop-blur-sm border border-gray-100 shadow-2xl hover:shadow-2xl/40 transition-transform transform hover:-translate-y-1">
      <div className="absolute -left-6 -top-6 w-36 h-36 bg-gradient-to-br from-blue-200 to-indigo-200 rounded-full opacity-20 pointer-events-none" />
      <div className="relative flex items-start justify-between">
        <div className="flex items-center">
          <div className="p-3 rounded-lg bg-white shadow-md mr-3">{icon}</div>
          <div>
            <dt className="text-xs tracking-wide text-gray-400 uppercase">{title}</dt>
            <dd className="text-2xl font-semibold text-gray-900 mt-1">{value}</dd>
          </div>
        </div>
      </div>
    </div>
  )
}

function PageHeader({ currentPnL, points }: { currentPnL: number; points: number }) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center space-x-4">
        {/* Brand */}
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg">
            <div className="text-white font-bold">DK</div>
          </div>
          <div>
            <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-700 to-purple-600">KillSwitch</h1>
            <p className="text-sm text-gray-500 mt-1">Real-time risk controls for automated trading</p>
          </div>
        </div>

        {/* Live mini-stats */}
        <div className="hidden md:flex items-center space-x-3 pl-4 border-l border-gray-100">
          <div className="text-xs text-gray-400">Live P&L</div>
          <div className={`text-sm font-medium ${currentPnL >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>₹{currentPnL.toFixed(2)}</div>
          <div className="text-xs text-gray-400">•</div>
          <div className="flex items-center text-xs text-gray-500"><TrendingUp className="h-4 w-4 mr-1 text-indigo-500" />{points} pts</div>
        </div>
      </div>

      <div className="flex items-center space-x-3">
        <button className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg shadow hover:shadow-md">
          <Bell className="h-4 w-4 text-gray-600" />
          <span className="text-sm text-gray-700">Alerts</span>
        </button>

        <button className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg shadow hover:shadow-md">
          <ShieldCheck className="h-4 w-4 text-gray-600" />
          <span className="text-sm text-gray-700">Safety</span>
        </button>

        <button className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg shadow hover:from-indigo-700">
          <span className="text-sm">Account</span>
          <ChevronDown className="h-4 w-4 text-white/90" />
        </button>
      </div>
    </div>
  )
}

/* ---------- Component ---------- */

export default function Dashboard() {
  const router = useRouter()
  const supabase = createClientComponentClient()

  const [config, setConfig] = useState<TradingConfig>({
    api_key: '',
    max_loss: '-13000',
    max_orders: '13',
    auto_trading_enabled: true
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const [currentPnL, setCurrentPnL] = useState<number>(0)
  const [orderCount, setOrderCount] = useState<number>(0)
  const [killSwitchActive, setKillSwitchActive] = useState<boolean>(false)
  const [killSwitchInfo, setKillSwitchInfo] = useState<any>(null)
  const [killSwitchTriggeredToday, setKillSwitchTriggeredToday] = useState<boolean>(false)

  const [pnlHistory, setPnlHistory] = useState<{ time: string; pnl: number }[]>([])
  const [isMonitoring, setIsMonitoring] = useState<boolean>(false)

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])

  const [tradingHours, setTradingHours] = useState({
    isWithinTradingHours: false,
    nextSessionTime: ''
  })

  /* ---------- Small helpers ---------- */

  const parseNumberSafe = (v: string | number | undefined, fallback = 0) => {
    const n = Number(v as any)
    return Number.isFinite(n) ? n : fallback
  }

  const isAutomatedAction = (actionType = '') => actionType.startsWith('CRON_')
  const formatActionType = (actionType = '') => (isAutomatedAction(actionType) ? actionType.replace('CRON_', '') : actionType)

  /* ---------- Time / trading hours ---------- */

  const checkTradingHours = useCallback(() => {
    const now = new Date()
    const day = now.getDay()
    const hours = now.getHours()
    const minutes = now.getMinutes()
    const currentTime = hours * 60 + minutes

    // Trading hours: 9:15 AM to 3:30 PM (555 to 930 minutes)
    const marketOpen = 9 * 60 + 15
    const marketClose = 15 * 60 + 30

    const isWeekday = day >= 1 && day <= 5
    const isWithinHours = currentTime >= marketOpen && currentTime <= marketClose
    const isWithinTradingHours = isWeekday && isWithinHours

    let nextSessionTime = ''
    if (!isWeekday) {
      const daysToMonday = day === 0 ? 1 : 8 - day
      const nextDate = new Date(now)
      nextDate.setDate(now.getDate() + daysToMonday)
      nextDate.setHours(9, 15, 0, 0)
      nextSessionTime = nextDate.toLocaleString()
    } else if (currentTime < marketOpen) {
      const nextDate = new Date(now)
      nextDate.setHours(9, 15, 0, 0)
      nextSessionTime = nextDate.toLocaleString()
    } else if (currentTime > marketClose) {
      const isNextDayWeekend = day === 5 // Friday
      if (isNextDayWeekend) {
        const nextDate = new Date(now)
        nextDate.setDate(now.getDate() + 3)
        nextDate.setHours(9, 15, 0, 0)
        nextSessionTime = nextDate.toLocaleString()
      } else {
        const nextDate = new Date(now)
        nextDate.setDate(now.getDate() + 1)
        nextDate.setHours(9, 15, 0, 0)
        nextSessionTime = nextDate.toLocaleString()
      }
    }

    setTradingHours({ isWithinTradingHours, nextSessionTime })
    return { isWithinTradingHours, nextSessionTime }
  }, [])

  /* ---------- Logging / DB helpers ---------- */

  const logTradeAction = useCallback(
    async (
      actionType: string,
      details: any = {},
      pnl: number | null = null,
      ordersCount: number | null = null,
      killSwitchStatus: boolean | null = null
    ) => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        await supabase.from('trading_logs').insert({
          user_id: user.id,
          action_type: actionType,
          action_details: details,
          ip_address: typeof window !== 'undefined' ? window.location.hostname : 'server',
          pnl,
          orders_count: ordersCount,
          kill_switch_status: killSwitchStatus
        })
      } catch (err) {
        console.error('Logging error:', err)
      }
    },
    [supabase]
  )

  /* ---------- Load config, history, audit ---------- */

  const loadConfig = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return null
      }

      const { data } = await supabase
        .from('trading_configs')
        .select('*')
        .eq('user_id', session.user.id)
        .single()

      if (data) {
        setConfig({
          api_key: data.api_key ?? '',
          max_loss: String(data.max_loss ?? '-3500'),
          max_orders: String(data.max_orders ?? '26'),
          auto_trading_enabled: data.auto_trading_enabled ?? true,
          user_id: data.user_id,
          id: data.id,
          created_at: data.created_at,
          updated_at: data.updated_at
        })
        return data
      }

      setConfig({
        api_key: '',
        max_loss: '-3500',
        max_orders: '26',
        auto_trading_enabled: true
      })
      return null
    } catch (err) {
      console.error('Error loading config:', err)
      setError('Failed to load configuration')
      return null
    }
  }, [supabase, router])

  const checkKillSwitchHistory = useCallback(async () => {
    try {
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return false

      const { data } = await supabase
        .from('kill_switch_logs')
        .select('*')
        .eq('user_id', user.id)
        .gte('created_at', today.toISOString())
        .limit(1)

      const wasTriggeredToday = Boolean(data && (data as any[]).length > 0)
      setKillSwitchTriggeredToday(wasTriggeredToday)
      setKillSwitchInfo(data && (data as any[]).length > 0 ? (data as any[])[0] : null)
      return wasTriggeredToday
    } catch (err) {
      console.error('Error checking kill switch history:', err)
      return false
    }
  }, [supabase])

  const loadAuditLogs = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('trading_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)

      if (data) setAuditLogs(data)
    } catch (err) {
      console.error('Error loading audit logs:', err)
    }
  }, [supabase])

  /* ---------- Client-side kill sequence (calls server) ---------- */

 const triggerClientKill = useCallback(
  async (pnl: number, orders: number) => {
    try {
      setKillSwitchActive(true)
      setIsMonitoring(false)
      setMessage('Kill triggered — notifying server and broker...')

      try {
        // FIX: triggerKill only accepts one optional string
        const resp = await triggerKill(
          `Client-side threshold | PnL=${pnl} | Orders=${orders}`
        )

        setKillSwitchTriggeredToday(true)
        setKillSwitchInfo({
          trigger_reason: "Client threshold",
          pnl,
          orders_count: orders,
          triggered_at: new Date().toISOString(),
          server_resp: resp
        })

        await logTradeAction(
          "KILL_SWITCH_TRIGGERED",
          {
            reason: "Client-side threshold",
            server_resp: resp,
            pnl,
            orders_count: orders
          },
          pnl,
          orders,
          true
        )

        setMessage("Kill switch triggered successfully (server notified).")
      } catch (serverErr: any) {
        console.error("Server trigger failed:", serverErr)

        await logTradeAction(
          "KILL_SWITCH_TRIGGER_FAILED",
          { error: serverErr?.message ?? serverErr, pnl, orders },
          pnl,
          orders,
          true
        )

        setMessage(
          "Kill switch activated locally — server trigger failed. Check logs."
        )
      }
    } catch (err: any) {
      const msg = err?.message ?? ""

      if (
        msg.includes("Invalid_Authentication") ||
        msg.includes("DH-901") ||
        msg.includes("expired")
      ) {
        setError("Your Dhan API token has expired — update it in the sidebar.")
      } else {
        setError(String(msg))
      }

      setKillSwitchActive(false)
    }
  },
  [logTradeAction, config.api_key]
)

  

  /* ---------- Stats update (polling) ---------- */

  const updateStats = useCallback(async () => {
    try {
      if (!config.api_key) return

      // fetch concurrently via utils/api (expected to accept apiKey)
    const [positionsRaw, ordersRaw] = await Promise.all([
  getPositions(),
  getOrders()
])

      const positions = Array.isArray(positionsRaw) ? positionsRaw : []
      const orders = Array.isArray(ordersRaw) ? ordersRaw : []

      const totalPnL = positions.reduce(
        (sum: number, pos: any) =>
          sum + (parseNumberSafe((pos.realizedProfit ?? pos.RealizedProfit) as any) || 0) + (parseNumberSafe((pos.unrealizedProfit ?? pos.UnrealizedProfit) as any) || 0),
        0
      )
      setCurrentPnL(totalPnL)

      const completedOrders = orders.filter((o: any) => String(o.orderStatus || o.order_status || '').toUpperCase() === 'TRADED').length
      setOrderCount(completedOrders)

      await logTradeAction('STATUS_UPDATE', { positions_count: positions.length }, totalPnL, completedOrders, killSwitchActive)

      setPnlHistory((prev) => [...prev, { time: new Date().toLocaleTimeString(), pnl: totalPnL }].slice(-20))

      // Check thresholds safely:
      const cfgMaxLoss = Number.isNaN(Number(config.max_loss)) ? NaN : Number(config.max_loss)
      const cfgMaxOrders = Number.isNaN(Number(config.max_orders)) ? NaN : Number(config.max_orders)

      if (Number.isNaN(cfgMaxLoss) || Number.isNaN(cfgMaxOrders)) {
        // skip threshold check if invalid
        console.warn('Invalid numeric config — skipping kill switch check', { cfgMaxLoss, cfgMaxOrders })
      } else {
        if ((totalPnL <= cfgMaxLoss || completedOrders >= cfgMaxOrders) && !killSwitchActive && !killSwitchTriggeredToday) {
          console.log('[dashboard] threshold tripped', { totalPnL, completedOrders })
          await triggerClientKill(totalPnL, completedOrders)
        }
      }
    } catch (err: any) {
  await logTradeAction(
    "ERROR",
    { error: err instanceof Error ? err.message : String(err) }
  );

  console.error("Error updating stats:", err);

  const msg = err?.message ?? "";

  // --- Soft handling of expired / invalid Dhan token ---
  if (
    msg.includes("Invalid_Authentication") ||
    msg.includes("DH-901") ||
    msg.includes("invalid or expired") ||
    msg.includes("access token") ||
    msg.includes("401")
  ) {
    setError("EXPIRED_TOKEN");
    return;
  }

  // Connection lost
  if (msg.includes("Failed to fetch")) {
    setError("Lost connection to trading server");
    return;
  }

  // Default fallback
  setError(String(msg))
}
  }, [config, killSwitchActive, killSwitchTriggeredToday, logTradeAction, triggerClientKill])

  /* ---------- Auto start / monitoring effects ---------- */

  const autoStartTrading = useCallback(async () => {
    try {
      const { isWithinTradingHours } = checkTradingHours()
      const wasTriggeredToday = await checkKillSwitchHistory()

      if (isWithinTradingHours && !wasTriggeredToday && config.auto_trading_enabled && config.api_key && !isMonitoring) {
        setIsMonitoring(true)
        await logTradeAction('AUTO_START', { reason: 'Trading hours started' })
        await updateStats()
      } else if (!isWithinTradingHours && isMonitoring) {
        setIsMonitoring(false)
        await logTradeAction('AUTO_STOP', { reason: 'Outside trading hours' }, currentPnL, orderCount, killSwitchActive)
      }
    } catch (err) {
      console.error('Auto start error:', err)
    }
  }, [checkTradingHours, checkKillSwitchHistory, config, isMonitoring, logTradeAction, updateStats, currentPnL, orderCount, killSwitchActive])

  useEffect(() => {
    // initialize
    const init = async () => {
      await loadConfig()
      await checkKillSwitchHistory()
      await loadAuditLogs()
      checkTradingHours()
    }
    init().catch((e) => console.error('init error', e))
  }, [loadConfig, checkKillSwitchHistory, loadAuditLogs, checkTradingHours])

  // auto start check every minute
  useEffect(() => {
    autoStartTrading().catch((e) => console.error('autoStartTrading error', e))
    const id = setInterval(() => {
      autoStartTrading().catch((e) => console.error('autoStartTrading error', e))
    }, 60_000)
    return () => clearInterval(id)
  }, [autoStartTrading])

  // monitoring polling while active
  useEffect(() => {
    let id: number | undefined
    if (isMonitoring && config.api_key && !killSwitchActive) {
      id = window.setInterval(() => {
        updateStats().catch((e) => console.error('updateStats error:', e))
      }, 5000)
    }
    return () => {
      if (id) clearInterval(id)
    }
  }, [isMonitoring, config.api_key, killSwitchActive, updateStats])

  /* ---------- Handlers: Save config, manual start/stop ---------- */

  const handleSaveConfig = useCallback(
    async (e?: React.FormEvent) => {
      if (e) e.preventDefault()
      setLoading(true)
      setError(null)
      setMessage(null)

      try {
        const parsedMaxLoss = Number(config.max_loss)
        const parsedMaxOrders = Number(config.max_orders)

        if (Number.isNaN(parsedMaxLoss)) throw new Error('Invalid Max Loss — enter a number like -3500.')
        if (Number.isNaN(parsedMaxOrders) || parsedMaxOrders < 0) throw new Error('Invalid Max Orders — enter a positive number.')

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('User not found')

        const { data: existing } = await supabase.from('trading_configs').select('id').eq('user_id', user.id).single()

        if (existing) {
          const { error } = await supabase.from('trading_configs').update({
            max_loss: parsedMaxLoss,
            max_orders: parsedMaxOrders
          }).eq('user_id', user.id)
          if (error) throw error
        } else {
          const { error } = await supabase.from('trading_configs').insert({
            user_id: user.id,
            api_key: config.api_key || '',
            max_loss: parsedMaxLoss,
            max_orders: parsedMaxOrders,
            auto_trading_enabled: config.auto_trading_enabled
          })
          if (error) throw error
        }

        await logTradeAction('CONFIG_UPDATE', { max_loss: parsedMaxLoss, max_orders: parsedMaxOrders }, 0, 0, false)
        setMessage('Configuration saved successfully!')
        if (config.auto_trading_enabled) {
          await autoStartTrading()
        } else {
          setIsMonitoring(false)
        }
      } catch (err: any) {
        console.error('Error saving config:', err)
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setLoading(false)
        setTimeout(() => setMessage(null), 1500)
      }
    },
    [config, supabase, logTradeAction, autoStartTrading]
  )

  const handleManualStart = useCallback(() => {
    if (!isMonitoring && !killSwitchTriggeredToday) {
      setIsMonitoring(true)
      updateStats().catch((e) => console.error('manual updateStats error:', e))
      logTradeAction('MANUAL_START', { reason: 'User initiated start' })
    }
  }, [isMonitoring, killSwitchTriggeredToday, updateStats, logTradeAction])

  /* ---------- Small derived helpers for view ---------- */
  const computePeak = (arr: { time: string; pnl: number }[]) => (arr.length ? Math.max(...arr.map((p) => p.pnl)) : 0)
  const computeAvg = (arr: { time: string; pnl: number }[]) => (arr.length ? arr.reduce((s, x) => s + x.pnl, 0) / arr.length : 0)
  const computeMaxDrawdown = (arr: { time: string; pnl: number }[]) => {
    if (!arr.length) return 0
    let peak = -Infinity
    let maxDD = 0
    for (const p of arr) {
      if (p.pnl > peak) peak = p.pnl
      const dd = peak - p.pnl
      if (dd > maxDD) maxDD = dd
    }
    return maxDD
  }

  /* ---------- JSX ---------- */

  return (
    <div className={`${inter.className} min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50 p-10`}> 
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 p-6 rounded-3xl bg-white/80 border border-gray-100 shadow-2xl">
          <PageHeader currentPnL={currentPnL} points={pnlHistory.length} />
        </div>

       {error === "EXPIRED_TOKEN" ? (
  <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 shadow flex items-center gap-2">
    <AlertCircle className="h-4 w-4 text-amber-600" />
    <span>Your Dhan API token has expired. Please update it in the sidebar.</span>
  </div>
) : error ? (
  <div className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 shadow">
    {error}
  </div>
) : null}
        {message && (
          <div className="mb-4 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-700 px-4 py-3 shadow">{message}</div>
        )}

        {/* Top alerts */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 mb-6">
          {!tradingHours.isWithinTradingHours && (
            <div className="lg:col-span-2 rounded-2xl bg-yellow-50 border border-yellow-200 text-yellow-800 px-6 py-5 flex items-center shadow-inner">
              <Clock className="h-5 w-5 mr-3" />
              <div>
                <p className="font-semibold text-sm">Outside trading hours</p>
                <p className="text-xs text-yellow-700">Trading will automatically start at <span className="font-medium">{tradingHours.nextSessionTime}</span></p>
              </div>
            </div>
          )}

          {killSwitchTriggeredToday && (
            <div className="rounded-2xl bg-red-50 border border-red-100 text-red-700 px-6 py-5 flex items-start shadow-inner">
              <AlertTriangle className="h-5 w-5 mr-3 mt-1" />
              <div>
                <p className="font-semibold text-sm">Kill switch triggered today</p>
                <p className="text-xs text-gray-600 mt-1">Trading paused for today — will resume at next market open.</p>
                {killSwitchInfo && (
                  <div className="mt-3 text-xs text-gray-700 bg-white p-3 rounded-md border border-gray-100 shadow-sm">
                    <p><span className="font-semibold">Reason:</span> {killSwitchInfo.trigger_reason ?? killSwitchInfo.reason ?? 'N/A'}</p>
                    <p><span className="font-semibold">P&L at trigger:</span> ₹{Number(killSwitchInfo.pnl ?? 0).toFixed(2)}</p>
                    <p><span className="font-semibold">Orders at trigger:</span> {killSwitchInfo.orders_count ?? killSwitchInfo.orders ?? '-'}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <StatCard title="Current P&L" value={<span className={`${currentPnL >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>₹{currentPnL.toFixed(2)}</span>} icon={<Activity className={`h-6 w-6 ${currentPnL >= 0 ? 'text-emerald-500' : 'text-rose-500'}`} />} />

          <StatCard title="Orders Today" value={<span className="text-gray-900">{orderCount}</span>} icon={<AlertCircle className={`h-6 w-6 ${orderCount > parseNumberSafe(config.max_orders, 999999) ? 'text-rose-500' : 'text-gray-400'}`} />} />

          <StatCard title="Kill Switch Status" value={<span className={`${killSwitchActive ? 'text-rose-600' : 'text-emerald-600'}`}>{killSwitchActive ? 'Active' : 'Inactive'}</span>} icon={<Settings className={`h-6 w-6 ${killSwitchActive ? 'text-rose-500' : 'text-emerald-500'}`} />} />

          <StatCard title="Monitoring" value={<span className="text-gray-900">{isMonitoring ? 'Active' : 'Inactive'}</span>} icon={<Activity className={`h-6 w-6 ${isMonitoring ? 'text-indigo-500' : 'text-gray-400'}`} />} />
        </div>

        {/* Main content */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 mb-8">
          <div className="lg:col-span-2 bg-white/90 p-6 rounded-3xl shadow-2xl border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">P&L Overview</h3>
                <p className="text-xs text-gray-400">Real-time performance and session summary</p>
              </div>
              <div className="text-sm text-gray-500">Last {pnlHistory.length} points</div>
            </div>

            {/* When empty show polished placeholder */}
            {pnlHistory.length === 0 ? (
              <div className="h-80 w-full flex items-center justify-center border-2 border-dashed border-gray-200 rounded-2xl bg-gradient-to-b from-white to-gray-50">
                <div className="text-center text-gray-500 px-6">
                  <Activity className="mx-auto h-10 w-10 text-gray-400" />
                  <p className="mt-4 text-lg font-medium text-gray-800">No P&L activity yet</p>
                  <p className="mt-2 text-sm text-gray-500 max-w-md mx-auto">Start monitoring to generate live P&L updates. Click <span className="font-semibold">Start Now</span> or enable automatic trading on the right.</p>
                  <div className="mt-5 flex items-center justify-center gap-3">
                    <button onClick={handleManualStart} className="px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow hover:from-indigo-700">Start Monitoring</button>
                    <button onClick={() => setMessage('Enable auto trading to start monitoring automatically.')} className="px-4 py-2 rounded-lg border border-gray-200 text-sm">Why no data?</button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={pnlHistory} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" stopOpacity={0.18} />
                        <stop offset="100%" stopColor="#a78bfa" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="6 6" stroke="#eef2ff" />
                    <XAxis dataKey="time" tick={{ fill: '#6b7280' }} />
                    <YAxis tick={{ fill: '#6b7280' }} />
                    <Tooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 20px rgba(16,24,40,0.08)' }} />

                    {(!Number.isNaN(parseNumberSafe(config.max_loss))) && (
                      <ReferenceLine y={parseNumberSafe(config.max_loss)} stroke="#ef4444" strokeDasharray="4 4" label={{ value: 'Max Loss', position: 'right', fill: '#ef4444' }} />
                    )}

                    <Line type="monotone" dataKey="pnl" stroke="#6366f1" strokeWidth={3} dot={false} activeDot={{ r: 5 }} />
                    <Area type="monotone" dataKey="pnl" stroke="none" fillOpacity={1} fill="url(#pnlGrad)" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* quick metrics row */}
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-gradient-to-r from-white to-indigo-50 border border-gray-100 shadow">
                <div className="text-xs text-gray-400">Peak P&L</div>
                <div className="text-lg font-semibold text-gray-900">₹{computePeak(pnlHistory).toFixed(2)}</div>
              </div>
              <div className="p-4 rounded-xl bg-gradient-to-r from-white to-rose-50 border border-gray-100 shadow">
                <div className="text-xs text-gray-400">Max Drawdown</div>
                <div className="text-lg font-semibold text-gray-900">₹{computeMaxDrawdown(pnlHistory).toFixed(2)}</div>
              </div>
              <div className="p-4 rounded-xl bg-gradient-to-r from-white to-green-50 border border-gray-100 shadow">
                <div className="text-xs text-gray-400">Average P&L</div>
                <div className="text-lg font-semibold text-gray-900">₹{computeAvg(pnlHistory).toFixed(2)}</div>
              </div>
            </div>
          </div>

          {/* Config form */}
          <div className="bg-white/95 shadow-2xl rounded-3xl p-6 border border-gray-100">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Trading Configuration</h3>
            <form onSubmit={(e) => handleSaveConfig(e)}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Maximum Loss (₹)</label>
                <div className="flex items-center">
                  <span className="mr-2 text-lg font-medium text-gray-700">₹</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="-?[0-9]*"
                    value={String(config.max_loss ?? '')}
                    onChange={(e) => setConfig({ ...config, max_loss: e.target.value })}
                    className="border p-2 w-full max-w-xs text-lg text-black placeholder-gray-400 rounded-md"
                    placeholder="-3500"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2">Use a negative number for loss thresholds (e.g. -3500).</p>

                <div className="mt-3 flex space-x-3">
                  {[-5000, -10000, -15000].map((value) => (
                    <label key={value} className="flex items-center space-x-2 cursor-pointer text-gray-700">
                      <input
                        type="radio"
                        name="presetMaxLoss"
                        value={value}
                        checked={parseNumberSafe(config.max_loss) === value}
                        onChange={() => setConfig({ ...config, max_loss: String(value) })}
                        className="h-4 w-4"
                      />
                      <span className="text-sm">₹{value}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="mt-4">
                <label htmlFor="maxOrders" className="block text-sm font-medium text-gray-700">Maximum Orders</label>
                <div className="flex items-center">
                  <input
                    id="maxOrders"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={String(config.max_orders ?? '')}
                    onChange={(e) => setConfig({ ...config, max_orders: e.target.value })}
                    className="border p-2 w-full max-w-xs text-lg text-black placeholder-gray-400 rounded-md"
                    placeholder="26"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2">Maximum number of executed orders allowed before kill switch locks.</p>
              </div>

              <div className="mt-4 flex items-center">
                <input
                  id="autoTrading"
                  type="checkbox"
                  checked={config.auto_trading_enabled}
                  onChange={(e) => setConfig({ ...config, auto_trading_enabled: e.target.checked })}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <label htmlFor="autoTrading" className="ml-2 block text-sm text-gray-700">Enable automatic trading during market hours (9:15 AM - 3:30 PM on weekdays)</label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-lg text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 transition-all duration-150 shadow-lg mt-6"
              >
                {loading ? 'Saving...' : 'Save Configuration'}
              </button>

              <div className="mt-2">
                <button
                  type="button"
                  onClick={handleManualStart}
                  disabled={isMonitoring || killSwitchTriggeredToday}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-lg text-sm font-medium text-white bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 transition-all duration-150 shadow-lg mt-3"
                >
                  Start Now
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Audit Logs */}
        <div className="bg-white/95 shadow-2xl rounded-3xl p-6 border border-gray-100">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Audit Logs</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-6 py-3 bg-gradient-to-r from-white to-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Time</th>
                  <th className="px-6 py-3 bg-gradient-to-r from-white to-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
                  <th className="px-6 py-3 bg-gradient-to-r from-white to-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">P&L</th>
                  <th className="px-6 py-3 bg-gradient-to-r from-white to-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Orders</th>
                  <th className="px-6 py-3 bg-gradient-to-r from-white to-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Kill Switch</th>
                  <th className="px-6 py-3 bg-gradient-to-r from-white to-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Source</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {auditLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{new Date(log.created_at ?? log.timestamps ?? Date.now()).toLocaleString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatActionType(log.action_type)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{typeof log.pnl === 'number' ? `₹${log.pnl.toFixed(2)}` : (log.action_details?.pnl ? `₹${Number(log.action_details.pnl).toFixed(2)}` : '-')}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{log.orders_count ?? log.action_details?.orders_count ?? '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{log.kill_switch_status ? <span className="px-2 py-1 text-xs font-semibold bg-rose-100 text-rose-800 rounded-full">Active</span> : <span className="px-2 py-1 text-xs font-semibold bg-emerald-100 text-emerald-800 rounded-full">Inactive</span>}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{isAutomatedAction(log.action_type) ? <span className="px-2 py-1 text-xs font-semibold bg-indigo-100 text-indigo-800 rounded-full">Automated</span> : <span className="px-2 py-1 text-xs font-semibold bg-gray-100 text-gray-800 rounded-full">Manual</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
