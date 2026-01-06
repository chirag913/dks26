/* eslint-disable react-hooks/exhaustive-deps */
'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
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
import { ShieldCheck, AlertTriangle } from 'lucide-react'
import { getPositions, getOrders, triggerKill } from '@/utils/api'

type TradingConfig = {
  api_key: string
  max_loss: string
  max_orders: string
  daily_lock_date?: string | null
}

type PnlPoint = { time: string; pnl: number }

const asArray = (v: any) => (Array.isArray(v) ? v : [])

export default function Dashboard() {
  const supabase = createClientComponentClient()
  const router = useRouter()
  const killRef = useRef(false)

  const [config, setConfig] = useState<TradingConfig>({
    api_key: '',
    max_loss: '-5000',
    max_orders: '10'
  })
  const [currentPnL, setCurrentPnL] = useState(0)
  const [orderCount, setOrderCount] = useState(0)
  const [pnlHistory, setPnlHistory] = useState<PnlPoint[]>([])
  const [killTriggeredToday, setKillTriggeredToday] = useState(false)
  const [apiTokenExpired, setApiTokenExpired] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const todayISO = new Date().toLocaleDateString('en-CA')
// YYYY-MM-DD in local timezone (IST on Indian systems)

const isLockedToday =
  config.daily_lock_date?.slice(0, 10) === todayISO

  /* ===== LOAD CONFIG ===== */
  const loadConfig = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return router.push('/login')

    const { data } = await supabase
      .from('trading_configs')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (data) {
      setConfig({
        api_key: data.api_key ?? '',
        max_loss: String(data.max_loss),
        max_orders: String(data.max_orders),
        daily_lock_date: data.daily_lock_date
      })
    }
  }, [])

  const loadKillStatus = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const { data } = await supabase
      .from('kill_switch_logs')
      .select('id')
      .eq('user_id', user.id)
      .gte('created_at', today.toISOString())
      .limit(1)

    if (data?.length) {
      killRef.current = true
      setKillTriggeredToday(true)
    }
  }, [])

  useEffect(() => {
    loadConfig()
    loadKillStatus()
  }, [])

  /* ===== MONITOR ===== */
  const updateStats = useCallback(async () => {
    if (!config.api_key || killRef.current) return
    try {
      const [posRaw, ordRaw] = await Promise.all([
        getPositions(config.api_key),
        getOrders(config.api_key)
      ])

      const pnl = asArray(posRaw).reduce(
        (s: number, p: any) =>
          s + Number(p.realizedProfit ?? 0) + Number(p.unrealizedProfit ?? 0),
        0
      )

      const completedOrders = asArray(ordRaw).filter(
        (o: any) => String(o.orderStatus).toUpperCase() === 'TRADED'
      ).length

      setCurrentPnL(pnl)
      setOrderCount(completedOrders)
      setPnlHistory(p => [...p.slice(-20), { time: new Date().toLocaleTimeString(), pnl }])

      if (
        pnl <= Number(config.max_loss) ||
        completedOrders >= Number(config.max_orders)
      ) {
        killRef.current = true
        await triggerKill(undefined, { source: 'server', pnl, orders: completedOrders })
        setKillTriggeredToday(true)
      }
    } catch (e: any) {
      if (e?.code === 'EXPIRED_TOKEN') setApiTokenExpired(true)
    }
  }, [config])

  useEffect(() => {
    if (killTriggeredToday) return
    const id = setInterval(updateStats, 5000)
    return () => clearInterval(id)
  }, [updateStats, killTriggeredToday])

  /* ===== SAVE ===== */
  const handleSave = async () => {
    if (isLockedToday) return
    await supabase.from('trading_configs').update({
      max_loss: Number(config.max_loss),
      max_orders: Number(config.max_orders),
      daily_lock_date: todayISO
    }).eq('api_key', config.api_key)

    setConfig(c => ({ ...c, daily_lock_date: todayISO }))
    setMessage('Risk limits locked for today')
    setTimeout(() => setMessage(null), 3000)
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans antialiased px-4 sm:px-8 py-8">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-gray-900">
              Risk Control Center
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Automated intraday capital protection
            </p>
          </div>

          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span className="text-sm font-medium text-emerald-700">
              Protection Active
            </span>
          </div>
        </div>

        {apiTokenExpired && <Alert title="API Token Expired" />}
        {killTriggeredToday && <Alert title="Take a break, Come back tomorrow." danger />}

        {/* STATS */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <Stat label="Current P&L" value={`₹${currentPnL.toFixed(2)}`} />
          <Stat label="Orders Executed" value={orderCount} />
          <Stat
            label="Kill Switch"
            value={killTriggeredToday ? 'Triggered' : 'Monitoring'}
            danger={killTriggeredToday}
          />
        </div>

        {/* CHART */}
        <Card>
          <h3 className="text-base font-semibold text-gray-800 mb-4">
            Intraday P&L
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={pnlHistory}>
              <CartesianGrid stroke="#E5E7EB" strokeDasharray="3 3" />
              <XAxis tick={{ fill: '#6B7280', fontSize: 12 }} />
              <YAxis tick={{ fill: '#6B7280', fontSize: 12 }} />
              <Tooltip />
              <ReferenceLine y={Number(config.max_loss)} stroke="#EF4444" strokeDasharray="4 4" />
              <Line dataKey="pnl" stroke="#111827" strokeWidth={2} />
              <Area dataKey="pnl" fill="#111827" fillOpacity={0.06} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* CONFIG */}
        <Card>
          <h2 className="text-base font-semibold text-gray-800 mb-4">
            Daily Risk Parameters
          </h2>

          <div className="space-y-4">
            <Input label="Max Loss (₹)" value={config.max_loss} disabled={isLockedToday}
             onChange={(v: number) =>
  setConfig({ ...config, max_loss: v })
}} />
            <Input label="Max Orders" value={config.max_orders} disabled={isLockedToday}
              onChange={(v: number) =>
  setConfig({ ...config, max_orders: v })
} />

            <button
              disabled={isLockedToday}
              onClick={handleSave}
              className={`w-full py-3 rounded-xl text-sm font-semibold transition ${
                isLockedToday
                  ? 'bg-gray-200 text-gray-500'
                  : 'bg-gray-900 text-white hover:bg-gray-800'
              }`}
            >
              {isLockedToday ? 'Locked for Today' : 'Save & Lock'}
            </button>

            {message && <p className="text-sm text-emerald-600">{message}</p>}
          </div>
        </Card>
      </div>
    </div>
  )
}

/* ===== UI HELPERS ===== */

function Card({ children }: any) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sm:p-6">
      {children}
    </div>
  )
}

function Stat({ label, value, danger }: any) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
      <p className="text-[11px] tracking-wide text-gray-500 uppercase">
        {label}
      </p>
      <p className={`mt-2 text-2xl font-semibold ${
        danger ? 'text-red-600' : 'text-gray-900'
      }`}>
        {value}
      </p>
    </div>
  )
}

function Input({ label, value, onChange, disabled }: any) {
  return (
    <div>
      <label className="block text-[11px] tracking-wide text-gray-500 uppercase mb-1">
        {label}
      </label>
      <input
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded-xl border px-4 py-2.5 text-sm ${
          disabled
            ? 'bg-gray-100 text-gray-500'
            : 'border-gray-300 focus:ring-2 focus:ring-gray-900/10'
        }`}
      />
    </div>
  )
}

function Alert({ title, danger }: any) {
  return (
    <div className={`rounded-xl border px-4 py-3 flex items-center gap-2 ${
      danger ? 'border-red-300 bg-red-50' : 'border-amber-300 bg-amber-50'
    }`}>
      <AlertTriangle className={`h-4 w-4 ${
        danger ? 'text-red-600' : 'text-amber-600'
      }`} />
      <span className="text-sm font-medium text-gray-800">{title}</span>
    </div>
  )
}
